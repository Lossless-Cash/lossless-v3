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

/// @title Lossless Controller Contract
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
    
    struct ReporterClaimStatus {
        uint256 reportId;
        bool claimed;
    }

    mapping(address => ReporterClaimStatus[])  private reporterClaimStatus;

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

    /// @notice This function pauses the contract
    function pause() public onlyPauseAdmin{
        _pause();
    }    

    /// @notice This function unpauses the contract
    function unpause() public onlyPauseAdmin{
        _unpause();
    }

    /// @notice This function sets a new admin
    /// @dev Only can be called by the Recovery admin
    /// @param newAdmin Address corresponding to the new Lossless Admin
    function setAdmin(address newAdmin) public onlyLosslessRecoveryAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice This function sets a new recovery admin
    /// @dev Only can be called by the previous Recovery admin
    /// @param newRecoveryAdmin Address corresponding to the new Lossless Recovery Admin
    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    /// @notice This function sets a new pause admin
    /// @dev Only can be called by the Recovery admin
    /// @param newPauseAdmin Address corresponding to the new Lossless Pause Admin
    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }
    
    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessToken Address corresponding to the Lossless Governance Token
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
    }

    /// @notice This function adds an address to the Decentralized Exchanges mapping
    /// @dev Only can be called by the Lossless Admin
    /// @param dexAddress Address corresponding to the DEX
    function addToDexList(address dexAddress) public onlyLosslessAdmin {
        dexList[dexAddress] = true;
    }

    /// @notice This function adds an address to the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _adr Address corresponding to be added to the whitelist mapping
    function addToWhitelist(address _adr) public onlyLosslessAdmin {
        whitelist[_adr] = true;
    }

    /// @notice This function removes an address from the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _adr Address corresponding to be removed from the whitelist mapping
    function removeFromWhitelist(address _adr) public onlyLosslessAdmin {
        whitelist[_adr] = false;
    }

    /// @notice This function adds an address to the blacklist
    /// @dev Only can be called by the Lossless Admin, and form other Lossless Contracts
    ///            The address gets blacklisted whenever a report is created on them.
    /// @param _adr Address corresponding to be added to the blacklist mapping
    function addToBlacklist(address _adr) public onlyFromAdminOrLssSC {
        require(!isBlacklisted(_adr), "LSS: Already blacklisted");
        blacklist[_adr] = true;
    }

    /// @notice This function removes an address from the blacklist
    /// @dev Only can be called by the Lossless Admin, and form other Lossless Contracts
    ///           The address gets removed from the blacklist when a report gets closed and the resolution being negative.
    /// @param _adr Address corresponding to be removed form the blacklist mapping
    function removeFromBlacklist(address _adr) public onlyFromAdminOrLssSC{
        require(isBlacklisted(_adr), "LSS: Not blacklisted");
        blacklist[_adr] = false;
    }

    /// @notice This function calls removeFromBlacklist()
    /// @param _adr Address corresponding to be removed form the blacklist mapping
    function resolvedNegatively(address _adr) public onlyFromAdminOrLssSC {
        removeFromBlacklist(_adr);
    }
    
    /// @notice This function sets the address of the Lossless Staking contract
    /// @param _adr Address corresponding to the Lossless Staking contract
    function setStakingContractAddress(address _adr) public onlyLosslessAdmin {
        losslessStaking = ILssStaking(_adr);
        losslessStakingingAddress = _adr;
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @param _adr Address corresponding to the Lossless Reporting contract
    function setReportingContractAddress(address _adr) public onlyLosslessAdmin {
        losslessReporting = ILssReporting(_adr);
        losslessReportingAddress = _adr;
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @param _adr Address corresponding to the Lossless Governance contract
    function setGovernanceContractAddress(address _adr) public onlyLosslessAdmin {
        losslessGovernance = ILssGovernance(_adr);
        losslessGovernanceAddress = _adr;
    }

    /// @notice This function sets the amount of tokens to be staked when reporting or staking
    /// @param _stakeAmount Amount to be staked
    function setStakeAmount(uint256 _stakeAmount) public onlyLosslessAdmin {
        stakeAmount = _stakeAmount;
    }

    /// @notice This function sets the default lifetime of the reports
    /// @param _lifetime Time frame of which a report is active
    function setReportLifetime(uint256 _lifetime) public onlyLosslessAdmin {
        reportLifetime = _lifetime;
    }

    /// @notice This function sets the default time that the recieved funds get locked
    /// @dev This function should be called in seconds
    /// @param _seconds Time frame of the recieved funds will be locked
    function setLockTimeframe(uint256 _seconds) public onlyLosslessAdmin {
        lockTimeframe = _seconds * 1 seconds;
    }

    /// @notice This function sets the payout status of a reporter
    /// @param _reporter Reporter address
    /// @param status Payout status 
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) public onlyFromAdminOrLssSC {
        for(uint256 i; i < reporterClaimStatus[_reporter].length; i++) {
            if (reporterClaimStatus[_reporter][i].reportId == reportId) {
                reporterClaimStatus[_reporter][i].claimed = status;
            }
        }
    }

    /// @notice This function add a reporter to the claim Status
    /// @param _reporter Reporter address
    /// @param reportId Report ID
    function addReporter(address _reporter, uint256 reportId) public onlyFromAdminOrLssSC {
        reporterClaimStatus[_reporter].push(ReporterClaimStatus(reportId, false));
    }

    /// @notice This function adds to the total coefficient per report
    /// @dev It takes part on the claimableAmount calculation of the Lossless Staking contract
    /// @param reportId Report to be added the coefficient
    /// @param _amt Coefficient amount
    function addToReportCoefficient(uint256 reportId, uint256 _amt) external onlyFromAdminOrLssSC {
        reportCoefficient[reportId] += _amt;
    }

    /// @notice This function activates the emergency mode
    /// @dev When a report gets generated for a token, it enters an emergency state globally.
    /// This means that the transfers get limited to a 15 minutes cooldown and only for half of the locked funds at a time.
    /// It gets activated by the Lossless Reporting contract .
    /// It deactivated when a resolution has been reached by the Lossless Governance contract.
    /// @param token Token on which the emergency mode must get activated
    function activateEmergency(address token) external onlyFromAdminOrLssSC {
        emergencyMode[token].emergency = true;
        emergencyMode[token].emergencyTimestamp = block.timestamp;
    }

    /// @notice This function deactivates the emergency mode
    /// @param token Token on which the emergency mode must get deactivated
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

    /// @notice This function returns  the payout status of a reporter
    /// @param _reporter Reporter address
    /// @return status Payout status 
    function getReporterPayoutStatus(address _reporter, uint256 reportId) public view returns (bool) {
        for(uint256 i; i < reporterClaimStatus[_reporter].length; i++) {
            if (reporterClaimStatus[_reporter][i].reportId == reportId) {
                return reporterClaimStatus[_reporter][i].claimed ;
            }
        }
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

    /// @notice This function add transfers to the lock queues
    /// @param checkpoint Address to lift the locks
    /// @param recipient Address to lift the locks
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

    /// @notice This function deletes the queue of locked funds
    /// @param recipient Address to lift the locks
    function dequeueLockedFunds(address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[_msgSender()].queue[recipient];

        delete queue.lockedFunds[queue.first];
        queue.first += 1;
    }

    // --- REPORT RESOLUTION ---

    /// @notice This function retrieves the funds of the reported account
    /// @param _addresses Array of addreses to retrieve the locked funds
    function retreiveBlacklistedFunds(address[] calldata _addresses, address token) public onlyFromAdminOrLssSC {
        uint256 blacklistedAmount;

        for(uint256 i; i < _addresses.length; i++) {
            blacklistedAmount += ILERC20(token).balanceOf(_addresses[i]);
        }
        ILERC20(token).transferOutBlacklistedFunds(_addresses);
    }

    function retrieveBlacklistedToStaking(uint256 reportId, address token) public onlyFromAdminOrLssSC{
        uint256 retrieveAmount = losslessReporting.getAmountReported(reportId);
        ILERC20(token).transfer(losslessStakingingAddress, retrieveAmount);
    }

    // --- BEFORE HOOKS ---

    /// @notice This function evaluates if the transfer can be made
    /// @param sender Address sending the funds
    /// @param recipient Address recieving the funds
    /// @param amount Amount to be transfered
    function evaluateTransfer(address sender, address recipient, uint256 amount) private returns (bool) {
        
        require(ILERC20(_msgSender()).balanceOf(sender) >= amount, "LSS: Insufficient balance");

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