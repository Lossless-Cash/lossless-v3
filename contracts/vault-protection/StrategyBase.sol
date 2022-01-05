// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface LosslessController {
    function admin() external returns(address);

    function isAddressProtected(address token, address protectedAddress) external view returns (bool);
}

interface Guardian {
    function protectionAdmin(address token) external returns (address);

    function setProtectedAddress(address token, address guardedAddress) external;

    function removeProtectedAddresses(address token, address protectedAddress) external;
}

abstract contract StrategyBase {
    Guardian public guardian;
    LosslessController public controller;

    // --- EVENTS ---

    event GuardianSet(address indexed newGuardian);
    event Paused(address indexed token, address indexed protectedAddress);
    event Unpaused(address indexed token, address indexed protectedAddress);

    constructor(Guardian _guardian, LosslessController _controller) {
        guardian = _guardian;
        controller = _controller;
    }

    // --- MODIFIERS ---

    modifier onlyProtectionAdmin(address token) {
        require(msg.sender == guardian.protectionAdmin(token), "LOSSLESS: Not protection admin");
        _;
    }

    // --- METHODS ---

    // @dev In case guardian is changed, this allows not to redeploy strategy and just update it.
    function setGuardian(Guardian newGuardian) external {
        require(msg.sender == controller.admin(), "LOSSLESS: Not lossless admin");
        guardian = newGuardian;
        emit GuardianSet(address(newGuardian));
    }
}