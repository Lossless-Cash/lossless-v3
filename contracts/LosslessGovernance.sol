// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

interface LosslessControllerInterface {
    function reportedProject(uint256 reportId) external view returns (address);
    function admin() external view returns (address);
    function reportTimestamps(uint256 reportId) external view returns (uint256);
    function reportLifetime() external view returns(uint256);
    function reportTokens(uint256 reportId) external view returns(address);
}

interface LERC20Interface {
    function admin() external view returns (address);
} 

contract LosslessGovernance is AccessControl {

    uint256 public lssTeamVoteIndex;
    uint256 public projectTeamVoteIndex = 1;
    uint256 public committeeVoteIndex = 2;

    uint256 public firstWavePayout  = 60;
    uint256 public secondWavePayout = 20;
    uint256 public thirdWavePayout  = 10;
    uint256 public fourthWavePayout = 5;
    uint256 public payoutReserved   = 5;

    bytes32 private constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 public committeeMembersCount;
    uint256 public quorumSize;

    LosslessControllerInterface public controller;

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

    constructor(address _controller) {
        controller = LosslessControllerInterface(_controller);
        _setupRole(DEFAULT_ADMIN_ROLE, controller.admin());
    }

    modifier onlyLosslessAdmin() {
        require(controller.admin() == _msgSender(), "LSS: must be admin");
        _;
    }

    //Verifies if an address is member
    function isCommitteeMember(address account) public view returns(bool) {
        return hasRole(COMMITTEE_ROLE, account);
    }

    //Returns if a vote was casted by a team on a report
    function getIsVoted(uint256 reportId, uint256 voterIndex) public view returns(bool) {
        return reportVotes[reportId].voted[voterIndex];
    }

    //Returns if a committee member has voted
    function getIsCommitteeMemberVoted(uint256 reportId, address account) public view returns(bool) {
        return reportVotes[reportId].committeeMemberVoted[account];
    }

    //Returns the resolution on a report by a team
    function getVote(uint256 reportId, uint256 voterIndex) public view returns(bool) {
        return reportVotes[reportId].votes[voterIndex];
    }

    //Returns number of votes made by the committee
    function getCommitteeVotesCount(uint256 reportId) public view returns(uint256) {
        return reportVotes[reportId].committeeVotes.length;
    }

    //Returns if report has been resolved
    function isReportSolved(uint256 reportId) public view returns(bool){
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        return reportVote.resolved;
    }

    //Returns report resolution
    function reportResolution(uint256 reportId) public view returns(bool){
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        return reportVote.resolution;
    }
    
    //Get if majority voted and the resolution of the votes
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

    //Add committee members
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

    //Remove Committee members
    function removeCommitteeMembers(address[] memory members, uint256 newQuorum) public onlyLosslessAdmin  {
        require(committeeMembersCount != 0, "LSS: committee has no members");
        committeeMembersCount -= members.length;
        quorumSize = newQuorum;
        //_updateQuorum(committeeMembersCount);
        for (uint256 i; i < members.length; ++i) {
            require(isCommitteeMember(members[i]), "LSS: An address is not member");
            revokeRole(COMMITTEE_ROLE, members[i]);
        }
    }

    //Auto change Quorum
    function _updateQuorum(uint256 _newTeamSize) private {
        if (_newTeamSize != 0) {
            quorumSize = ((_newTeamSize/2)+1);
        } else {
            delete quorumSize;
        }
    }

    //LossLess Team voting
    function losslessVote(uint256 reportId, bool vote) public onlyLosslessAdmin {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");
        
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        
        require(!reportVotes[reportId].voted[lssTeamVoteIndex], "LSS: LSS already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;
    }

    //Token Team voting
    function projectTeamVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");

        //address projectTeam = LERC20Interface(controller.reportTokens(reportId)).admin();
        require(LERC20Interface(controller.reportTokens(reportId)).admin() == msg.sender, "LSS: must be project team");

        Vote storage reportVote;
        reportVote = reportVotes[reportId];

        require(!reportVote.voted[projectTeamVoteIndex], "LSS: team already voted");
        
        reportVote.voted[projectTeamVoteIndex] = true;
        reportVote.votes[projectTeamVoteIndex] = vote;
    }

    //Committee members voting
    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(!isReportSolved(reportId), "LSS: Report already solved.");
        require(isCommitteeMember(msg.sender), "LSS: Caller is not member");

        uint256 reportTimestamp = controller.reportTimestamps(reportId);
        require(reportTimestamp != 0 && reportTimestamp + controller.reportLifetime() > block.timestamp, "LSS: report is not valid");

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


    //Report resolution
    function resolveReport(uint256 reportId) public {

        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == controller.admin() 
                || msg.sender == LERC20Interface(controller.reportTokens(reportId)).admin(),
                "LSS: Role cannot resolve.");
        
        Vote storage reportVote;
        reportVote = reportVotes[reportId];
        require(!isReportSolved(reportId), "LSS: Report already resolved");

        uint256 aggreeCount;
        uint256 voteCount;

        if (getIsVoted(reportId, lssTeamVoteIndex)){voteCount += 1;
        if (getVote(reportId, lssTeamVoteIndex)){ aggreeCount += 1;}}
        if (getIsVoted(reportId, projectTeamVoteIndex)){voteCount += 1;
        if (getVote(reportId, projectTeamVoteIndex)){ aggreeCount += 1;}}

        (bool comitteeResoluted, bool committeeResolution) = getCommitteeMajorityReachedResult(reportId);
        require(comitteeResoluted, "LSS: Committee resolve pending");

        voteCount += 1;

        if (committeeResolution) {
            aggreeCount += 1;
        }

        require(voteCount > 2, "LSS: Not enough votes");
        
        if (aggreeCount > (voteCount - aggreeCount)){
            reportVote.resolution = true;
        }else{
            reportVote.resolution = false;
        }
        
        reportVote.resolved = true;
    }
}