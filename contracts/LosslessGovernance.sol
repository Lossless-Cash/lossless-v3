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
    }

    mapping(uint256 => Vote) reportVotes;

    constructor(address _controller) {
        controller = LosslessController(_controller);
        _setupRole(DEFAULT_ADMIN_ROLE, controller.admin());
    }

    modifier onlyLosslessAdmin() {
        require(controller.admin() == _msgSender(), "LOSSLESS: must be admin");
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
    
    //Added auto change Quorum
    function addCommitteeMembers(address[] memory members) public onlyLosslessAdmin  {
        committeeMembersCount += members.length;
        _updateQuorum(committeeMembersCount);
        for (uint256 i = 0; i < members.length; ++i) {
            require(!isCommitteeMember(members[i]), "LOSSLESS: duplicate members");
            grantRole(COMMITTEE_ROLE, members[i]);
        }
    } 

    function removeCommitteeMembers(address[] memory members) public onlyLosslessAdmin  {
        require(committeeMembersCount != 0, "LOSSLESS: committee has no members");
        committeeMembersCount -= members.length;
        _updateQuorum(committeeMembersCount);
        for (uint256 i = 0; i < members.length; ++i) {
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
        require(!isReportSolved(reportId), "LOSSLESS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        Vote storage reportVote = reportVotes[reportId];
        bool teamVoted = reportVotes[reportId].voted[lssTeamVoteIndex];
        
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LOSSLESS: report is not valid");
        require(!teamVoted, "LOSSLESS: LSS already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;
    }

    function projectTeamVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LOSSLESS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LOSSLESS: report is not valid");

        address projectTeam = LERC20(controller.reportTokens(reportId)).admin();
        require(projectTeam == msg.sender, "LOSSLESS: must be project team");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.voted[projectTeamVoteIndex], "LOSSLESS: team already voted");
        
        reportVote.voted[projectTeamVoteIndex] = true;
        reportVote.votes[projectTeamVoteIndex] = vote;
    }

    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LOSSLESS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LOSSLESS: Caller is not committee member");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LOSSLESS: report is not valid");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.committeeMemberVoted[msg.sender], "LOSSLESS: Committee member already voted.");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(vote);
        bool isMajorityReached;
        bool result;
        (isMajorityReached, result) = getCommitteeMajorityReachedResult(reportId);
        if (isMajorityReached) {
            reportVote.votes[committeeVoteIndex] = result;
            reportVote.voted[committeeVoteIndex] = true;
        }
    }

    function resolveReport(uint256 reportId) public {

        address projectOwner = LERC20(controller.reportTokens(reportId)).admin();
        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == controller.admin() 
                || msg.sender == projectOwner);
        // Need to check if we have atleast a couple of parties voted
        
        Vote storage reportVote = reportVotes[reportId];
        require(!isReportSolved(reportId), "LOSSLESS: Report already resolved");

        // IMPORTANT is not taking into consideration comitee votes
        uint256 aggreeCount = 0;
        uint256 voteCount = 0;
        for(uint256 i = 0; i < 3; i++) {
            if (reportVote.voted[i]) {
                voteCount += 1;

                if (reportVote.votes[i]) {
                    aggreeCount += 1;
                }
            }
        }

        (bool comitteeResoluted, bool committeeResolution) = getCommitteeMajorityReachedResult(reportId);

        console.log("Committee resoluted: %s - committeeResolution: %s", comitteeResoluted, committeeResolution);

        require(comitteeResoluted == true, "LOSSLESS: Committee hasnt reached a resolution.");

        voteCount += 1;

        if (committeeResolution) {
            aggreeCount += 1;
        }

        console.log("%s votes counted", voteCount);
        console.log("%s votes agreed", aggreeCount);

        require(voteCount > 2, "LOSSLESS: Not enough votes.");

        if (aggreeCount > 1) {
            reportVote.resolved = true;
            //Do more stuff on controller
        }

        uint256 disagreeCount = voteCount - aggreeCount;
        if (disagreeCount > 1) {
            reportVote.resolved = false;
            //Do more stuff on controller
        }
    }
}