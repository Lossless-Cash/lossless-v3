// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessController.sol";
import "./Interfaces/ILosslessStaking.sol";
import "./Interfaces/ILosslessReporting.sol";
import "./Interfaces/ILosslessGovernance.sol";

/// @title Lossless Governance Contract
/// @notice The governance contract is in charge of handling the voting process over the reports and their resolution
contract LosslessGovernance is ILssGovernance, Initializable, AccessControlUpgradeable, PausableUpgradeable {

    uint256 override public constant LSS_TEAM_INDEX = 0;
    uint256 override public constant TOKEN_OWNER_INDEX = 1;
    uint256 override public constant COMMITEE_INDEX = 2;

    bytes32 public constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    uint256 override public committeeMembersCount;

    uint256 override public walletDisputePeriod;

    uint256 public compensationPercentage;

    uint256 public constant HUNDRED = 1e2;

    ILssReporting override public losslessReporting;
    ILssController override public losslessController;
    ILssStaking override public losslessStaking;

    struct Vote {
        mapping(address => bool) committeeMemberVoted;
        mapping(address => bool) committeeMemberClaimed;
        bool[] committeeVotes;
        bool[3] votes;
        bool[3] voted;
        bool resolved;
        bool resolution;
        bool losslessPayed;
        uint256 amountReported;
    }
    mapping(uint256 => Vote) public reportVotes;

    struct ProposedWallet {
        uint16 proposal;
        uint16 committeeDisagree;
        uint256 retrievalAmount;
        uint256 timestamp;
        address wallet;
        bool status;
        bool losslessVote;
        bool losslessVoted;
        bool tokenOwnersVote;
        bool tokenOwnersVoted;
        bool walletAccepted;
        mapping (uint16 => MemberVotesOnProposal) memberVotesOnProposal;
    }

    mapping(uint256 => ProposedWallet) public proposedWalletOnReport;

    struct Compensation {
        uint256 amount;
        bool payed;
    }

    struct MemberVotesOnProposal {
        mapping (address => bool) memberVoted;
    }

    mapping(address => Compensation) private compensation;

    address[] private reportedAddresses;


    uint256 public revsharePercent;
    address public revshareAdmin;
    mapping(uint256 => bool) public revsharePayed;

    function initialize(ILssReporting _losslessReporting, ILssController _losslessController, ILssStaking _losslessStaking, uint256 _walletDisputePeriod) public initializer {
        losslessReporting = _losslessReporting;
        losslessController = _losslessController;
        losslessStaking = _losslessStaking;
        walletDisputePeriod = _walletDisputePeriod;
        committeeMembersCount = 0;
    }

    modifier onlyLosslessAdmin() {
        require(msg.sender == losslessController.admin(), "LSS: Must be admin");
        _;
    }

    modifier onlyLosslessPauseAdmin() {
        require(msg.sender == losslessController.pauseAdmin(), "LSS: Must be pauseAdmin");
        _;
    }

    // --- ADMINISTRATION ---

    function pause() public onlyLosslessPauseAdmin  {
        _pause();
    }    
    
    function unpause() public onlyLosslessPauseAdmin {
        _unpause();
    }

    
    /// @notice This function gets the contract version
    /// @return Version of the contract
    function getVersion() external pure returns (uint256) {
        return 1;
    }
    
    /// @notice This function determines if an address belongs to the Committee
    /// @param _account Address to be verified
    /// @return True if the address is a committee member
    function isCommitteeMember(address _account) override public view returns(bool) {
        return hasRole(COMMITTEE_ROLE, _account);
    }

    /// @notice This function returns if a report has been voted by one of the three fundamental parts
    /// @param _reportId Report number to be checked
    /// @param _voterIndex Voter Index to be checked
    /// @return True if it has been voted
    function getIsVoted(uint256 _reportId, uint256 _voterIndex) override public view returns(bool) {
        return reportVotes[_reportId].voted[_voterIndex];
    }

    /// @notice This function returns the resolution on a report by a team 
    /// @param _reportId Report number to be checked
    /// @param _voterIndex Voter Index to be checked
    /// @return True if it has voted
    function getVote(uint256 _reportId, uint256 _voterIndex) override public view returns(bool) {
        return reportVotes[_reportId].votes[_voterIndex];
    }

    /// @notice This function returns if report has been resolved    
    /// @param _reportId Report number to be checked
    /// @return True if it has been solved
    function isReportSolved(uint256 _reportId) override public view returns(bool){
        return reportVotes[_reportId].resolved;
    }

    /// @notice This function returns report resolution     
    /// @param _reportId Report number to be checked
    /// @return True if it has been resolved positively
    function reportResolution(uint256 _reportId) override public view returns(bool){
        return reportVotes[_reportId].resolution;
    }

    /// @notice This function sets the wallet dispute period
    /// @param _timeFrame Time in seconds for the dispute period
    function setDisputePeriod(uint256 _timeFrame) override public onlyLosslessAdmin whenNotPaused {
        require(_timeFrame != walletDisputePeriod, "LSS: Already set to that amount");
        walletDisputePeriod = _timeFrame;
        emit NewDisputePeriod(walletDisputePeriod);
    }

    /// @notice This function sets the amount of tokens given to the erroneously reported address
    /// @param _amount Percentage to return
    function setCompensationAmount(uint256 _amount) override public onlyLosslessAdmin {
        require(_amount <= 100, "LSS: Invalid amount");
        require(_amount != compensationPercentage, "LSS: Already set to that amount");
        compensationPercentage = _amount;
        emit NewCompensationPercentage(compensationPercentage);
    }

    /// @notice This function sets revenue share Admin
    /// @param _address Address of the new admin
    function setRevshareAdmin(address _address) override public onlyLosslessAdmin {
        require(_address != revshareAdmin, "LSS: Already set to that address");
        revshareAdmin = _address;
        emit NewRevshareAdmin(revshareAdmin);
    }
    
    /// @notice This function sets the share percentage
    /// @param _amount Percentage to share
    function setRevsharePercentage(uint256 _amount) override public onlyLosslessAdmin {
        require(_amount <= 100, "LSS: Invalid amount");
        require(_amount != revsharePercent, "LSS: Already set to that amount");
        revsharePercent = _amount;
        emit NewRevsharePercentage(revsharePercent);
    }


    /// @notice This function returns if the majority of the commitee voted and the resolution of the votes
    /// @param _reportId Report number to be checked
    /// @return isMajorityReached result Returns True if the majority has voted and the true if the result is positive
    function _getCommitteeMajorityReachedResult(uint256 _reportId) private view returns(bool isMajorityReached, bool result) {        
        Vote storage reportVote = reportVotes[_reportId];
        uint256 committeeLength = reportVote.committeeVotes.length;
        uint256 committeeQuorum = (committeeMembersCount >> 1) + 1; 

        uint256 agreeCount;
        for(uint256 i = 0; i < committeeLength;) {
            if (reportVote.committeeVotes[i]) {
                agreeCount += 1;
            }
            unchecked{i++;}
        }

        if (agreeCount >= committeeQuorum) {
            return (true, true);
        } else if ((committeeLength - agreeCount) >= committeeQuorum) {
            return (true, false);
        } else {
            return (false, false);
        }
    }

    /// @notice This function returns the amount reported on a report    
    /// @param _reportId Report id to check
    function getAmountReported(uint256 _reportId) override external view returns(uint256) {
        return reportVotes[_reportId].amountReported;
    }

    /// @notice This function adds committee members    
    /// @param _members Array of members to be added
    function addCommitteeMembers(address[] memory _members) override public onlyLosslessAdmin whenNotPaused {
        committeeMembersCount += _members.length;

        for(uint256 i = 0; i < _members.length;) {
            address newMember = _members[i];
            require(!isCommitteeMember(newMember), "LSS: duplicate members");
            _grantRole(COMMITTEE_ROLE, newMember);

            unchecked{i++;}
        }

        emit NewCommitteeMembers(_members);
    } 

    /// @notice This function removes Committee members    
    /// @param _members Array of members to be added
    function removeCommitteeMembers(address[] memory _members) override public onlyLosslessAdmin whenNotPaused {  
        require(committeeMembersCount >= _members.length, "LSS: Not enough members to remove");

        committeeMembersCount -= _members.length;

        for(uint256 i = 0; i < _members.length;) {
            address newMember = _members[i];
            require(isCommitteeMember(newMember), "LSS: An address is not member");
            _revokeRole(COMMITTEE_ROLE, newMember);
            unchecked{i++;}
        }

        emit CommitteeMembersRemoval(_members);
    }

    /// @notice This function emits a vote on a report by the Lossless Team
    /// @dev Only can be run by the Lossless Admin
    /// @param _reportId Report to cast the vote
    /// @param _vote Resolution
    function losslessVote(uint256 _reportId, bool _vote) override public onlyLosslessAdmin whenNotPaused {
        require(!isReportSolved(_reportId), "LSS: Report already solved");
        require(isReportActive(_reportId), "LSS: report is not valid");
        
        Vote storage reportVote = reportVotes[_reportId];
        
        require(!reportVote.voted[LSS_TEAM_INDEX], "LSS: LSS already voted");

        reportVote.voted[LSS_TEAM_INDEX] = true;
        reportVote.votes[LSS_TEAM_INDEX] = _vote;

        if (_vote) {
            emit LosslessTeamPositiveVote(_reportId);
        } else {
            emit LosslessTeamNegativeVote(_reportId);
        }
    }

    /// @notice This function emits a vote on a report by the Token Owners
    /// @dev Only can be run by the Token admin
    /// @param _reportId Report to cast the vote
    /// @param _vote Resolution
    function tokenOwnersVote(uint256 _reportId, bool _vote) override public whenNotPaused {
        require(!isReportSolved(_reportId), "LSS: Report already solved");
        require(isReportActive(_reportId), "LSS: report is not valid");

        (,,,,ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        require(msg.sender == reportTokens.admin(), "LSS: Must be token owner");

        Vote storage reportVote = reportVotes[_reportId];

        require(!reportVote.voted[TOKEN_OWNER_INDEX], "LSS: owners already voted");
        
        reportVote.voted[TOKEN_OWNER_INDEX] = true;
        reportVote.votes[TOKEN_OWNER_INDEX] = _vote;

        if (_vote) {
            emit TokenOwnersPositiveVote(_reportId);
        } else {
            emit TokenOwnersNegativeVote(_reportId);
        }
    }

    /// @notice This function emits a vote on a report by a Committee member
    /// @dev Only can be run by a committee member
    /// @param _reportId Report to cast the vote
    /// @param _vote Resolution
    function committeeMemberVote(uint256 _reportId, bool _vote) override public whenNotPaused {
        require(!isReportSolved(_reportId), "LSS: Report already solved");
        require(isCommitteeMember(msg.sender), "LSS: Must be a committee member");
        require(isReportActive(_reportId), "LSS: report is not valid");

        Vote storage reportVote = reportVotes[_reportId];

        require(!reportVote.committeeMemberVoted[msg.sender], "LSS: Member already voted");
        
        reportVote.committeeMemberVoted[msg.sender] = true;
        reportVote.committeeVotes.push(_vote);

        (bool isMajorityReached, bool result) = _getCommitteeMajorityReachedResult(_reportId);

        if (isMajorityReached) {
            reportVote.votes[COMMITEE_INDEX] = result;
            reportVote.voted[COMMITEE_INDEX] = true;
            emit CommitteeMajorityReach(_reportId, result);
        }

        if (_vote) {
            emit CommitteeMemberPositiveVote(_reportId, msg.sender);
        } else {
            emit CommitteeMemberNegativeVote(_reportId, msg.sender);
        }
    }

    /// @notice This function solves a report based on the voting resolution of the three pilars
    /// @dev Only can be run by the three pilars.
    /// When the report gets resolved, if it's resolved negatively, the reported address gets removed from the blacklist
    /// If the report is solved positively, the funds of the reported account get retrieved in order to be distributed among stakers and the reporter.
    /// @param _reportId Report to be resolved
    function resolveReport(uint256 _reportId) override public whenNotPaused {

        require(!isReportSolved(_reportId), "LSS: Report already solved");


        (,,,uint256 reportTimestamps,,,) = losslessReporting.getReportInfo(_reportId);
        
        if (reportTimestamps + losslessReporting.reportLifetime() > block.timestamp) {
            _resolveActive(_reportId);
        } else {
            _resolveExpired(_reportId);
        }
        
        reportVotes[_reportId].resolved = true;
        delete reportedAddresses;

        emit ReportResolve(_reportId, reportVotes[_reportId].resolution);
    }

    /// @notice This function has the logic to solve a report that it's still active
    /// @param _reportId Report to be resolved
    function _resolveActive(uint256 _reportId) private {
                
        (,address reportedAddress, address secondReportedAddress,, ILERC20 token, bool secondReports,) = losslessReporting.getReportInfo(_reportId);

        Vote storage reportVote = reportVotes[_reportId];

        uint256 agreeCount = 0;
        uint256 voteCount = 0;

        if (getIsVoted(_reportId, LSS_TEAM_INDEX)){voteCount += 1;
        if (getVote(_reportId, LSS_TEAM_INDEX)){ agreeCount += 1;}}
        if (getIsVoted(_reportId, TOKEN_OWNER_INDEX)){voteCount += 1;
        if (getVote(_reportId, TOKEN_OWNER_INDEX)){ agreeCount += 1;}}

        (bool committeeResoluted, bool committeeResolution) = _getCommitteeMajorityReachedResult(_reportId);
        if (committeeResoluted) {voteCount += 1;
        if (committeeResolution) {agreeCount += 1;}}

        require(voteCount >= 2, "LSS: Not enough votes");
        require(!(voteCount == 2 && agreeCount == 1), "LSS: Need another vote to untie");

        reportedAddresses.push(reportedAddress);

        if (secondReports) {
            reportedAddresses.push(secondReportedAddress);
        }

        if (agreeCount > (voteCount - agreeCount)){
            reportVote.resolution = true;
            for(uint256 i; i < reportedAddresses.length;) {
                reportVote.amountReported += token.balanceOf(reportedAddresses[i]);
                unchecked{i++;}
            }
            proposedWalletOnReport[_reportId].retrievalAmount = losslessController.retrieveBlacklistedFunds(reportedAddresses, token, _reportId);
            losslessController.deactivateEmergency(token);
        }else{
            reportVote.resolution = false;
            _compensateAddresses(reportedAddresses);
        }
    } 

    /// @notice This function has the logic to solve a report that it's expired
    /// @param _reportId Report to be resolved
    function _resolveExpired(uint256 _reportId) private {

        (,address reportedAddress, address secondReportedAddress,,,bool secondReports,) = losslessReporting.getReportInfo(_reportId);

        reportedAddresses.push(reportedAddress);

        if (secondReports) {
            reportedAddresses.push(secondReportedAddress);
        }

        reportVotes[_reportId].resolution = false;
        _compensateAddresses(reportedAddresses);
    }

    /// @notice This compensates the addresses wrongly reported
    /// @dev The array of addresses will contain the main reported address and the second reported address
    /// @param _addresses Array of addresses to be compensated
    function _compensateAddresses(address[] memory _addresses) private {
        uint256 reportingAmount = losslessReporting.reportingAmount();
        uint256 compensationAmount = (reportingAmount * compensationPercentage) / HUNDRED;

        
        for(uint256 i = 0; i < _addresses.length;) {
            address singleAddress = _addresses[i];
            Compensation storage addressCompensation = compensation[singleAddress]; 
            losslessController.resolvedNegatively(singleAddress);      
            addressCompensation.amount += compensationAmount;
            addressCompensation.payed = false;
            unchecked{i++;}
        }
    }

    /// @notice This method retuns if a report is still active
    /// @param _reportId report Id to verify
    function isReportActive(uint256 _reportId) public view returns(bool) {
        (,,,uint256 reportTimestamps,,,) = losslessReporting.getReportInfo(_reportId);
        return reportTimestamps != 0 && reportTimestamps + losslessReporting.reportLifetime() > block.timestamp;
    }

    // REFUND PROCESS

    /// @notice This function proposes a wallet where the recovered funds will be returned
    /// @dev Only can be run by lossless team or token owners.
    /// @param _reportId Report to propose the wallet
    /// @param _wallet proposed address
    function proposeWallet(uint256 _reportId, address _wallet) override public whenNotPaused {
        (,,,uint256 reportTimestamps, ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        require(msg.sender == losslessController.admin() || 
                msg.sender == reportTokens.admin(),
                "LSS: Role cannot propose");
        require(reportTimestamps != 0, "LSS: Report does not exist");
        require(reportResolution(_reportId), "LSS: Report solved negatively");
        require(_wallet != address(0), "LSS: Wallet cannot ber zero adr");

        ProposedWallet storage proposedWallet = proposedWalletOnReport[_reportId];

        require(proposedWallet.wallet == address(0), "LSS: Wallet already proposed");

        proposedWallet.wallet = _wallet;
        proposedWallet.timestamp = block.timestamp;
        proposedWallet.losslessVote = true;
        proposedWallet.tokenOwnersVote = true;
        proposedWallet.walletAccepted = true;

        emit WalletProposal(_reportId, _wallet);
    }

    /// @notice This function is used to reject the wallet proposal
    /// @dev Only can be run by the three pilars.
    /// @param _reportId Report to propose the wallet
    function rejectWallet(uint256 _reportId) override public whenNotPaused {
        (,,,uint256 reportTimestamps,ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        ProposedWallet storage proposedWallet = proposedWalletOnReport[_reportId];

        require(block.timestamp <= (proposedWallet.timestamp + walletDisputePeriod), "LSS: Dispute period closed");
        require(reportTimestamps != 0, "LSS: Report does not exist");

        if (hasRole(COMMITTEE_ROLE, msg.sender)) {
            require(!proposedWallet.memberVotesOnProposal[proposedWallet.proposal].memberVoted[msg.sender], "LSS: Already Voted");
            proposedWallet.committeeDisagree += 1;
            proposedWallet.memberVotesOnProposal[proposedWallet.proposal].memberVoted[msg.sender] = true;
        } else if (msg.sender == losslessController.admin()) {
            require(!proposedWallet.losslessVoted, "LSS: Already Voted");
            proposedWallet.losslessVote = false;
            proposedWallet.losslessVoted = true;
        } else if (msg.sender == reportTokens.admin()) {
            require(!proposedWallet.tokenOwnersVoted, "LSS: Already Voted");
            proposedWallet.tokenOwnersVote = false;
            proposedWallet.tokenOwnersVoted = true;
        } else revert ("LSS: Role cannot reject.");

        if (!_determineProposedWallet(_reportId)) {
            emit WalletRejection(_reportId);
        }
    }

    /// @notice This function retrieves the fund to the accepted proposed wallet
    /// @param _reportId Report to propose the wallet
    function retrieveFunds(uint256 _reportId) override public whenNotPaused {
        (,,,uint256 reportTimestamps, ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        ProposedWallet storage proposedWallet = proposedWalletOnReport[_reportId];

        require(block.timestamp >= (proposedWallet.timestamp + walletDisputePeriod), "LSS: Dispute period not closed");
        require(reportTimestamps != 0, "LSS: Report does not exist");
        require(!proposedWallet.status, "LSS: Funds already claimed");
        require(proposedWallet.walletAccepted, "LSS: Wallet rejected");
        require(proposedWallet.wallet == msg.sender, "LSS: Only proposed adr can claim");

        proposedWallet.status = true;

        require(reportTokens.transfer(msg.sender, proposedWallet.retrievalAmount), 
        "LSS: Funds retrieve failed");

        emit FundsRetrieval(_reportId, proposedWallet.retrievalAmount);
    }

    /// @notice This function determins if the refund wallet was accepted
    /// @param _reportId Report to propose the wallet
    function _determineProposedWallet(uint256 _reportId) private returns(bool){
        
        ProposedWallet storage proposedWallet = proposedWalletOnReport[_reportId];
        uint256 agreementCount;
        
        if (proposedWallet.committeeDisagree < (committeeMembersCount >> 1)+1 ){
            agreementCount += 1;
        }

        if (proposedWallet.losslessVote) {
            agreementCount += 1;
        }

        if (proposedWallet.tokenOwnersVote) {
            agreementCount += 1;
        }
        
        if (agreementCount >= 2) {
            return true;
        }

        proposedWallet.wallet = address(0);
        proposedWallet.timestamp = block.timestamp;
        proposedWallet.status = false;
        proposedWallet.losslessVote = true;
        proposedWallet.losslessVoted = false;
        proposedWallet.tokenOwnersVote = true;
        proposedWallet.tokenOwnersVoted = false;
        proposedWallet.walletAccepted = false;
        proposedWallet.committeeDisagree = 0;
        proposedWallet.proposal += 1;

        return false;
    }

    /// @notice This lets an erroneously reported account to retrieve compensation
    function retrieveCompensation() override public whenNotPaused {
        require(!compensation[msg.sender].payed, "LSS: Already retrieved");
        require(compensation[msg.sender].amount != 0, "LSS: No retribution assigned");
        
        compensation[msg.sender].payed = true;

        losslessReporting.retrieveCompensation(msg.sender, compensation[msg.sender].amount);

        emit CompensationRetrieval(msg.sender, compensation[msg.sender].amount);

        compensation[msg.sender].amount = 0;

    }

    ///@notice This function verifies is an address belongs to a contract
    ///@param _addr address to verify
    function isContract(address _addr) private view returns (bool){
         uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size != 0);
    }

    ///@notice This function is for committee members to claim their rewards
    ///@param _reportId report ID to claim reward from
    function claimCommitteeReward(uint256 _reportId) override public whenNotPaused {
        require(reportResolution(_reportId), "LSS: Report solved negatively");

        Vote storage reportVote = reportVotes[_reportId];

        require(reportVote.committeeMemberVoted[msg.sender], "LSS: Did not vote on report");
        require(!reportVote.committeeMemberClaimed[msg.sender], "LSS: Already claimed");

        (,,,,ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        uint256 numberOfMembersVote = reportVote.committeeVotes.length;
        uint256 committeeReward = losslessReporting.committeeReward();

        uint256 compensationPerMember = (reportVote.amountReported * committeeReward /  HUNDRED) / numberOfMembersVote;

        reportVote.committeeMemberClaimed[msg.sender] = true;

        require(reportTokens.transfer(msg.sender, compensationPerMember), "LSS: Reward transfer failed");

        emit CommitteeMemberClaim(_reportId, msg.sender, compensationPerMember);
    }

    /// @notice This function is for the Lossless to claim the rewards
    /// @param _reportId report worked on
    function losslessClaim(uint256 _reportId) override public whenNotPaused onlyLosslessAdmin {
        require(reportResolution(_reportId), "LSS: Report solved negatively");   

        Vote storage reportVote = reportVotes[_reportId];

        require(!reportVote.losslessPayed, "LSS: Already claimed");

        (,,,,ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        uint256 amountToClaim = reportVote.amountReported * losslessReporting.losslessReward() / HUNDRED;

        if (revshareAdmin != address(0)) {
            uint256 shared = amountToClaim * revsharePercent / HUNDRED;
            amountToClaim -= shared;
        }

        reportVote.losslessPayed = true;
        require(reportTokens.transfer(losslessController.admin(), amountToClaim), 
        "LSS: Reward transfer failed");

        emit LosslessClaim(reportTokens, _reportId, amountToClaim);
    }

    /// REVENUE SHARE
        
    /// @notice This function is for the claim of the Shared revenue
    /// @param _reportId report worked on
    function revshareClaim(uint256 _reportId) override public whenNotPaused {
        require(msg.sender == revshareAdmin, "LSS: Must be revshareAdmin");
        require(reportResolution(_reportId), "LSS: Report solved negatively");   

        Vote storage reportVote = reportVotes[_reportId];

        require(!revsharePayed[_reportId], "LSS: Already claimed");

        (,,,,ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        uint256 losslessReward = reportVote.amountReported * losslessReporting.losslessReward() / HUNDRED;
        uint256 amountToClaim = losslessReward * revsharePercent / HUNDRED;

        revsharePayed[_reportId] = true;
        require(reportTokens.transfer(msg.sender, amountToClaim), 
        "LSS: Reward transfer failed");

        emit RevshareClaim(reportTokens, _reportId, amountToClaim);
    }

}