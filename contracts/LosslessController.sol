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
    function transferOutBlacklistedFunds(address[] calldata from) external;
    function admin() external view returns (address);
}

interface ILssStaking {
    function getReportStakes(uint256 reportId) external returns(address[] memory);
    function getIsAccountStaked(uint256 reportId, address account) external view returns(bool);
    function getStakingTimestamp(address _address, uint256 reportId) external view returns (uint256);
    function getPayoutStatus(address _address, uint256 reportId) external view returns (bool);
    function getStakerCoefficient(uint256 reportId, address _address) external view returns (uint256);
    function setPayoutStatus(uint256 reportId, address _adr) external;
}

interface ILssReporting {
    function getTokenFromReport(uint256 _reportId) external view returns (address);
    function getReportedAddress(uint256 _reportId) external view returns (address);
    function getReporter(uint256 _reportId) external view returns (address);
    function getReportTimestamps(uint256 _reportId) external view returns (uint256);
    function getReporterRewardAndLSSFee() external view returns (uint256 reward, uint256 fee);
    function getAmountReported(uint256 reportId) external view returns (uint256);
}

interface ILssGovernance {
    function reportResolution(uint256 reportId) external view returns(bool);
}

/// @title Lossless Controller
/// @author Lossless.cash
/// @notice The controller contract is in charge of the communication and senstive data among all Lossless Environment Smart Contracts
contract LosslessController is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint256 public stakeAmount;
    uint256 public reportLifetime;

    uint256 public dexTranferThreshold;

    uint256 lockTimeframe;

    uint256 emergencyCooldown;

    ILERC20 public losslessToken;
    ILssStaking public losslessStaking;
    ILssReporting public losslessReporting;
    ILssGovernance public losslessGovernance;

    address public losslessReportingAddress;
    address public losslessStakingingAddress;
    address public losslessGovernanceAddress;

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
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => TokenLockedFunds) private tokenScopedLockedFunds;

    mapping(uint256 => uint256) public reportCoefficient;
    
    mapping(address => bool) private dexList;
    mapping(address => bool) private whitelist;
    mapping(address => bool) private blacklist;

    struct EmergencyMode {
        bool emergency;
        uint256 emergencyTimestamp;
        mapping(address => uint256) emergencyAddressCooldown;
    }

    mapping(address => EmergencyMode) private emergencyMode;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    // --- MODIFIERS ---

    /// @notice Avoids execution form other than the Recovery Admin
    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    /// @notice Avoids execution form other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LSS: Must be admin");
        _;
    }

    /// @notice Avoids execution form other than the Pause Admin
    modifier onlyPauseAdmin() {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
        _;
    }

    /// @notice Avoids execution form other than the Lossless Admin or Lossless Environment
    modifier onlyFromAdminOrLssSC {
        require(_msgSender() == losslessStakingingAddress ||
                _msgSender() == losslessReportingAddress  || 
                _msgSender() == losslessGovernanceAddress ||
                _msgSender() == admin, "LSS: Admin or LSS SC only");
        _;
    }

    /// @notice Avoids execution form blacklisted addresses
    modifier notBlacklisted() {
        require(!blacklist[_msgSender()], "LSS: You cannot operate");
        _;
    }

    /// @notice Upgrade proxy for deployment
    /// @dev Should be deployed with OpenZeppelin Upgradeable Contracts
    /// @param _admin Address corresponding to the Lossless Admin
    /// @param _recoveryAdmin Address corresponding to the Lossless Recovery Admin
    /// @param _pauseAdmin Address corresponding to the Lossless Recovery Admin
    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin) public initializer {
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        pauseAdmin = _pauseAdmin;
        dexTranferThreshold = 2;
        lockTimeframe = 5 minutes;
        emergencyCooldown = 15 minutes;
        whitelist[_admin] = true;
        whitelist[_recoveryAdmin]  = true;
        whitelist[_pauseAdmin]  = true;
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
    
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
    }

    function addToDexList(address dexAddress) public onlyLosslessAdmin {
        dexList[dexAddress] = true;
    }

    function addToWhitelist(address _adr) public onlyLosslessAdmin {
        whitelist[_adr] = true;
    }

    function removeFromWhitelist(address _adr) public onlyLosslessAdmin {
        whitelist[_adr] = false;
    }

    function addToBlacklist(address _adr) public onlyFromAdminOrLssSC {
        require(!isBlacklisted(_adr), "LSS: Already blacklisted");
        blacklist[_adr] = true;
    }

    function removeFromBlacklist(address _adr) public onlyFromAdminOrLssSC{
        require(isBlacklisted(_adr), "LSS: Not blacklisted");
        blacklist[_adr] = false;
    }

    function resolvedNegatively(address _adr) public onlyFromAdminOrLssSC {
        removeFromBlacklist(_adr);
    }
    
    function setStakingContractAddress(address _adr) public onlyLosslessAdmin {
        losslessStaking = ILssStaking(_adr);
        losslessStakingingAddress = _adr;
    }

    function setReportingContractAddress(address _adr) public onlyLosslessAdmin {
        losslessReporting = ILssReporting(_adr);
        losslessReportingAddress = _adr;
    }

    function setGovernanceContractAddress(address _adr) public onlyLosslessAdmin {
        losslessGovernance = ILssGovernance(_adr);
        losslessGovernanceAddress = _adr;
    }

    function setStakeAmount(uint256 _stakeAmount) public onlyLosslessAdmin {
        stakeAmount = _stakeAmount;
    }

    function setReportLifetime(uint256 _lifetime) public onlyLosslessAdmin {
        reportLifetime = _lifetime;
    }

    function setLockTimeframe(uint256 _seconds) public onlyLosslessAdmin {
        lockTimeframe = _seconds * 1 seconds;
    }

    function addToReportCoefficient(uint256 reportId, uint256 _amt) external onlyFromAdminOrLssSC {
        reportCoefficient[reportId] += _amt;
    }

    function activateEmergency(address token) external onlyFromAdminOrLssSC {
        emergencyMode[token].emergency = true;
        emergencyMode[token].emergencyTimestamp = block.timestamp;
    }

    function deactivateEmergency(address token) external onlyFromAdminOrLssSC {
        emergencyMode[token].emergency = false;
    }

    // --- GETTERS ---

    /// @notice This function will return the contract version 
    function getVersion() public pure returns (uint256) {
        return 1;
    }

    /// @notice This function will return if the address is blacklisted/reported
    /// @return Returns true or false
    function isBlacklisted(address _adr) public view returns (bool) {
        return blacklist[_adr];
    }

    /// @notice This function will return if the address is whitelisted
    /// @return Returns true or false
    function isWhitelisted(address _adr) public view returns (bool) {
        return whitelist[_adr];
    }
    
    /// @notice This function will return the non-settled tokens amount
    /// @param token Address corresponding to the token being held
    /// @param account Address to get the available amount
    /// @return Returns the amount of locked funds
    function getLockedAmount(address token, address account) public view returns (uint256) {
        uint256 lockedAmount;
        
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[token].queue[account];

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

    /// @notice This function will calculate the available amount that an address has to transfer. 
    /// @param token Address corresponding to the token being held
    /// @param account Address to get the available amount
    function getAvailableAmount(address token, address account) public view returns (uint256 amount) {
        uint256 total = ILERC20(token).balanceOf(account);
        uint256 locked = getLockedAmount(token, account);
        return total - locked;
    }

    /// @notice This function will return the last funds in queue
    /// @param token Address corresponding to the token being held
    /// @param account Address to get the available amount
    /// @return Returns the last funds on queue
    function getQueueTail(address token, address account) public view returns (uint256) {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[token].queue[account];
        return queue.last;
    }

    /// @notice This function will return the standard report lifetime 
    /// @return Returns the last funds on queue
    function getReportLifetime() public view returns (uint256) {
        return reportLifetime;
    }

    /// @notice This function will return the standard stake cost
    /// @return Returns the cost of staking
    function getStakeAmount() public view returns (uint256) {
        return stakeAmount;
    }

    /// @notice This function will return the acummulated coefficient  on a report
    /// @param reportId Report to be consulted
    /// @return Returns the total coefficient
    function getReportCoefficient(uint256 reportId) public view returns (uint256) {
        return reportCoefficient[reportId];
    }

    // LOCKs & QUEUES

    /// @notice This function will remove the locks that have already been lifted
    /// @param recipient Address to lift the locks
    function removeExpiredLocks (address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];

        uint i = queue.first;
        ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];

        while (checkpoint.timestamp <= block.timestamp && i <= queue.last) {
            delete queue.lockedFunds[i];
            i += 1;
            checkpoint = queue.lockedFunds[i];
        }
    }

    /// @notice This function will lift the locks after a certain amount
    /// @dev The condition to lift the locks is that their checkpoint should be greater than the set amount
    /// @param availableAmount Address to lift the locks
    /// @param account Address to lift the locks
    /// @param amount Address to lift the locks
    function removeUsedUpLocks (uint256 availableAmount, address account, uint256 amount) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[_msgSender()].queue[account];

        require(queue.touchedTimestamp + lockTimeframe <= block.timestamp, "LSS: Transfers limit reached");

        uint256 amountLeft = amount - availableAmount;
        uint i = 1;

        while (amountLeft > 0 && i <= queue.last) {
            ReceiveCheckpoint memory checkpoint;
            checkpoint = queue.lockedFunds[i];

            if ((checkpoint.timestamp - block.timestamp) >= 300)  {
                if (checkpoint.amount > amountLeft) {
                    checkpoint.amount -= amountLeft;
                    delete amountLeft;
                } else {
                    amountLeft -= checkpoint.amount;
                    delete checkpoint.amount;
                }
            }
            
            i += 1;
        }

        queue.touchedTimestamp = block.timestamp;
    }

    function enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];

        if (queue.lockedFunds[queue.last].timestamp == checkpoint.timestamp) {
            queue.lockedFunds[queue.last].amount += checkpoint.amount;
        } else {
            queue.last += 1;
            queue.lockedFunds[queue.last] = checkpoint;
        }
    }

    function dequeueLockedFunds(address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];

        delete queue.lockedFunds[queue.first];
        queue.first += 1;
    }

    // --- REPORT RESOLUTION ---

    function retreiveBlacklistedFunds(address[] calldata _addresses) public onlyFromAdminOrLssSC {
        uint256 blacklistedAmount;

        for(uint256 i; i < _addresses.length; i++) {
            blacklistedAmount += losslessToken.balanceOf(_addresses[i]);
        }
        losslessToken.transferOutBlacklistedFunds(_addresses);
    }

    function retrieveBlacklistedToStaking(uint256 reportId) public onlyFromAdminOrLssSC{
        uint256 retrieveAmount = losslessReporting.getAmountReported(reportId);
        losslessToken.transfer(losslessStakingingAddress, retrieveAmount);
    }

    // --- BEFORE HOOKS ---

    function evaluateTransfer(address sender, address recipient, uint256 amount) private returns (bool) {
        
        uint256 availableAmount = getAvailableAmount(_msgSender(), sender);

        if (emergencyMode[_msgSender()].emergency) {
            require(amount <= (availableAmount/2), "LSS: Emergency mode active, can only transfer half of the available amount");
            require((block.timestamp - emergencyMode[_msgSender()].emergencyAddressCooldown[sender]) > 15 minutes, "LSS: Emergency mode active, can only transfer every 15 minutes");
        }

        if (dexList[recipient] && amount > dexTranferThreshold) {
            require(availableAmount >= amount, "LSS: Amt exceeds settled balance");
        } else if (availableAmount < amount) {
            removeUsedUpLocks(availableAmount, sender, amount);
            require(getAvailableAmount(_msgSender(), sender) >= amount, "LSS: Amt exceeds settled balance");
        }

        if (dexList[recipient]) {
            removeExpiredLocks(recipient);
        }

        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(amount, block.timestamp + 5 minutes);
        enqueueLockedFunds(newCheckpoint, recipient);
        emergencyMode[_msgSender()].emergencyAddressCooldown[sender] = block.timestamp;

        return true;
    }

    function beforeTransfer(address sender, address recipient, uint256 amount) external notBlacklisted {
        require(!isBlacklisted(sender), "LSS: You cannot operate");
        require(!isBlacklisted(recipient), "LSS: Recipient is blacklisted");

        require(evaluateTransfer(sender, recipient, amount), "LSS: Transfer evaluation failed");

    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external notBlacklisted {
        require(!isBlacklisted(sender), "LSS: You cannot operate");
        require(!isBlacklisted(recipient), "LSS: Recipient is blacklisted");
        require(!isBlacklisted(msgSender), "LSS: Recipient is blacklisted");

        require(evaluateTransfer(sender, recipient, amount), "LSS: Transfer evaluation failed");
    }

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {

    }

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}