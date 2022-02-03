// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract LosslessControllerV1 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    event AdminChange(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChange(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChange(address indexed previousAdmin, address indexed newAdmin);

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(recoveryAdmin == _msgSender(), "LOSSLESS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LOSSLESS: Must be admin");
        _;
    }

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin) public initializer {
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        pauseAdmin = _pauseAdmin;
        __Context_init_unchained();
        __Pausable_init_unchained();
    }

    // --- SETTERS ---

    function pause() public {
        require(_msgSender() == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _pause();
    }    
    
    function unpause() public {
        require(_msgSender() == pauseAdmin, "LOSSLESS: Must be pauseAdmin");
        _unpause();
    }

    function setAdmin(address newAdmin) public onlyLosslessRecoveryAdmin {
        require(newAdmin != admin, "LERC20: Cannot set same address");
        emit AdminChange(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        require(newRecoveryAdmin != recoveryAdmin, "LERC20: Cannot set same address");
        emit RecoveryAdminChange(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        require(newPauseAdmin != pauseAdmin, "LERC20: Cannot set same address");
        emit PauseAdminChange(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 1;
    }

    // --- BEFORE HOOKS ---

    // The following before hooks are in place as a placeholder for future products.
    // Also to preserve legacy LERC20 compatibility
    
    function beforeTransfer(address sender, address recipient, uint256 amount) external {}

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    // * After hooks are deprecated in LERC20 but we have to keep them
    //   here in order to support legacy LERC20.

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {}

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}