// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessController.sol";
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

    uint256 public constant HUNDRED = 1e2;

    ILERC20 override public stakingToken;
    ILssController override public losslessController;
    ILssGovernance override public losslessGovernance;

    struct TokenReports {
        mapping(address => uint256) reports;
    }

    mapping(ILERC20 => TokenReports) private tokenReports;

    //mapping(uint256 => bool)  private reporterClaimStatus;

    struct Report {
        address reporter;
        address reportedAddress;
        address secondReportedAddress;
        uint256 reportTimestamps;
        ILERC20 reportTokens;
        bool secondReports;
        bool reporterClaimStatus;
    }

    mapping(uint256 => Report) reportInfo;

    // --- MODIFIERS ---

    /// @notice Avoids execution from other than the Lossless Admin
    modifier onlyLosslessAdmin() {
        require(msg.sender == losslessController.admin(), "LSS: Must be admin");
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
        losslessController = _losslessController;
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
        stakingToken = _stakingToken;
        emit NewStakingToken(stakingToken);
    }

    /// @notice This function sets the address of the Lossless Governance smart contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance smart contract
    function setLosslessGovernance(ILssGovernance _losslessGovernance) override public onlyLosslessAdmin {
        require(address(_losslessGovernance) != address(0), "LSS: Cannot be zero address");
        require(_losslessGovernance != losslessGovernance, "LSS: Cannot be same address");
        losslessGovernance = _losslessGovernance;
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
    /// @param _reward Percentage rewarded to the reporter when a report gets resolved positively
    function setReporterReward(uint256 _reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(_reward != reporterReward, "LSS: Already set to that amount");
        reporterReward = _reward;
        emit NewReporterReward(_reward);
    }

    /// @notice This function sets the default Lossless Reward
    /// @param _reward Percentage attributed to Lossless when a report gets resolved positively
    function setLosslessReward(uint256 _reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(_reward != losslessReward, "LSS: Already set to that amount");
        losslessReward = _reward;
        emit NewLosslessReward(_reward);
    }

    /// @notice This function sets the default Stakers Reward
    /// @param _reward Percentage attributed to Stakers when a report gets resolved positively
    function setStakersReward(uint256 _reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(_reward != stakersReward, "LSS: Already set to that amount");
        stakersReward = _reward;
        emit NewStakersReward(_reward);
    }

    /// @notice This function sets the default Committee Reward
    /// @param _reward Percentage attributed to committee when a report gets resolved positively
    function setCommitteeReward(uint256 _reward) override public onlyLosslessAdmin cannotExceedHundred {
        require(_reward != committeeReward, "LSS: Already set to that amount");
        committeeReward = _reward;
        emit NewCommitteeReward(_reward);
    }

    /// @notice This function sets the default lifetime of the reports
    /// @param _lifetime Time frame of which a report is active
    function setReportLifetime(uint256 _lifetime) override public onlyLosslessAdmin {
        require(_lifetime != reportLifetime, "LSS: Already set to that amount");
        reportLifetime = _lifetime;
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
    /// @param _reportId Report Id to get admin
    /// @return reporter
    /// @return reportedAddress
    /// @return secondReportedAddress
    /// @return reportTimestamps
    /// @return reportTokens
    /// @return secondReports 
    /// @return reporterClaimStatus 
    function getReportInfo(uint256 _reportId) override external view returns(address reporter,
        address reportedAddress,
        address secondReportedAddress,
        uint256 reportTimestamps,
        ILERC20 reportTokens,
        bool secondReports,
        bool reporterClaimStatus) {

        Report storage queriedReport = reportInfo[_reportId];

        return (queriedReport.reporter, 
        queriedReport.reportedAddress, 
        queriedReport.secondReportedAddress, 
        queriedReport.reportTimestamps, 
        queriedReport.reportTokens, 
        queriedReport.secondReports, 
        queriedReport.reporterClaimStatus);
    }

    // --- REPORTS ---

    /// @notice This function will generate a report
    /// @dev This function must be called by a non blacklisted/reported address. 
    /// It will generate a report for an address linked to a token.
    /// Lossless Contracts, Admin addresses and Dexes cannot be reported.
    /// @param _token Token address of the stolen funds
    /// @param _account Potential malicious address
    function report(ILERC20 _token, address _account) override public notBlacklisted whenNotPaused returns (uint256){
        require(_account != address(0), "LSS: Cannot report zero address");
        require(!losslessController.whitelist(_account), "LSS: Cannot report LSS protocol");
        require(!losslessController.dexList(_account), "LSS: Cannot report Dex");

        uint256 reportId = tokenReports[_token].reports[_account];

        require(reportId == 0 || 
                reportInfo[reportId].reportTimestamps + reportLifetime < block.timestamp || 
                losslessGovernance.isReportSolved(reportId) && 
                !losslessGovernance.reportResolution(reportId), "LSS: Report already exists");

        reportCount += 1;
        reportId = reportCount;
        reportInfo[reportId].reporter = msg.sender;

        tokenReports[_token].reports[_account] = reportId;
        reportInfo[reportId].reportTimestamps = block.timestamp;
        reportInfo[reportId].reportTokens = _token;

        require(stakingToken.transferFrom(msg.sender, address(this), reportingAmount), "LSS: Reporting stake failed");

        losslessController.addToBlacklist(_account);
        reportInfo[reportId].reportedAddress = _account;
        
        losslessController.activateEmergency(_token);

        emit ReportSubmission(_token, _account, reportId, reportingAmount);

        return reportId;
    }


    /// @notice This function will add a second address to a given report.
    /// @dev This funtion must be called by a non blacklisted/reported address. 
    /// It will generate a second report linked to the first one created. 
    /// This can be used in the event that the malicious actor is able to frontrun the first report by swapping the tokens or transfering.
    /// @param _reportId Report that was previously generated.
    /// @param _account Potential malicious address
    function secondReport(uint256 _reportId, address _account) override public whenNotPaused {
        require(_account != address(0), "LSS: Cannot report zero address");
        require(!losslessGovernance.isReportSolved(_reportId) && !losslessGovernance.reportResolution(_reportId), "LSS: Report already solved");
        require(!losslessController.whitelist(_account), "LSS: Cannot report LSS protocol");
        require(!losslessController.dexList(_account), "LSS: Cannot report Dex");

        Report storage queriedReport = reportInfo[_reportId]; 

        uint256 reportTimestamp = queriedReport.reportTimestamps;
        ILERC20 token = queriedReport.reportTokens;

        require(_reportId != 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(queriedReport.secondReports == false, "LSS: Another already submitted");
        require(msg.sender == queriedReport.reporter, "LSS: invalid reporter");

        queriedReport.secondReports = true;
        tokenReports[token].reports[_account] = _reportId;

        losslessController.addToBlacklist(_account);
        queriedReport.secondReportedAddress = _account;

        emit SecondReportSubmission(token, _account, _reportId);
    }

    /// @notice This function is for the reporter to claim their rewards
    /// @param _reportId Staked report
    function reporterClaim(uint256 _reportId) override public whenNotPaused {
        require(reportInfo[_reportId].reporter == msg.sender, "LSS: Only reporter");
        require(losslessGovernance.reportResolution(_reportId), "LSS: Report solved negatively");

        Report storage queriedReport = reportInfo[_reportId];

        require(!queriedReport.reporterClaimStatus, "LSS: You already claimed");

        queriedReport.reporterClaimStatus = true;

        uint256 amountToClaim = reporterClaimableAmount(_reportId);

        require(queriedReport.reportTokens.transfer(msg.sender, amountToClaim), "LSS: Token transfer failed");
        require(stakingToken.transfer(msg.sender, reportingAmount), "LSS: Reporting stake failed");
        emit ReporterClaim(msg.sender, _reportId, amountToClaim);
    }

    // --- CLAIM ---

    /// @notice This function returns the claimable amount by the reporter
    /// @dev The reporter has a fixed percentage as reward.
    /// @param _reportId Staked report    
    function reporterClaimableAmount(uint256 _reportId) override public view returns (uint256) {
        uint256 reportedAmount = losslessGovernance.getAmountReported(_reportId);
        return reportedAmount * reporterReward / HUNDRED;
    }
    
    /// @notice This function allows the governance token to retribute an erroneous report
    /// @param _adr retribution address
    /// @param _amount amount to be retrieved
    function retrieveCompensation(address _adr, uint256 _amount) override public onlyLosslessGov {
        require(stakingToken.transfer(_adr, _amount), "LSS: Compensation retrieve fail");
        emit CompensationRetrieve(_adr, _amount);
    }

}
