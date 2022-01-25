// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ILosslessERC20.sol";
import "./ILosslessStaking.sol";
import "./ILosslessReporting.sol";
import "./ILosslessControllerV3.sol";

interface ILssGovernance {
    function LSS_TEAM_INDEX() external view returns(uint256);
    function TOKEN_OWNER_INDEX() external view returns(uint256);
    function COMMITEE_INDEX() external view returns(uint256);
    function committeeMembersCount() external view returns(uint256);
    function walletDisputePeriod() external view returns(uint256);
    function losslessStaking() external view returns (ILssStaking);
    function losslessReporting() external view returns (ILssReporting);
    function losslessController() external view returns (ILssController);
    function isCommitteeMember(address account) external view returns(bool);
    function getIsVoted(uint256 reportId, uint256 voterIndex) external view returns(bool);
    function getVote(uint256 reportId, uint256 voterIndex) external view returns(bool);
    function isReportSolved(uint256 reportId) external view returns(bool);
    function reportResolution(uint256 reportId) external view returns(bool);
    function getAmountReported(uint256 reportId) external view returns(uint256);
    
    function setDisputePeriod(uint256 timeFrame) external;
    function addCommitteeMembers(address[] memory members) external;
    function removeCommitteeMembers(address[] memory members) external;
    function losslessVote(uint256 reportId, bool vote) external;
    function tokenOwnersVote(uint256 reportId, bool vote) external;
    function committeeMemberVote(uint256 reportId, bool vote) external;
    function resolveReport(uint256 reportId) external;
    function proposeWallet(uint256 reportId, address wallet) external;
    function rejectWallet(uint256 reportId) external;
    function retrieveFunds(uint256 reportId) external;
    function retrieveCompensation() external;
    function claimCommitteeReward(uint256 reportId) external;
    function setCompensationAmount(uint256 amount) external;

    event NewCommitteeMembers(address[] members);
    event CommitteeMembersRemoval(address[] members);
    event LosslessTeamPositiveVote(uint256 indexed reportId);
    event LosslessTeamNegativeVote(uint256 indexed reportId);
    event TokenOwnersPositiveVote(uint256 indexed reportId);
    event TokenOwnersNegativeVote(uint256 indexed reportId);
    event CommitteeMemberPositiveVote(uint256 indexed reportId, address indexed member);
    event CommitteeMemberNegativeVote(uint256 indexed reportId, address indexed member);
    event ReportResolve(uint256 indexed reportId, bool indexed resolution);
    event WalletProposal(uint256 indexed reportId, address indexed wallet);
    event WalletRejected(uint256 indexed reportId, address indexed wallet);
    event CommitteeMemberClaim(uint256 indexed reportID, address indexed member, uint256 indexed amount);
    event CommitteeMajorityReach(uint256 indexed reportId, bool indexed result);
    event NewDisputePeriod(uint256 indexed newPeriod);
    event WalletRejection(uint256 indexed reportId, address indexed wallet);
    event FundsRetrieval(uint256 indexed reportId, address indexed wallet, uint256 indexed amount);
    event CompensationRetrieval(address indexed wallet, uint256 indexed amount);
    event LosslessClaim(ILERC20 indexed token, uint256 indexed reportID, uint256 indexed amount);
}
