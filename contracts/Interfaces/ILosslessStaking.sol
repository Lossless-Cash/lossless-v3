// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ILosslessERC20.sol";
import "./ILosslessGovernance.sol";
import "./ILosslessStaking.sol";
import "./ILosslessReporting.sol";
import "./ILosslessControllerV3.sol";

interface ILssStaking {
  function stakingToken() external returns(ILERC20);
  function losslessReporting() external returns(ILssReporting);
  function losslessController() external returns(ILssController);
  function losslessGovernance() external returns(ILssGovernance);
  function stakingAmount() external returns(uint256);
  function stakers(uint256 reportId) external returns(address[] memory);
  function totalStakedOnReport(uint256 reportId) external returns(uint256);
  function losslessPayed(uint256 reportId) external returns(bool);
  function getVersion() external pure returns (uint256);
  function getIsAccountStaked(uint256 reportId, address account) external view returns(bool);
  function getStakerCoefficient(uint256 reportId, address _address) external view returns (uint256);
  function stakerClaimableAmount(uint256 reportId) external view returns (uint256);
  
  function pause() external;
  function unpause() external;
  function setLssReporting(ILssReporting _losslessReporting) external;
  function setStakingToken(ILERC20 _stakingToken) external;
  function setLosslessGovernance(ILssGovernance _losslessGovernance) external;
  function setStakingAmount(uint256 _stakingAmount) external;
  function stake(uint256 reportId) external;
  function stakerClaim(uint256 reportId) external;
  function losslessClaim(uint256 reportId) external;

  event Stake(ILERC20 indexed token, address indexed account, uint256 indexed reportId);
  event StakerClaim(address indexed staker, address indexed token, uint256 indexed reportID);
  event NewStakingAmount(uint256 indexed newAmount);
  event NewStakingToken(address indexed newToken);
  event NewReportingContract(address indexed newContract);
  event NewGovernanceContract(address indexed newContract);
}