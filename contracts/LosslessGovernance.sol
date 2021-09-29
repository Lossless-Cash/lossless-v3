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
    function admin() external view returns (address);
}

interface ILssController {
    function getReportLifetime() external view returns(uint256);
    function retreiveBlacklistedFunds(address[] calldata _addresses) external;
    function resolvedNegatively(address _adr) external;
    function retrieveBlacklistedToStaking(uint256 reportId) external;
    function deactivateEmergency(address token) external;
}

interface ILERC20 {
    function admin() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
} 

/// @title Lossless Governance Contract
/// @notice The governance contract is in charge of handling the voting process over the reports and their resolution
contract LosslessGovernance is Initializable, AccessControl {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint256 public lssTeamVoteIndex;
    uint256 public tokenOwnersVoteIndex;
    uint256 public committeeVoteIndex;

    bytes32 private constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 public committeeMembersCount;
    uint256 public quorumSize;

    ILssReporting public losslessReporting;
    ILssController public losslessController;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        bool[] committeeVotes;
        bool[3] votes;
        bool[3] voted;
        bool resolved;
        bool resolution;
    }

    mapping(uint256 => Vote) reportVotes;
    mapping(address => address) projectOwners;
    mapping(uint256 => uint256) amountReported;

    address[] private reportedAddresses;

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin, address _losslessReporting, address _losslessController) public initializer {
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        pauseAdmin = _pauseAdmin;
        losslessReporting = ILssReporting(_losslessReporting);
        losslessController = ILssController(_losslessController);
        tokenOwnersVoteIndex = 1;
        committeeVoteIndex = 2;
        _setupRole(DEFAULT_ADMIN_ROLE, losslessReporting.admin());
    }

    modifier onlyLosslessAdmin() {
        require(losslessReporting.admin() == _msgSender(), "LSS: must be admin");
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
    }

    /// @notice This function emits a vote on a report by the Token Owners
    /// @dev Only can be run by the Token admin
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function tokenOwnersVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = losslessReporting.getReportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + losslessController.getReportLifetime() > block.timestamp, "LSS: report is not valid");

        require(ILERC20(losslessReporting.getTokenFromReport(reportId)).admin() == msg.sender, "LSS: must be project team");

        Vote storage reportVote;
        reportVote = reportVotes[reportId];

        require(!reportVote.voted[tokenOwnersVoteIndex], "LSS: team already voted");
        
        reportVote.voted[tokenOwnersVoteIndex] = true;
        reportVote.votes[tokenOwnersVoteIndex] = vote;
    }

    /// @notice This function emits a vote on a report by a Committee member
    /// @dev Only can be run by a committee member
    /// @param reportId Report to cast the vote
    /// @param vote Resolution
    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LSS: Caller is not member");

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
    }

    /// @notice This function solves a reported based on the voting resolution of the three pilars
    /// @dev Only can be run by the three pilars.
    /// When the report gets resolved, if it's resolved negatively, the reported address gets removed from the blacklist
    /// If the report is solved positively, the funds of the reported account get retrieved in order to be distributed among stakers and the reporter.
    /// @param reportId Report to be resolved
    function resolveReport(uint256 reportId) public {

        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == losslessReporting.admin() 
                || msg.sender == ILERC20(losslessReporting.getTokenFromReport(reportId)).admin(),
                "LSS: Role cannot resolve.");
        
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

        if (aggreeCount > (voteCount - aggreeCount)){
            reportVote.resolution = true;
            losslessController.retreiveBlacklistedFunds(reportedAddresses);
            losslessController.retrieveBlacklistedToStaking(reportId);
        }else{
            reportVote.resolution = false;
            losslessController.resolvedNegatively(reportedAddress);
        }
        
        losslessController.deactivateEmergency(losslessReporting.getTokenFromReport(reportId));
        reportVote.resolved = true;
        delete reportedAddresses;
    }
}