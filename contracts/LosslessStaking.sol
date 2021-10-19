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

interface ILssReporting {
    function getTokenFromReport(uint256 _reportId) external view returns (address);
    function getReportedAddress(uint256 _reportId) external view returns (address);
    function getReporter(uint256 _reportId) external view returns (address);
    function getReportTimestamps(uint256 _reportId) external view returns (uint256);
    function getReporterRewardAndLSSFee() external view returns (uint256 reward, uint256 fee);
    function getAmountReported(uint256 reportId) external view returns (uint256);
}

interface ILssController {
    function getStakeAmount() external view returns (uint256);
    function isBlacklisted(address _adr) external view returns (bool);
    function getReportLifetime() external view returns (uint256);
    function addToReportCoefficient(uint256 reportId, uint256 _amt) external;
    function getReportCoefficient(uint256 reportId) external view returns (uint256);
    function getReporterPayoutStatus(address _reporter, uint256 reportId) external view returns (bool);
    function setReporterPayoutStatus(address _reporter, bool status, uint256 reportId) external; 
    function admin() external view returns (address);
    function pauseAdmin() external view returns (address);
    function recoveryAdmin() external view returns (address);
}

interface ILssGovernance {
    function reportResolution(uint256 reportId) external view returns(bool);
    function isReportSolved(uint256 reportId) external view returns(bool);
}

