// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../Interfaces/ILosslessERC20.sol";
import "../Interfaces/IProtectionStrategy.sol";

contract LosslessControllerV2 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    // --- V2 VARIABLES ---

    address public guardian;
    mapping(ILERC20 => Protections) private tokenProtections;

    struct Protection {
        bool isProtected;
        ProtectionStrategy strategy;
    }

    struct Protections {
        mapping(address => Protection) protections;
    }

    // --- EVENTS ---

    event AdminChange(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChange(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChange(address indexed previousAdmin, address indexed newAdmin);


    // --- V2 EVENTS ---

    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event ProtectedAddressSet(ILERC20 indexed token, address indexed protectedAddress, address indexed strategy);
    event RemovedProtectedAddress(ILERC20 indexed token, address indexed protectedAddress);

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(msg.sender == recoveryAdmin, "LOSSLESS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(msg.sender == admin, "LOSSLESS: Must be admin");
        _;
    }

    modifier onlyPauseAdmin() {
        require(msg.sender == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _;
    }

    // --- V2 MODIFIERS ---

    modifier onlyGuardian() {
        require(msg.sender == guardian, "LOSSLESS: Must be Guardian");
        _;
    }

    // --- VIEWS ---

    function getVersion() external pure returns (uint256) {
        return 2;
    }

    // --- V2 VIEWS ---

    function isAddressProtected(ILERC20 token, address protectedAddress) external view returns (bool) {
        return tokenProtections[token].protections[protectedAddress].isProtected;
    }

    function getProtectedAddressStrategy(ILERC20 token, address protectedAddress) external view returns (address) {
        return address(tokenProtections[token].protections[protectedAddress].strategy);
    }

    // --- ADMINISTRATION ---

    function pause() external onlyPauseAdmin  {
        _pause();
    }    
    
    function unpause() external onlyPauseAdmin {
        _unpause();
    }

    function setAdmin(address newAdmin) external onlyLosslessRecoveryAdmin {
        require(newAdmin != admin, "LERC20: Cannot set same address");
        emit AdminChange(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) external onlyLosslessRecoveryAdmin {
        require(newRecoveryAdmin != recoveryAdmin, "LERC20: Cannot set same address");
        emit RecoveryAdminChange(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) external onlyLosslessRecoveryAdmin {
        require(newPauseAdmin != pauseAdmin, "LERC20: Cannot set same address");
        emit PauseAdminChange(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }

    // --- GUARD ---

    // @notice Set a guardian contract.
    // @dev Guardian contract must be trusted as it has some access rights and can modify controller's state.
    function setGuardian(address newGuardian) external onlyLosslessAdmin whenNotPaused {
        require(newGuardian != address(0), "LSS: Cannot be zero address");
        require(newGuardian != guardian, "LERC20: Cannot set same address");
        emit GuardianSet(guardian, newGuardian);
        guardian = newGuardian;
    }

    // @notice Sets protection for an address with the choosen strategy.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function setProtectedAddress(ILERC20 token, address protectedAddresss, ProtectionStrategy strategy) external onlyGuardian whenNotPaused {
        Protection storage protection = tokenProtections[token].protections[protectedAddresss];
        protection.isProtected = true;
        protection.strategy = strategy;
        emit ProtectedAddressSet(token, protectedAddresss, address(strategy));
    }

    // @notice Remove the protection from the address.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function removeProtectedAddress(ILERC20 token, address protectedAddresss) external onlyGuardian whenNotPaused {
        delete tokenProtections[token].protections[protectedAddresss];
        emit RemovedProtectedAddress(token, protectedAddresss);
    }

    // --- BEFORE HOOKS ---

    // @notice If address is protected, transfer validation rules have to be run inside the strategy.
    // @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        if (tokenProtections[ILERC20(msg.sender)].protections[sender].isProtected) {
            tokenProtections[ILERC20(msg.sender)].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }
    }

    // @notice If address is protected, transfer validation rules have to be run inside the strategy.
    // @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    // @dev msgSender is unused here, but it is sent by the LERC20, removing it would halt the transferFrom function of LERC20s
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        if (tokenProtections[ILERC20(msg.sender)].protections[sender].isProtected) {
            tokenProtections[ILERC20(msg.sender)].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }
    }

    // The following before hooks are in place as a placeholder for future products.
    // Also to preserve legacy LERC20 compatibility
    
    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    function beforeMint(address _to, uint256 _amount) external {}

    function beforeBurn(address _account, uint256 _amount) external {}

    // --- AFTER HOOKS ---
    // * After hooks are deprecated in LERC20 but we have to keep them
    //   here in order to support legacy LERC20.

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {}

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}