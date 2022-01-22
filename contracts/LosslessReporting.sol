// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessControllerV3.sol";
import "./Interfaces/ILosslessGovernance.sol";
import "./Interfaces/ILosslessReporting.sol";

/// @title Lossless Reporting Contract
/// @author Lossless.cash
/// @notice The Reporting smart contract is in charge of handling all the parts related to creating new reports
contract LosslessReporting is ILssReporting, Initializable, ContextUpgradeable, PausableUpgradeable {
    uint256 override public reporterReward;
    uint256 override public losslessReward;
    uint256 override public stakersReward;
    uint256 override public committeeReward;

    uint256 override public reportLifetime;
    uint256 override public reportingAmount;

    uint256 override public reportCount;

    uint256 constant toPercentage = 10**2;

    ILERC20 override public stakingToken;
    ILssController override public losslessController;
    ILssGovernance override public losslessGovernance;

    struct TokenReports {
        mapping(address => uint256) reports;
    }

    mapping(ILERC20 => TokenReports) private tokenReports;

    mapping(uint256 => bool)  private reporterClaimStatus;


    struct Report {
        address reporter;
        address reportedAddress;
        address secondReportedAddress;
        uint256 reportTimestamps;
        address reportTokens;
        bool secondReports;
    }

    mapping(uint256 => Report) reportInfo;

    // --- MODIFIERS ---

    /// @notice Avoids execution from other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == msg.sender, "LSS: Must be admin");
        _;
    }

    /// @notice Avoids execution from other than the Pause Admin
    modifier onlyPauseAdmin() {
        require(losslessController.pauseAdmin() == msg.sender, "LSS: Must be pauseAdmin");
        _;
    }

    /// @notice Avoids execution from blacklisted addresses
    modifier notBlacklisted() {
        require(!losslessController.blacklist(msg.sender), "LSS: You cannot operate");
        _;
    }

    /// @notice Avoids execution from other than the Lossless Governance
    modifier onlyLosslessGov {
        require(msg.sender == address(losslessGovernance),
                "LSS: Lss SC only");
        _;
    }

    /// @notice Avoids rewards to exceed a hundrer percent
    modifier cannotExceedHundred() {
        _;
        require(reporterReward + losslessReward + committeeReward + stakersReward <= 100, "LSS: Total exceed 100");
    }

    function initialize(ILssController _losslessController) public initializer {
        reportCount = 0;
        losslessController = ILssController(_losslessController);
    }
    
    // --- SETTERS ---

    /// @notice This function pauses the contract
    function pause() override public onlyPauseAdmin{
        _pause();
    }    

    /// @notice This function unpauses the contract
    function unpause() override public onlyPauseAdmin{
        _unpause();
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingToken Address corresponding to the Lossless Governance Token
    function setStakingToken(ILERC20 _stakingToken) override public onlyLosslessAdmin {
        require(address(_stakingToken) != address(0), "LSS: Cannot be zero address");
        require(_stakingToken != stakingToken, "LSS: Cannot be same address");
        stakingToken = ILERC20(_stakingToken);
        emit NewStakingToken(stakingToken);
    }

    /// @notice This function sets the address of the Lossless Governance smart contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance smart contract
    function setLosslessGovernance(ILssGovernance _losslessGovernance) override public onlyLosslessAdmin {
        require(address(_losslessGovernance) != address(0), "LSS: Cannot be zero address");
        require(_losslessGovernance != losslessGovernance, "LSS: Cannot be same address");
        losslessGovernance = ILssGovernance(_losslessGovernance);
        emit NewGovernanceContract(losslessGovernance);
    }

    /// @notice This function sets the amount of tokens to be staked when reporting
    /// @param _reportingAmount Amount to generate a report
    function setReportingAmount(uint256 _reportingAmount) override public onlyLosslessAdmin {
        require(reportingAmount != _reportingAmount, "LSS: Already set to that amount");
        reportingAmount = _reportingAmount;
        emit NewReportingAmount(_reportingAmount);
    }

    /// @notice This function sets the default reporter reward
    /// @param reward Percentage rewarded to the reporter when a report gets resolved positively
    function setReporterReward(uint256 reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(reward != reporterReward, "LSS: Already set to that amount");
        reporterReward = reward;
        emit NewReporterReward(reward);
    }

    /// @notice This function sets the default Lossless Reward
    /// @param reward Percentage attributed to Lossless when a report gets resolved positively
    function setLosslessReward(uint256 reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(reward != losslessReward, "LSS: Already set to that amount");
        losslessReward = reward;
        emit NewLosslessReward(reward);
    }

    /// @notice This function sets the default Stakers Reward
    /// @param reward Percentage attributed to Stakers when a report gets resolved positively
    function setStakersReward(uint256 reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(reward != stakersReward, "LSS: Already set to that amount");
        stakersReward = reward;
        emit NewStakersReward(reward);
    }

    /// @notice This function sets the default Committee Reward
    /// @param reward Percentage attributed to committee when a report gets resolved positively
    function setCommitteeReward(uint256 reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(reward != committeeReward, "LSS: Already set to that amount");
        committeeReward = reward;
        emit NewCommitteeReward(reward);
    }

    /// @notice This function sets the default lifetime of the reports
    /// @param lifetime Time frame of which a report is active
    function setReportLifetime(uint256 lifetime) override public onlyLosslessAdmin {
        require(lifetime != reportLifetime, "LSS: Already set to that amount");
        reportLifetime = lifetime;
        emit NewReportLifetime(reportLifetime);
    }

    // --- GETTERS ---

    /// @notice This function gets the contract version
    /// @return Version of the contract
    function getVersion() override external pure returns (uint256) {
        return 1;
    }

    /// @notice This function will return the reward amount for all parties
    /// @return _reporter Returns the reporter reward
    /// @return _lossless Returns the Lossless Reward
    /// @return _committee Returns the committee Reward
    /// @return _stakers Returns the stakers Reward
    function getRewards() override external view returns (uint256 _reporter, uint256 _lossless, uint256 _committee, uint256 _stakers) {
        return (reporterReward, losslessReward, committeeReward, stakersReward);
    }
    
    /// @notice This function will return the admin of the repoted token
    /// @param reportId Report Id to get admin
    /// @return reporter
    /// @return reportedAddress
    /// @return secondReportedAddress
    /// @return reportTimestamps
    /// @return reportTokens
    /// @return secondReports 
    function getReportInfo(uint256 reportId) override external view returns(address reporter,
        address reportedAddress,
        address secondReportedAddress,
        uint256 reportTimestamps,
        address reportTokens,
        bool secondReports) {

        Report storage report = reportInfo[reportId];

        return (report.reporter, report.reportedAddress, report.secondReportedAddress, report.reportTimestamps, report.reportTokens, report.secondReports);
    }

    // --- REPORTS ---

    /// @notice This function will generate a report
    /// @dev This function must be called by a non blacklisted/reported address. 
    /// It will generate a report for an address linked to a token.
    /// Lossless Contracts, Admin addresses and Dexes cannot be reported.
    /// @param token Token address of the stolen funds
    /// @param account Potential malicious address
    function report(ILERC20 token, address account) override public notBlacklisted whenNotPaused returns (uint256){
        require(account != address(0), "LSS: Cannot report zero address");
        require(!losslessController.whitelist(account), "LSS: Cannot report LSS protocol");
        require(!losslessController.dexList(account), "LSS: Cannot report Dex");

        uint256 reportId = tokenReports[token].reports[account];

        require(reportId == 0 || 
                reportInfo[reportId].reportTimestamps + reportLifetime < block.timestamp || 
                losslessGovernance.isReportSolved(reportId) && 
                !losslessGovernance.reportResolution(reportId), "LSS: Report already exists");

        reportCount += 1;
        reportId = reportCount;
        reportInfo[reportId].reporter = msg.sender;

        tokenReports[ILERC20(token)].reports[account] = reportId;
        reportInfo[reportId].reportTimestamps = block.timestamp;
        reportInfo[reportId].reportTokens = address(token);

        require(stakingToken.transferFrom(msg.sender, address(this), reportingAmount), "LSS: Reporting stake failed");

        losslessController.addToBlacklist(account);
        reportInfo[reportId].reportedAddress = account;
        
        losslessController.activateEmergency(token);

        emit ReportSubmission(address(token), account, reportId);

        return reportId;
    }


    /// @notice This function will add a second address to a given report.
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a second report linked to the first one created. 
    /// This can be used in the event that the malicious actor is able to frontrun the first report by swapping the tokens or transfering.
    /// @param reportId Report that was previously generated.
    /// @param account Potential malicious address
    function secondReport(uint256 reportId, address account) override public whenNotPaused {
        require(account != address(0), "LSS: Cannot report zero address");
        require(!losslessGovernance.isReportSolved(reportId) && !losslessGovernance.reportResolution(reportId), "LSS: Report already solved");
        require(!losslessController.whitelist(account), "LSS: Cannot report LSS protocol");
        require(!losslessController.dexList(account), "LSS: Cannot report Dex");

        uint256 reportTimestamp = reportInfo[reportId].reportTimestamps;
        address token = reportInfo[reportId].reportTokens;

        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(reportInfo[reportId].secondReports == false, "LSS: Another already submitted");
        require(msg.sender == reportInfo[reportId].reporter, "LSS: invalid reporter");

        reportInfo[reportId].secondReports = true;
        tokenReports[ILERC20(token)].reports[account] = reportId;

        losslessController.addToBlacklist(account);
        reportInfo[reportId].secondReportedAddress = account;

        emit SecondReportSubmission(token, account, reportId);
    }

    /// @notice This function is for the reporter to claim their rewards
    /// @param reportId Staked report
    function reporterClaim(uint256 reportId) override public whenNotPaused {
        require(reportInfo[reportId].reporter == msg.sender, "LSS: Only reporter");
        require(!reporterClaimStatus[reportId], "LSS: You already claimed");
        require(losslessGovernance.reportResolution(reportId), "LSS: Report solved negatively");

        reporterClaimStatus[reportId] = true;

        uint256 amountToClaim = reporterClaimableAmount(reportId);

        require(ILERC20(reportInfo[reportId].reportTokens).transfer(msg.sender, amountToClaim), "LSS: Token transfer failed");
        require(stakingToken.transfer(msg.sender, reportingAmount), "LSS: Reporting stake failed");
        emit ReporterClaim(msg.sender, reportId, amountToClaim);
    }

    // --- CLAIM ---

    /// @notice This function returns the claimable amount by the reporter
    /// @dev The reporter has a fixed percentage as reward.
    /// @param reportId Staked report    
    function reporterClaimableAmount(uint256 reportId) override public view returns (uint256) {
        uint256 reportedAmount = losslessGovernance.getAmountReported(reportId);
        return reportedAmount * reporterReward / toPercentage;
    }
    
    /// @notice This function allows the governance token to retribute an erroneous report
    /// @param adr retribution address
    /// @param amount amount to be retrieved
    function retrieveCompensation(address adr, uint256 amount) override public onlyLosslessGov {
        require(stakingToken.transfer(adr, amount), "LSS: Compensation retrieve fail");
        emit CompensationRetrieve(adr, amount);
    }

}
