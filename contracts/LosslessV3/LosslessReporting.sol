// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface ILERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function admin() external view returns (address);
}

interface ILssController {
    function blacklist(address _adr) external returns (bool);
    function reportingAmount() external returns (uint256);
    function addToBlacklist(address _adr) external;
    function whitelist(address _adr) external view returns (bool);
    function activateEmergency(address token) external;
    function admin() external view returns (address);
    function pauseAdmin() external view returns (address);
    function getReporterPayoutStatus(address _reporter, uint256 reportId) external view returns (bool);
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) external; 
}

interface ILssGovernance {
    function isReportSolved(uint256 reportId) external returns (bool);
    function reportResolution(uint256 reportId) external view returns(bool);
}

interface ILssStaking {
    function reporterClaimableAmount(uint256 reportId) external view returns (uint256);
}

/// @title Lossless Reporting Contract
/// @author Lossless.cash
/// @notice The Reporting smart contract is in charge of handling all the parts related to creating new reports
contract LosslessReporting is Initializable, ContextUpgradeable, PausableUpgradeable {
    uint256 public reporterReward;
    uint256 public losslessFee;
    uint256 public stakersFee;
    uint256 public committeeFee;

    uint256 public reportLifetime;
    uint256 public reportingAmount;

    uint256 public reportCount;

    ILERC20 public losslessToken;
    ILssController public losslessController;
    ILssGovernance public losslessGovernance;
    ILssStaking public losslessStaking;

    struct TokenReports {
        mapping(address => uint256) reports;
    }

    mapping(address => TokenReports) private tokenReports;

    mapping(uint256 => address) public reporter;
    mapping(uint256 => address) public reportedAddress;
    mapping(uint256 => address) public secondReportedAddress;
    mapping(uint256 => uint256) public reportTimestamps;
    mapping(uint256 => address) public reportTokens;
    mapping(uint256 => bool) public secondReports;


    event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event SecondReportsubmitted(address indexed token, address indexed account, uint256 reportId);

    // --- MODIFIERS ---

    /// @notice Avoids execution from other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == msg.sender, "LSS: Must be admin");
        _;
    }

    /// @notice Avoids execution from other than the Pause Admin
    modifier onlyPauseAdmin() {
        require(msg.sender == losslessController.pauseAdmin(), "LSS: Must be pauseAdmin");
        _;
    }

    /// @notice Avoids execution from blacklisted addresses
    modifier notBlacklisted() {
        require(!losslessController.blacklist(msg.sender), "LSS: You cannot operate");
        _;
    }

    function initialize(address _losslessController) public initializer {
        losslessController = ILssController(_losslessController);
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

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessToken Address corresponding to the Lossless Governance Token
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        require(_losslessToken != address(0), "LERC20: Cannot be zero address");
        losslessToken = ILERC20(_losslessToken);
    }

    /// @notice This function sets the address of the Lossless Governance smart contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance smart contract
    function setLosslessGovernance(address _losslessGovernance) public onlyLosslessAdmin {
        require(_losslessGovernance != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = ILssGovernance(_losslessGovernance);
    }

    /// @notice This function sets the address of the Lossless Staking smart contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessStaking Address corresponding to the Lossless Staking smart contract
    function setLosslessStaking(address _losslessStaking) public onlyLosslessAdmin {
        losslessStaking = ILssStaking(_losslessStaking);
    }

    /// @notice This function sets the amount of tokens to be staked when reporting or staking
    /// @param _reportingAmount Amount to be staked
    function setReportingAmount(uint256 _reportingAmount) public onlyLosslessAdmin {
        reportingAmount = _reportingAmount;
    }

    /// @notice This function sets the default reporter reward
    /// @param reward Percentage rewarded to the reporter when a report gets resolved positively
    function setReporterReward(uint256 reward) public onlyLosslessAdmin {
        reporterReward = reward;
    }

    /// @notice This function sets the default Lossless Fee
    /// @param fee Percentage attributed to Lossless when a report gets resolved positively
    function setLosslessFee(uint256 fee) public onlyLosslessAdmin {
        require(0 < fee && fee < 100, "LSS: Invalid amount");
        losslessFee = fee;
    }

    /// @notice This function sets the default Stakers Fee
    /// @param fee Percentage attributed to Stakers when a report gets resolved positively
    function setStakersFee(uint256 fee) public onlyLosslessAdmin {
        require(0 < fee && fee < 100, "LSS: Invalid amount");
        stakersFee = fee;
    }

    /// @notice This function sets the default Committee Fee
    /// @param fee Percentage attributed to Stakers when a report gets resolved positively
    function setCommitteeFee(uint256 fee) public onlyLosslessAdmin {
        require(0 < fee && fee < 100, "LSS: Invalid amount");
        committeeFee = fee;
    }

    /// @notice This function sets the default lifetime of the reports
    /// @param _lifetime Time frame of which a report is active
    function setReportLifetime(uint256 _lifetime) public onlyLosslessAdmin {
        reportLifetime = _lifetime;
    }



    // --- GETTERS ---

    /// @notice This function gets the contract version
    /// @return Version of the contract
    function getVersion() external pure returns (uint256) {
        return 1;
    }

    /// @notice This function will return the Reporter reward and Lossless fee percentage
    /// @return reporter Returns the reporter reward
    /// @return lossless Returns the Lossless Fee
    /// @return committee Returns the committee Fee
    /// @return stakers Returns the stakers Fee
    function getFees() external view returns (uint256 reporter, uint256 lossless, uint256 committee, uint256 stakers) {
        return (reporterReward, losslessFee, committeeFee, stakersFee);
    }

    // --- REPORTS ---

    /// @notice This function will generate a report
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a report for and address linked to a token.
    /// Lossless Contracts and Admin addresses cannot be reported.
    /// @param token Token address of the stolen funds
    /// @param account Potential malicious address
    function report(address token, address account) public notBlacklisted whenNotPaused returns (uint256){
        require(!losslessController.whitelist(account), "LSS: Cannot report LSS protocol");

        uint256 reportId = tokenReports[token].reports[account];

        require(reportId == 0 || reportTimestamps[reportId] + reportLifetime < block.timestamp || losslessGovernance.isReportSolved(reportId), "LSS: Report already exists");

        reportCount += 1;
        reportId = reportCount;
        reporter[reportId] = msg.sender;

        tokenReports[token].reports[account] = reportId;
        reportTimestamps[reportId] = block.timestamp;
        reportTokens[reportId] = token;

        losslessToken.transferFrom(msg.sender, address(this), reportingAmount);

        losslessController.addToBlacklist(account);
        reportedAddress[reportId] = account;
        
        losslessController.activateEmergency(token);

        emit ReportSubmitted(token, account, reportId);

        return reportId;
    }


    /// @notice This function will generate a second report
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a second report linked to the first one created. 
    /// This can be used in the event that the malicious actor is able to frontrun the first report by swapping the tokens or transfering.
    /// @param reportId Report that was previously generated.
    /// @param account Potential malicious address
    function secondReport(uint256 reportId, address account) public notBlacklisted whenNotPaused {
        require(!losslessGovernance.isReportSolved(reportId), "LSS: Report already solved.");
        uint256 reportTimestamp;
        address token;

        token = reportTokens[reportId];

        require(!losslessController.whitelist(account), "LSS: Cannot report LSS protocol");

        reportTimestamp = reportTimestamps[reportId];

        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(secondReports[reportId] == false, "LSS: Another already submitted");
        require(msg.sender == reporter[reportId], "LSS: invalid reporter");

        secondReports[reportId] = true;
        tokenReports[token].reports[account] = reportId;

        losslessController.addToBlacklist(account);
        secondReportedAddress[reportId] = account;

        emit SecondReportsubmitted(token, account, reportId);
    }

/// @notice This function is for the reporter to claim their rewards
    /// @param reportId Staked report
    function reporterClaim(uint256 reportId) public whenNotPaused {
        
        require(reporter[reportId] == msg.sender, "LSS: Must use stakerClaim");
        require(!losslessController.getReporterPayoutStatus(msg.sender, reportId), "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");
        require(losslessGovernance.reportResolution(reportId), "LSS: Report solved negatively.");

        uint256 amountToClaim;

        amountToClaim = losslessStaking.reporterClaimableAmount(reportId);

        losslessController.setReporterPayoutStatus(msg.sender, true, reportId);

        ILERC20(reportTokens[reportId]).transfer(msg.sender, amountToClaim);
        losslessToken.transfer(msg.sender, reportingAmount);
    }

}