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

interface ILssController {
    function isBlacklisted(address _adr) external returns (bool);
    function getReportLifetime() external returns (uint256);
    function getStakeAmount() external returns (uint256);
    function addToBlacklist(address _adr) external;
    function isWhitelisted(address _adr) external view returns (bool);
    function activateEmergency(address token) external;
}

/// @title Lossless Reporting Contract
/// @author Lossless.cash
/// @notice The Reporting smart contract is in charge of handling all the parts related to creating new reports
contract LosslessReporting is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    uint256 public reporterReward;
    uint256 public losslessFee;

    uint256 public reportCount;

    ILERC20 public losslessToken;
    ILssController public losslessController;
    address controllerAddress;
    address stakingAddress;

    struct TokenReports {
        mapping(address => uint256) reports;
    }

    
    mapping(address => TokenReports) private tokenReports; // Address. reported X address, on report ID

    mapping(uint256 => address) public reporter;
    mapping(uint256 => address) public reportedAddress;
    mapping(uint256 => uint256) public reportTimestamps;
    mapping(uint256 => address) public reportTokens;
    mapping(uint256 => bool) public anotherReports;
    mapping(uint256 => uint256) public amountReported;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event AnotherReportSubmitted(address indexed token, address indexed account, uint256 reportId);

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

    /// @notice Avoids execution form blacklisted addresses
    modifier notBlacklisted() {
        require(!losslessController.isBlacklisted(_msgSender()), "LSS: You cannot operate");
        _;
    }

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin) public initializer {
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        pauseAdmin = _pauseAdmin;
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

    /// @notice This function sets the address of the Lossless Controller contract
    /// @param _adr Address corresponding to the Lossless Controller contract
    function setControllerContractAddress(address _adr) public onlyLosslessAdmin {
        losslessController = ILssController(_adr);
        controllerAddress = _adr;
    }

    /// @notice This function sets the address of the Lossless Staking contract
    /// @param _adr Address corresponding to the Lossless Staking contract
    function setStakingContractAddress(address _adr) public onlyLosslessAdmin {
        stakingAddress = _adr;
    }

    /// @notice This function sets the default reporter reward
    /// @param reward Percentage rewarded to the reporter when a report gets resolved positively
    function setReporterReward(uint256 reward) public onlyLosslessAdmin {
        reporterReward = reward;
    }

    /// @notice This function sets the default Lossless Fee
    /// @param fee Percentage attributed to Lossless when a report gets resolved positively
    function setLosslessFee(uint256 fee) public onlyLosslessAdmin {
        losslessFee = fee;
    }

    // --- GETTERS ---

    /// @notice This function gets the contract version
    /// @return Version of the contract
    function getVersion() public pure returns (uint256) {
        return 1;
    }

    /// @notice This function will return the address of the reporter
    /// @param _reportId Report number
    /// @return The address of the reporter
    function getReporter(uint256 _reportId) public view returns (address) {
        return reporter[_reportId];
    }

    /// @notice This function will return when the report was created
    /// @param _reportId Report number
    /// @return The block timestamp when the report was generated
    function getReportTimestamps(uint256 _reportId) public view returns (uint256) {
        return reportTimestamps[_reportId];
    }

    /// @notice This function will return the token associated with the report
    /// @param _reportId Report number
    /// @return Token address
    function getTokenFromReport(uint256 _reportId) public view returns (address) {
        return reportTokens[_reportId];
    }

    /// @notice This function will return the address that was reported
    /// @param _reportId Report number
    /// @return Potential malicios actor address
    function getReportedAddress(uint256 _reportId) public view returns (address) {
        return reportedAddress[_reportId];
    }

    /// @notice This function will return the Reporter reward and Lossless fee percentage
    /// @return reward Returns the reporter reward
    /// @return fee Returns the Lossless Fee
    function getReporterRewardAndLSSFee() public view returns (uint256 reward, uint256 fee) {
        return (reporterReward, losslessFee);
    }

    /// @notice This function will return the amount of tokens locked by the report
    /// @return Amount of tokens
    function getAmountReported(uint256 reportId) public view returns (uint256) {
        return amountReported[reportId];
    }

    // --- REPORTS ---

    /// @notice This function will generate a report
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a report for and address linked to a token.
    /// Lossless Contracts and Admin addresses cannot be reported.
    /// @param token Token address of the stolen funds
    /// @param account Potential malicious address
    function report(address token, address account) public notBlacklisted {
        require(!losslessController.isWhitelisted(account), "LSS: Cannot report LSS protocol");

        uint256 reportId = tokenReports[token].reports[account];
        uint256 reportLifetime;
        uint256 stakeAmount;

        reportLifetime = losslessController.getReportLifetime();
        stakeAmount = losslessController.getStakeAmount();

        require(reportId == 0 || reportTimestamps[reportId] + reportLifetime < block.timestamp, "LSS: Report already exists");

        reportCount += 1;
        reportId = reportCount;
        reporter[reportId] = _msgSender();

        // Bellow does not allow freezing more than one wallet. Do we want that?
        tokenReports[token].reports[account] = reportId;
        reportTimestamps[reportId] = block.timestamp;
        reportTokens[reportId] = token;

        losslessToken.transferFrom(_msgSender(), stakingAddress, stakeAmount);

        losslessController.addToBlacklist(account);
        reportedAddress[reportId] = account;

        
        amountReported[reportId] = losslessToken.balanceOf(account);

        losslessController.activateEmergency(token);
        emit ReportSubmitted(token, account, reportId);
    }


    /// @notice This function will generate a second report
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a second report linked to the first one created. 
    /// This can be used in the event that the malicious actor is able to frontrun the first report by swapping the tokens or transfering.
    /// @param reportId Report that was previously generated.
    /// @param token Token address of the stolen funds
    /// @param account Potential malicious address
    function reportAnother(uint256 reportId, address token, address account) public notBlacklisted {
        uint256 reportLifetime;
        uint256 reportTimestamp;
        uint256 stakeAmount;

        require(!losslessController.isWhitelisted(account), "LSS: Cannot report LSS protocol");

        reportTimestamp = reportTimestamps[reportId];
        reportLifetime = losslessController.getReportLifetime();
        stakeAmount = losslessController.getStakeAmount();

        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(anotherReports[reportId] == false, "LSS: Another already submitted");
        require(_msgSender() == reporter[reportId], "LSS: invalid reporter");

        anotherReports[reportId] = true;
        tokenReports[token].reports[account] = reportId;
        amountReported[reportId] += losslessToken.balanceOf(account);

        losslessController.addToBlacklist(account);
        reportedAddress[reportId] = account;

        losslessToken.transferFrom(_msgSender(), stakingAddress, stakeAmount);

        emit AnotherReportSubmitted(token, account, reportId);
    }
}