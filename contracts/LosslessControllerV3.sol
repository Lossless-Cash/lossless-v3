// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(address indexed owner, address indexed spender, uint256 value);
}


contract LosslessControllerV3 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint public cooldownPeriod;

    struct ReceiveCheckpoint {
        uint amount;
        uint timestamp;
    }

    struct LocksQueue {
        mapping(uint256 => ReceiveCheckpoint) lockedFunds;
        uint256 first;
        uint256 last;
    }

    struct TokenLockedFunds {
        mapping(address => LocksQueue) queue;
    }

    mapping(address => TokenLockedFunds) tokenScopedLockedFunds;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    function initialize() public initializer {
       cooldownPeriod = 5 minutes;
    }

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LOSSLESS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LOSSLESS: Must be admin");
        _;
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
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }

    function removeExpiredLocks (address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        uint i = queue.first;
        ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];

        while (checkpoint.timestamp <= block.timestamp && i <= queue.last) {
            delete queue.lockedFunds[i];
            i += 1;
            checkpoint = queue.lockedFunds[i];
        }
    }

    function enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        queue.last += 1;
        queue.lockedFunds[queue.last] = checkpoint;
    }

    function dequeueLockedFunds(address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        delete queue.lockedFunds[queue.first];
        queue.first += 1;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 3;
    }

    function getLockedAmount(address token, address account) public view returns (uint256 lockedAmount) {
        LocksQueue storage queue = tokenScopedLockedFunds[token].queue[account];
        uint i = queue.first;
        while (i <= queue.last) {
            ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];
            if (checkpoint.timestamp > block.timestamp) {
                lockedAmount += checkpoint.amount;
            }
            i += 1;
        }
    }

    function getAvailableAmount(address token, address account) public view returns (uint256 amount) {
        uint total = IERC20(token).balanceOf(account);
        return total - getLockedAmount(token, account);
    }

    // --- BEFORE HOOKS ---

    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        require(getAvailableAmount(_msgSender(), sender) >= amount, "LERC20: transfer amount exceeds balance");
    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        require(getAvailableAmount(_msgSender(), sender) >= amount, "LERC20: transfer amount exceeds balance");
    }

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {
        removeExpiredLocks(recipient);
        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(amount, block.timestamp + 5 minutes);
        enqueueLockedFunds(newCheckpoint, recipient);
    }

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        removeExpiredLocks(recipient);
        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(amount, block.timestamp + 5 minutes);
        enqueueLockedFunds(newCheckpoint, recipient);
    }

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}