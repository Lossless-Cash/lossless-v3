// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ILosslessERC20.sol";
import "./ILosslessGovernance.sol";
import "./ILosslessStaking.sol";
import "./ILosslessControllerV3.sol";

interface ILssReporting {
  function reporterReward() external returns(uint256);
  function losslessReward() external returns(uint256);
  function stakersReward() external returns(uint256);
  function committeeReward() external returns(uint256);
  function reportLifetime() external view returns(uint256);
  function reportingAmount() external returns(uint256);
  function reportCount() external returns(uint256);
  function stakingToken() external returns(address);
  function losslessController() external returns(ILssController);
  function losslessGovernance() external returns(ILssGovernance);
  function reporter(uint256 reportId) external returns(address);
  function reportedAddress(uint256 reportId) external returns(address);
  function secondReportedAddress(uint256 reportId) external returns(address);
  function reportTimestamps(uint256 reportId) external view returns(uint256);
  function reportTokens(uint256 reportId) external returns(address);
  function secondReports(uint256 reportId) external returns(bool);
  function getVersion() external pure returns (uint256);
  function getRewards() external view returns (uint256 reporter, uint256 lossless, uint256 committee, uint256 stakers);
  function report(ILERC20 token, address account) external returns (uint256);
  function reporterClaimableAmount(uint256 reportId) external view returns (uint256);
  
  function pause() external;
  function unpause() external;
  function setStakingToken(ILERC20 _stakingToken) external;
  function setLosslessGovernance(ILssGovernance _losslessGovernance) external;
  function setReportingAmount(uint256 _reportingAmount) external;
  function setReporterReward(uint256 reward) external;
  function setLosslessReward(uint256 reward) external;
  function setStakersReward(uint256 reward) external;
  function setCommitteeReward(uint256 reward) external;
  function setReportLifetime(uint256 _lifetime) external;
  function secondReport(uint256 reportId, address account) external;
  function reporterClaim(uint256 reportId) external;
  function retrieveCompensation(address adr, uint256 amount) external;

  event ReportSubmission(address indexed token, address indexed account, uint256 indexed reportId);
  event SecondReportSubmission(address indexed token, address indexed account, uint256 indexed reportId);
  event NewReportingAmount(uint256 indexed newAmount);
}