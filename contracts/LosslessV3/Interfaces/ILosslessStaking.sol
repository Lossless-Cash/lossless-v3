// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ILssStaking {
  function stakingToken() external returns(address);
  function losslessReporting() external returns(address);
  function losslessController() external returns(address);
  function losslessGovernance() external returns(address);
  function stakingAmount() external returns(uint256);
  function stakers() external returns(address[] memory);
  function totalStakedOnReport(uint256 reportId) external returns(uint256);
  function losslessPayed(uint256 reportId) external returns(bool);
  function getVersion() external pure returns (uint256);
  function getIsAccountStaked(uint256 reportId, address account) external view returns(bool);
  function getStakerCoefficient(uint256 reportId, address _address) external view returns (uint256);
  function stakerClaimableAmount(uint256 reportId) external view returns (uint256);
  
  function pause() external;
  function unpause() external;
  function setLssReporting(address _losslessReporting) external;
  function setStakingToken(address _stakingToken) external;
  function setLosslessGovernance(address _losslessGovernance) external;
  function setStakingAmount(uint256 _stakingAmount) external;
  function stake(uint256 reportId) external;
  function stakerClaim(uint256 reportId) external;
  function losslessClaim(uint256 reportId) external;
  function retrieveCompensation(address adr, uint256 amount) external;

  event Staked(address indexed token, address indexed account, uint256 reportId);
}