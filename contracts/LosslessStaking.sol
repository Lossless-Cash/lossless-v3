// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "hardhat/console.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessControllerV3.sol";
import "./Interfaces/ILosslessGovernance.sol";
import "./Interfaces/ILosslessReporting.sol";

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

    ILERC20 public stakingToken;
    ILssReporting public losslessReporting;
    ILssController public losslessController;
    ILssGovernance public losslessGovernance;

    uint256 public stakingAmount;
    uint256 private constant toPercentage = 1e2;
    uint256 private constant betterDecimals = 1e6;
    
    mapping(address => Stake) private stakes;
    mapping(uint256 => address[]) public stakers;

    mapping(uint256 => uint256) public totalStakedOnReport;

    mapping(uint256 => uint256) public reportCoefficient;


    mapping(address => PerReportAmount) stakedOnReport;

    struct PerReportAmount {
        mapping(uint256 => uint256) report;
    }

    event NewStake(address indexed token, address indexed account, uint256 reportId);
    event StakerClaim(address indexed staker, address indexed token, uint256 indexed reportID, uint256 amount);
    event NewStakingAmount(uint256 indexed newAmount);
    event NewStakingToken(address indexed newToken);
    event NewReportingContract(address indexed newContract);
    event NewGovernanceContract(address indexed newContract);

    function initialize(ILssReporting _losslessReporting, ILssController _losslessController) public initializer {
       losslessReporting = ILssReporting(_losslessReporting);
       losslessController = ILssController(_losslessController);
       stakingAmount = 0;
    }

    // --- MODIFIERS ---

    modifier onlyLosslessAdmin() {
        require(msg.sender == losslessController.admin(), "LSS: Must be admin");
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
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessReporting Address corresponding to the Lossless Reporting contract
    function setLssReporting(ILssReporting _losslessReporting) public onlyLosslessAdmin {
        require(address(ILssReporting(_losslessReporting)) != address(0), "LERC20: Cannot be zero address");
        losslessReporting = ILssReporting(_losslessReporting);
        emit NewReportingContract(address(ILssReporting(_losslessReporting)));
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingToken Address corresponding to the Lossless Governance Token
    function setStakingToken(ILERC20 _stakingToken) public onlyLosslessAdmin {
        require(address(ILERC20(_stakingToken)) != address(0), "LERC20: Cannot be zero address");
        stakingToken = ILERC20(_stakingToken);
        emit NewStakingToken(address(ILERC20(_stakingToken)));
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance contract
    function setLosslessGovernance(ILssGovernance _losslessGovernance) public onlyLosslessAdmin {
        require(address(ILssGovernance(_losslessGovernance)) != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = ILssGovernance(_losslessGovernance);
        emit NewGovernanceContract(address(ILssGovernance(_losslessGovernance)));
    }

    /// @notice This function sets the amount of tokens to be staked when staking
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingAmount Amount to be staked
    function setStakingAmount(uint256 _stakingAmount) public onlyLosslessAdmin {
        stakingAmount = _stakingAmount;
        emit NewStakingAmount(_stakingAmount);
    }

    // STAKING

    /// @notice This function generates a stake on a report
    /// @dev The earlier the stake is placed on the report, the higher the reward is.
    /// The reporter cannot stake as it'll have a fixed percentage reward.
    /// A reported address cannot stake.
    /// @param reportId Report to stake
    function stake(uint256 reportId) public notBlacklisted whenNotPaused {
        require(!losslessGovernance.isReportSolved(reportId), "LSS: Report already resolved");

        StakeInfo storage stakeInfo = stakes[msg.sender].stakeInfoOnReport[reportId];

        (address reporter,,, uint256 reportTimestamps, address reportTokens,) = losslessReporting.getReportInfo(reportId);

        require(!stakeInfo.staked, "LSS: already staked");
        require(reporter != msg.sender, "LSS: reporter can not stake");   

        uint256 reportTimestamp = reportTimestamps;

        require(reportId > 0 && (reportTimestamp + losslessReporting.reportLifetime()) > block.timestamp, "LSS: report does not exists");

        uint256 stakerCoefficient = reportTimestamp + losslessReporting.reportLifetime() - block.timestamp;

        stakers[reportId].push(msg.sender);
        stakeInfo.timestamp = block.timestamp;
        stakeInfo.coefficient = stakerCoefficient;
        stakeInfo.staked = true;

        reportCoefficient[reportId] += stakerCoefficient;
        
        require(stakingToken.transferFrom(msg.sender, address(this), stakingAmount),
        "LSS: Staking transfer failed");

        totalStakedOnReport[reportId] += stakingAmount;
        stakedOnReport[msg.sender].report[reportId] = stakingAmount;
        
        emit NewStake(reportTokens, msg.sender, reportId);
    }

    // --- CLAIM ---
    
    /// @notice This function returns the claimable amount by the stakers
    /// @dev It takes into consideration the staker coefficient in order to return the percentage rewarded.
    /// @param reportId Staked report
    function stakerClaimableAmount(uint256 reportId) public view returns (uint256) {
        (,,, uint256 stakersReward) = losslessReporting.getRewards();
        uint256 amountStakedOnReport = losslessGovernance.getAmountReported(reportId);
        uint256 amountDistributedToStakers = amountStakedOnReport * stakersReward / toPercentage;
        uint256 stakerCoefficient = getStakerCoefficient(reportId, msg.sender);
        uint256 coefficientMultiplier = ((amountDistributedToStakers * betterDecimals) / reportCoefficient[reportId]);
        uint256 stakerAmountToClaim = (coefficientMultiplier * stakerCoefficient) / betterDecimals;
        return stakerAmountToClaim;
    }


    /// @notice This function is for the stakers to claim their rewards
    /// @param reportId Staked report
    function stakerClaim(uint256 reportId) public whenNotPaused {
        StakeInfo storage stakeInfo = stakes[msg.sender].stakeInfoOnReport[reportId];

        require(!stakeInfo.payed, "LSS: You already claimed");
        require(losslessGovernance.reportResolution(reportId), "LSS: Report solved negatively");

        stakeInfo.payed = true;

        uint256 amountToClaim = stakerClaimableAmount(reportId);

        (,,,, address reportTokens,) = losslessReporting.getReportInfo(reportId);

        require(ILERC20(reportTokens).transfer(msg.sender, amountToClaim),
        "LSS: Reward transfer failed");
        require(stakingToken.transfer(msg.sender, stakedOnReport[msg.sender].report[reportId]),
        "LSS: Staking transfer failed");

        emit StakerClaim(msg.sender, reportTokens, reportId, amountToClaim);
    }

    // --- GETTERS ---

    /// @notice This function returns the contract version
    /// @return Returns the Smart Contract version
    function getVersion() public pure returns (uint256) {
        return 1;
    }

    
    /// @notice This function returns if an address is already staking on a report
    /// @param reportId Report being staked
    /// @param account Address to consult
    /// @return True if the account is already staking
    function getIsAccountStaked(uint256 reportId, address account) public view returns(bool) {
        return stakes[account].stakeInfoOnReport[reportId].staked;
    }

    /// @notice This function returns the coefficient of a staker in a report
    /// @param reportId Report where the address staked
    /// @param _address Staking address
    /// @return The coefficient calculated for the staker
    function getStakerCoefficient(uint256 reportId, address _address) public view returns (uint256) {
        return stakes[_address].stakeInfoOnReport[reportId].coefficient;
    }


}