/// @title Lossless Staking Contract
/// @notice The Staking contract is in charge of handling the staking done on reports
contract LosslessStaking is Initializable, ContextUpgradeable, PausableUpgradeable {

    uint256 public cooldownPeriod;

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

    address public controllerAddress;
    address public governanceAddress;
    address public tokenAddress;

    mapping(address => bool) whitelist;
    
    mapping(address => Stake) private stakes;
    mapping(uint256 => address[]) public stakers;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event Staked(address indexed token, address indexed account, uint256 reportId);

    function initialize(address _losslessReporting, address _losslessController, address _losslessGovernance) public initializer {
       cooldownPeriod = 5 minutes;
       losslessReporting = ILssReporting(_losslessReporting);
       losslessController = ILssController(_losslessController);
       losslessGovernance = ILssGovernance(_losslessGovernance);
       controllerAddress = _losslessController;
       governanceAddress = _losslessGovernance;
    }

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == losslessController.recoveryAdmin(), "LSS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(losslessController.admin() == _msgSender(), "LSS: Must be admin");
        _;
    }

    modifier onlyLosslessPauseAdmin() {
        require(_msgSender() == losslessController.pauseAdmin(), "LSS: Must be pauseAdmin");
        _;
    }

    modifier notBlacklisted() {
        require(!losslessController.isBlacklisted(_msgSender()), "LSS: You cannot operate");
        _;
    }

    modifier onlyFromAdminOrLssSC {
        require(_msgSender() == controllerAddress ||
                _msgSender() == losslessController.admin(), "LSS: Admin or LSS SC only");
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
    function setILssReporting(address _losslessReporting) public onlyLosslessRecoveryAdmin {
        losslessReporting = ILssReporting(_losslessReporting);
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessToken Address corresponding to the Lossless Governance Token
    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
        tokenAddress = _losslessToken;
    }
    
    // GET STAKE INFO

    /// @notice This function returns all the reports where an address is staking
    /// @param account Staker address
    /// @return All account stakes structured as Stake[] array
    function getAccountStakes(address account, uint256 reportId) public view returns(StakeInfo memory) {
        return stakes[account].stakeInfoOnReport[reportId];
    }

    /// @notice This function returns the timestamp of when the stake was made
    /// @param _address Staker address
    /// @param reportId Report being staked
    /// @return Timestamp of the staking
    function getStakingTimestamp(address _address, uint256 reportId) public view returns (uint256){
        return stakes[_address].stakeInfoOnReport[reportId].timestamp;
    }

    /// @notice This function returns if an address has claimed their reward funds
    /// @param _address Staker address
    /// @param reportId Report being staked
    /// @return True if the address has already claimed
    function getPayoutStatus(address _address, uint256 reportId) public view returns (bool) {
        return stakes[_address].stakeInfoOnReport[reportId].payed;
    }

    /// @notice This function returns all the stakes made on a report
    /// @param reportId Report being staked
    /// @return An array of addresses currently staking on the report
    function getReportStakes(uint256 reportId) public view returns(address[] memory) {
        return stakers[reportId];
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
        return  losslessController.getReportLifetime()/((block.timestamp - _timestamp));
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
    function stake(uint256 reportId) public notBlacklisted {
        require(!losslessGovernance.isReportSolved(reportId), "LSS: Report already resolved");
        require(!getIsAccountStaked(reportId, _msgSender()), "LSS: already staked");
        require(losslessReporting.getReporter(reportId) != _msgSender(), "LSS: reporter can not stake");   

        uint256 reportTimestamp;
        reportTimestamp = losslessReporting.getReportTimestamps(reportId);

        require(reportTimestamp + 1 minutes < block.timestamp, "LSS: Must wait 1 minute to stake");
        require(reportId > 0 && (reportTimestamp + losslessController.getReportLifetime()) > block.timestamp, "LSS: report does not exists");

        uint256 stakeAmount = losslessController.getStakeAmount();
        require(losslessToken.balanceOf(_msgSender()) >= stakeAmount, "LSS: Not enough $LSS to stake");

        uint256 stakerCoefficient;
        stakerCoefficient = calculateCoefficient(reportTimestamp);

        stakers[reportId].push(_msgSender());
        stakes[_msgSender()].stakeInfoOnReport[reportId].timestamp = block.timestamp;
        stakes[_msgSender()].stakeInfoOnReport[reportId].coefficient = stakerCoefficient;
        stakes[_msgSender()].stakeInfoOnReport[reportId].payed = false;
        stakes[_msgSender()].stakeInfoOnReport[reportId].staked = true;

        losslessController.addToReportCoefficient(reportId, stakerCoefficient);
        
        losslessToken.transferFrom(_msgSender(), address(this), stakeAmount);
        
        emit Staked(losslessReporting.getTokenFromReport(reportId), _msgSender(), reportId);
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

        require(!getPayoutStatus(_msgSender(), reportId), "LSS: You already claimed");

        address reporter;
        reporter = losslessReporting.getReporter(reportId);

        require(_msgSender() == reporter, "LSS: Must be the reporter");

        uint256 reporterReward;
        uint256 losslessFee;
        uint256 amountStakedOnReport;
        uint256 stakeAmount;
        stakeAmount = losslessController.getStakeAmount();

        amountStakedOnReport = losslessReporting.getAmountReported(reportId);

        (reporterReward, losslessFee) = losslessReporting.getReporterRewardAndLSSFee();

        return amountStakedOnReport * reporterReward / 10**2;
    }
    
    /// @notice This function returns the claimable amount by the stakers
    /// @dev Only can be used by the stakers.
    /// It takes into consideration the staker coefficient in order to return the percentage rewarded.
    /// @param reportId Staked report
    function stakerClaimableAmount(uint256 reportId) public view returns (uint256) {

        require(!getPayoutStatus(_msgSender(), reportId), "LSS: You already claimed");
        require(getIsAccountStaked(reportId, _msgSender()), "LSS: You're not staking");

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

        stakeAmount = losslessController.getStakeAmount();

        amountStakedOnReport = losslessReporting.getAmountReported(reportId);

        (reporterReward, losslessFee) = losslessReporting.getReporterRewardAndLSSFee();

        reportedToken = losslessReporting.getTokenFromReport(reportId);

        reportedWallet = losslessReporting.getReportedAddress(reportId);

        amountStakedOnReport = amountStakedOnReport * (100 - reporterReward - losslessFee) / 10**2;

        stakerCoefficient = getStakerCoefficient(reportId, _msgSender());
        reportCoefficient = losslessController.getReportCoefficient(reportId);

        secondsCoefficient = 10**4/reportCoefficient;

        stakerPercentage = (secondsCoefficient * stakerCoefficient);

        stakerAmountToClaim = (amountStakedOnReport * stakerPercentage) / 10**4;

        return stakerAmountToClaim;
    }


    /// @notice This function is for the stakers to claim their rewards
    /// @param reportId Staked report
    function stakerClaim(uint256 reportId) public notBlacklisted{

        require( losslessReporting.getReporter(reportId) != _msgSender(), "LSS: Must user reporterClaim");
        require(!getPayoutStatus(_msgSender(), reportId), "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");

        uint256 amountToClaim;
        uint256 stakeAmount;

        amountToClaim = stakerClaimableAmount(reportId);
        stakeAmount = losslessController.getStakeAmount();

        ILERC20(losslessReporting.getTokenFromReport(reportId)).transfer(_msgSender(), amountToClaim);
        losslessToken.transfer( _msgSender(), stakeAmount);

        setPayoutStatus(reportId, _msgSender());
    }

    /// @notice This function is for the reported  to claim their rewards
    /// @param reportId Staked report
    function reporterClaim(uint256 reportId) public notBlacklisted{
        
        require( losslessReporting.getReporter(reportId) == _msgSender(), "LSS: Must user stakerClaim");
        require(!losslessController.getReporterPayoutStatus(_msgSender(), reportId), "LSS: You already claimed");
        require(losslessGovernance.isReportSolved(reportId), "LSS: Report still open");

        uint256 amountToClaim;
        uint256 stakeAmount;

        amountToClaim = reporterClaimableAmount(reportId);
        stakeAmount = losslessController.getStakeAmount();

        ILERC20(losslessReporting.getTokenFromReport(reportId)).transfer(_msgSender(), amountToClaim);
        losslessToken.transfer(_msgSender(), stakeAmount);

        losslessController.setReporterPayoutStatus(_msgSender(), true, reportId);
    }

    // --- GETTERS ---

    /// @notice This function returns the contract version
    /// @return Returns the Smart Contract version
    function getVersion() public pure returns (uint256) {
        return 1;
    }
}