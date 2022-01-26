// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ILosslessERC20.sol";
import "./ILosslessGovernance.sol";
import "./ILosslessReporting.sol";
import "./ILosslessControllerV3.sol";

interface ILssStaking {
  function stakingToken() external returns(ILERC20);
  function losslessReporting() external returns(ILssReporting);
  function losslessController() external returns(ILssController);
  function losslessGovernance() external returns(ILssGovernance);
  function stakingAmount() external returns(uint256);
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

  event NewStake(ILERC20 indexed token, address indexed account, uint256 indexed reportId);
  event StakerClaim(address indexed staker, ILERC20 indexed token, uint256 indexed reportID, uint256 amount);
  event NewStakingAmount(uint256 indexed newAmount);
  event NewStakingToken(ILERC20 indexed newToken);
  event NewReportingContract(address indexed newContract);
  event NewGovernanceContract(address indexed newContract);
}