// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessControllerV3.sol";
import "./Interfaces/ILosslessGovernance.sol";

/// @title Lossless Reporting Contract
/// @author Lossless.cash
/// @notice The Reporting smart contract is in charge of handling all the parts related to creating new reports
contract LosslessReporting is Initializable, ContextUpgradeable, PausableUpgradeable {
    uint256 public reporterReward;
    uint256 public losslessReward;
    uint256 public stakersReward;
    uint256 public committeeReward;

    uint256 public reportLifetime;
    uint256 public reportingAmount;

    uint256 public reportCount;

    ILERC20 public stakingToken;
    ILssController public losslessController;
    ILssGovernance public losslessGovernance;

    struct TokenReports {
        mapping(address => uint256) reports;
    }

    mapping(address => TokenReports) private tokenReports;

    struct ReporterClaimStatus {
        mapping(uint256 => bool) reportIdClaimStatus;
    }

    mapping(address => ReporterClaimStatus)  private reporterClaimStatus;

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
    /// @param _stakingToken Address corresponding to the Lossless Governance Token
    function setStakingToken(address _stakingToken) public onlyLosslessAdmin {
        require(_stakingToken != address(0), "LERC20: Cannot be zero address");
        stakingToken = ILERC20(_stakingToken);
    }

    /// @notice This function sets the address of the Lossless Governance smart contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance smart contract
    function setLosslessGovernance(address _losslessGovernance) public onlyLosslessAdmin {
        require(_losslessGovernance != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = ILssGovernance(_losslessGovernance);
    }

    /// @notice This function sets the amount of tokens to be staked when reporting or staking
    /// @param _reportingAmount Amount to be staked
    function setReportingAmount(uint256 _reportingAmount) public onlyLosslessAdmin {
        reportingAmount = _reportingAmount;
    }

    /// @notice This function sets the default reporter reward
    /// @param reward Percentage rewarded to the reporter when a report gets resolved positively
    function setReporterReward(uint256 reward) public onlyLosslessAdmin {
        require(0 <= reward && reward <= 100, "LSS: Invalid amount");
        require(reward + losslessReward + committeeReward + stakersReward <= 100, "LSS: Total exceed 100");
        reporterReward = reward;
    }

    /// @notice This function sets the default Lossless Fee
    /// @param fee Percentage attributed to Lossless when a report gets resolved positively
    function setLosslessReward(uint256 fee) public onlyLosslessAdmin {
        require(0 <= fee && fee <= 100, "LSS: Invalid amount");
        require(reporterReward + fee + committeeReward + stakersReward <= 100, "LSS: Total exceed 100");
        losslessReward = fee;
    }

    /// @notice This function sets the default Stakers Fee
    /// @param fee Percentage attributed to Stakers when a report gets resolved positively
    function setStakersReward(uint256 fee) public onlyLosslessAdmin {
        require(0 <= fee && fee <= 100, "LSS: Invalid amount");
        require(reporterReward + losslessReward + committeeReward + fee <= 100, "LSS: Total exceed 100");
        stakersReward = fee;
    }

    /// @notice This function sets the default Committee Fee
    /// @param fee Percentage attributed to Stakers when a report gets resolved positively
    function setCommitteeReward(uint256 fee) public onlyLosslessAdmin {
        require(0 <= fee && fee <= 100, "LSS: Invalid amount");
        require(reporterReward + losslessReward + fee + stakersReward <= 100, "LSS: Total exceed 100");
        committeeReward = fee;
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
        return (reporterReward, losslessReward, committeeReward, stakersReward);
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
        require(!losslessController.dexList(account), "LSS: Cannot report Dex");

        uint256 reportId = tokenReports[token].reports[account];

        require(reportId == 0 || reportTimestamps[reportId] + reportLifetime < block.timestamp || losslessGovernance.isReportSolved(reportId), "LSS: Report already exists");

        reportCount += 1;
        reportId = reportCount;
        reporter[reportId] = msg.sender;

        tokenReports[token].reports[account] = reportId;
        reportTimestamps[reportId] = block.timestamp;
        reportTokens[reportId] = token;

        stakingToken.transferFrom(msg.sender, address(this), reportingAmount);

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
        require(!losslessController.whitelist(account), "LSS: Cannot report LSS protocol");
        require(!losslessController.dexList(account), "LSS: Cannot report Dex");

        uint256 reportTimestamp = reportTimestamps[reportId];
        address token = reportTokens[reportId];

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
        require(reporter[reportId] == msg.sender, "LSS: Only reporter");
        require(!reporterClaimStatus[msg.sender].reportIdClaimStatus[reportId], "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");
        require(losslessGovernance.reportResolution(reportId), "LSS: Report solved negatively.");

        reporterClaimStatus[msg.sender].reportIdClaimStatus[reportId] = true;

        ILERC20(reportTokens[reportId]).transfer(msg.sender, reporterClaimableAmount(reportId));
        stakingToken.transfer(msg.sender, reportingAmount);
    }

    // --- CLAIM ---

    /// @notice This function returns the claimable amount by the reporter
    /// @dev Only can be used by the reporter.
    /// The reporter has a fixed percentage as reward.
    /// @param reportId Staked report    
    function reporterClaimableAmount(uint256 reportId) public view returns (uint256) {
        uint256 reportedAmount = losslessGovernance.amountReported(reportId);
        return reportedAmount * reporterReward / 10**2;
    }
}
