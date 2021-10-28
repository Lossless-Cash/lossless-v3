// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

interface ILssReporting {
    function getReportTimestamps(uint256 reportId) external view returns (uint256);
    function getReportedAddress(uint256 _reportId) external view returns (address);
    function getTokenFromReport(uint256 reportId) external view returns(address);
    function reportedProject(uint256 reportId) external view returns (address);
    function getStakersFee() external view returns (uint256);
    function getAmountReported(uint256 reportId) external view returns (uint256);
    function getReporterRewardAndLSSFee() external view returns (uint256 reward, uint256 fee);
}

interface ILssController {
    function getReportLifetime() external view returns(uint256);
    function retreiveBlacklistedFunds(address[] calldata _addresses, address token) external;
    function resolvedNegatively(address _adr) external;
    function retrieveBlacklistedToContracts(uint256 reportId, address token) external;
    function deactivateEmergency(address token) external;
    function admin() external view returns (address);
    function pauseAdmin() external view returns (address);
    function recoveryAdmin() external view returns (address);
    function getCompensationPercentage() external view returns (uint256);
}

interface ILssStaking {
    function getTotalStaked(uint256 reportId) external view returns (uint256);
    function retrieveCompensation(address adr, uint256 amount) external;
}

interface ILERC20 {
    function admin() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
} 

