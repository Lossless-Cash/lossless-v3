//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ILosslessController {
    function beforeTransfer(address sender, address recipient, uint256 amount) external;
    function beforeTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external;
    function beforeApprove(address sender, address spender, uint256 amount) external;
    function beforeIncreaseAllowance(address msgSender, address spender, uint256 addedValue) external;
    function beforeDecreaseAllowance(address msgSender, address spender, uint256 subtractedValue) external;
    function afterApprove(address sender, address spender, uint256 amount) external;
    function afterTransfer(address sender, address recipient, uint256 amount) external;
    function afterTransferFrom(address msgSender, address sender, address recipient, uint256 amount) external;
    function afterIncreaseAllowance(address sender, address spender, uint256 addedValue) external;
    function afterDecreaseAllowance(address sender, address spender, uint256 subtractedValue) external;
}

contract LERC20 is ERC20 {
    ILosslessController private lossless;
    address public recoveryAdmin;
    address public admin;
    uint256 public timelockPeriod;
    uint256 public losslessTurnOffDate;
    bool public isLosslessTurnOffProposed;
    bool public isLosslessOn = true;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event RecoveryAdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event LosslessTurnOffProposed(uint256 turnOffDate);
    event LosslessTurnedOff();
    event LosslessTurnedOn();

    constructor(uint256 totalSupply, string memory name, string memory symbol, address lssAddress, address _admin, address _recoveryAdmin, uint256 _timelockPeriod) ERC20(name, symbol) {
        _mint(_msgSender(), totalSupply);
        admin = _admin;
        recoveryAdmin = _recoveryAdmin;
        timelockPeriod = _timelockPeriod;
        lossless = ILosslessController(lssAddress);
    }

    // --- LOSSLESS modifiers ---

    modifier lssAprove(address spender, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeApprove(_msgSender(), spender, amount);
            _;
            lossless.afterApprove(_msgSender(), spender, amount);
        } else {
            _;
        }
    }

    modifier lssTransfer(address recipient, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeTransfer(_msgSender(), recipient, amount);
            _;
            lossless.afterTransfer(_msgSender(), recipient, amount);
        } else {
            _;
        }
    }

    modifier lssTransferFrom(address sender, address recipient, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeTransferFrom(_msgSender(),sender, recipient, amount);
            _;
            lossless.afterTransferFrom(_msgSender(), sender, recipient, amount);
        } else {
            _;
        }
    }

    modifier lssIncreaseAllowance(address spender, uint256 addedValue) {
        if (isLosslessOn) {
            lossless.beforeIncreaseAllowance(_msgSender(), spender, addedValue);
            _;
            lossless.afterIncreaseAllowance(_msgSender(), spender, addedValue);
        } else {
            _;
        }
    }

    modifier lssDecreaseAllowance(address spender, uint256 subtractedValue) {
        if (isLosslessOn) {
            lossless.beforeDecreaseAllowance(_msgSender(), spender, subtractedValue);
            _;
            lossless.afterDecreaseAllowance(_msgSender(), spender, subtractedValue);
        } else {
            _;
        }
    }

    modifier onlyRecoveryAdmin() {
        require(_msgSender() == recoveryAdmin, "LERC20: Must be recovery admin");
        _;
    }

    // --- LOSSLESS management ---

    function getAdmin() external view returns (address) {
        return admin;
    }

    function transferOutBlacklistedFunds(address[] calldata from) external {
        require(_msgSender() == address(lossless), "LERC20: Only lossless contract");
        for (uint i = 0; i < from.length; i++) {
            _transfer(from[i], address(lossless), balanceOf(from[i]));
        }
    }

    function setLosslessAdmin(address newAdmin) public onlyRecoveryAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setLosslessRecoveryAdmin(address newRecoveryAdmin) public onlyRecoveryAdmin {
        emit RecoveryAdminChanged(recoveryAdmin, newRecoveryAdmin);
        recoveryAdmin = newRecoveryAdmin;
    }

    function proposeLosslessTurnOff() public onlyRecoveryAdmin {
        losslessTurnOffDate = block.timestamp + timelockPeriod;
        isLosslessTurnOffProposed = true;
        emit LosslessTurnOffProposed(losslessTurnOffDate);
    }

    function executeLosslessTurnOff() public onlyRecoveryAdmin {
        require(isLosslessTurnOffProposed, "LERC20: TurnOff not proposed");
        require(losslessTurnOffDate <= block.timestamp, "LERC20: Time lock in progress");
        isLosslessOn = false;
        isLosslessTurnOffProposed = false;
        emit LosslessTurnedOff();
    }

    function executeLosslessTurnOn() public onlyRecoveryAdmin {
        isLosslessTurnOffProposed = false;
        isLosslessOn = true;
        emit LosslessTurnedOn();
    }

    // --- ERC20 methods ---

    function approve(address spender, uint256 amount) public virtual override lssAprove(spender, amount) returns (bool) {
        return super.approve(spender, amount);
    }

    function transfer(address recipient, uint256 amount) public virtual override lssTransfer(recipient, amount) returns (bool) {
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override lssTransferFrom(sender, recipient, amount) returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual override lssIncreaseAllowance(spender, addedValue) returns (bool) {
        return super.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual override lssDecreaseAllowance(spender, subtractedValue) returns (bool) {
        return super.decreaseAllowance(spender, subtractedValue);
    }
}