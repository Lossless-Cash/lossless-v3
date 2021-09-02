// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface LERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    function admin() external view returns (address);
}


contract LosslessControllerV2 is Initializable, ContextUpgradeable, PausableUpgradeable {
    address public pauseAdmin;
    address public admin;
    address public recoveryAdmin;

    //Duplicate with V3 remove when fully implemented
    uint256 public stakeAmount;

    uint256 public reportLifetime;
    uint256 public reportCount;
    LERC20 public losslessToken;

    // FIX
    struct TokenReports {
        mapping(address => uint256) reports;
    }

    mapping(uint256 => address) public reporter;
    mapping(address => TokenReports) tokenReports;
    mapping(uint256 => uint256) public reportTimestamps;
    mapping(uint256 => address) public reportTokens;
    mapping(uint256 => bool) public anotherReports;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event PauseAdminChanged(address indexed previousAdmin, address indexed newAdmin);

    event ReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    event AnotherReportSubmitted(address indexed token, address indexed account, uint256 reportId);
    // --- MODIFIERS ---

    modifier onlyLosslessRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LSS: must be recoveryAdmin");
        _;
    }

    modifier onlyLosslessAdmin() {
        require(admin == _msgSender(), "LSS: must be admin");
        _;
    }

    // --- ADMIN STUFF ---

    function pause() public {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
        _pause();
    }    
    
    function unpause() public {
        require(_msgSender() == pauseAdmin, "LSS: Must be pauseAdmin");
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

    function setReportLifetime(uint256 _reportLifetime) public onlyLosslessAdmin {
        reportLifetime = _reportLifetime;
    }

    function setLosslessToken(address _losslessToken) public onlyLosslessAdmin {
        losslessToken = LERC20(_losslessToken);
    }

    //Duplicate with V3 remove when fully implemented
    function setStakeAmount(uint256 _stakeAmount) public onlyLosslessAdmin {
        stakeAmount = _stakeAmount;
    }

    // --- GETTERS ---

    function getVersion() public pure returns (uint256) {
        return 2;
    }

    // --- REPORTS ---

    function report(address token, address account) public {
        uint256 reportId = tokenReports[token].reports[account];
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId == 0 || reportTimestamp + reportLifetime < block.timestamp, "LSS: report already exists");

        reportCount += 1;
        reportId = reportCount;
        reporter[reportId] = _msgSender();

        // Bellow does not allow freezing more than one wallet. Do we want that?
        tokenReports[token].reports[account] = reportId;
        reportTimestamps[reportId] = block.timestamp;
        reportTokens[reportId] = token;

        losslessToken.transferFrom(_msgSender(), address(this), stakeAmount);

        emit ReportSubmitted(token, account, reportId);
    }

    function reportAnother(uint256 reportId, address token, address account) public {
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId > 0 && reportTimestamp + reportLifetime > block.timestamp, "LSS: report does not exists");
        require(anotherReports[reportId] == false, "LSS: another report already submitted");
        require(_msgSender() == reporter[reportId], "LSS: invalid reporter");

        anotherReports[reportId] = true;
        tokenReports[token].reports[account] = reportId;

        emit AnotherReportSubmitted(token, account, reportId);
    }

    // --- BEFORE HOOKS ---

    function beforeTransfer(address sender, address recipient, uint256 amount) external view{
        uint256 reportId = tokenReports[_msgSender()].reports[sender];
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId == 0 || reportTimestamp + reportLifetime < block.timestamp, "LSS: address is temporarily flagged");
    }

    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external view{
        uint256 reportId = tokenReports[_msgSender()].reports[sender];
        uint256 reportTimestamp = reportTimestamps[reportId];
        require(reportId == 0 || reportTimestamp + reportLifetime < block.timestamp, "LSS: address is temporarily flagged");

        uint256 msgSenderReportId = tokenReports[_msgSender()].reports[msgSender];
        uint256 msgSenderReportTimestamp = reportTimestamps[msgSenderReportId];
        require(msgSenderReportId == 0 || msgSenderReportTimestamp + reportLifetime < block.timestamp, "LSS: address is temporarily flagged");
    }

    function beforeApprove(address sender, address spender, uint256 amount) external {}

    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external {}

    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external {}

    // --- AFTER HOOKS ---

    function afterApprove(address sender, address spender, uint256 amount) external {}

    function afterTransfer(address sender, address recipient, uint256 amount) external {}

    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external {}

    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external {}

    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external {}
}