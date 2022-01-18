// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessGovernance.sol";
import "./Interfaces/ILosslessStaking.sol";
import "./Interfaces/ILosslessReporting.sol";

interface ProtectionStrategy {
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external;
}

/// @title Lossless Controller Contract
/// @notice The controller contract is in charge of the communication and senstive data among all Lossless Environment Smart Contracts
contract LosslessControllerV3 is Initializable, ContextUpgradeable, PausableUpgradeable {
    
    // IMPORTANT!: For future reference, when adding new variables for following versions of the controller. 
    // All the previous ones should be kept in place and not change locations, types or names.
    // If thye're modified this would cause issues with the memory slots.

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

    uint256 public dexTranferThreshold;

    uint256 public settlementTimeLock;
    mapping(ILERC20 => uint256) public tokenLockTimeframe;
    mapping(ILERC20 => uint256) public proposedTokenLockTimeframe;
    mapping(ILERC20 => uint256) public changeSettlementTimelock;
    mapping(ILERC20 => bool) public isNewSettlementProposed;

    ILERC20 public stakingToken;
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

    mapping(ILERC20 => TokenLockedFunds) private tokenScopedLockedFunds;
  
    mapping(address => bool) public dexList;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;

    mapping(ILERC20 => uint256) private emergencyMode;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    // --- V2 EVENTS ---

    event GuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event ProtectedAddressSet(address indexed token, address indexed protectedAddress, address indexed strategy);
    event RemovedProtectedAddress(address indexed token, address indexed protectedAddress);

    // --- V3 EVENTS ---

    event NewSettlementPeriodProposed(address token, uint256 _seconds);
    event SettlementPeriodChanged(address token, uint256 proposedTokenLockTimeframe);

    // --- MODIFIERS ---

    /// @notice Avoids execution from other than the Recovery Admin
    modifier onlyLosslessRecoveryAdmin() {
        require(msg.sender == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    /// @notice Avoids execution from other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(msg.sender == admin, "LSS: Must be admin");
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

    // --- VIEWS ---

    /// @notice This function will return the contract version 
    function getVersion() external pure returns (uint256) {
        return 3;
    }

        // --- V2 VIEWS ---

    function isAddressProtected(address token, address protectedAddress) external view returns (bool) {
        return tokenProtections[token].protections[protectedAddress].isProtected;
    }

    function getProtectedAddressStrategy(address token, address protectedAddress) external view returns (address) {
        return address(tokenProtections[token].protections[protectedAddress].strategy);
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
        require(newAdmin != address(0), "LERC20: Cannot be zero address");
        require(newAdmin != admin, "LERC20: Cannot set same address");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice This function sets a new recovery admin
    /// @dev Only can be called by the previous Recovery admin
    /// @param newRecoveryAdmin Address corresponding to the new Lossless Recovery Admin
    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        require(newRecoveryAdmin != address(0), "LERC20: Cannot be zero address");
        require(newRecoveryAdmin != recoveryAdmin, "LERC20: Cannot set same address");
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    /// @notice This function sets a new pause admin
    /// @dev Only can be called by the Recovery admin
    /// @param newPauseAdmin Address corresponding to the new Lossless Recovery Admin
    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        require(newPauseAdmin != address(0), "LERC20: Cannot be zero address");
        require(newPauseAdmin != pauseAdmin, "LERC20: Cannot set same address");
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }


    // --- V3 SETTERS ---

    /// @notice This function sets the timelock for tokens to change the settlement period
    /// @dev Only can be called by the Lossless Admin
    /// @param newTimelock Timelock in seconds
    function setSettlementTimeLock(uint256 newTimelock) public onlyLosslessAdmin {
        settlementTimeLock = newTimelock;
    }

    /// @notice This function sets the transfer threshold for Dexes
    /// @dev Only can be called by the Lossless Admin
    /// @param newThreshold Timelock in seconds
    function setDexTransferThreshold(uint256 newThreshold) public onlyLosslessAdmin {
        dexTranferThreshold = newThreshold;
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

    /// @notice This function adds an address to the blacklist
    /// @dev Only can be called by the Lossless Admin, and from other Lossless Contracts
    /// The address gets blacklisted whenever a report is created on them.
    /// @param _adr Address corresponding to be added to the blacklist mapping
    function addToBlacklist(address _adr) public onlyLosslessEnv {
        blacklist[_adr] = true;
    }

    /// @notice This function removes an address from the blacklist
    /// @dev Can only be called from other Lossless Contracts, used mainly in Lossless Governance
    /// @param _adr Address corresponding to be removed from the blacklist mapping
    function resolvedNegatively(address _adr) public onlyLosslessEnv {
        blacklist[_adr] = false;
    }
    
    /// @notice This function sets the address of the Lossless Staking contract
    /// @param _adr Address corresponding to the Lossless Staking contract
    function setStakingContractAddress(ILssStaking _adr) public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        losslessStaking = _adr;
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @param _adr Address corresponding to the Lossless Reporting contract
    function setReportingContractAddress(ILssReporting _adr) public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        losslessReporting = _adr;
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @param _adr Address corresponding to the Lossless Governance contract
    function setGovernanceContractAddress(ILssGovernance _adr) public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = _adr;
    }

    /// @notice This function starts a new proposal to change the SettlementPeriod
    /// @param _token to propose the settlement change period on
    /// @param _seconds Time frame that the recieved funds will be locked
    function proposeNewSettlementPeriod(ILERC20 _token, uint256 _seconds) public {
        require(_token.admin() == msg.sender, "LSS: Must be Token Admin");
        require(changeSettlementTimelock[_token] <= block.timestamp, "LSS: Time lock in progress");
        changeSettlementTimelock[_token] = block.timestamp + settlementTimeLock;
        isNewSettlementProposed[_token] = true;
        proposedTokenLockTimeframe[_token] = _seconds;
        emit NewSettlementPeriodProposed(address(_token), _seconds);
    }

    /// @notice This function executes the new settlement period after the timelock
    /// @param _token to set time settlement period on
    function executeNewSettlementPeriod(ILERC20 _token) public {
        require(_token.admin() == msg.sender, "LSS: Must be Token Admin");
        require(isNewSettlementProposed[_token] == true, "LSS: New Settlement not proposed");
        require(changeSettlementTimelock[_token] <= block.timestamp, "LSS: Time lock in progress");
        tokenLockTimeframe[_token] = proposedTokenLockTimeframe[_token];
        isNewSettlementProposed[_token] = false;
        proposedTokenLockTimeframe[_token] = 0; 
        emit SettlementPeriodChanged(address(_token), tokenLockTimeframe[_token]);
    }

    /// @notice This function activates the emergency mode
    /// @dev When a report gets generated for a token, it enters an emergency state globally.
    /// The emergency period will be active for one settlement period.
    /// During this time users can only transfer settled tokens
    /// @param _token Token on which the emergency mode must get activated
    function activateEmergency(ILERC20 _token) external onlyLosslessEnv {
        emergencyMode[_token] = block.timestamp;
    }

    /// @notice This function deactivates the emergency mode
    /// @param _token Token on which the emergency mode will be deactivated
    function deactivateEmergency(ILERC20 _token) external onlyLosslessEnv {
        emergencyMode[_token] = 0;
    }

   // --- GUARD ---

    // @notice Set a guardian contract.
    // @dev Guardian contract must be trusted as it has some access rights and can modify controller's state.
    function setGuardian(address newGuardian) external onlyLosslessAdmin whenNotPaused {
        require(newGuardian != address(0), "LSS: Cannot be zero address");
        emit GuardianSet(guardian, newGuardian);
        guardian = newGuardian;
    }

    // @notice Sets protection for an address with the choosen strategy.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function setProtectedAddress(address token, address protectedAddress, ProtectionStrategy strategy) external onlyGuardian whenNotPaused {
        Protection storage protection = tokenProtections[token].protections[protectedAddress];
        protection.isProtected = true;
        protection.strategy = strategy;
        emit ProtectedAddressSet(token, protectedAddress, address(strategy));
    }

    // @notice Remove the protection from the address.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function removeProtectedAddress(address token, address protectedAddresss) external onlyGuardian whenNotPaused {
        delete tokenProtections[token].protections[protectedAddresss];
        emit RemovedProtectedAddress(token, protectedAddresss);
    }

    /// @notice This function will return the non-settled tokens amount
    /// @param _token Address corresponding to the token being held
    /// @param account Address to get the available amount
    /// @return Returns the amount of locked funds
    function getLockedAmount(ILERC20 _token, address account) public view returns (uint256) {
        uint256 lockedAmount;
        
        LocksQueue storage queue = tokenScopedLockedFunds[_token].queue[account];

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
    /// @param _token Address corresponding to the token being held
    /// @param account Address to get the available amount
    function getAvailableAmount(ILERC20 _token, address account) public view returns (uint256 amount) {
        uint256 total = _token.balanceOf(account);
        uint256 locked = getLockedAmount(_token, account);
        return total - locked;
    }

    // LOCKs & QUEUES

    /// @notice This function add transfers to the lock queues
    /// @param checkpoint timestamp of the transfer
    /// @param recipient Address to add the locks
    function _enqueueLockedFunds(ReceiveCheckpoint memory checkpoint, address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[ILERC20(msg.sender)].queue[recipient];
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
    /// @param _token Token to retrieve the funds from
    /// @param reportId Report Id related to the incident
    function retrieveBlacklistedFunds(address[] calldata _addresses, ILERC20 _token, uint256 reportId) public onlyLosslessEnv returns(uint256){
        uint256 totalAmount = losslessGovernance.amountReported(reportId);
        
        _token.transferOutBlacklistedFunds(_addresses);
                
        (uint256 reporterReward, uint256 losslessReward, uint256 committeeReward, uint256 stakersReward) = losslessReporting.getRewards();

        uint256 toLssStaking = totalAmount * stakersReward / 10**2;
        uint256 toLssReporting = totalAmount * reporterReward / 10**2;
        uint256 toLssGovernance = totalAmount - toLssStaking - toLssReporting;

        require(_token.transfer(address(losslessStaking), toLssStaking), "LSS: Error on Staking retrieval");
        require(_token.transfer(address(losslessReporting), toLssReporting), "LSS: Error on Reportin retrieval");
        require(_token.transfer(address(losslessGovernance), toLssGovernance), "LSS: Error on Gov retrieval");

        return totalAmount - toLssStaking - toLssReporting - (totalAmount * (committeeReward + losslessReward) / 10**2);
    }


    /// @notice This function will lift the locks after a certain amount
    /// @dev The condition to lift the locks is that their checkpoint should be greater than the set amount
    /// @param availableAmount Unlocked Amount
    /// @param account Address to lift the locks
    /// @param amount Amount to lift
    function _removeUsedUpLocks (uint256 availableAmount, address account, uint256 amount) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[ILERC20(msg.sender)].queue[account];

        require(queue.touchedTimestamp + tokenLockTimeframe[ILERC20(msg.sender)] <= block.timestamp, "LSS: Transfers limit reached");

        uint256 amountLeft =  amount - availableAmount;
        uint256 i = queue.first;
        
        while (amountLeft > 0 && i <= queue.last) {
            ReceiveCheckpoint storage checkpoint = queue.lockedFunds[i];
            if (checkpoint.amount > amountLeft) {
                checkpoint.amount -= amountLeft;
                delete amountLeft;
            } else {
                amountLeft -= checkpoint.amount;
                delete checkpoint.amount;
            }
            i += 1;
        }

        queue.touchedTimestamp = block.timestamp;
    }

    /// @notice This function will remove the locks that have already been lifted
    /// @param recipient Address to lift the locks
    function _removeExpiredLocks (address recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[ILERC20(msg.sender)].queue[recipient];

        uint i = queue.first;
        ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];

        while (checkpoint.timestamp <= block.timestamp && i <= queue.last) {
            delete queue.lockedFunds[i];
            i += 1;
            checkpoint = queue.lockedFunds[i];
        }
    }


    // --- BEFORE HOOKS ---

    /// @notice This function evaluates if the transfer can be made
    /// @param sender Address sending the funds
    /// @param recipient Address recieving the funds
    /// @param amount Amount to be transfered
    function _evaluateTransfer(address sender, address recipient, uint256 amount) private returns (bool) {
        uint256 settledAmount = getAvailableAmount(ILERC20(msg.sender), sender);
        if (amount > settledAmount) {
            require(emergencyMode[ILERC20(msg.sender)] + tokenLockTimeframe[ILERC20(msg.sender)] < block.timestamp,
                    "LSS: Emergency mode active, cannot transfer unsettled tokens");
            if (dexList[recipient]) {
                require(amount - settledAmount <= dexTranferThreshold,
                        "LSS: Cannot transfer over the dex threshold");
            } else {
                _removeUsedUpLocks(settledAmount, sender, amount);
            }
        }

        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(amount, block.timestamp + tokenLockTimeframe[ILERC20(msg.sender)]);
        _enqueueLockedFunds(newCheckpoint, recipient);
        _removeExpiredLocks(recipient);
        return true;
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransfer(address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            tokenProtections[msg.sender].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }

        require(!blacklist[sender], "LSS: You cannot operate");
        
        if (tokenLockTimeframe[ILERC20(msg.sender)] != 0) {
            _evaluateTransfer(sender, recipient, amount);
        }
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {
        if (tokenProtections[msg.sender].protections[sender].isProtected) {
            tokenProtections[msg.sender].protections[sender].strategy.isTransferAllowed(msg.sender, sender, recipient, amount);
        }

        require(!blacklist[msgSender], "LSS: You cannot operate");
        require(!blacklist[sender], "LSS: Sender is blacklisted");

        if (tokenLockTimeframe[ILERC20(msg.sender)] != 0) {
            _evaluateTransfer(sender, recipient, amount);
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
