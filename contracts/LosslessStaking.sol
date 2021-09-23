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
    function getReporter(uint256 _reportId) external view returns (address);
    
    function getReportTimestamps(uint256 _reportId) external view returns (uint256);

    function getTokenFromReport(uint256 _reportId) external view returns (address);
}

interface ILssController {
    function getStakeAmount() external view returns (uint256);

    function isBlacklisted(address _adr) external view returns (bool);

    function getReportLifetime() external returns (uint256);

    function addToReportCoefficient(uint256 reportId, uint256 _amt) external;
}

contract LosslessStaking is Initializable, ContextUpgradeable, PausableUpgradeable {

    uint256 public cooldownPeriod;

    struct Stake {
        uint256 reportId;
        uint256 timestamp;
        uint256 coefficient;
        bool payed;
    }

    ILERC20 public losslessToken;
    ILssReporting public losslessReporting;
    ILssController public losslessController;

    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;
    address public controllerAddress;
    address public tokenAddress;

    mapping(address => bool) whitelist;
    
    mapping(address => Stake[]) public stakes;
    mapping(uint256 => address[]) public stakers;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event Staked(address indexed token, address indexed account, uint256 reportId);

    function initialize(address _admin, address _recoveryAdmin, address _pauseAdmin, address _losslessReporting, address _losslessController) public initializer {
       cooldownPeriod = 5 minutes;
       admin = _admin;
       recoveryAdmin = _recoveryAdmin;
       pauseAdmin = _pauseAdmin;
       losslessReporting = ILssReporting(_losslessReporting);
       losslessController = ILssController(_losslessController);
       controllerAddress = _losslessController;
    }

    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LSS: Must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LSS: Must be admin");
        _;
    }

    modifier onlyLosslessPauseAdmin() {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
        _;
    }

    modifier notBlacklisted() {
        require(!losslessController.isBlacklisted(_msgSender()), "LSS: You cannot operate");
        _;
    }

    modifier onlyFromAdminOrLssSC {
        require(_msgSender() == controllerAddress ||
                _msgSender() == admin, "LSS: Admin or LSS SC only");
        _;
    }


    // --- SETTERS ---

    function pause() public onlyLosslessPauseAdmin {
        _pause();
    }    
    
    function unpause() public onlyLosslessPauseAdmin {
        _unpause();
    }

    function setAdmin(address newAdmin) public onlyLosslessRecoveryAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setRecoveryAdmin(address newRecoveryAdmin) public onlyLosslessRecoveryAdmin {
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function setPauseAdmin(address newPauseAdmin) public onlyLosslessRecoveryAdmin {
        emit PauseAdminChanged(pauseAdmin, newPauseAdmin);
        pauseAdmin = newPauseAdmin;
    }

    function setILssReporting(address _losslessReporting) public onlyLosslessRecoveryAdmin {
        losslessReporting = ILssReporting(_losslessReporting);
    }

    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = ILERC20(_losslessToken);
        tokenAddress = _losslessToken;
    }
    
    // GET STAKE INFO

    function getAccountStakes(address account) public view returns(Stake[] memory) {
        return stakes[account];
    }

    function getStakingTimestamp(address _address, uint256 reportId) public view returns (uint256){
        for(uint256 i; i < stakes[_address].length; i++) {
            if (stakes[_address][i].reportId == reportId) {
                return stakes[_address][i].timestamp;
            }
        }
    }

    function getPayoutStatus(address _address, uint256 reportId) public view returns (bool) {
        for(uint256 i; i < stakes[_address].length; i++) {
            if (stakes[_address][i].reportId == reportId) {
                return stakes[_address][i].payed;
            }
        }
    }

    function getReportStakes(uint256 reportId) public view returns(address[] memory) {
        return stakers[reportId];
    }

    function getIsAccountStaked(uint256 reportId, address account) public view returns(bool) {
        for(uint256 i; i < stakes[account].length; i++) {
            if (stakes[account][i].reportId == reportId) {
                return true;
            }
        }

        return false;
    }


    // STAKING

    function calculateCoefficient(uint256 _timestamp) private view returns (uint256) {
        return 86400/((block.timestamp - _timestamp));
    }

    function getStakerCoefficient(uint256 reportId, address _address) public view returns (uint256) {
        for(uint256 i; i < stakes[_address].length; i++) {
            if (stakes[_address][i].reportId == reportId) {
                return stakes[_address][i].coefficient;
            }
        }
    }

    function stake(uint256 reportId) public notBlacklisted {
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
        stakes[_msgSender()].push(Stake(reportId, block.timestamp, stakerCoefficient, false));

        losslessController.addToReportCoefficient(reportId, stakerCoefficient);
        
        losslessToken.transferFrom(_msgSender(), controllerAddress, stakeAmount);
        
        emit Staked(losslessReporting.getTokenFromReport(reportId), _msgSender(), reportId);
    }

    function addToWhitelist(address allowedAddress) public onlyLosslessAdmin {
        whitelist[allowedAddress] = true;
    }

    function setPayoutStatus(uint256 reportId, address _adr) public onlyFromAdminOrLssSC {

        for(uint256 i; i < stakes[_adr].length; i++) {
            if (stakes[_adr][i].reportId == reportId) {
                stakes[_adr][i].payed = true;
            }
        }
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 1;
    }
}