/// @title Lossless Governance Contract
/// @notice The governance contract is in charge of handling the voting process over the reports and their resolution
contract LosslessGovernance is Initializable, AccessControl {

    uint256 public lssTeamVoteIndex;
    uint256 public tokenOwnersVoteIndex;
    uint256 public committeeVoteIndex;

    bytes32 private constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 public committeeMembersCount;
    uint256 public quorumSize;

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
    mapping(address => address) public projectOwners;
    mapping(uint256 => uint256) public amountReported;

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

    /// @notice This function returns if a committee member has voted    
    /// @param reportId Report number to be checked
    /// @param account Address of the committee member
    /// @return True if the member has voted
    function getIsCommitteeMemberVoted(uint256 reportId, address account) public view returns(bool) {
        return reportVotes[reportId].committeeMemberVoted[account];
    }

    /// @notice This function returns the resolution on a report by a team 
    /// @param reportId Report number to be checked
    /// @param voterIndex Voter Index to be checked
    /// @return True if it has voted
    function getVote(uint256 reportId, uint256 voterIndex) public view returns(bool) {
        return reportVotes[reportId].votes[voterIndex];
    }

    /// @notice This function returns number of votes made by the committee
    /// @param reportId Report number to be checked
    /// @return Number of votes made by the committee
    function getCommitteeVotesCount(uint256 reportId) public view returns(uint256) {
        return reportVotes[reportId].committeeVotes.length;
    }

    /// @notice This function returns if report has been resolved    
    /// @param reportId Report number to be checked
    /// @return True if it has been solved
    function isReportSolved(uint256 reportId) public view returns(bool){
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        return reportVote.resolved;
    }

    /// @notice This function returns report resolution     
    /// @param reportId Report number to be checked
    /// @return True if it has been resolved positively
    function reportResolution(uint256 reportId) public view returns(bool){
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        return reportVote.resolution;
    }

    /// @notice This function sets the wallet dispute period
    /// @param timeFrame Time in seconds for the dispute period
    function setDipustePeriod(uint256 timeFrame) public onlyLosslessAdmin {
        walletDisputePeriod = timeFrame;
    }
    
    /// @notice This function returns if the majority of the commitee voted and the resolution of the votes
    /// @param reportId Report number to be checked
    /// @return isMajorityReached result Returns True if the majority has voted and the true if the result is positive
    function getCommitteeMajorityReachedResult(uint256 reportId) private view returns(bool isMajorityReached, bool result) {        
        Vote storage reportVote;
        reportVote = reportVotes[reportId];

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
    /// @param newQuorum New quorum number, based on the members
    function addCommitteeMembers(address[] memory members, uint256 newQuorum) public onlyLosslessAdmin  {
        
        require(newQuorum > 0, "LSS: Quorum cannot be zero");

        committeeMembersCount += members.length;
        quorumSize = newQuorum;

        //_updateQuorum(committeeMembersCount);

        for (uint256 i; i < members.length; ++i) {
            require(!isCommitteeMember(members[i]), "LSS: duplicate members");
            grantRole(COMMITTEE_ROLE, members[i]);
        }

        emit NewCommitteeMembers(members);
    } 

    /// @notice This function removes Committee members    
    /// @param members Array of members to be added
    /// @param newQuorum New quorum number, based on the members
    function removeCommitteeMembers(address[] memory members, uint256 newQuorum) public onlyLosslessAdmin  {
        
        require(committeeMembersCount != 0, "LSS: committee has no members");
        require(newQuorum > 0, "LSS: Quorum cannot be zero");

        committeeMembersCount -= members.length;
        quorumSize = newQuorum;

        //_updateQuorum(committeeMembersCount);

        for (uint256 i; i < members.length; ++i) {
            require(isCommitteeMember(members[i]), "LSS: An address is not member");
            revokeRole(COMMITTEE_ROLE, members[i]);
        }

        emit CommitteeMembersRemoved(members);
    }

    /// @notice This function automatically updates the quorum number
    /// @dev Not yet implemented
    /// @param _newTeamSize Size of the committee 
    function _updateQuorum(uint256 _newTeamSize) private {
        if (_newTeamSize != 0) {
            quorumSize = ((_newTeamSize/2)+1);
        } else {
            delete quorumSize;
        }
    }

    /// @notice This function emits a vote on a report by the Lossless Team
    /// @dev Only can be run by the Lossless Admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function losslessVote(uint256 reportId, bool vote) public onlyLosslessAdmin {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = losslessReporting.getReportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessController.getReportLifetime() > block.timestamp, "LSS: report is not valid");
        
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        
        require(!reportVotes[reportId].voted[lssTeamVoteIndex], "LSS: LSS already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;

        emit LosslessTeamVoted(reportId, vote);
    }

    /// @notice This function emits a vote on a report by the Token Owners
    /// @dev Only can be run by the Token admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function tokenOwnersVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = losslessReporting.getReportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessController.getReportLifetime() > block.timestamp, "LSS: report is not valid");

        require(ILERC20(losslessReporting.getTokenFromReport(reportId)).admin() == msg.sender, "LSS: must be token owner");

        Vote storage reportVote;
        reportVote = reportVotes[reportId];

        require(!reportVote.voted[tokenOwnersVoteIndex], "LSS: owners already voted");
        
        reportVote.voted[tokenOwnersVoteIndex] = true;
        reportVote.votes[tokenOwnersVoteIndex] = vote;

        emit TokenOwnersVoted(reportId, vote);
    }

    /// @notice This function emits a vote on a report by a Committee member
    /// @dev Only can be run by a committee member
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LSS: must be a committee member");

        uint256 reportTimestamp = losslessReporting.getReportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessController.getReportLifetime() > block.timestamp, "LSS: report is not valid");

        Vote storage reportVote;
        reportVote = reportVotes[reportId];

        require(!reportVote.committeeMemberVoted[msg.sender], "LSS: Member already voted.");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(vote);

        (bool isMajorityReached, bool result) = getCommitteeMajorityReachedResult(reportId);

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
    function resolveReport(uint256 reportId) public {

        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == losslessController.admin() 
                || msg.sender == ILERC20(losslessReporting.getTokenFromReport(reportId)).admin(),
                "LSS: Role cannot resolve.");
        
        address token;
        token = losslessReporting.getTokenFromReport(reportId);

        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        require(!isReportSolved(reportId), "LSS: Report already resolved");

        uint256 aggreeCount;
        uint256 voteCount;

        if (getIsVoted(reportId, lssTeamVoteIndex)){voteCount += 1;
        if (getVote(reportId, lssTeamVoteIndex)){ aggreeCount += 1;}}
        if (getIsVoted(reportId, tokenOwnersVoteIndex)){voteCount += 1;
        if (getVote(reportId, tokenOwnersVoteIndex)){ aggreeCount += 1;}}

        (bool comitteeResoluted, bool committeeResolution) = getCommitteeMajorityReachedResult(reportId);
        require(comitteeResoluted, "LSS: Committee resolve pending");

        voteCount += 1;

        if (committeeResolution) {
            aggreeCount += 1;
        }

        require(voteCount > 2, "LSS: Not enough votes");
        
        address reportedAddress;
        reportedAddress = losslessReporting.getReportedAddress(reportId);

        reportedAddresses.push(reportedAddress);

        losslessController.deactivateEmergency(token);
        
        if (aggreeCount > (voteCount - aggreeCount)){
            reportVote.resolution = true;
            losslessController.retreiveBlacklistedFunds(reportedAddresses, token);
            losslessController.retrieveBlacklistedToContracts(reportId, token);
        }else{
            reportVote.resolution = false;
            losslessController.resolvedNegatively(reportedAddress);

            uint256 compensationAmount = losslessController.getCompensationPercentage();
            compensation[reportedAddress].amount +=  (losslessStaking.getTotalStaked(reportId) * compensationAmount) / 10**2;
            compensation[reportedAddress].payed =  false;
        }
        
        reportVote.resolved = true;
        delete reportedAddresses;

        emit ReportResolved(reportId, reportVote.resolution);
    }

    // REFUND PROCESS

    /// @notice This function proposes a wallet where the recovered funds will be returned
    /// @dev Only can be run by the three pilars.
    /// @param reportId Report to propose the wallet
    /// @param wallet proposed address
    function proposeWallet(uint256 reportId, address wallet) public {
        require(msg.sender == losslessController.admin() || 
                msg.sender == ILERC20(losslessReporting.getTokenFromReport(reportId)).admin(),
                "LSS: Role cannot propose.");
        require(isReportSolved(reportId), "LSS: Report is not solved.");
        require(reportResolution(reportId), "LSS: Report solved negatively.");
        require(proposedWalletOnReport[reportId].wallet == address(0), "LSS: Wallet already proposed.");

        proposedWalletOnReport[reportId].wallet = wallet;
        proposedWalletOnReport[reportId].timestamp = block.timestamp;
        proposedWalletOnReport[reportId].status = false;
        proposedWalletOnReport[reportId].losslessVote = true;
        proposedWalletOnReport[reportId].losslessVoted = false;
        proposedWalletOnReport[reportId].tokenOwnersVote = true;
        proposedWalletOnReport[reportId].tokenOwnersVoted = false;

        emit WalletProposed(reportId, wallet);
    }

    /// @notice This function is used to reject the wallet proposal
    /// @dev Only can be run by the three pilars.
    /// @param reportId Report to propose the wallet
    function rejectWallet(uint256 reportId) public {

        require(block.timestamp <= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period closed");

        bool isMember = hasRole(COMMITTEE_ROLE, msg.sender);
        bool isLosslessTeam = msg.sender == losslessController.admin();
        bool isTokenOwner = msg.sender == ILERC20(losslessReporting.getTokenFromReport(reportId)).admin();

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

    /// @notice This function proposes a wallet where the recovered funds will be returned
    /// @param reportId Report to propose the wallet
    function retrieveFunds(uint256 reportId) public {
 
        require(block.timestamp >= (proposedWalletOnReport[reportId].timestamp + walletDisputePeriod), "LSS: Dispute period not closed");
        require(!proposedWalletOnReport[reportId].status, "LSS: Funds already claimed");

        address proposedAddress = proposedWalletOnReport[reportId].wallet;
        require(proposedAddress == msg.sender, "LSS: Only proposed adr can claim");

        require(determineProposedWallet(reportId), "LSS: Proposed wallet rejected");

        address token;
        token = losslessReporting.getTokenFromReport(reportId);

        uint256 rewardAmounts;
        uint256 totalAmount;
        
        totalAmount = losslessReporting.getAmountReported(reportId);

        (uint256 reporterReward, uint256 losslessFee) = losslessReporting.getReporterRewardAndLSSFee();

        rewardAmounts = totalAmount * (losslessReporting.getStakersFee() + reporterReward + losslessFee) / 10**2;

        proposedWalletOnReport[reportId].status = true;
        
        ILERC20(token).transfer(msg.sender, totalAmount - rewardAmounts);

        emit FundsRetrieved(reportId, msg.sender);
    }

    /// @notice This function determins is the refund wallet was accepted
    /// @param reportId Report to propose the wallet
    function determineProposedWallet(uint256 reportId) private returns(bool){
        
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
    function retrieveCompensation() public {
        require(!compensation[msg.sender].payed, "LSS: Already retrieved");
        require(compensation[msg.sender].amount > 0, "LSS: No retribution assigned");
        
        compensation[msg.sender].payed = true;

        losslessStaking.retrieveCompensation(msg.sender, compensation[msg.sender].amount);

        compensation[msg.sender].amount = 0;

        emit CompensationRetrieved(msg.sender);
    }
}