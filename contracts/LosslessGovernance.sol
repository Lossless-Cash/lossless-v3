import "@openzeppelin/contracts/access/AccessControl.sol";

interface LosslessController {
    // Checks if not over and checks if exists
    function isReportValid(uint256 reportId) external view returns (bool);
    function reportedProject(uint256 reportId) external view returns (address);
    function admin() external view returns (address);
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
    uint8 private lssTeamVoteIndex = 0;
    uint8 private projectTeamVoteIndex = 1;
    uint8 private committeeVoteIndex = 2;

    LosslessController public controller;
    uint256 public committeeMembersCount = 0;
    mapping(address => address) projectOwners;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        bool[] committeeVotes;
        bool[] votes;
        bool[] voted;
        bool resolved;
    }

    mapping(uint256 => Vote) reportVotes;

    constructor(address _controller) {
        controller = LosslessController(_controller);
        _setupRole(DEFAULT_ADMIN_ROLE, controller.admin());
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
    
    // revoke committee
    function addCommitteeMembers(address[] memory members) public  {
        committeeMembersCount += members.length;
        for (uint256 i = 0; i < members.length; ++i) {
            grantRole(COMMITTEE_ROLE, members[i]);
        }
    } 

    function removeCommitteeMembers(address[] memory members) public  {
        committeeMembersCount -= members.length;
        for (uint256 i = 0; i < members.length; ++i) {
            revokeRole(COMMITTEE_ROLE, members[i]);
        }
    }

    // TODO:
    // - LSS TEAM VOTE ON REPORT
    // - PROJECT TEAM VOTE ON REPORT
    // - COMMITTEE VOTE ON REPORT

    // QUESTIONS: 
    // - do we want to change vote once we've vote

    function losslessVote(uint256 reportId, bool vote) public {
        require(controller.admin() == msg.sender, "Caller is not lossless team");
        require(controller.isReportValid(reportId), "Report is not valid");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.voted[lssTeamVoteIndex], "Lossless team already voted.");

        reportVote.voted[lssTeamVoteIndex] = true;
        reportVote.votes[lssTeamVoteIndex] = vote;
    }

    function projectTeamVote(uint256 reportId, bool vote) public {
        require(controller.isReportValid(reportId), "Report is not valid");
        
        address projectTeam = LERC20(controller.reportedProject(reportId)).admin();
        require(projectTeam == msg.sender, "Caller is not project team");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.voted[projectTeamVoteIndex], "Project team already voted.");
        
        reportVote.voted[projectTeamVoteIndex] = true;
        reportVote.votes[projectTeamVoteIndex] = vote;
    }

    function committeeMemberVote(uint256 reportId, bool vote) public {
        require(hasRole(COMMITTEE_ROLE, msg.sender), "Caller is not committee member");
        require(controller.isReportValid(reportId), "Report is not valid");

        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.committeeMemberVoted[msg.sender], "Committee member already voted.");
        
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
        address reportedProject = controller.reportedProject(reportId);
        require(hasRole(COMMITTEE_ROLE, msg.sender) 
                || msg.sender == controller.admin() 
                || msg.sender == projectOwners[reportedProject]);

        // Need to check if we have atleast a couple of parties voted
        
        Vote storage reportVote = reportVotes[reportId];
        require(!reportVote.resolved, "Report already resolved");

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

        if (aggreeCount > 1) {
            // DO STUFF
        }

        uint256 disagreeCount = voteCount - aggreeCount;
        if (disagreeCount > 1) {
            // DO OTHER STUFF
        }
    }
}