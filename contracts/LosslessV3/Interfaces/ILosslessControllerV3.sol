// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


interface ILssController {
    function getLockedAmount(address token, address account) external view returns (uint256);
    function getAvailableAmount(address token, address account) external view returns (uint256 amount);
    function retrieveBlacklistedFunds(address[] calldata _addresses, address token, uint256 reportId) external returns(uint256);
    function erroneousCompensation() external view returns (uint256);
    function reportLifetime() external returns (uint256);
    function stakeAmount() external view returns (uint256);
    function reportingAmount() external returns (uint256);
    function whitelist(address _adr) external view returns (bool);
    function dexList(address dexAddress) external returns (bool);
    function getReporterPayoutStatus(address _reporter, uint256 reportId) external view returns (bool);
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) external; 
    function blacklist(address _adr) external view returns (bool);
    function reportCoefficient(uint256 reportId) external view returns (uint256);
    function admin() external view returns (address);
    function pauseAdmin() external view returns (address);
    function recoveryAdmin() external view returns (address);
    function guardian() external view returns (address);
    function stakingToken() external view returns (address);
    function losslessStaking() external view returns (address);
    function losslessReporting() external view returns (address);
    function lockCheckpointExpiration() external view returns (uint256);
    function dexTranferThreshold() external view returns (uint256);
    function settlementTimeLock() external view returns (uint256);
    function tokenLockTimeframe(address token) external view returns (uint256);
    function proposedTokenLockTimeframe(address token) external view returns (uint256);
    function changeSettlementTimelock(address token) external view returns (uint256);
    function isNewSettlementProposed(address token) external view returns (bool);
    function reportCoefficient(address token) external view returns (uint256);
    
    function pause() external;
    function unpause() external;
    function setAdmin(address newAdmin) external;
    function setRecoveryAdmin(address newRecoveryAdmin) external;
    function setPauseAdmin(address newPauseAdmin) external;
    function setStakingToken(address _stakingToken) external;
    function setSettlementTimeLock(uint256 newTimelock) external;
    function setDexTrasnferThreshold(uint256 newThreshold) external;
    function setCompensationAmount(uint256 amount) external;
    function setLocksLiftUpExpiration(uint256 time) external;
    function setDexList(address[] calldata _dexList, bool value) external;
    function setWhitelist(address[] calldata _addrList, bool value) external;
    function addToBlacklist(address _adr) external;
    function resolvedNegatively(address _adr) external;
    function setStakingContractAddress(address _adr) external;
    function setReportingContractAddress(address _adr) external; 
    function setGovernanceContractAddress(address _adr) external;
    function proposeNewSettlementPeriod(address token, uint256 _seconds) external;
    function executeNewSettlementPeriod(address token) external;
    function addToReportCoefficient(uint256 reportId, uint256 _amt) external;
    function activateEmergency(address token) external;
    function deactivateEmergency(address token) external;
    function setGuardian(address newGuardian) external;
    function removeProtectedAddress(address token, address protectedAddresss) external;
    function beforeTransfer(address sender, address recipient, uint256 amount) external;
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external;
    function beforeApprove(address sender, address spender, uint256 amount) external;
    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external;
    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event ProtectedAddressSet(address indexed token, address indexed protectedAddress, address indexed strategy);
    event RemovedProtectedAddress(address indexed token, address indexed protectedAddress);
    event NewSettlementPeriodProposed(address token, uint256 _seconds);
    event SettlementPeriodChanged(address token, uint256 proposedTokenLockTimeframe);
}