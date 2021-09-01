// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

interface LosslessController {
    // Checks if not over and checks if exists
    function reportedProject(uint256 reportId) external view returns (address);
    function admin() external view returns (address);
    function reportTimestamps(uint256 reportId) external view returns (uint256);
    function reportLifetime() external view returns(uint256);
    function reportTokens(uint256 reportId) external view returns(address);
}

// [ ] set project team
// [ ] set lossless team
// [ ] set commitee members
// [ ] set losslessController


interface LERC20 {
    function admin() external view returns (address);
} 

contract LosslessGovernance is AccessControl {
    bytes32 private constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");
    uint8 public lssTeamVoteIndex = 0;
    uint8 public projectTeamVoteIndex = 1;
    uint8 public committeeVoteIndex = 2;

    LosslessController public controller;
    uint256 public committeeMembersCount = 0;
    uint256 public quorumSize = 0;
    mapping(address => address) projectOwners;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        bool[] committeeVotes;
        bool[3] votes;
        bool[3] voted;
        bool resolved;
        bool resolution;
    }

    mapping(uint256 => Vote) reportVotes;

    constructor(address _controller) {
        controller = LosslessController(_controller);
        _setupRole(DEFAULT_ADMIN_ROLE, controller.admin());
    }

    modifier onlyLosslessAdmin() {
        require(controller.admin() == _msgSender(), "LSS: must be admin");
        _;
    }

    function isCommitteeMember(address account) public view returns(bool) {
        return hasRole(COMMITTEE_ROLE, account);
    }

    function getCommitteeMajorityReachedResult(uint256 reportId) private view returns(bool isMajorityReached, bool result) {        
        Vote storage reportVote = reportVotes[reportId];

        uint256 agreeCount = 0;
        for(uint256 i = 0; i < reportVote.committeeVotes.length; i++) {
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

    function getIsVoted(uint256 reportId, uint8 voterIndex) public view returns(bool) {
        return reportVotes[reportId].voted[voterIndex];
    }

    function getIsCommitteeMemberVoted(uint256 reportId, address account) public view returns(bool) {
        return reportVotes[reportId].committeeMemberVoted[account];
    }

    function getVote(uint256 reportId, uint8 voterIndex) public view returns(bool) {
        return reportVotes[reportId].votes[voterIndex];
    }

    function getCommitteeVotesCount(uint256 reportId) public view returns(uint256) {
        return reportVotes[reportId].committeeVotes.length;
    }

    //Returns if report has been resolved
    function isReportSolved(uint256 reportId) public view returns(bool){
        Vote storage reportVote = reportVotes[reportId];
        return reportVote.resolved;
    }

    //Returns report resolution
    function reportResolution(uint256 reportId) public view returns(bool){
        Vote storage reportVote = reportVotes[reportId];
        return reportVote.resolution;
    }
    
    //Auto change Quorum
    function addCommitteeMembers(address[] memory members, uint256 newQuorum) public onlyLosslessAdmin  {
        committeeMembersCount += members.length;
        quorumSize = newQuorum;
        //_updateQuorum(committeeMembersCount);
        for (uint256 i = 0; i < members.length; ++i) {
            require(!isCommitteeMember(members[i]), "LSS: duplicate members");
            grantRole(COMMITTEE_ROLE, members[i]);
        }
    } 

    function removeCommitteeMembers(address[] memory members, uint256 newQuorum) public onlyLosslessAdmin  {
        require(committeeMembersCount != 0, "LSS: committee has no members");
        committeeMembersCount -= members.length;
        quorumSize = newQuorum;
        //_updateQuorum(committeeMembersCount);
        for (uint256 i = 0; i < members.length; ++i) {
            require(isCommitteeMember(members[i]), "LSS: one of the addresses is not memeber");
            revokeRole(COMMITTEE_ROLE, members[i]);
        }
    }

    //Update QuorumSize
    function _updateQuorum(uint256 _newTeamSize) private {
        if (_newTeamSize != 0) {
            quorumSize = ((_newTeamSize/2)+1);
        } else {
            quorumSize = 0;
        }
    }


    // TODO:
    // - LSS TEAM VOTE ON REPORT
    // - PROJECT TEAM VOTE ON REPORT
    // - COMMITTEE VOTE ON REPORT

    function losslessVote(uint256 reportId, bool vote) public onlyLosslessAdmin {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        Vote storage reportVote = reportVotes[reportId];
        bool teamVoted = reportVotes[reportId].voted[lssTeamVoteIndex];
        
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");
        require(!teamVoted, "LSS: LSS already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;
    }

    function projectTeamVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");

        address projectTeam = LERC20(controller.reportTokens(reportId)).admin();
        require(projectTeam == msg.sender, "LSS: must be project team");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.voted[projectTeamVoteIndex], "LSS: team already voted");
        
        reportVote.voted[projectTeamVoteIndex] = true;
        reportVote.votes[projectTeamVoteIndex] = vote;
    }

    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LSS: Caller is not committee member");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.committeeMemberVoted[msg.sender], "LSS: Committee member already voted.");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(vote);

        (bool isMajorityReached, bool result) = getCommitteeMajorityReachedResult(reportId);

        if (isMajorityReached) {
            reportVote.votes[committeeVoteIndex] = result;
            reportVote.voted[committeeVoteIndex] = true;
        }
    }

    function resolveReport(uint256 reportId) public {

        address projectOwner = LERC20(controller.reportTokens(reportId)).admin();
        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == controller.admin() 
                || msg.sender == projectOwner,
                "LSS: Role cannot resolve.");
        
        Vote storage reportVote = reportVotes[reportId];
        require(!isReportSolved(reportId), "LSS: Report already resolved");

        uint8 aggreeCount = 0;
        uint8 voteCount = 0;

        if (getIsVoted(reportId, lssTeamVoteIndex)){voteCount += 1;}
        if (getIsVoted(reportId, projectTeamVoteIndex)){voteCount += 1;}

        if (getVote(reportId, lssTeamVoteIndex)){ aggreeCount += 1;}
        if (getVote(reportId, projectTeamVoteIndex)){ aggreeCount += 1;}

        (bool comitteeResoluted, bool committeeResolution) = getCommitteeMajorityReachedResult(reportId);
        require(comitteeResoluted, "LSS: Committee hasnt reached a resolution.");

        voteCount += 1;

        if (committeeResolution) {
            aggreeCount += 1;
        }

        require(voteCount > 2, "LSS: Not enough votes.");
        
        if (aggreeCount > (voteCount - aggreeCount)){
            reportVote.resolution = true;
            reportVote.resolved = true;
        }else{
            reportVote.resolution = false;
            reportVote.resolved = true;
        }
    }
}