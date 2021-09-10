// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface ILERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    function admin() external view returns (address);
}

contract LosslessController is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint256 public stakeAmount;

    uint256 public reportLifetime;
    uint256 public reportCount;
    uint256 dexTranferThreshold;
    ILERC20 public losslessToken;

    struct TokenReports {
        mapping(address => uint256) reports;
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

    struct ReceiveCheckpoint {
        uint amount;
        uint timestamp;
    }

    mapping(address => TokenLockedFunds) tokenScopedLockedFunds;
    
    mapping(address => bool) dexList;

    mapping(uint256 => address) public reporter;
    mapping(address => TokenReports) tokenReports;
    mapping(uint256 => uint256) public reportTimestamps;
    mapping(uint256 => address) public reportTokens;
    mapping(uint256 => bool) public anotherReports;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event AnotherReportSubmitted(address indexed token, address indexed account, uint256 reportId);

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LSS: Must be admin");
        _;
    }

    modifier onlyPauseAdmin() {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
        _;
    }

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin) public initializer {
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        pauseAdmin = _pauseAdmin;
        dexTranferThreshold = 2;
    }

    // --- SETTERS ---

    function pause() public onlyPauseAdmin{
        _pause();
    }    
    
    function unpause() public onlyPauseAdmin{
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
    
    function setReportLifetime(uint256 _reportLifetime) public onlyLosslessAdmin {
        reportLifetime = _reportLifetime;
    }

    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
    }

    function setStakeAmount(uint256 _stakeAmount) public onlyLosslessAdmin {
        stakeAmount = _stakeAmount;
    }

    function addToDexList(address dexAddress) public onlyLosslessAdmin {
        dexList[dexAddress] = true;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 1;
    }

    function getReporter(uint256 _reportId) public view returns (address) {
        return reporter[_reportId];
    }

    function getReportTimestamps(uint256 _reportId) public view returns (uint256) {
        return reportTimestamps[_reportId];
    }

    function getTokenFromReport(uint256 _reportId) public view returns (address) {
        return reportTokens[_reportId];
    }

    function getReportLifetime() public view returns (uint256) {
        return reportLifetime;
    }

    function getStakeAmount() public view returns (uint256) {
        return stakeAmount;
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
        uint256 total = ILERC20(token).balanceOf(account);
        uint256 locked = getLockedAmount(token, account);
        return total - locked;
    }

    function getQueueTail(address token, address account) public view returns (uint256) {
        LocksQueue storage queue = tokenScopedLockedFunds[token].queue[account];
        return queue.last;
    }    

    // --- REPORTS ---

    function report(address token, address account) public {
        uint256 reportId = tokenReports[token].reports[account];
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId == 0 || reportTimestamp + reportLifetime < block.timestamp, "LSS: report already exists");

        reportCount += 1;
        reportId = reportCount;
        reporter[reportId] = _msgSender();

        // Bellow does not allow freezing more than one wallet. Do we want that?
        tokenReports[token].reports[account] = reportId;
        reportTimestamps[reportId] = block.timestamp;
        reportTokens[reportId] = token;

        losslessToken.transferFrom(_msgSender(), address(this), stakeAmount);

        emit ReportSubmitted(token, account, reportId);
    }

    function reportAnother(uint256 reportId, address token, address account) public {
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(anotherReports[reportId] == false, "LSS: another report already submitted");
        require(_msgSender() == reporter[reportId], "LSS: invalid reporter");

        anotherReports[reportId] = true;
        tokenReports[token].reports[account] = reportId;

        emit AnotherReportSubmitted(token, account, reportId);
    }

    // LOCKs & QUEUES
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
        require(queue.touchedTimestamp + 5 minutes <= block.timestamp, "ILERC20: transfers limit reached");

        uint256 amountLeft = amount - availableAmount;
        uint i = queue.first;

        while (amountLeft > 0 && i <= queue.last) {
            ReceiveCheckpoint storage checkpoint = queue.lockedFunds[i];
            if ((checkpoint.timestamp - block.timestamp) >= 300)  {
                console.log("Checkpoint %s > %s", checkpoint.timestamp, block.timestamp);
                if (checkpoint.amount > amountLeft) {
                    checkpoint.amount -= amountLeft;
                    amountLeft = 0;
                } else {
                    amountLeft -= checkpoint.amount;
                    checkpoint.amount = 0;
                }
            }
            
            i += 1;
        }

        queue.touchedTimestamp = block.timestamp;
    }

    function enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];
        if (queue.lockedFunds[queue.last].timestamp == checkpoint.timestamp) {
            queue.lockedFunds[queue.last].amount += checkpoint.amount;
            checkpoint.timestamp = block.timestamp;
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


    // --- BEFORE HOOKS ---

    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        uint256 availableAmount = getAvailableAmount(_msgSender(), sender);

        console.log("Transfer amount: %s", amount);
        console.log("Available %s", availableAmount);
        console.log("Is dex? %s", dexList[recipient]);

        if (dexList[recipient] && amount > dexTranferThreshold) {
            require(availableAmount >= amount, "ILERC20: transfer amount exceeds settled balance");
        } else if (availableAmount < amount) {
            removeUsedUpLocks(availableAmount, sender, amount);
            availableAmount = getAvailableAmount(_msgSender(), sender);
            console.log("New available amount: %s", availableAmount);
            require(getAvailableAmount(_msgSender(), sender) >= amount, "ILERC20: transfer amount exceeds settled balance");
        }
    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        uint256 availableAmount = getAvailableAmount(_msgSender(), sender);
        if (dexList[recipient]  && amount > dexTranferThreshold) {
            require(availableAmount >= amount, "ILERC20: transfer amount exceeds settled balance");
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