// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ILssReporting {
  function reporterReward() external returns(uint256);
  function losslessFee() external returns(uint256);
  function stakersFee() external returns(uint256);
  function committeeFee() external returns(uint256);
  function reportLifetime() external returns(uint256);
  function reportingAmount() external returns(uint256);
  function reportCount() external returns(uint256);
  function losslessToken() external returns(address);
  function losslessController() external returns(address);
  function losslessGovernance() external returns(address);
  function reporter(uint256 reportId) external returns(address);
  function reportedAddress(uint256 reportId) external returns(address);
  function secondReportedAddress(uint256 reportId) external returns(address);
  function reportTimestamps(uint256 reportId) external returns(uint256);
  function reportTokens(uint256 reportId) external returns(address);
  function secondReports(uint256 reportId) external returns(bool);
  function getVersion() external pure returns (uint256);
  function getFees() external view returns (uint256 reporter, uint256 lossless, uint256 committee, uint256 stakers);
  function report(address token, address account) external returns (uint256);
  function reporterClaimableAmount(uint256 reportId) external view returns (uint256);
  
  function pause() external;
  function unpause() external;
  function setLosslessToken(address _losslessToken) external;
  function setLosslessGovernance(address _losslessGovernance) external;
  function setReportingAmount(uint256 _reportingAmount) external;
  function setReporterReward(uint256 reward) external;
  function setLosslessFee(uint256 fee) external;
  function setStakersFee(uint256 fee) external;
  function setCommitteeFee(uint256 fee) external;
  function setReportLifetime(uint256 _lifetime) external;
  function secondReport(uint256 reportId, address account) external;
  function reporterClaim(uint256 reportId) external;

  event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
  event SecondReportsubmitted(address indexed token, address indexed account, uint256 reportId);
}