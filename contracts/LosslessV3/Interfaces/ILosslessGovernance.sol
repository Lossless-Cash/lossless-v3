// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ILssGovernance {
    function lssTeamVoteIndex() external view returns(address);
    function tokenOwnersVoteIndex() external view returns(address);
    function committeeVoteIndex() external view returns(address);
    function committeeMembersCount() external view returns(address);
    function walletDisputePeriod() external view returns(address);
    function losslessToken() external view returns (address);
    function losslessStaking() external view returns (address);
    function losslessReporting() external view returns (address);
    function losslessController() external view returns (address);
    function isCommitteeMember(address account) external view returns(bool);
    function getIsVoted(uint256 reportId, uint256 voterIndex) external view returns(bool);
    function getVote(uint256 reportId, uint256 voterIndex) external view returns(bool);
    function isReportSolved(uint256 reportId) external view returns(bool);
    function reportResolution(uint256 reportId) external view returns(bool);
    function amountReported(uint256 reportId) external view returns (uint256);
    
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
    event LosslessClaimed(address indexed token, uint256 indexed reportID);
}
