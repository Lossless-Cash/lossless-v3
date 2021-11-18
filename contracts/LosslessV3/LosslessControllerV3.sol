// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface ILERC20 {
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
    function admin() external view returns (address);
}

interface ILssReporting {
    function getFees() external view returns (uint256 reporter, uint256 lossless, uint256 committee, uint256 stakers);
    function amountReported(uint256 reportId) external view returns (uint256);
}

interface ILssGovernance {
    function amountReported(uint256 reportId) external view returns(uint256);
}

interface ProtectionStrategy {
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external;
}

/// @title Lossless Controller Contract
/// @notice The controller contract is in charge of the communication and senstive data among all Lossless Environment Smart Contracts
contract LosslessControllerV3 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    // --- V2 VARIABLES ---

    address public guardian;
    mapping(address => Protections) private tokenProtections;

    struct Protection {
        bool isProtected;
        ProtectionStrategy strategy;
    }

    struct Protections {
        mapping(address => Protection) protections;
    }

    // --- V3 VARIABLES ---
    uint256 public lockCheckpointExpiration;

    uint256 public dexTranferThreshold;

    uint256 settlementTimeLock;
    mapping(address => uint256) public tokenLockTimeframe;
    mapping(address => uint256) public proposedTokenLockTimeframe;
    mapping(address => uint256) public changeSettlementTimelock;
    mapping(address => bool) public isNewSettlementProposed;

    mapping(address => bool) public tokenTransferEvaluation;

    uint256 public erroneousCompensation;

    ILERC20 public losslessToken;
    ILssStaking public losslessStaking;
    ILssReporting public losslessReporting;
    ILssGovernance public losslessGovernance;

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
    
    mapping(address => bool) public dexList;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;

    mapping(address => EmergencyMode) private emergencyMode;

    struct EmergencyMode {
        bool emergency;
        uint256 emergencyTimestamp;
        uint256 emergencyMappingNum;
        mapping( uint256 => mapping(address => bool)) emergencyTransfer;
        mapping( uint256 => mapping(address => bool)) emergencyDexTransfer;
    }

    
    struct ReporterClaimStatus {
        mapping(uint256 => bool) reportIdClaimStatus;
    }

    mapping(address => ReporterClaimStatus)  private reporterClaimStatus;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    // --- V2 EVENTS ---

    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event ProtectedAddressSet(address indexed token, address indexed protectedAddress, address indexed strategy);
    event RemovedProtectedAddress(address indexed token, address indexed protectedAddress);

    // --- MODIFIERS ---

    /// @notice Avoids execution from other than the Recovery Admin
    modifier onlyLosslessRecoveryAdmin() {
        require(msg.sender == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    /// @notice Avoids execution from other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(admin == msg.sender, "LSS: Must be admin");
        _;
    }

    /// @notice Avoids execution from other than the Pause Admin
    modifier onlyPauseAdmin() {
        require(msg.sender == pauseAdmin, "LSS: Must be pauseAdmin");
        _;
    }

    // --- V2 MODIFIERS ---

    modifier onlyGuardian() {
        require(msg.sender == guardian, "LOSSLESS: Must be Guardian");
        _;
    }

    // --- V3 MODIFIERS ---

    /// @notice Avoids execution from other than the Lossless Admin or Lossless Environment
    modifier onlyLosslessEnv {
        require(msg.sender == address(losslessStaking)   ||
                msg.sender == address(losslessReporting) || 
                msg.sender == address(losslessGovernance),
                "LSS: Lss SC only");
        _;
    }

    /// @notice Avoids execution from blacklisted addresses
    modifier notBlacklisted() {
        require(!blacklist[msg.sender], "LSS: You cannot operate");
        _;
    }

    // --- VIEWS ---

    /// @notice This function will return the contract version 
    function getVersion() external pure returns (uint256) {
        return 3;
    }

    // --- ADMINISTRATION ---

    function pause() public onlyPauseAdmin  {
        _pause();
    }    
    
    function unpause() public onlyPauseAdmin {
        _unpause();
    }

    /// @notice This function sets a new admin
    /// @dev Only can be called by the Recovery admin
    /// @param newAdmin Address corresponding to the new Lossless Admin
    function setAdmin(address newAdmin) public onlyLosslessRecoveryAdmin {
        require(msg.sender != address(0), "LERC20: Cannot be zero address");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        require(msg.sender != address(0), "LERC20: Cannot be zero address");
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        require(msg.sender != address(0), "LERC20: Cannot be zero address");
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }


    // --- V3 SETTERS ---

    /// @notice This function sets default values for Contoller V3
    /// @dev Called on startur
    function setControllerV3Defaults() public onlyLosslessAdmin {
        dexTranferThreshold = 2;
        erroneousCompensation = 2;
        whitelist[admin] = true;
        whitelist[recoveryAdmin]  = true;
        whitelist[pauseAdmin]  = true;
        settlementTimeLock = 12 hours;
        lockCheckpointExpiration = 300 seconds;
    }
    
    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessToken Address corresponding to the Lossless Governance Token
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        require(_losslessToken != address(0), "LERC20: Cannot be zero address");
        losslessToken = ILERC20(_losslessToken);
    }

    /// @notice This function sets the timelock for tokens to change the settlement period
    /// @dev Only can be called by the Lossless Admin
    /// @param newTimelock Timelock in seconds
    function setSettlementTimeLock(uint256 newTimelock) public onlyLosslessAdmin {
        settlementTimeLock = newTimelock;
    }

    /// @notice This function sets the amount of tokens given to the erroneously reported address
    /// @param amount Percentage to return
    function setCompensationAmount(uint256 amount) public onlyLosslessAdmin {
        erroneousCompensation = amount;
    }

    /// @notice This function sets the amount of time for used up and expired tokens to be lifted
    /// @param time Time in seconds
    function setLocksLiftUpExpiration(uint256 time) public onlyLosslessAdmin {
        lockCheckpointExpiration = time;
    }
    
    /// @notice This function removes or adds an array of dex addresses from the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _dexList List of dex addresses to add or remove
    function setDexList(address[] calldata _dexList, bool value) public onlyLosslessAdmin {
        for(uint256 i; i < _dexList.length; i++) {
            dexList[_dexList[i]] = value;
        }
    }

    /// @notice This function removes or adds an array of addresses from the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _addrList List of addresses to add or remove
    function setWhitelist(address[] calldata _addrList, bool value) public onlyLosslessAdmin {
        for(uint256 i; i < _addrList.length; i++) {
            whitelist[_addrList[i]] = value;
        }
    }

    /// @notice This function lets token owners decide wheter or not add transfer evaluations
    /// @dev Only can be called by the Token Admin
    /// @param token Token to change
    /// @param value Flag status
    function setTokenEvaluation(address token, bool value) public {
        require(msg.sender == ILERC20(token).admin(), "LSS: Only token admin");
        tokenTransferEvaluation[token] = value;
    }

    /// @notice This function adds an address to the blacklist
    /// @dev Only can be called by the Lossless Admin, and from other Lossless Contracts
    ///            The address gets blacklisted whenever a report is created on them.
    /// @param _adr Address corresponding to be added to the blacklist mapping
    function addToBlacklist(address _adr) public onlyLosslessEnv {
        require(!blacklist[_adr], "LSS: Already blacklisted");
        blacklist[_adr] = true;
    }

    /// @notice This function calls removeFromBlacklist() and returns a percentage as compensation
    /// @param _adr Address corresponding to be removed from the blacklist mapping
    function resolvedNegatively(address _adr) public onlyLosslessEnv {
        require(blacklist[_adr], "LSS: Not blacklisted");
        blacklist[_adr] = false;
    }
    
    /// @notice This function sets the address of the Lossless Staking contract
    /// @param _adr Address corresponding to the Lossless Staking contract
    function setStakingContractAddress(address _adr) public onlyLosslessAdmin {
        require(_adr != address(0), "LERC20: Cannot be zero address");
        losslessStaking = ILssStaking(_adr);
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @param _adr Address corresponding to the Lossless Reporting contract
    function setReportingContractAddress(address _adr) public onlyLosslessAdmin {
        require(_adr != address(0), "LERC20: Cannot be zero address");
        losslessReporting = ILssReporting(_adr);
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @param _adr Address corresponding to the Lossless Governance contract
    function setGovernanceContractAddress(address _adr) public onlyLosslessAdmin {
        require(_adr != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = ILssGovernance(_adr);
    }

    /// @notice This function starts the Timelock to change the settlement period
    /// @dev This function should be called in seconds
    /// @param token to set time settlement period on
    /// @param _seconds Time frame of the recieved funds will be locked
    function proposeNewSettlementPeriod(address token, uint256 _seconds) public {
        require(ILERC20(token).admin() == msg.sender, "LSS: Must be Token Admin");
        changeSettlementTimelock[token] = block.timestamp + settlementTimeLock;
        isNewSettlementProposed[token] = true;
        proposedTokenLockTimeframe[token] = _seconds;
        //Add event
    }

    /// @notice This function executes the new settlement period after the timelock
    /// @param token to set time settlement period on
    function executeNewSettlementPeriod(address token) public {
        require(ILERC20(token).admin() == msg.sender, "LSS: Must be Token Admin");
        require(isNewSettlementProposed[token] == true, "LSS: New Settlement not proposed");
        require(changeSettlementTimelock[token] <= block.timestamp, "LSS: Time lock in progress");
        tokenLockTimeframe[token] = proposedTokenLockTimeframe[token];
        isNewSettlementProposed[token] = false;
        //Add event 
    }

    /// @notice This function sets the payout status of a reporter
    /// @param _reporter Reporter address
    /// @param status Payout status 
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) public onlyLosslessEnv {
        reporterClaimStatus[_reporter].reportIdClaimStatus[reportId] = status;
    }

    /// @notice This function adds to the total coefficient per report
    /// @dev It takes part on the claimableAmount calculation of the Lossless Staking contract
    /// @param reportId Report to be added the coefficient
    /// @param _amt Coefficient amount
    function addToReportCoefficient(uint256 reportId, uint256 _amt) external onlyLosslessEnv {
        reportCoefficient[reportId] += _amt;
    }

    /// @notice This function activates the emergency mode
    /// @dev When a report gets generated for a token, it enters an emergency state globally.
    /// This means that the transfers get limited to a 15 minutes cooldown and only for half of the locked funds at a time.
    /// It gets activated by the Lossless Reporting contract .
    /// It deactivated when a resolution has been reached by the Lossless Governance contract.
    /// @param token Token on which the emergency mode must get activated
    function activateEmergency(address token) external onlyLosslessEnv {
        emergencyMode[token].emergency = true;
        emergencyMode[token].emergencyTimestamp = block.timestamp;
        emergencyMode[token].emergencyMappingNum += 1;
    }

    // --- GUARD ---

    // @notice Set a guardian contract.
    // @dev Guardian contract must be trusted as it has some access rights and can modify controller's state.
    function setGuardian(address newGuardian) public onlyLosslessAdmin whenNotPaused {
        emit GuardianSet(guardian, newGuardian);
        guardian = newGuardian;
    }

    // @notice Sets protection for an address with the choosen strategy.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function setProtectedAddress(address token, address protectedAddresss, ProtectionStrategy strategy) external onlyGuardian whenNotPaused {
        Protection storage protection = tokenProtections[token].protections[protectedAddresss];
        protection.isProtected = true;
        protection.strategy = strategy;
        emit ProtectedAddressSet(token, protectedAddresss, address(strategy));
    }

    // @notice Remove the protection from the address.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function removeProtectedAddress(address token, address protectedAddresss) external onlyGuardian whenNotPaused {
        delete tokenProtections[token].protections[protectedAddresss];
        emit RemovedProtectedAddress(token, protectedAddresss);
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
    function getReporterPayoutStatus(address _reporter, uint256 reportId) external view returns (bool) {
        return reporterClaimStatus[_reporter].reportIdClaimStatus[reportId];
    }

    /// @notice This function will calculate the available amount that an address has to transfer. 
    /// @param token Address corresponding to the token being held
    /// @param account Address to get the available amount
    function getAvailableAmount(address token, address account) public view returns (uint256 amount) {
        uint256 total = ILERC20(token).balanceOf(account);
        uint256 locked = getLockedAmount(token, account);
        return total - locked;
    }

    // LOCKs & QUEUES

    /// @notice This function will remove the locks that have already been lifted
    /// @param recipient Address to lift the locks
    function _removeExpiredLocks (address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[msg.sender].queue[recipient];

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
    function _removeUsedUpLocks (uint256 availableAmount, address account, uint256 amount) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[msg.sender].queue[account];

        require(queue.touchedTimestamp + tokenLockTimeframe[msg.sender] <= block.timestamp, "LSS: Transfers limit reached");

        uint256 amountLeft = amount - availableAmount;
        uint i = 1;

        while (amountLeft > 0 && i <= queue.last) {
            ReceiveCheckpoint memory checkpoint;
            checkpoint = queue.lockedFunds[i];

            if ((checkpoint.timestamp - block.timestamp) >= lockCheckpointExpiration)  {
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
    function _enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[msg.sender].queue[recipient];

        if (queue.lockedFunds[queue.last].timestamp == checkpoint.timestamp) {
            queue.lockedFunds[queue.last].amount += checkpoint.amount;
        } else {
            queue.last += 1;
            queue.lockedFunds[queue.last] = checkpoint;
        }
    }

    // --- REPORT RESOLUTION ---

    /// @notice This function retrieves the funds of the reported account
    /// @param _addresses Array of addreses to retrieve the locked funds
    function retrieveBlacklistedFunds(address[] calldata _addresses, address token, uint256 reportId) public onlyLosslessEnv returns(uint256){

        uint256 totalAmount = losslessGovernance.amountReported(reportId);
        
        ILERC20(token).transferOutBlacklistedFunds(_addresses);
                
        (uint256 reporterReward, uint256 losslessFee, uint256 committeeFee, uint256 stakersFee) = losslessReporting.getFees();

        uint256 feesRetrieveAmount = totalAmount * (stakersFee + losslessFee) / 10**2;
        uint256 reporterFeeRetrieveAmount = totalAmount * (reporterReward) / 10**2;

        ILERC20(token).transfer(address(losslessStaking), feesRetrieveAmount);
        ILERC20(token).transfer(address(losslessReporting), reporterFeeRetrieveAmount);
        ILERC20(token).transfer(address(losslessGovernance), totalAmount - feesRetrieveAmount - reporterFeeRetrieveAmount);

        return totalAmount - feesRetrieveAmount - reporterFeeRetrieveAmount;
    }

    // --- BEFORE HOOKS ---

    /// @notice This function evaluates if the transfer can be made
    /// @param sender Address sending the funds
    /// @param recipient Address recieving the funds
    /// @param amount Amount to be transfered
    function _evaluateTransfer(address sender, address recipient, uint256 amount) private returns (bool) {

        uint256 settledAmount = getAvailableAmount(msg.sender, sender);

        if ((emergencyMode[msg.sender].emergencyTimestamp + tokenLockTimeframe[msg.sender] > block.timestamp && amount >= settledAmount)) {
            bool regularTransferInEmergencyStatus;
            regularTransferInEmergencyStatus = emergencyMode[msg.sender].emergencyTransfer[emergencyMode[msg.sender].emergencyMappingNum][sender];
            require(!regularTransferInEmergencyStatus, "LSS: Emergency mode active, one transfer of unsettled tokens per period allowed");

            bool dexTransferInEmergencyStatus;
            dexTransferInEmergencyStatus = emergencyMode[msg.sender].emergencyDexTransfer[emergencyMode[msg.sender].emergencyMappingNum][sender];
            require(!dexList[recipient] && !dexTransferInEmergencyStatus, "LSS: Emergency mode active, cannot transfer unsettled tokens to DEX");

            if (dexList[recipient] && amount > dexTranferThreshold){
                emergencyMode[msg.sender].emergencyDexTransfer[emergencyMode[msg.sender].emergencyMappingNum][sender] = true;
            } else {
                emergencyMode[msg.sender].emergencyTransfer[emergencyMode[msg.sender].emergencyMappingNum][sender] = true;
            }
        } else {
            if (dexList[recipient] && amount > dexTranferThreshold) {
                require(settledAmount >= amount, "LSS: Amt exceeds settled balance");
            } else if (settledAmount < amount) {
                //_removeUsedUpLocks(settledAmount, sender, amount);
                require(settledAmount >= amount, "LSS: Amt exceeds settled balance");
            }
        }

        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(amount, block.timestamp + tokenLockTimeframe[msg.sender]);
        _enqueueLockedFunds(newCheckpoint, recipient);

        return true;
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            tokenProtections[msg.sender].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }

        require(!blacklist[sender], "LSS: You cannot operate");
        require(!blacklist[recipient], "LSS: Recipient is blacklisted");
        
        if (tokenTransferEvaluation[msg.sender] && !dexList[sender]) {
            require(_evaluateTransfer(sender, recipient, amount), "LSS: Transfer evaluation failed");
        }
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            tokenProtections[msg.sender].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }

        require(!blacklist[sender], "LSS: You cannot operate");
        require(!blacklist[recipient], "LSS: Recipient is blacklisted");
        require(!blacklist[msgSender], "LSS: Recipient is blacklisted");

        if (tokenTransferEvaluation[msg.sender]) {
            require(_evaluateTransfer(sender, recipient, amount), "LSS: Transfer evaluation failed");
        }

    }

    function beforeMint(address to, uint256 amount) external {}

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeBurn(address account, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}


    // --- AFTER HOOKS ---
    // * After hooks are deprecated in LERC20 but we have to keep them
    //   here in order to support legacy LERC20.

    function afterMint(address to, uint256 amount) external {}

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterBurn(address account, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {}

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}
