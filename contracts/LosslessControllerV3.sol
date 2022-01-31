// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessGovernance.sol";
import "./Interfaces/ILosslessStaking.sol";
import "./Interfaces/ILosslessReporting.sol";
import "./Interfaces/IProtectionStrategy.sol";

import "hardhat/console.sol";

/// @title Lossless Controller Contract
/// @notice The controller contract is in charge of the communication and senstive data among all Lossless Environment Smart Contracts
contract LosslessControllerV3 is ILssController, Initializable, ContextUpgradeable, PausableUpgradeable {
    
    // IMPORTANT!: For future reference, when adding new variables for following versions of the controller. 
    // All the previous ones should be kept in place and not change locations, types or names.
    // If thye're modified this would cause issues with the memory slots.

    address override public pauseAdmin;
    address override public admin;
    address override public recoveryAdmin;

    // --- V2 VARIABLES ---

    address override public guardian;
    mapping(ILERC20 => Protections) private tokenProtections;

    struct Protection {
        bool isProtected;
        ProtectionStrategy strategy;
    }

    struct Protections {
        mapping(address => Protection) protections;
    }

    // --- V3 VARIABLES ---

    ILssStaking override public losslessStaking;
    ILssReporting override public losslessReporting;
    ILssGovernance override public losslessGovernance;

    struct LocksQueue {
        mapping(uint256 => ReceiveCheckpoint) lockedFunds;
        uint256 touchedTimestamp;
        uint256 first;
        uint256 last;
    }

    struct TokenLockedFunds {
        mapping(address => LocksQueue) queue;
    }

    mapping(ILERC20 => TokenLockedFunds) private tokenScopedLockedFunds;
    
    struct ReceiveCheckpoint {
        uint256 amount;
        uint256 timestamp;
    }
    
    uint256 public constant HUNDRED = 1e2;
    uint256 override public dexTranferThreshold;
    uint256 override public settlementTimeLock;

    mapping(address => bool) override public dexList;
    mapping(address => bool) override public whitelist;
    mapping(address => bool) override public blacklist;

    struct TokenConfig {
        uint256 tokenLockTimeframe;
        uint256 proposedTokenLockTimeframe;
        uint256 changeSettlementTimelock;
        uint256 emergencyMode;
    }

    mapping(ILERC20 => TokenConfig) tokenConfig;

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

    function isAddressProtected(ILERC20 _token, address _protectedAddress) public view returns (bool) {
        return tokenProtections[_token].protections[_protectedAddress].isProtected;
    }

    function getProtectedAddressStrategy(ILERC20 _token, address _protectedAddress) external view returns (address) {
        require(isAddressProtected(_token, _protectedAddress), "LSS: Address not protected");
        return address(tokenProtections[_token].protections[_protectedAddress].strategy);
    }

    // --- ADMINISTRATION ---

    function pause() override public onlyPauseAdmin  {
        _pause();
    }    
    
    function unpause() override public onlyPauseAdmin {
        _unpause();
    }

    /// @notice This function sets a new admin
    /// @dev Only can be called by the Recovery admin
    /// @param _newAdmin Address corresponding to the new Lossless Admin
    function setAdmin(address _newAdmin) override public onlyLosslessRecoveryAdmin {
        require(_newAdmin != admin, "LERC20: Cannot set same address");
        emit AdminChange(_newAdmin);
        admin = _newAdmin;
    }

    /// @notice This function sets a new recovery admin
    /// @dev Only can be called by the previous Recovery admin
    /// @param _newRecoveryAdmin Address corresponding to the new Lossless Recovery Admin
    function setRecoveryAdmin(address _newRecoveryAdmin) override public onlyLosslessRecoveryAdmin {
        require(_newRecoveryAdmin != recoveryAdmin, "LERC20: Cannot set same address");
        emit RecoveryAdminChange(_newRecoveryAdmin);
        recoveryAdmin = _newRecoveryAdmin;
    }

    /// @notice This function sets a new pause admin
    /// @dev Only can be called by the Recovery admin
    /// @param _newPauseAdmin Address corresponding to the new Lossless Recovery Admin
    function setPauseAdmin(address _newPauseAdmin) override public onlyLosslessRecoveryAdmin {
        require(_newPauseAdmin != pauseAdmin, "LERC20: Cannot set same address");
        emit PauseAdminChange(_newPauseAdmin);
        pauseAdmin = _newPauseAdmin;
    }


    // --- V3 SETTERS ---

    /// @notice This function sets the timelock for tokens to change the settlement period
    /// @dev Only can be called by the Lossless Admin
    /// @param _newTimelock Timelock in seconds
    function setSettlementTimeLock(uint256 _newTimelock) override public onlyLosslessAdmin {
        require(_newTimelock != settlementTimeLock, "LSS: Cannot set same value");
        settlementTimeLock = _newTimelock;
        emit NewSettlementTimelock(settlementTimeLock);
    }

    /// @notice This function sets the transfer threshold for Dexes
    /// @dev Only can be called by the Lossless Admin
    /// @param _newThreshold Timelock in seconds
    function setDexTransferThreshold(uint256 _newThreshold) override public onlyLosslessAdmin {
        require(_newThreshold != dexTranferThreshold, "LSS: Cannot set same value");
        dexTranferThreshold = _newThreshold;
        emit NewDexThreshold(dexTranferThreshold);
    }
    
    /// @notice This function removes or adds an array of dex addresses from the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _dexList List of dex addresses to add or remove
    /// @param _value True if the addresses are bieng added, false if removed
    function setDexList(address[] calldata _dexList, bool _value) override public onlyLosslessAdmin {
        for(uint256 i = 0; i < _dexList.length; i++) {

            address adr = _dexList[i];
            require(!blacklist[adr], "LSS: An address is blacklisted");

            dexList[adr] = _value;

            if (_value) {
                emit NewDex(adr);
            } else {
                emit DexRemoval(adr);
            }
        }
    }

    /// @notice This function removes or adds an array of addresses from the whitelst
    /// @dev Only can be called by the Lossless Admin, only Lossless addresses 
    /// @param _addrList List of addresses to add or remove
    /// @param _value True if the addresses are bieng added, false if removed
    function setWhitelist(address[] calldata _addrList, bool _value) override public onlyLosslessAdmin {
        for(uint256 i = 0; i < _addrList.length) {

            address adr = _addrList[i];
            require(!blacklist[adr], "LSS: An address is blacklisted");

            whitelist[adr] = _value;

            if (_value) {
                emit NewWhitelistedAddress(adr);
            } else {
                emit WhitelistedAddressRemoval(adr);
            }

            unchecked {i++;}
        }
    }

    /// @notice This function adds an address to the blacklist
    /// @dev Only can be called by the Lossless Admin, and from other Lossless Contracts
    /// The address gets blacklisted whenever a report is created on them.
    /// @param _adr Address corresponding to be added to the blacklist mapping
    function addToBlacklist(address _adr) override public onlyLosslessEnv {
        blacklist[_adr] = true;
        emit NewBlacklistedAddress(_adr);
    }

    /// @notice This function removes an address from the blacklist
    /// @dev Can only be called from other Lossless Contracts, used mainly in Lossless Governance
    /// @param _adr Address corresponding to be removed from the blacklist mapping
    function resolvedNegatively(address _adr) override public onlyLosslessEnv {
        blacklist[_adr] = false;
        emit AccountBlacklistRemoval(_adr);
    }
    
    /// @notice This function sets the address of the Lossless Staking contract
    /// @param _adr Address corresponding to the Lossless Staking contract
    function setStakingContractAddress(ILssStaking _adr) override public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        require(_adr != losslessStaking, "LSS: Cannot set same value");
        losslessStaking = _adr;
        emit NewStakingContract(_adr);
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @param _adr Address corresponding to the Lossless Reporting contract
    function setReportingContractAddress(ILssReporting _adr) override public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        require(_adr != losslessReporting, "LSS: Cannot set same value");
        losslessReporting = _adr;
        emit NewReportingContract(_adr);
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @param _adr Address corresponding to the Lossless Governance contract
    function setGovernanceContractAddress(ILssGovernance _adr) override public onlyLosslessAdmin {
        require(address(_adr) != address(0), "LERC20: Cannot be zero address");
        require(_adr != losslessGovernance, "LSS: Cannot set same value");
        losslessGovernance = _adr;
        emit NewGovernanceContract(_adr);
    }

    /// @notice This function starts a new proposal to change the SettlementPeriod
    /// @param _token to propose the settlement change period on
    /// @param _seconds Time frame that the recieved funds will be locked
    function proposeNewSettlementPeriod(ILERC20 _token, uint256 _seconds) override public {

        TokenConfig storage config = tokenConfig[_token];

        require(msg.sender == _token.admin(), "LSS: Must be Token Admin");
        require(config.changeSettlementTimelock <= block.timestamp, "LSS: Time lock in progress");
        config.changeSettlementTimelock = block.timestamp + settlementTimeLock;
        config.proposedTokenLockTimeframe = _seconds;
        emit NewSettlementPeriodProposal(_token, _seconds);
    }

    /// @notice This function executes the new settlement period after the timelock
    /// @param _token to set time settlement period on
    function executeNewSettlementPeriod(ILERC20 _token) override public {

        TokenConfig storage config = tokenConfig[_token];

        require(msg.sender == _token.admin(), "LSS: Must be Token Admin");
        require(config.proposedTokenLockTimeframe != 0, "LSS: New Settlement not proposed");
        require(config.changeSettlementTimelock <= block.timestamp, "LSS: Time lock in progress");
        config.tokenLockTimeframe = config.proposedTokenLockTimeframe;
        config.proposedTokenLockTimeframe = 0; 
        emit SettlementPeriodChange(_token, config.tokenLockTimeframe);
    }

    /// @notice This function activates the emergency mode
    /// @dev When a report gets generated for a token, it enters an emergency state globally.
    /// The emergency period will be active for one settlement period.
    /// During this time users can only transfer settled tokens
    /// @param _token Token on which the emergency mode must get activated
    function activateEmergency(ILERC20 _token) override external onlyLosslessEnv {
        tokenConfig[_token].emergencyMode = block.timestamp;
        emit EmergencyActive(_token);
    }

    /// @notice This function deactivates the emergency mode
    /// @param _token Token on which the emergency mode will be deactivated
    function deactivateEmergency(ILERC20 _token) override external onlyLosslessEnv {
        tokenConfig[_token].emergencyMode = 0;
        emit EmergencyDeactivation(_token);
    }

   // --- GUARD ---

    // @notice Set a guardian contract.
    // @dev Guardian contract must be trusted as it has some access rights and can modify controller's state.
    function setGuardian(address _newGuardian) override external onlyLosslessAdmin whenNotPaused {
        require(_newGuardian != address(0), "LSS: Cannot be zero address");
        emit GuardianSet(guardian, _newGuardian);
        guardian = _newGuardian;
    }

    // @notice Sets protection for an address with the choosen strategy.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function setProtectedAddress(ILERC20 _token, address _protectedAddress, ProtectionStrategy _strategy) override external onlyGuardian whenNotPaused {
        Protection storage protection = tokenProtections[_token].protections[_protectedAddress];
        protection.isProtected = true;
        protection.strategy = _strategy;
        emit NewProtectedAddress(_token, _protectedAddress, address(_strategy));
    }

    // @notice Remove the protection from the address.
    // @dev Strategies are verified in the guardian contract.
    // @dev This call is initiated from a strategy, but guardian proxies it.
    function removeProtectedAddress(ILERC20 _token, address _protectedAddress) override external onlyGuardian whenNotPaused {
        require(isAddressProtected(_token, _protectedAddress), "LSS: Address not protected");
        delete tokenProtections[_token].protections[_protectedAddress];
        emit RemovedProtectedAddress(_token, _protectedAddress);
    }

    /// @notice This function will return the non-settled tokens amount
    /// @dev Overflow is not possible because the account cannot receive more than the total supply of the token. Token supply cannot be larger than type(uint256).max.
    /// @param _token Address corresponding to the token being held
    /// @param _account Address to get the available amount
    /// @return Returns the amount of locked funds
    function getLockedAmount(ILERC20 _token, address _account) override public view returns (uint256) {
        uint256 lockedAmount = 0;
        
        LocksQueue storage queue = tokenScopedLockedFunds[_token].queue[_account];

        uint i = queue.first;
        uint256 lastItem = queue.last;

        while (i <= lastItem) {
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
    /// @param _account Address to get the available amount
    function getAvailableAmount(ILERC20 _token, address _account) override public view returns (uint256 amount) {
        uint256 total = _token.balanceOf(_account);
        uint256 locked = getLockedAmount(_token, _account);
        return total - locked;
    }

    // LOCKs & QUEUES

    /// @notice This function add transfers to the lock queues
    /// @param _checkpoint timestamp of the transfer
    /// @param _recipient Address to add the locks
    function _enqueueLockedFunds(ReceiveCheckpoint memory _checkpoint, address _recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[ILERC20(msg.sender)].queue[_recipient];

        uint lastItem = queue.last;
        
        ReceiveCheckpoint storage lastCheckpoint = queue.lockedFunds[lastItem];

        if (lastCheckpoint.timestamp < _checkpoint.timestamp) {
            queue.lockedFunds[lastItem + 1] = _checkpoint;
            queue.last += 1;
        } else if (lastCheckpoint.timestamp >= _checkpoint.timestamp) {
            lastCheckpoint.amount += _checkpoint.amount;
        }
    }

    // --- REPORT RESOLUTION ---

    /// @notice This function retrieves the funds of the reported account
    /// @param _addresses Array of addreses to retrieve the locked funds
    /// @param _token Token to retrieve the funds from
    /// @param _reportId Report Id related to the incident
    function retrieveBlacklistedFunds(address[] calldata _addresses, ILERC20 _token, uint256 _reportId) override public onlyLosslessEnv returns(uint256){
        uint256 totalAmount = losslessGovernance.getAmountReported(_reportId);
        
        _token.transferOutBlacklistedFunds(_addresses);
                
        (uint256 reporterReward, uint256 losslessReward, uint256 committeeReward, uint256 stakersReward) = losslessReporting.getRewards();

        uint256 toLssStaking = totalAmount * stakersReward / HUNDRED;
        uint256 toLssReporting = totalAmount * reporterReward / HUNDRED;
        uint256 toLssGovernance = totalAmount - toLssStaking - toLssReporting;

        require(_token.transfer(address(losslessStaking), toLssStaking), "LSS: Staking retrieval failed");
        require(_token.transfer(address(losslessReporting), toLssReporting), "LSS: Reporting retrieval failed");
        require(_token.transfer(address(losslessGovernance), toLssGovernance), "LSS: Governance retrieval failed");

        return totalAmount - toLssStaking - toLssReporting - (totalAmount * (committeeReward + losslessReward) / HUNDRED);
    }


    /// @notice This function will lift the locks after a certain amount
    /// @dev The condition to lift the locks is that their checkpoint should be greater than the set amount
    /// @param _availableAmount Unlocked Amount
    /// @param _account Address to lift the locks
    /// @param _amount Amount to lift
    function _removeUsedUpLocks (uint256 _availableAmount, address _account, uint256 _amount) private {
        LocksQueue storage queue;
        ILERC20 token = ILERC20(msg.sender);
        
        queue = tokenScopedLockedFunds[token].queue[_account];

        require(queue.touchedTimestamp + tokenConfig[token].tokenLockTimeframe <= block.timestamp, "LSS: Transfers limit reached");

        uint256 amountLeft =  _amount - _availableAmount;
        uint256 i = queue.first;
        uint256 lastItem = queue.last;
        
        while (amountLeft > 0 && i <= lastItem) {
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
    /// @param _recipient Address to lift the locks
    function _removeExpiredLocks (address _recipient) private {
        LocksQueue storage queue;
        queue = tokenScopedLockedFunds[ILERC20(msg.sender)].queue[_recipient];

        uint i = queue.first;
        uint256 lastItem = queue.last;

        ReceiveCheckpoint memory checkpoint = queue.lockedFunds[i];

        console.log("lastItem %s", lastItem);
        while (checkpoint.timestamp <= block.timestamp && i <= lastItem) {
            console.log("checkpoint.timestamp %s", checkpoint.timestamp);
            console.log("i %s", i);
            delete queue.lockedFunds[i];
            i += 1;
            checkpoint = queue.lockedFunds[i];
            queue.first += 1;
        }
    }


    // --- BEFORE HOOKS ---

    /// @notice This function evaluates if the transfer can be made
    /// @param _sender Address sending the funds
    /// @param _recipient Address recieving the funds
    /// @param _amount Amount to be transfered
    function _evaluateTransfer(address _sender, address _recipient, uint256 _amount) private returns (bool) {
        ILERC20 token = ILERC20(msg.sender);
        uint256 settledAmount = getAvailableAmount(token, _sender);
        
        TokenConfig storage config = tokenConfig[token];

        if (_amount > settledAmount) {
            require(config.emergencyMode + config.tokenLockTimeframe < block.timestamp,
                    "LSS: Emergency mode active, cannot transfer unsettled tokens");
            if (dexList[_recipient]) {
                require(_amount - settledAmount <= dexTranferThreshold,
                        "LSS: Cannot transfer over the dex threshold");
            } else {
                _removeUsedUpLocks(settledAmount, _sender, _amount);
            }
        }

        ReceiveCheckpoint memory newCheckpoint = ReceiveCheckpoint(_amount, block.timestamp + config.tokenLockTimeframe);
        _enqueueLockedFunds(newCheckpoint, _recipient);
        _removeExpiredLocks(_recipient);
        return true;
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransfer(address _sender, address _recipient, uint256 _amount) override external {
        ILERC20 token = ILERC20(msg.sender);
        if (tokenProtections[token].protections[_sender].isProtected) {
            tokenProtections[token].protections[_sender].strategy.isTransferAllowed(msg.sender, _sender, _recipient, _amount);
        }

        require(!blacklist[_sender], "LSS: You cannot operate");
        
        if (tokenConfig[token].tokenLockTimeframe != 0) {
            _evaluateTransfer(_sender, _recipient, _amount);
        }
    }

    /// @notice If address is protected, transfer validation rules have to be run inside the strategy.
    /// @dev isTransferAllowed reverts in case transfer can not be done by the defined rules.
    function beforeTransferFrom(address _msgSender, address _sender, address _recipient, uint256 _amount) override external {
        ILERC20 token = ILERC20(msg.sender);

        if (tokenProtections[token].protections[_sender].isProtected) {
            tokenProtections[token].protections[_sender].strategy.isTransferAllowed(msg.sender, _sender, _recipient, _amount);
        }

        require(!blacklist[_msgSender], "LSS: You cannot operate");
        require(!blacklist[_sender], "LSS: Sender is blacklisted");

        if (tokenConfig[token].tokenLockTimeframe != 0) {
            _evaluateTransfer(_sender, _recipient, _amount);
        }

    }

    // The following before hooks are in place as a placeholder for future products.
    // Also to preserve legacy LERC20 compatibility
    
    function beforeMint(address _to, uint256 _amount) override external {}

    function beforeApprove(address _sender, address _spender, uint256 _amount) override external {}

    function beforeBurn(address _account, uint256 _amount) override external {}

    function beforeIncreaseAllowance(address _msgSender, address _spender, uint256 _addedValue) override external {}

    function beforeDecreaseAllowance(address _msgSender, address _spender, uint256 _subtractedValue) override external {}


    // --- AFTER HOOKS ---
    // * After hooks are deprecated in LERC20 but we have to keep them
    //   here in order to support legacy LERC20.

    function afterMint(address _to, uint256 _amount) external {}

    function afterApprove(address _sender, address _spender, uint256 _amount) external {}

    function afterBurn(address _account, uint256 _amount) external {}

    function afterTransfer(address _sender, address _recipient, uint256 _amount) external {}

    function afterTransferFrom(address _msgSender, address _sender, address _recipient, uint256 _amount) external {}

    function afterIncreaseAllowance(address _sender, address _spender, uint256 _addedValue) external {}

    function afterDecreaseAllowance(address _sender, address _spender, uint256 _subtractedValue) external {}
}
