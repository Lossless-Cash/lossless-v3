// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./StrategyBase.sol";

contract TreasuryProtectionStrategy is StrategyBase {
    mapping(address => Protection) private protectedAddresses;

    struct Whitelist {
        mapping(address => bool) whitelist;
    }

    struct Protection {
        mapping(address => Whitelist) protection; 
    }

    constructor(Guardian _guardian, LosslessController _controller) StrategyBase(_guardian, _controller) {}

    // --- VIEWS ---

    function isAddressWhitelisted(address token, address protectedAddress, address whitelistedAddress) public view returns(bool) {
        return protectedAddresses[token].protection[protectedAddress].whitelist[whitelistedAddress];
    }

    // @dev Called by controller to check if transfer is allowed to happen.
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external view {
        require(isAddressWhitelisted(token, sender, recipient), "LOSSLESS: not whitelisted");
    }

    // --- METHODS ---

    // @dev Called by project owners. Sets a whitelist for protected address.
    function setProtectedAddress(address token, address protectedAddress, address[] calldata whitelist) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < whitelist.length; i++) {
            protectedAddresses[token].protection[protectedAddress].whitelist[whitelist[i]] = true;
        }

        guardian.setProtectedAddress(token, protectedAddress);
    }

    // @dev Remove whitelist for protected addresss.
    function removeProtectedAddresses(address token, address[] calldata addressesToRemove) public onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < addressesToRemove.length; i++) {
            delete protectedAddresses[token].protection[addressesToRemove[i]];
            guardian.removeProtectedAddresses(token, addressesToRemove[i]);
        }
    }
}