// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "hardhat/console.sol";


interface ILERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function admin() external view returns (address);
}

interface ILssReporting {
    function reportTokens(uint256 _reportId) external view returns (address);
    function reportedAddress(uint256 _reportId) external view returns (address);
    function reporter(uint256 _reportId) external view returns (address);
    function reportTimestamps(uint256 _reportId) external view returns (uint256);
    function getReporterRewardAndLSSFee() external view returns (uint256 reward, uint256 fee);
    function amountReported(uint256 reportId) external view returns (uint256);
    function stakersFee() external view returns (uint256);
}

interface ILssController {
    function stakeAmount() external view returns (uint256);
    function blacklist(address _adr) external view returns (bool);
    function reportLifetime() external view returns (uint256);
    function addToReportCoefficient(uint256 reportId, uint256 _amt) external;
    function reportCoefficient(uint256 reportId) external view returns (uint256);
    function getReporterPayoutStatus(address _reporter, uint256 reportId) external view returns (bool);
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) external; 
    function admin() external view returns (address);
    function pauseAdmin() external view returns (address);
}

interface ILssGovernance {
    function isReportSolved(uint256 reportId) external view returns(bool);
    function amountReported(uint256 reportId) external view returns(uint256);
}

/// @title Lossless Staking Contract
/// @notice The Staking contract is in charge of handling the staking done on reports
contract LosslessStaking is Initializable, ContextUpgradeable, PausableUpgradeable {

    struct Stake {
        mapping(uint256 => StakeInfo) stakeInfoOnReport;
    }

    struct StakeInfo {
        uint256 timestamp;
        uint256 coefficient;
        bool staked;
        bool payed;
    }

    ILERC20 public losslessToken;
    ILssReporting public losslessReporting;
    ILssController public losslessController;
    ILssGovernance public losslessGovernance;
    
    mapping(address => Stake) private stakes;
    mapping(uint256 => address[]) public stakers;

    mapping(uint256 => uint256) public totalStakedOnReport;

    event Staked(address indexed token, address indexed account, uint256 reportId);

    function initialize(address _losslessReporting, address _losslessController) public initializer {
       losslessReporting = ILssReporting(_losslessReporting);
       losslessController = ILssController(_losslessController);
    }

    // --- MODIFIERS ---

    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == msg.sender, "LSS: Must be admin");
        _;
    }

    modifier onlyLosslessPauseAdmin() {
        require(msg.sender == losslessController.pauseAdmin(), "LSS: Must be pauseAdmin");
        _;
    }

    modifier notBlacklisted() {
        require(!losslessController.blacklist(msg.sender), "LSS: You cannot operate");
        _;
    }

    /// @notice Avoids execution from other than the Lossless Admin or Lossless Environment
    modifier onlyFromAdminOrLssSC {
        require(msg.sender == address(losslessController) ||
                msg.sender == address(losslessGovernance) ||
                msg.sender == losslessController.admin(), "LSS: Admin or LSS SC only");
        _;
    }

    // --- SETTERS ---

    /// @notice This function pauses the contract
    function pause() public onlyLosslessPauseAdmin {
        _pause();
    }    

    /// @notice This function unpauses the contract
    function unpause() public onlyLosslessPauseAdmin {
        _unpause();
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @param _losslessReporting Address corresponding to the Lossless Reporting contract
    function setLssReporting(address _losslessReporting) public onlyLosslessAdmin {
        losslessReporting = ILssReporting(_losslessReporting);
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessToken Address corresponding to the Lossless Governance Token
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance Token
    function setLosslessGovernance(address _losslessGovernance) public onlyLosslessAdmin {
        losslessGovernance = ILssGovernance(_losslessGovernance);
    }

    /// @notice This function returns if an address has claimed their reward funds
    /// @param _address Staker address
    /// @param reportId Report being staked
    /// @return True if the address has already claimed
    function getPayoutStatus(address _address, uint256 reportId) public view returns (bool) {
        return stakes[_address].stakeInfoOnReport[reportId].payed;
    }

    /// @notice This function returns if an address is already staking on a report
    /// @param reportId Report being staked
    /// @param account Address to consult
    /// @return True if the account is already staking
    function getIsAccountStaked(uint256 reportId, address account) public view returns(bool) {
        return stakes[account].stakeInfoOnReport[reportId].staked;
    }


    // STAKING

    /// @notice This function returns the coefficient of the staker taking into consideration the timestamp
    /// @dev The closer to the reportLifetime the staking happen, the higher the coefficient
    /// @param _timestamp Timestamp of the staking
    /// @return The coefficient from the following formula "reportLifetime/(block.timestamp - stakingTimestamp)"
    function calculateCoefficient(uint256 _timestamp) private view returns (uint256) {
        return  losslessController.reportLifetime()/((block.timestamp - _timestamp));
    }

    /// @notice This function returns the coefficient of a staker in a report
    /// @param reportId Report where the address staked
    /// @param _address Staking address
    /// @return The coefficient calculated for the staker
    function getStakerCoefficient(uint256 reportId, address _address) public view returns (uint256) {
        return stakes[_address].stakeInfoOnReport[reportId].coefficient;
    }

    /// @notice This function generates a stake on a report
    /// @dev The earlier the stake is placed on the report, the higher the reward is.
    /// One minute must pass between the report and the stake. 
    /// The reporter cannot stake as it'll have a fixed percentage reward.
    /// A reported address cannot stake.
    /// @param reportId Report to stake
    function stake(uint256 reportId) public notBlacklisted whenNotPaused {
        require(!losslessGovernance.isReportSolved(reportId), "LSS: Report already resolved");
        require(!getIsAccountStaked(reportId, msg.sender), "LSS: already staked");
        require(losslessReporting.reporter(reportId) != msg.sender, "LSS: reporter can not stake");   

        uint256 reportTimestamp;
        reportTimestamp = losslessReporting.reportTimestamps(reportId);

        require(reportId > 0 && (reportTimestamp + losslessController.reportLifetime()) > block.timestamp, "LSS: report does not exists");

        uint256 stakeAmount = losslessController.stakeAmount();

        uint256 stakerCoefficient;
        stakerCoefficient = calculateCoefficient(reportTimestamp);

        stakers[reportId].push(msg.sender);
        stakes[msg.sender].stakeInfoOnReport[reportId].timestamp = block.timestamp;
        stakes[msg.sender].stakeInfoOnReport[reportId].coefficient = stakerCoefficient;
        stakes[msg.sender].stakeInfoOnReport[reportId].payed = false;
        stakes[msg.sender].stakeInfoOnReport[reportId].staked = true;

        losslessController.addToReportCoefficient(reportId, stakerCoefficient);
        
        losslessToken.transferFrom(msg.sender, address(this), stakeAmount);

        totalStakedOnReport[reportId] += stakeAmount;
        
        emit Staked(losslessReporting.reportTokens(reportId), msg.sender, reportId);
    }

    /// @notice This function sets the payout status to true when claiming
    /// @param reportId Report to change the payout status on
    function setPayoutStatus(uint256 reportId, address _adr) private {
        stakes[_adr].stakeInfoOnReport[reportId].payed = true;
    }

    // --- CLAIM ---

    /// @notice This function returns the claimable amount by the reporter
    /// @dev Only can be used by the reporter.
    /// The reporter has a fixed percentage as reward.
    /// @param reportId Staked report    
    function reporterClaimableAmount(uint256 reportId) public view returns (uint256) {

        require(!getPayoutStatus(msg.sender, reportId), "LSS: You already claimed");

        address reporter;
        reporter = losslessReporting.reporter(reportId);

        require(msg.sender == reporter, "LSS: Must be the reporter");

        uint256 reporterReward;
        uint256 losslessFee;
        uint256 amountStakedOnReport;
        uint256 stakeAmount;
        stakeAmount = losslessController.stakeAmount();

        amountStakedOnReport = losslessGovernance.amountReported(reportId);

        (reporterReward, losslessFee) = losslessReporting.getReporterRewardAndLSSFee();

        return amountStakedOnReport * reporterReward / 10**2;
    }
    
    /// @notice This function returns the claimable amount by the stakers
    /// @dev Only can be used by the stakers.
    /// It takes into consideration the staker coefficient in order to return the percentage rewarded.
    /// @param reportId Staked report
    function stakerClaimableAmount(uint256 reportId) public view returns (uint256) {

        require(!getPayoutStatus(msg.sender, reportId), "LSS: You already claimed");
        require(getIsAccountStaked(reportId, msg.sender), "LSS: You're not staking");

        uint256 reporterReward;
        uint256 losslessFee;
        uint256 amountStakedOnReport;
        uint256 stakerCoefficient;
        uint256 stakerPercentage;
        uint256 stakerAmountToClaim;
        uint256 secondsCoefficient;
        uint256 stakeAmount;
        uint256 reportCoefficient;
        address reportedToken;
        address reportedWallet;

        stakeAmount = losslessController.stakeAmount();

        amountStakedOnReport = losslessGovernance.amountReported(reportId);

        (reporterReward, losslessFee) = losslessReporting.getReporterRewardAndLSSFee();

        reportedToken = losslessReporting.reportTokens(reportId);

        reportedWallet = losslessReporting.reportedAddress(reportId);

        amountStakedOnReport = amountStakedOnReport * losslessReporting.stakersFee() / 10**2;

        stakerCoefficient = getStakerCoefficient(reportId, msg.sender);
        reportCoefficient = losslessController.reportCoefficient(reportId);

        secondsCoefficient = 10**4/reportCoefficient;

        stakerPercentage = (secondsCoefficient * stakerCoefficient);

        stakerAmountToClaim = (amountStakedOnReport * stakerPercentage) / 10**4;

        return stakerAmountToClaim;
    }


    /// @notice This function is for the stakers to claim their rewards
    /// @param reportId Staked report
    function stakerClaim(uint256 reportId) public notBlacklisted whenNotPaused {

        require( losslessReporting.reporter(reportId) != msg.sender, "LSS: Must user reporterClaim");
        require(!getPayoutStatus(msg.sender, reportId), "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");

        uint256 amountToClaim;
        uint256 stakeAmount;
        address token;

        amountToClaim = stakerClaimableAmount(reportId);
        stakeAmount = losslessController.stakeAmount();
        token = losslessReporting.reportTokens(reportId);

        setPayoutStatus(reportId, msg.sender);

        ILERC20(token).transfer(msg.sender, amountToClaim);
        losslessToken.transfer( msg.sender, stakeAmount);
    }

    /// @notice This function is for the reported  to claim their rewards
    /// @param reportId Staked report
    function reporterClaim(uint256 reportId) public notBlacklisted whenNotPaused {
        
        require( losslessReporting.reporter(reportId) == msg.sender, "LSS: Must user stakerClaim");
        require(!losslessController.getReporterPayoutStatus(msg.sender, reportId), "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");

        uint256 amountToClaim;
        uint256 stakeAmount;

        amountToClaim = reporterClaimableAmount(reportId);
        stakeAmount = losslessController.stakeAmount();

        losslessController.setReporterPayoutStatus(msg.sender, true, reportId);

        ILERC20(losslessReporting.reportTokens(reportId)).transfer(msg.sender, amountToClaim);
        losslessToken.transfer(msg.sender, stakeAmount);
    }

    /// @notice This function allows the governance token to retribute an erroneous report
    /// @param adr retribution address
    /// @param amount amount to be retrieved
    function retrieveCompensation(address adr, uint256 amount) public onlyFromAdminOrLssSC {
        losslessToken.transfer(adr, amount);
    }


    // --- GETTERS ---

    /// @notice This function returns the contract version
    /// @return Returns the Smart Contract version
    function getVersion() public pure returns (uint256) {
        return 1;
    }

}