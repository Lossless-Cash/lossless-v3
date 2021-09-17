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
}

contract LosslessStaking is Initializable, ContextUpgradeable, PausableUpgradeable {

    uint256 public cooldownPeriod;

    struct Stake {
        uint256 reportId;
        uint256 timestamp;
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
       controllerAddress = _losslessReporting;
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

    function getPayoutStatus(address _address, uint256 reportId) public view returns (bool) {
        return stakes[_address][reportId].payed;
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

    function stake(uint256 reportId) public notBlacklisted {
        require(!getIsAccountStaked(reportId, _msgSender()), "LSS: already staked");
        require(losslessReporting.getReporter(reportId) != _msgSender(), "LSS: reporter can not stake");   
        require(reportId > 0 && losslessReporting.getReportTimestamps(reportId) + losslessController.getReportLifetime() > block.timestamp, "LSS: report does not exists");

        uint256 stakeAmount = losslessController.getStakeAmount();
        require(losslessToken.balanceOf(_msgSender()) >= stakeAmount, "LSS: Not enough $LSS to stake");

        stakers[reportId].push(_msgSender());
        stakes[_msgSender()].push(Stake(reportId, block.timestamp, false));

        losslessToken.transferFrom(_msgSender(), controllerAddress, stakeAmount);
        
        emit Staked(losslessReporting.getTokenFromReport(reportId), _msgSender(), reportId);
    }

    function addToWhitelist(address allowedAddress) public onlyLosslessAdmin {
        whitelist[allowedAddress] = true;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 1;
    }
}