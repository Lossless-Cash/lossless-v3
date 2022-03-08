// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "./Interfaces/ILosslessERC20.sol";
import "./Interfaces/ILosslessController.sol";
import "./Interfaces/ILosslessGovernance.sol";
import "./Interfaces/ILosslessReporting.sol";
import "./Interfaces/ILosslessStaking.sol";

/// @title Lossless Staking Contract
/// @notice The Staking contract is in charge of handling the staking done on reports
contract LosslessStaking is ILssStaking, Initializable, ContextUpgradeable, PausableUpgradeable {

    struct Stake {
        mapping(uint256 => StakeInfo) stakeInfoOnReport;
    }

    struct StakeInfo {
        uint256 timestamp;
        uint256 coefficient;
        uint256 totalStakedOnReport;
        bool staked;
        bool payed;
    }

    ILERC20 override public stakingToken;
    ILssReporting override public losslessReporting;
    ILssController override public losslessController;
    ILssGovernance override public losslessGovernance;

    uint256 public override stakingAmount;
    uint256 public constant HUNDRED = 1e2;
    uint256 public constant MILLION = 1e6;

    mapping(address => Stake) private stakes;

    mapping(uint256 => uint256) public reportCoefficient;

    mapping(address => PerReportAmount) stakedOnReport;

    struct PerReportAmount {
        mapping(uint256 => uint256) report;
    }

    function initialize(ILssReporting _losslessReporting, ILssController _losslessController, uint256 _stakingAmount) public initializer {
       losslessReporting = _losslessReporting;
       losslessController = _losslessController;
       stakingAmount = _stakingAmount;
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
    function pause() override public onlyLosslessPauseAdmin {
        _pause();
    }    

    /// @notice This function unpauses the contract
    function unpause() override public onlyLosslessPauseAdmin {
        _unpause();
    }

    /// @notice This function sets the address of the Lossless Reporting contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessReporting Address corresponding to the Lossless Reporting contract
    function setLssReporting(ILssReporting _losslessReporting) override public onlyLosslessAdmin {
        require(address(_losslessReporting) != address(0), "LERC20: Cannot be zero address");
        losslessReporting = _losslessReporting;
        emit NewReportingContract(_losslessReporting);
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingToken Address corresponding to the Lossless Governance Token
    function setStakingToken(ILERC20 _stakingToken) override public onlyLosslessAdmin {
        require(address(_stakingToken) != address(0), "LERC20: Cannot be zero address");
        stakingToken = _stakingToken;
        emit NewStakingToken(_stakingToken);
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance contract
    function setLosslessGovernance(ILssGovernance _losslessGovernance) override public onlyLosslessAdmin {
        require(address(_losslessGovernance) != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = _losslessGovernance;
        emit NewGovernanceContract(_losslessGovernance);
    }

    /// @notice This function sets the amount of tokens to be staked when staking
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingAmount Amount to be staked
    function setStakingAmount(uint256 _stakingAmount) override public onlyLosslessAdmin {
        require(_stakingAmount != 0, "LSS: Must be greater than zero");
        require(_stakingAmount != stakingAmount, "LSS: Already set to that amount");
        stakingAmount = _stakingAmount;
        emit NewStakingAmount(_stakingAmount);
    }

    // STAKING

    /// @notice This function generates a stake on a report
    /// @dev The earlier the stake is placed on the report, the higher the reward is.
    /// The reporter cannot stake as it'll have a fixed percentage reward.
    /// A reported address cannot stake.
    /// @param _reportId Report to stake
    function stake(uint256 _reportId) override public notBlacklisted whenNotPaused {
        require(!losslessGovernance.isReportSolved(_reportId), "LSS: Report already resolved");

        StakeInfo storage stakeInfo = stakes[msg.sender].stakeInfoOnReport[_reportId];

        (address reporter,,, uint256 reportTimestamps, ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        require(!stakeInfo.staked, "LSS: already staked");
        require(msg.sender != reporter, "LSS: reporter can not stake");   

        uint256 reportTimestamp = reportTimestamps;
        uint256 reportLifetime = losslessReporting.reportLifetime();

        require(_reportId != 0 && (reportTimestamp + reportLifetime) > block.timestamp, "LSS: report does not exists");

        uint256 stakerCoefficient = reportTimestamp + reportLifetime - block.timestamp;

        stakeInfo.timestamp = block.timestamp;
        stakeInfo.coefficient = stakerCoefficient;
        stakeInfo.staked = true;

        reportCoefficient[_reportId] += stakerCoefficient;
        
        require(stakingToken.transferFrom(msg.sender, address(this), stakingAmount),
        "LSS: Staking transfer failed");

        stakeInfo.totalStakedOnReport += stakingAmount;
        stakedOnReport[msg.sender].report[_reportId] = stakingAmount;
        
        emit NewStake(reportTokens, msg.sender, _reportId, stakingAmount);
    }

    // --- CLAIM ---
    
    /// @notice This function returns the claimable amount by the stakers
    /// @dev It takes into consideration the staker coefficient in order to return the percentage rewarded.
    /// @param _reportId Staked report
    function stakerClaimableAmount(uint256 _reportId) override public view returns (uint256) {
        (,,, uint256 stakersReward) = losslessReporting.getRewards();
        uint256 amountStakedOnReport = losslessGovernance.getAmountReported(_reportId);
        uint256 amountDistributedToStakers = (amountStakedOnReport * stakersReward) / HUNDRED;
        uint256 stakerCoefficient = getStakerCoefficient(_reportId, msg.sender);
        uint256 coefficientMultiplier = ((amountDistributedToStakers * MILLION) / reportCoefficient[_reportId]);
        uint256 stakerAmountToClaim = (coefficientMultiplier * stakerCoefficient) / MILLION;
        return stakerAmountToClaim;
    }


    /// @notice This function is for the stakers to claim their rewards
    /// @param _reportId Staked report
    function stakerClaim(uint256 _reportId) override public whenNotPaused {
        StakeInfo storage stakeInfo = stakes[msg.sender].stakeInfoOnReport[_reportId];

        require(!stakeInfo.payed, "LSS: You already claimed");
        require(losslessGovernance.reportResolution(_reportId), "LSS: Report solved negatively");

        stakeInfo.payed = true;

        uint256 amountToClaim = stakerClaimableAmount(_reportId);

        (,,,, ILERC20 reportTokens,,) = losslessReporting.getReportInfo(_reportId);

        require(reportTokens.transfer(msg.sender, amountToClaim),
        "LSS: Reward transfer failed");
        require(stakingToken.transfer(msg.sender, stakedOnReport[msg.sender].report[_reportId]),
        "LSS: Staking transfer failed");

        emit StakerClaim(msg.sender, reportTokens, _reportId, amountToClaim);
    }

    // --- GETTERS ---

    /// @notice This function returns the contract version
    /// @return Returns the Smart Contract version
    function getVersion() override public pure returns (uint256) {
        return 1;
    }

    
    /// @notice This function returns if an address is already staking on a report
    /// @param _reportId Report being staked
    /// @param _account Address to consult
    /// @return True if the account is already staking
    function getIsAccountStaked(uint256 _reportId, address _account) override public view returns(bool) {
        return stakes[_account].stakeInfoOnReport[_reportId].staked;
    }

    /// @notice This function returns the coefficient of a staker in a report
    /// @param _reportId Report where the address staked
    /// @param _address Staking address
    /// @return The coefficient calculated for the staker
    function getStakerCoefficient(uint256 _reportId, address _address) override public view returns (uint256) {
        return stakes[_address].stakeInfoOnReport[_reportId].coefficient;
    }


}
