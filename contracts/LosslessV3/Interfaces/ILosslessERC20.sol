// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ILERC20 {
    function name() external view returns (string memory);
    function admin() external view returns (address);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);
    function getAdmin() external view returns (address);
    function transferOutBlacklistedFunds(address[] calldata from) external;
    //* vvv Admin methods, should this go here? vvvv
    function setLosslessAdmin(address newAdmin) external;
    function transferRecoveryAdminOwnership(address candidate, bytes32 keyHash) external;
    function acceptRecoveryAdminOwnership(bytes memory key) external;
    function proposeLosslessTurnOff() external;
    function executeLosslessTurnOff() external;
    function executeLosslessTurnOn() external;
}