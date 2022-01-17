// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "hardhat/console.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessControllerV3.sol";
import "./Interfaces/ILosslessStaking.sol";
import "./Interfaces/ILosslessReporting.sol";


/// @title Lossless Governance Contract
/// @notice The governance contract is in charge of handling the voting process over the reports and their resolution
contract LosslessGovernance is Initializable, AccessControlUpgradeable, PausableUpgradeable {

    uint256 public constant lssTeamVoteIndex = 0;
    uint256 public constant tokenOwnersVoteIndex = 1;
    uint256 public constant committeeVoteIndex = 2;

    bytes32 public constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 public committeeMembersCount;

    uint256 public walletDisputePeriod;

    uint256 public erroneousCompensation;

    ILssReporting public losslessReporting;
    ILssController public losslessController;
    ILssStaking public losslessStaking;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        mapping(address => bool) committeeMemberClaimed;
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

    mapping(uint256 => bool) public losslessPayed;

    struct ProposedWallet {
        uint16 proposal;
        address wallet;
        uint256 timestamp;
        bool status;
        bool losslessVote;
        bool losslessVoted;
        bool tokenOwnersVote;
        bool tokenOwnersVoted;
        bool walletAccepted;
        uint16 committeeDisagree;
        mapping (uint16 => MemberVotesOnProposal) memberVotesOnProposal;
    }

    struct Compensation {
        uint256 amount;
        bool payed;
    }

    struct MemberVotesOnProposal {
        mapping (address => bool) memberVoted;
    }

    mapping(address => Compensation) private compensation;

    address[] private reportedAddresses;

    event NewCommitteeMembers(address[] indexed members);
    event CommitteeMembersRemoval(address[] indexed members);
    event LosslessTeamPositiveVote(uint256 indexed reportId);
    event LosslessTeamNegativeVote(uint256 indexed reportId);
    event TokenOwnersPositiveVote(uint256 indexed reportId);
    event TokenOwnersNegativeVote(uint256 indexed reportId);
    event CommitteeMemberPositiveVote(uint256 indexed reportId, address indexed member);
    event CommitteeMemberNegativeVote(uint256 indexed reportId, address indexed member);
    event ReportResolve(uint256 indexed reportId, bool indexed resolution);
    event WalletProposal(uint256 indexed reportId, address indexed wallet);
    event WalletRejection(uint256 indexed reportId, address indexed wallet);
    event FundsRetrieval(uint256 indexed reportId, address indexed wallet, uint256 indexed amount);
    event CompensationRetrieval(address indexed wallet, uint256 indexed amount);
    event LosslessClaim(address indexed token, uint256 indexed reportID, uint256 indexed amount);
    event CommitteeMemberClaim(uint256 indexed reportID, address indexed member, uint256 indexed amount);
    event CommitteeMajorityReach(uint256 indexed reportId, bool indexed result);
    event NewDisputePeriod(uint256 indexed newPeriod);

    function initialize(ILssReporting _losslessReporting, ILssController _losslessController, ILssStaking _losslessStaking) public initializer {
        losslessReporting = ILssReporting(_losslessReporting);
        losslessController = ILssController(_losslessController);
        losslessStaking = ILssStaking(_losslessStaking);
        walletDisputePeriod = 7 days;
        committeeMembersCount = 0;
        _setupRole(DEFAULT_ADMIN_ROLE, losslessController.admin());
    }

    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == msg.sender, "LSS: Must be admin");
        _;
    }

    // --- ADMINISTRATION ---

    function pause() public onlyLosslessAdmin  {
        _pause();
    }    
    
    function unpause() public onlyLosslessAdmin {
        _unpause();
    }

    
    /// @notice This function gets the contract version
    /// @return Version of the contract
    function getVersion() external pure returns (uint256) {
        return 1;
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
    function setDisputePeriod(uint256 timeFrame) public onlyLosslessAdmin whenNotPaused {
        walletDisputePeriod = timeFrame;
        emit NewDisputePeriod(walletDisputePeriod);
    }

    /// @notice This function sets the amount of tokens given to the erroneously reported address
    /// @param amount Percentage to return
    function setCompensationAmount(uint256 amount) public onlyLosslessAdmin {
        require(0 <= amount && amount <= 100, "LSS: Invalid amount");
        erroneousCompensation = amount;
    }
    
    /// @notice This function returns if the majority of the commitee voted and the resolution of the votes
    /// @param reportId Report number to be checked
    /// @return isMajorityReached result Returns True if the majority has voted and the true if the result is positive
    function _getCommitteeMajorityReachedResult(uint256 reportId) private view returns(bool isMajorityReached, bool result) {        
        Vote storage reportVote = reportVotes[reportId];
        uint256 committeeLength = reportVote.committeeVotes.length;
        uint256 committeeQuorum = (committeeMembersCount/2) + 1; 

        uint256 agreeCount;
        for(uint256 i = 0; i < committeeLength; i++) {
            if (reportVote.committeeVotes[i]) {
                agreeCount += 1;
            }
        }

        if (agreeCount >= committeeQuorum) {
            return (true, true);
        } else if ((committeeLength - agreeCount) >= committeeQuorum) {
            return (true, false);
        } else {
            return (false, false);
        }
    }

    /// @notice This function adds committee members    
    /// @param members Array of members to be added
    function addCommitteeMembers(address[] memory members) public onlyLosslessAdmin whenNotPaused {
        committeeMembersCount += members.length;

        for (uint256 i = 0; i < members.length; ++i) {
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

        for (uint256 i = 0; i < members.length; ++i) {
            require(isCommitteeMember(members[i]), "LSS: An address is not member");
            revokeRole(COMMITTEE_ROLE, members[i]);
        }

        emit CommitteeMembersRemoval(members);
    }

    /// @notice This function emits a vote on a report by the Lossless Team
    /// @dev Only can be run by the Lossless Admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function losslessVote(uint256 reportId, bool vote) public onlyLosslessAdmin whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved");
        require(isReportActive(reportId), "LSS: report is not valid");
        
        Vote storage reportVote = reportVotes[reportId];
        
        require(!reportVotes[reportId].voted[lssTeamVoteIndex], "LSS: LSS already voted");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;

        if (vote) {
            emit LosslessTeamPositiveVote(reportId);
        } else {
            emit LosslessTeamNegativeVote(reportId);
        }
    }

    /// @notice This function emits a vote on a report by the Token Owners
    /// @dev Only can be run by the Token admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function tokenOwnersVote(uint256 reportId, bool vote) public whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved");
        require(isReportActive(reportId), "LSS: report is not valid");
        require(ILERC20(losslessReporting.reportTokens(reportId)).admin() == msg.sender, "LSS: Must be token owner");

        Vote storage reportVote = reportVotes[reportId];

        require(!reportVote.voted[tokenOwnersVoteIndex], "LSS: owners already voted");
        
        reportVote.voted[tokenOwnersVoteIndex] = true;
        reportVote.votes[tokenOwnersVoteIndex] = vote;

        if (vote) {
            emit TokenOwnersPositiveVote(reportId);
        } else {
            emit TokenOwnersNegativeVote(reportId);
        }
    }

    /// @notice This function emits a vote on a report by a Committee member
    /// @dev Only can be run by a committee member
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function committeeMemberVote(uint256 reportId, bool vote) public whenNotPaused {
        require(!isReportSolved(reportId), "LSS: Report already solved");
        require(isCommitteeMember(msg.sender), "LSS: Must be a committee member");
        require(isReportActive(reportId), "LSS: report is not valid");

        Vote storage reportVote = reportVotes[reportId];

        require(!reportVote.committeeMemberVoted[msg.sender], "LSS: Member already voted");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(vote);

        (bool isMajorityReached, bool result) = _getCommitteeMajorityReachedResult(reportId);

        if (isMajorityReached) {
            reportVote.votes[committeeVoteIndex] = result;
            reportVote.voted[committeeVoteIndex] = true;
            emit CommitteeMajorityReach(reportId, result);
        }

        if (vote) {
            emit CommitteeMemberPositiveVote(reportId, msg.sender);
        } else {
            emit CommitteeMemberNegativeVote(reportId, msg.sender);
        }
    }

    /// @notice This function solves a report based on the voting resolution of the three pilars
    /// @dev Only can be run by the three pilars.
    /// When the report gets resolved, if it's resolved negatively, the reported address gets removed from the blacklist
    /// If the report is solved positively, the funds of the reported account get retrieved in order to be distributed among stakers and the reporter.
    /// @param reportId Report to be resolved
    function resolveReport(uint256 reportId) public whenNotPaused {

        require(!isReportSolved(reportId), "LSS: Report already resolved");
        
        if (losslessReporting.reportTimestamps(reportId) + losslessReporting.reportLifetime() > block.timestamp) {
            _resolveActive(reportId);
        } else {
            _resolveExpired(reportId);
        }
        
        reportVotes[reportId].resolved = true;
        delete reportedAddresses;

        emit ReportResolve(reportId, reportVotes[reportId].resolution);
    }

    /// @notice This function has the logic to solve a report that it's still active
    /// @param reportId Report to be resolved
    function _resolveActive(uint256 reportId) private {
                
        address token = losslessReporting.reportTokens(reportId);
        Vote storage reportVote = reportVotes[reportId];

        uint256 aggreeCount;
        uint256 voteCount;

        if (getIsVoted(reportId, lssTeamVoteIndex)){voteCount += 1;
        if (getVote(reportId, lssTeamVoteIndex)){ aggreeCount += 1;}}
        if (getIsVoted(reportId, tokenOwnersVoteIndex)){voteCount += 1;
        if (getVote(reportId, tokenOwnersVoteIndex)){ aggreeCount += 1;}}

        (bool committeeResoluted, bool committeeResolution) = _getCommitteeMajorityReachedResult(reportId);
        if (committeeResoluted) {voteCount += 1;
        if (committeeResolution) {aggreeCount += 1;}}

        require(voteCount >= 2, "LSS: Not enough votes");
        require(!(voteCount == 2 && aggreeCount == 1), "LSS: Need another vote to untie");

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
            _compensateAddresses(reportedAddresses);
        }
    } 

    /// @notice This function has the logic to solve a report that it's expired
    /// @param reportId Report to be resolved
    function _resolveExpired(uint256 reportId) private {
        address reportedAddress = losslessReporting.reportedAddress(reportId);

        reportedAddresses.push(reportedAddress);

        if (losslessReporting.secondReports(reportId)) {
            reportedAddresses.push(losslessReporting.secondReportedAddress(reportId));
        }

        reportVotes[reportId].resolution = false;
        _compensateAddresses(reportedAddresses);
    }

    /// @notice This compensates the addresses wrongly reported
    /// @dev The array of addresses will contain the main reported address and the second reported address
    /// @param addresses Array of addresses to be compensated
    function _compensateAddresses(address[] memory addresses) private {
        uint256 reportingAmount = losslessReporting.reportingAmount();
        
        for(uint256 i; i < addresses.length; i++) {
            losslessController.resolvedNegatively(addresses[i]);      
            compensation[addresses[i]].amount +=  (reportingAmount * erroneousCompensation) / 10**2;
            compensation[addresses[i]].payed = false;
        }
    }

    function isReportActive(uint256 reportId) public view returns(bool) {
        uint256 reportTimestamp = losslessReporting.reportTimestamps(reportId);
        return reportTimestamp != 0 && reportTimestamp + losslessReporting.reportLifetime() > block.timestamp;
    }

    // REFUND PROCESS

    /// @notice This function proposes a wallet where the recovered funds will be returned
    /// @dev Only can be run by lossless team or token owners.
    /// @param reportId Report to propose the wallet
    /// @param wallet proposed address
    function proposeWallet(uint256 reportId, address wallet) public whenNotPaused {
        require(msg.sender == losslessController.admin() || 
                msg.sender == ILERC20(losslessReporting.reportTokens(reportId)).admin(),
                "LSS: Role cannot propose");
        require(reportResolution(reportId), "LSS: Report solved negatively");
        require(wallet != address(0), "LSS: Wallet cannot ber zero adr");
        require(proposedWalletOnReport[reportId].wallet == address(0), "LSS: Wallet already proposed");

        proposedWalletOnReport[reportId].wallet = wallet;
        proposedWalletOnReport[reportId].timestamp = block.timestamp;
        proposedWalletOnReport[reportId].losslessVote = true;
        proposedWalletOnReport[reportId].tokenOwnersVote = true;
        proposedWalletOnReport[reportId].walletAccepted = true;

        emit WalletProposal(reportId, wallet);
    }

    /// @notice This function is used to reject the wallet proposal
    /// @dev Only can be run by the three pilars.
    /// @param reportId Report to propose the wallet
    function rejectWallet(uint256 reportId) public whenNotPaused {

        require(block.timestamp <= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period closed");

        bool isMember = hasRole(COMMITTEE_ROLE, msg.sender);
        bool isLosslessTeam = msg.sender == losslessController.admin();
        bool isTokenOwner = msg.sender == ILERC20(losslessReporting.reportTokens(reportId)).admin();

        require(isMember || isLosslessTeam || isTokenOwner, "LSS: Role cannot reject");

        if (isMember) {
            require(!proposedWalletOnReport[reportId].memberVotesOnProposal[proposedWalletOnReport[reportId].proposal].memberVoted[msg.sender], "LSS: Already Voted");
            proposedWalletOnReport[reportId].committeeDisagree += 1;
            proposedWalletOnReport[reportId].memberVotesOnProposal[proposedWalletOnReport[reportId].proposal].memberVoted[msg.sender] = true;
        } else if (isLosslessTeam) {
            require(!proposedWalletOnReport[reportId].losslessVoted, "LSS: Already Voted");
            proposedWalletOnReport[reportId].losslessVote = false;
            proposedWalletOnReport[reportId].losslessVoted = true;
        } else {
            require(!proposedWalletOnReport[reportId].tokenOwnersVoted, "LSS: Already Voted");
            proposedWalletOnReport[reportId].tokenOwnersVote = false;
            proposedWalletOnReport[reportId].tokenOwnersVoted = true;
        }

        _determineProposedWallet(reportId);

        emit WalletRejection(reportId, proposedWalletOnReport[reportId].wallet);
    }

    /// @notice This function retrieves the fund to the accepted proposed wallet
    /// @param reportId Report to propose the wallet
    function retrieveFunds(uint256 reportId) public whenNotPaused {
        require(block.timestamp >= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period not closed");
        require(!proposedWalletOnReport[reportId].status, "LSS: Funds already claimed");
        require(proposedWalletOnReport[reportId].walletAccepted, "LSS: Wallet rejected");
        require(proposedWalletOnReport[reportId].wallet == msg.sender, "LSS: Only proposed adr can claim");

        proposedWalletOnReport[reportId].status = true;

        ILERC20(losslessReporting.reportTokens(reportId)).transfer(msg.sender, retrievalAmount[reportId]);

        emit FundsRetrieval(reportId, msg.sender, retrievalAmount[reportId]);
    }

    /// @notice This function determins if the refund wallet was accepted
    /// @param reportId Report to propose the wallet
    function _determineProposedWallet(uint256 reportId) private returns(bool){
        
        uint256 agreementCount;
        
        if (proposedWalletOnReport[reportId].committeeDisagree < (committeeMembersCount/2)+1 ){
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
        proposedWalletOnReport[reportId].walletAccepted = false;
        proposedWalletOnReport[reportId].committeeDisagree = 0;
        proposedWalletOnReport[reportId].proposal += 1;

        return false;
    }

    /// @notice This lets an erroneously reported account to retrieve compensation
    function retrieveCompensation() public whenNotPaused {
        require(!compensation[msg.sender].payed, "LSS: Already retrieved");
        require(compensation[msg.sender].amount > 0, "LSS: No retribution assigned");
        
        compensation[msg.sender].payed = true;

        losslessReporting.retrieveCompensation(msg.sender, compensation[msg.sender].amount);

        emit CompensationRetrieval(msg.sender, compensation[msg.sender].amount);

        compensation[msg.sender].amount = 0;

    }

    ///@notice This function is for committee members to claim their rewards
    ///@param reportId report ID to claim reward from
    function claimCommitteeReward(uint256 reportId) public whenNotPaused {
        require(reportResolution(reportId), "LSS: Report solved negatively");
        require(reportVotes[reportId].committeeMemberVoted[msg.sender], "LSS: Did not vote on report");
        require(!reportVotes[reportId].committeeMemberClaimed[msg.sender], "LSS: Already claimed");

        uint256 numberOfMembersVote = reportVotes[reportId].committeeVotes.length;
        uint256 committeeReward = losslessReporting.committeeReward();

        uint256 compensationPerMember = (amountReported[reportId] * committeeReward /  10**2) / numberOfMembersVote;

        address token = losslessReporting.reportTokens(reportId);

        reportVotes[reportId].committeeMemberClaimed[msg.sender] = true;

        ILERC20(token).transfer(msg.sender, compensationPerMember);

        emit CommitteeMemberClaim(reportId, msg.sender, compensationPerMember);
    }

    
    /// @notice This function is for the Lossless to claim the rewards
    /// @param reportId report worked on
    function losslessClaim(uint256 reportId) public whenNotPaused onlyLosslessAdmin {
        require(reportResolution(reportId), "LSS: Report solved negatively");   
        require(!losslessPayed[reportId], "LSS: Already claimed");

        uint256 amountToClaim = amountReported[reportId] * losslessReporting.losslessReward() / 10**2;
        losslessPayed[reportId] = true;
        ILERC20(losslessReporting.reportTokens(reportId)).transfer(losslessController.admin(), amountToClaim);

        emit LosslessClaim(losslessReporting.reportTokens(reportId), reportId, amountToClaim);
    }

}