// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

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

interface ControllerV2 {
    function getReporter(uint256 _reportId) external view returns (address);
    
    function getReportTimestamps(uint256 _reportId) external view returns (uint256);

    function getTokenFromReport(uint256 _reportId) external view returns (address);

    function getReportLifetime() external view returns (uint256);

    function sendStake(address _from, address _to, uint256 _amt) external;
}

contract LosslessStaking is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint256 public stakeAmount;

    uint public cooldownPeriod;

    ControllerV2 public controllerV2;

    struct ReceiveCheckpoint {
        uint amount;
        uint timestamp;
    }

    struct Stake {
        uint256 reportId;
        uint256 timestamp;
    }

    struct LocksQueue {
        mapping(uint256 => ReceiveCheckpoint) lockedFunds;
        uint256 touchedTimestamp;
        uint256 first;
        uint256 last;
    }

    struct TokenLockedFunds {
        mapping(address => LocksQueue) queue;
    }

    mapping(address => TokenLockedFunds) tokenScopedLockedFunds;
    mapping(address => bool) dexList;
    mapping(address => bool) whitelist;
    uint256 dexTranferThreshold;

    
    mapping(address => Stake[]) public stakes;
    mapping(uint256 => address[]) public stakers;


    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event Staked(address indexed token, address indexed account, uint256 reportId);

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin, address _controllerV2) public initializer {
       cooldownPeriod = 5 minutes;
       dexTranferThreshold = 2;
       admin = _admin;
       recoveryAdmin = _recoveryAdmin;
       pauseAdmin = _pauseAdmin;
       controllerV2 = ControllerV2(_controllerV2);
    }

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LSS: Must be admin");
        _;
    }

    // --- SETTERS ---

    function pause() public {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
        _pause();
    }    
    
    function unpause() public {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
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

    function setControllerV2(address _controllerV2) public onlyLosslessRecoveryAdmin {
        controllerV2 = ControllerV2(_controllerV2);
    }

    // GET STAKE INFO

    function getAccountStakes(address account) public view returns(Stake[] memory) {
        return stakes[account];
    }

    function getReportStakes(uint256 reportId) public view returns(address[] memory) {
        return stakers[reportId];
    }

    function getIsAccountStaked(uint256 reportId, address account) public view returns(bool) {
        for(uint256 i = 0; i < stakes[account].length; i++) {
            if (stakes[account][i].reportId == reportId) {
                return true;
            }
        }

        return false;
    }

    
    function stake(uint256 reportId) public {
        console.log("Enters stake()");        
        address reporter = controllerV2.getReporter(reportId);
        console.log("Got reporter %s", reporter);
        require(!getIsAccountStaked(reportId, _msgSender()), "LSS: already staked");
        console.log("Passed not staking");        
        require(reporter != _msgSender(), "LSS: reporter can not stake");
        console.log("Passed not being reporter");
        uint256 reportLifetime = controllerV2.getReportLifetime();
        console.log("Got report lifetime: %s", reportLifetime);
        uint256 reportTimestamp = controllerV2.getReportTimestamps(reportId);
        console.log("Got report timestamp: %s", reportTimestamp);
        
        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        console.log("Passed report ID existance");

        stakers[reportId].push(_msgSender());
        stakes[_msgSender()].push(Stake(reportId, block.timestamp));

        //controllerV2.sendStake(_msgSender(), address(this), stakeAmount);
        
        emit Staked(controllerV2.getTokenFromReport(reportId), _msgSender(), reportId);
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

    function removeUsedUpLocks (uint256 availableAmount, address account, uint256 amount) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[account];
        require(queue.touchedTimestamp + 5 minutes <= block.timestamp, "LERC20: transfers limit reached");
        uint256 amountLeft = amount - availableAmount;
        uint i = queue.first;

        while (amountLeft > 0 && i <= queue.last) {
            // console.log("---queue.last---", queue.last);
            ReceiveCheckpoint storage checkpoint = queue.lockedFunds[i];
            if (checkpoint.amount > amountLeft) {
                // console.log("B");
                // console.log("removing", checkpoint.timestamp);
                // console.log("amountLeft", checkpoint.amount);
                // console.log("amountLeft", amountLeft);
                checkpoint.amount -= amountLeft;
                amountLeft = 0;
            } else {
                // console.log("A");
                // console.log("removing", checkpoint.timestamp);
                // console.log("amountLeft", checkpoint.amount);
                // console.log("amountLeft", amountLeft);
                amountLeft -= checkpoint.amount;
                checkpoint.amount = 0;
            }
            
            i += 1;
        }

        queue.touchedTimestamp = block.timestamp;
    }

    function enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        if (queue.lockedFunds[queue.last].timestamp == checkpoint.timestamp) {
            queue.lockedFunds[queue.last].amount += checkpoint.amount;
        } else {
            queue.last += 1;
            queue.lockedFunds[queue.last] = checkpoint;
        }
    }

    function dequeueLockedFunds(address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        delete queue.lockedFunds[queue.first];
        queue.first += 1;
    }

    function addToDexList(address dexAddress) public onlyLosslessAdmin {
        dexList[dexAddress] = true;
    }

    function addToWhitelist(address allowedAddress) public onlyLosslessAdmin {
        whitelist[allowedAddress] = true;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 3;
    }
    
    function getLockedAmount(address token, address account) public view returns (uint256) {
        uint256 lockedAmount = 0;
        LocksQueue storage queue = tokenScopedLockedFunds[token].queue[account];
        uint i = queue.first;
        while (i <= queue.last) {
            ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];
            if (checkpoint.timestamp > block.timestamp) {
                lockedAmount = lockedAmount + checkpoint.amount;
            }
            i += 1;
        }

        return lockedAmount;
    }

    function getAvailableAmount(address token, address account) public view returns (uint256 amount) {
        uint256 total = IERC20(token).balanceOf(account);
        uint256 locked = getLockedAmount(token, account);
        return total - locked;
    }

    function getQueueTail(address token, address account) public view returns (uint256) {
        LocksQueue storage queue = tokenScopedLockedFunds[token].queue[account];
        return queue.last;
    }

    // --- BEFORE HOOKS ---

    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        uint256 availableAmount = getAvailableAmount(_msgSender(), sender);
        if (dexList[recipient] && amount > 2) {
            require(availableAmount >= amount, "LERC20: transfer amount exceeds settled balance");
        } else if (availableAmount < amount) {
            removeUsedUpLocks(availableAmount, sender, amount);
        }
    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        uint256 availableAmount = getAvailableAmount(_msgSender(), sender);
        if (dexList[recipient]  && amount > dexTranferThreshold) {
            require(availableAmount >= amount, "LERC20: transfer amount exceeds settled balance");
        } else if (availableAmount < amount) {
            removeUsedUpLocks(availableAmount, sender, amount);
        }
    }

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {
        if (dexList[recipient]) {
            removeExpiredLocks(recipient);
        }
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