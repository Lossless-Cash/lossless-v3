// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "hardhat/console.sol";

interface ILssReporting {
    function reportTimestamps(uint256 reportId) external view returns (uint256);
    function reportedAddress(uint256 _reportId) external view returns (address);
    function reportTokens(uint256 reportId) external view returns(address);
    function secondReportedAddress(uint256 reportId) external view returns (address);
    function secondReports(uint256 reportId) external view returns (bool);
    function reportLifetime() external view returns(uint256);
    function getFees() external view returns (uint256 reporter, uint256 lossless, uint256 committee, uint256 stakers);
}

interface ILssController {
    function retrieveBlacklistedFunds(address[] calldata _addresses, address token, uint256 reportId) external returns(uint256);
    function resolvedNegatively(address _adr) external;
    function deactivateEmergency(address token) external;
    function admin() external view returns (address);
    function erroneousCompensation() external view returns (uint256);
}

interface ILssStaking {
    function retrieveCompensation(address adr, uint256 amount) external;
    function stakingAmount() external view returns (uint256);
}

interface ILERC20 {
    function admin() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
} 

/// @title Lossless Governance Contract
/// @notice The governance contract is in charge of handling the voting process over the reports and their resolution
contract LosslessGovernance is Initializable, AccessControlUpgradeable, PausableUpgradeable {

    uint256 public lssTeamVoteIndex;
    uint256 public tokenOwnersVoteIndex;
    uint256 public committeeVoteIndex;

    bytes32 private constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 public committeeMembersCount;

    uint256 public walletDisputePeriod;

    ILssReporting public losslessReporting;
    ILssController public losslessController;
    ILssStaking public losslessStaking;
    ILERC20 public losslessToken;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        bool[] committeeVotes;
        bool[3] votes;
        bool[3] voted;
        bool resolved;
        bool resolution;
    }

    mapping(uint256 => Vote) public reportVotes;
    mapping(uint256 => uint256) public amountReported;
    mapping(uint256 => uint256) private retrievalAmount;

    mapping(uint256 => ProposedWallet) public proposedWalletOnReport;

    struct ProposedWallet {
        address wallet;
        uint256 timestamp;
        bool status;
        bool losslessVote;
        bool losslessVoted;
        bool tokenOwnersVote;
        bool tokenOwnersVoted;
        uint16 committeeDisagree;
        mapping (address => bool) memberVoted;
    }

    struct Compensation {
        uint256 amount;
        bool payed;
    }

    mapping(address => Compensation) private compensation;

    address[] private reportedAddresses;

    event NewCommitteeMembers(address[] indexed members);
    event CommitteeMembersRemoved(address[] indexed members);
    event LosslessTeamVoted(uint256 indexed reportId, bool indexed vote);
    event TokenOwnersVoted(uint256 indexed reportId, bool indexed vote);
    event CommitteeMemberVoted(uint256 indexed reportId, address indexed member, bool indexed vote);
    event ReportResolved(uint256 indexed reportId, bool indexed resolution);
    event WalletProposed(uint256 indexed reportId, address indexed wallet);
    event WalletRejected(uint256 indexed reportId, address indexed wallet);
    event FundsRetrieved(uint256 indexed reportId, address indexed wallet);
    event CompensationRetrieved(address indexed wallet);


    function initialize(address _losslessReporting, address _losslessController, address _losslessStaking, address _losslessToken) public initializer {
        losslessReporting = ILssReporting(_losslessReporting);
        losslessController = ILssController(_losslessController);
        losslessStaking = ILssStaking(_losslessStaking);
        losslessToken = ILERC20(_losslessToken);
        walletDisputePeriod = 7 days;
        tokenOwnersVoteIndex = 1;
        committeeVoteIndex = 2;
        _setupRole(DEFAULT_ADMIN_ROLE, losslessController.admin());
    }

    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == msg.sender, "LSS: must be admin");
        _;
    }

    // --- ADMINISTRATION ---

    function pause() public onlyLosslessAdmin  {
        _pause();
    }    
    
    function unpause() public onlyLosslessAdmin {
        _unpause();
    }


    /// @notice This function determines if an address belongs to the Committee
    /// @param account Address to be verified
    /// @return True if the address is a committee member
    function isCommitteeMember(address account) public view returns(bool) {
        return hasRole(COMMITTEE_ROLE, account);
    }

    /// @notice This function returns if a report has been voted by one of the three fundamental parts
    /// @param reportId Report number to be checked
    /// @param voterIndex Voter Index to be checked
    /// @return True if it has been voted
    function getIsVoted(uint256 reportId, uint256 voterIndex) public view returns(bool) {
        return reportVotes[reportId].voted[voterIndex];
    }

    /// @notice This function returns the resolution on a report by a team 
    /// @param reportId Report number to be checked
    /// @param voterIndex Voter Index to be checked
    /// @return True if it has voted
    function getVote(uint256 reportId, uint256 voterIndex) public view returns(bool) {
        return reportVotes[reportId].votes[voterIndex];
    }

    /// @notice This function returns if report has been resolved    
    /// @param reportId Report number to be checked
    /// @return True if it has been solved
    function isReportSolved(uint256 reportId) public view returns(bool){
        return reportVotes[reportId].resolved;
    }

    /// @notice This function returns report resolution     
    /// @param reportId Report number to be checked
    /// @return True if it has been resolved positively
    function reportResolution(uint256 reportId) public view returns(bool){
        return reportVotes[reportId].resolution;
    }

    /// @notice This function sets the wallet dispute period
    /// @param timeFrame Time in seconds for the dispute period
    function setDisputePeriod(uint256 timeFrame) public onlyLosslessAdmin {
        walletDisputePeriod = timeFrame;
    }
    
    /// @notice This function returns if the majority of the commitee voted and the resolution of the votes
    /// @param reportId Report number to be checked
    /// @return isMajorityReached result Returns True if the majority has voted and the true if the result is positive
    function _getCommitteeMajorityReachedResult(uint256 reportId) private view returns(bool isMajorityReached, bool result) {        
        Vote storage reportVote = reportVotes[reportId];

        uint256 agreeCount;
        for(uint256 i; i < reportVote.committeeVotes.length; i++) {
            if (reportVote.committeeVotes[i]) {
                agreeCount += 1;
            }
        }
        if (agreeCount > (committeeMembersCount / 2)) {
            return (true, true);
        }

        uint256 disagreeCount = reportVote.committeeVotes.length - agreeCount;
        if (disagreeCount > (committeeMembersCount / 2)) {
            return (true, false);
        }

        return (false, false);
    }

    /// @notice This function adds committee members    
    /// @param members Array of members to be added
    function addCommitteeMembers(address[] memory members) public onlyLosslessAdmin whenNotPaused {
        committeeMembersCount += members.length;

        for (uint256 i; i < members.length; ++i) {
            require(!isCommitteeMember(members[i]), "LSS: duplicate members");
            grantRole(COMMITTEE_ROLE, members[i]);
        }

        emit NewCommitteeMembers(members);
    } 

    /// @notice This function removes Committee members    
    /// @param members Array of members to be added
    function removeCommitteeMembers(address[] memory members) public onlyLosslessAdmin whenNotPaused {  
        require(committeeMembersCount != 0, "LSS: committee has no members");

        committeeMembersCount -= members.length;

        for (uint256 i; i < members.length; ++i) {
            require(isCommitteeMember(members[i]), "LSS: An address is not member");
            revokeRole(COMMITTEE_ROLE, members[i]);
        }

        emit CommitteeMembersRemoved(members);
    }

    /// @notice This function emits a vote on a report by the Lossless Team
    /// @dev Only can be run by the Lossless Admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function losslessVote(uint256 reportId, bool vote) public onlyLosslessAdmin whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = losslessReporting.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessReporting.reportLifetime() > block.timestamp, "LSS: report is not valid");
        
        Vote storage reportVote = reportVotes[reportId];
        
        require(!reportVotes[reportId].voted[lssTeamVoteIndex], "LSS: LSS already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;

        emit LosslessTeamVoted(reportId, vote);
    }

    /// @notice This function emits a vote on a report by the Token Owners
    /// @dev Only can be run by the Token admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function tokenOwnersVote(uint256 reportId, bool vote) public whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = losslessReporting.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessReporting.reportLifetime() > block.timestamp, "LSS: report is not valid");

        require(ILERC20(losslessReporting.reportTokens(reportId)).admin() == msg.sender, "LSS: must be token owner");

        Vote storage reportVote = reportVotes[reportId];

        require(!reportVote.voted[tokenOwnersVoteIndex], "LSS: owners already voted");
        
        reportVote.voted[tokenOwnersVoteIndex] = true;
        reportVote.votes[tokenOwnersVoteIndex] = vote;

        emit TokenOwnersVoted(reportId, vote);
    }

    /// @notice This function emits a vote on a report by a Committee member
    /// @dev Only can be run by a committee member
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function committeeMemberVote(uint256 reportId, bool vote) public whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LSS: must be a committee member");

        uint256 reportTimestamp = losslessReporting.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessReporting.reportLifetime() > block.timestamp, "LSS: report is not valid");

        Vote storage reportVote = reportVotes[reportId];

        require(!reportVote.committeeMemberVoted[msg.sender], "LSS: Member already voted.");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(vote);

        (bool isMajorityReached, bool result) = _getCommitteeMajorityReachedResult(reportId);

        if (isMajorityReached) {
            reportVote.votes[committeeVoteIndex] = result;
            reportVote.voted[committeeVoteIndex] = true;
        }

        emit CommitteeMemberVoted(reportId, msg.sender, vote);
    }

    /// @notice This function solves a reported based on the voting resolution of the three pilars
    /// @dev Only can be run by the three pilars.
    /// When the report gets resolved, if it's resolved negatively, the reported address gets removed from the blacklist
    /// If the report is solved positively, the funds of the reported account get retrieved in order to be distributed among stakers and the reporter.
    /// @param reportId Report to be resolved
    function resolveReport(uint256 reportId) public whenNotPaused {

        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == losslessController.admin() 
                || msg.sender == ILERC20(losslessReporting.reportTokens(reportId)).admin(),
                "LSS: Role cannot resolve.");
        
        address token = losslessReporting.reportTokens(reportId);

        Vote storage reportVote = reportVotes[reportId];

        require(!isReportSolved(reportId), "LSS: Report already resolved");

        uint256 aggreeCount;
        uint256 voteCount;

        if (getIsVoted(reportId, lssTeamVoteIndex)){voteCount += 1;
        if (getVote(reportId, lssTeamVoteIndex)){ aggreeCount += 1;}}
        if (getIsVoted(reportId, tokenOwnersVoteIndex)){voteCount += 1;
        if (getVote(reportId, tokenOwnersVoteIndex)){ aggreeCount += 1;}}

        if (voteCount == 1 || (voteCount + aggreeCount) % 2 != 0) {
            (bool committeeResoluted, bool committeeResolution) = _getCommitteeMajorityReachedResult(reportId);
            if (committeeResoluted) {voteCount += 1;
            if (committeeResolution) {aggreeCount += 1;}}
        }

        require(voteCount >= 2, "LSS: Not enough votes");
        require(!(voteCount == 2 && aggreeCount == 1), "LSS: Need anothe vote to untie");
        
        address reportedAddress = losslessReporting.reportedAddress(reportId);

        reportedAddresses.push(reportedAddress);

        if (losslessReporting.secondReports(reportId)) {
            reportedAddresses.push(losslessReporting.secondReportedAddress(reportId));
        }

        if (aggreeCount > (voteCount - aggreeCount)){
            reportVote.resolution = true;
            for(uint256 i; i < reportedAddresses.length; i++) {
                amountReported[reportId] += ILERC20(token).balanceOf(reportedAddresses[i]);
            }
            retrievalAmount[reportId] = losslessController.retrieveBlacklistedFunds(reportedAddresses, token, reportId);
            losslessController.deactivateEmergency(token);
        }else{
            reportVote.resolution = false;
            compensateAddresses(reportedAddresses);
        }
        
        reportVote.resolved = true;
        delete reportedAddresses;

        emit ReportResolved(reportId, reportVote.resolution);
    }

    /// @notice This compensates the addresses wrongly reported
    /// @dev The array of addresses will contain the main reported address and the second reported address
    /// @param addresses Array of addresses to be compensated
    function compensateAddresses(address[] memory addresses) internal {
        uint256 compensationAmount = losslessController.erroneousCompensation();
        uint256 stakingAmount = losslessStaking.stakingAmount();
        
        for(uint256 i; i < addresses.length; i++) {
            losslessController.resolvedNegatively(addresses[i]);      
            compensation[addresses[i]].amount +=  (stakingAmount * compensationAmount) / 10**2;
            compensation[addresses[i]].payed =  false;
        }
    }

    // REFUND PROCESS

    /// @notice This function proposes a wallet where the recovered funds will be returned
    /// @dev Only can be run by the three pilars.
    /// @param reportId Report to propose the wallet
    /// @param wallet proposed address
    function proposeWallet(uint256 reportId, address wallet) public whenNotPaused {
        require(msg.sender == losslessController.admin() || 
                msg.sender == ILERC20(losslessReporting.reportTokens(reportId)).admin(),
                "LSS: Role cannot propose.");
        require(isReportSolved(reportId), "LSS: Report is not solved.");
        require(reportResolution(reportId), "LSS: Report solved negatively.");
        require(proposedWalletOnReport[reportId].wallet == address(0), "LSS: Wallet already proposed.");

        proposedWalletOnReport[reportId].wallet = wallet;
        proposedWalletOnReport[reportId].timestamp = block.timestamp;
        proposedWalletOnReport[reportId].losslessVote = true;
        proposedWalletOnReport[reportId].tokenOwnersVote = true;

        emit WalletProposed(reportId, wallet);
    }

    /// @notice This function is used to reject the wallet proposal
    /// @dev Only can be run by the three pilars.
    /// @param reportId Report to propose the wallet
    function rejectWallet(uint256 reportId) public whenNotPaused {

        require(block.timestamp <= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period closed");

        bool isMember = hasRole(COMMITTEE_ROLE, msg.sender);
        bool isLosslessTeam = msg.sender == losslessController.admin();
        bool isTokenOwner = msg.sender == ILERC20(losslessReporting.reportTokens(reportId)).admin();

        require(isMember || isLosslessTeam || isTokenOwner, "LSS: Role cannot resolve.");

        if (isMember) {
            require(!proposedWalletOnReport[reportId].memberVoted[msg.sender], "LSS: Already Voted.");
            proposedWalletOnReport[reportId].committeeDisagree += 1;
            proposedWalletOnReport[reportId].memberVoted[msg.sender] = true;
        } else if (isLosslessTeam) {
            require(!proposedWalletOnReport[reportId].losslessVoted, "LSS: Already Voted.");
            proposedWalletOnReport[reportId].losslessVote = false;
            proposedWalletOnReport[reportId].losslessVoted = true;
        } else {
            require(!proposedWalletOnReport[reportId].tokenOwnersVoted, "LSS: Already Voted.");
            proposedWalletOnReport[reportId].tokenOwnersVote = false;
            proposedWalletOnReport[reportId].tokenOwnersVoted = true;
        }

        emit WalletRejected(reportId, proposedWalletOnReport[reportId].wallet);
    }

    /// @notice This function retrieves the fund to the accepted proposed wallet
    /// @param reportId Report to propose the wallet
    function retrieveFunds(uint256 reportId) public whenNotPaused {
        require(msg.sender != address(0), "LERC20: Cannot be zero address");
        require(block.timestamp >= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period not closed");
        require(!proposedWalletOnReport[reportId].status, "LSS: Funds already claimed");

        require(proposedWalletOnReport[reportId].wallet == msg.sender, "LSS: Only proposed adr can claim");

        require(_determineProposedWallet(reportId), "LSS: Proposed wallet rejected");

        proposedWalletOnReport[reportId].status = true;

        ILERC20(losslessReporting.reportTokens(reportId)).transfer(msg.sender, retrievalAmount[reportId]);

        emit FundsRetrieved(reportId, msg.sender);
    }

    /// @notice This function determins is the refund wallet was accepted
    /// @param reportId Report to propose the wallet
    function _determineProposedWallet(uint256 reportId) private returns(bool){
        
        uint256 agreementCount;
        
        if (proposedWalletOnReport[reportId].committeeDisagree < committeeMembersCount/2 ){
            agreementCount += 1;
        }

        if (proposedWalletOnReport[reportId].losslessVote) {
            agreementCount += 1;
        }

        if (proposedWalletOnReport[reportId].tokenOwnersVote) {
            agreementCount += 1;
        }
        
        if (agreementCount >= 2) {
            return true;
        }

        proposedWalletOnReport[reportId].wallet = address(0);
        proposedWalletOnReport[reportId].timestamp = block.timestamp;
        proposedWalletOnReport[reportId].status = false;
        proposedWalletOnReport[reportId].losslessVote = true;
        proposedWalletOnReport[reportId].losslessVoted = false;
        proposedWalletOnReport[reportId].tokenOwnersVote = true;
        proposedWalletOnReport[reportId].tokenOwnersVoted = false;

        return false;
    }

    /// @notice This lets an erroneously reported account to retrieve compensation
    function retrieveCompensation() public whenNotPaused {
        require(!compensation[msg.sender].payed, "LSS: Already retrieved");
        require(compensation[msg.sender].amount > 0, "LSS: No retribution assigned");
        
        compensation[msg.sender].payed = true;

        losslessStaking.retrieveCompensation(msg.sender, compensation[msg.sender].amount);

        compensation[msg.sender].amount = 0;

        emit CompensationRetrieved(msg.sender);
    }

    ///@notice This function is for committee members to claim their rewards
    ///@param reportId report ID to claim reward from
    function claimCommitteeReward(uint256 reportId) public {
        require(isReportSolved(reportId), "LSS: Report is not solved.");
        require(isCommitteeMember(msg.sender), "LSS: Must be committee member");
        require(reportVotes[reportId].committeeMemberVoted[msg.sender], "LSS: Did not vote on report");

        uint256 numberOfMembersVote = reportVotes[reportId].committeeVotes.length;
        (,,uint256 committeeFee,) = losslessReporting.getFees();
        uint256 compensationPerMember = (retrievalAmount[reportId] * committeeFee /  10**2) / numberOfMembersVote;

        address token = losslessReporting.reportTokens(reportId);

        ILERC20(token).transfer(msg.sender, compensationPerMember);
    }
}