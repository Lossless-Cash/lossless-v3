// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
    
    function transferOutBlacklistedFunds(address[] calldata from) external;
    function setLosslessAdmin(address newAdmin) external;
    function transferRecoveryAdminOwnership(address candidate, bytes32 keyHash) external;
    function acceptRecoveryAdminOwnership(bytes memory key) external;
    function proposeLosslessTurnOff() external;
    function executeLosslessTurnOff() external;
    function executeLosslessTurnOn() external;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event NewAdmin(address indexed newAdmin);
    event NewRecoveryAdminProposal(address indexed candidate);
    event NewRecoveryAdmin(address indexed newAdmin);
    event LosslessTurnOffProposal(uint256 turnOffDate);
    event LosslessOff();
    event LosslessOn();
}