// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

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
    
    mapping(address => Stake) private stakes;
    mapping(uint256 => address[]) public stakers;

    mapping(uint256 => uint256) public totalStakedOnReport;

    mapping(uint256 => uint256) public reportCoefficient;

    event Staked(address indexed token, address indexed account, uint256 reportId);
    event StakerClaimed(address indexed staker, address indexed token, uint256 indexed reportID);
    event StakingAmountChanged(uint256 indexed newAmount);

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
    function setLssReporting(address _losslessReporting) public onlyLosslessAdmin {
        require(_losslessReporting != address(0), "LERC20: Cannot be zero address");
        losslessReporting = ILssReporting(_losslessReporting);
    }

    /// @notice This function sets the address of the Lossless Governance Token
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingToken Address corresponding to the Lossless Governance Token
    function setStakingToken(address _stakingToken) public onlyLosslessAdmin {
        require(_stakingToken != address(0), "LERC20: Cannot be zero address");
        stakingToken = ILERC20(_stakingToken);
    }

    /// @notice This function sets the address of the Lossless Governance contract
    /// @dev Only can be called by the Lossless Admin
    /// @param _losslessGovernance Address corresponding to the Lossless Governance contract
    function setLosslessGovernance(address _losslessGovernance) public onlyLosslessAdmin {
        require(_losslessGovernance != address(0), "LERC20: Cannot be zero address");
        losslessGovernance = ILssGovernance(_losslessGovernance);
    }

    /// @notice This function sets the amount of tokens to be staked when staking
    /// @dev Only can be called by the Lossless Admin
    /// @param _stakingAmount Amount to be staked
    function setStakingAmount(uint256 _stakingAmount) public onlyLosslessAdmin {
        stakingAmount = _stakingAmount;
        emit StakingAmountChanged(_stakingAmount);
    }

    // STAKING

    /// @notice This function generates a stake on a report
    /// @dev The earlier the stake is placed on the report, the higher the reward is.
    /// The reporter cannot stake as it'll have a fixed percentage reward.
    /// A reported address cannot stake.
    /// @param reportId Report to stake
    function stake(uint256 reportId) public notBlacklisted whenNotPaused {
        require(!losslessGovernance.isReportSolved(reportId), "LSS: Report already resolved");
        require(!stakes[msg.sender].stakeInfoOnReport[reportId].staked, "LSS: already staked");
        require(losslessReporting.reporter(reportId) != msg.sender, "LSS: reporter can not stake");   

        uint256 reportTimestamp = losslessReporting.reportTimestamps(reportId);

        require(reportId > 0 && (reportTimestamp + losslessReporting.reportLifetime()) > block.timestamp, "LSS: report does not exists");

        uint256 stakerCoefficient = reportTimestamp + losslessReporting.reportLifetime() - block.timestamp;

        stakers[reportId].push(msg.sender);
        stakes[msg.sender].stakeInfoOnReport[reportId].timestamp = block.timestamp;
        stakes[msg.sender].stakeInfoOnReport[reportId].coefficient = stakerCoefficient;
        stakes[msg.sender].stakeInfoOnReport[reportId].staked = true;

        reportCoefficient[reportId] += stakerCoefficient;
        
        stakingToken.transferFrom(msg.sender, address(this), stakingAmount);

        totalStakedOnReport[reportId] += stakingAmount;
        
        emit Staked(losslessReporting.reportTokens(reportId), msg.sender, reportId);
    }

    // --- CLAIM ---
    
    /// @notice This function returns the claimable amount by the stakers
    /// @dev It takes into consideration the staker coefficient in order to return the percentage rewarded.
    /// @param reportId Staked report
    function stakerClaimableAmount(uint256 reportId) public view returns (uint256) {
        (,,, uint256 stakersReward) = losslessReporting.getRewards();
        uint256 amountStakedOnReport = losslessGovernance.amountReported(reportId);
        uint256 amountDistributedToStakers = amountStakedOnReport * stakersReward / 10**2;
        uint256 stakerCoefficient = getStakerCoefficient(reportId, msg.sender);
        uint256 coefficientMultiplier = ((amountDistributedToStakers * 10**6) / reportCoefficient[reportId]);
        uint256 stakerAmountToClaim = (coefficientMultiplier * stakerCoefficient) / 10**6;
        return stakerAmountToClaim;
    }


    /// @notice This function is for the stakers to claim their rewards
    /// @param reportId Staked report
    function stakerClaim(uint256 reportId) public whenNotPaused {
        require(!stakes[msg.sender].stakeInfoOnReport[reportId].payed, "LSS: You already claimed");
        require(losslessGovernance.reportResolution(reportId), "LSS: Report solved negatively");

        stakes[msg.sender].stakeInfoOnReport[reportId].payed = true;

        ILERC20(losslessReporting.reportTokens(reportId)).transfer(msg.sender, stakerClaimableAmount(reportId));
        stakingToken.transfer( msg.sender, stakingAmount);

        emit StakerClaimed(msg.sender, losslessReporting.reportTokens(reportId), reportId);
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
