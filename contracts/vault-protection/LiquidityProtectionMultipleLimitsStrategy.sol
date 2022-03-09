// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./StrategyBase.sol";

contract LiquidityProtectionMultipleLimitsStrategy is StrategyBase{
    mapping(address => Protection) private protection;

    struct Limit {
        uint256 periodInSeconds;
        uint256 lastCheckpointTime;
        uint256 amountPerPeriod;
        uint256 amountLeftInCurrentPeriod;
    }

    struct Protection {
        mapping(address => Limit[]) limits;
    }

    constructor(Guardian _guardian, LosslessController _controller)  StrategyBase(_guardian, _controller) {}

    // --- METHODS ---

    // @dev params mostly as in batched
    // @dev This method allows setting 0...N limit to 1 address.
    // @dev Each item on the same index in periodsInSeconds, amountsPerPeriod, startTimestamp represents a different variable of the same limit.
    function setLimits(
        address token,
        address protectedAddress,
        uint256[] calldata periodsInSeconds,
        uint256[] calldata amountsPerPeriod,
        uint256[] calldata startTimestamp
    ) external onlyProtectionAdmin(token) {
        guardian.setProtectedAddress(token, protectedAddress);
        saveLimits(token, protectedAddress, periodsInSeconds, amountsPerPeriod, startTimestamp);
    }

    // @param token Project token, the protection will be scoped inside of this token's transfers.
    // @param protectedAddress Address to apply the limits to.
    // @param periodsInSeconds Limit period described in seconds. Each item in the list represents a different limit.
    // @param amountsPerPeriod A list of max amounts that can be transfered in the coressponding period.
    // @param startTimestamp A list of item that shows when each of the limits should be activated. Desribed in seconds.
    // @dev This method allows setting 0...N limits to 0...N addresses.
    // @dev Each item on the same index in periodsInSeconds, amountsPerPeriod, startTimestamp represents a different variable of the same limit.
    function setLimitsBatched(
        address token,
        address[] calldata protectedAddresses,
        uint256[] calldata periodsInSeconds,
        uint256[] calldata amountsPerPeriod,
        uint256[] calldata startTimestamp
    ) external onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            guardian.setProtectedAddress(token, protectedAddresses[i]);
            saveLimits(token, protectedAddresses[i], periodsInSeconds, amountsPerPeriod, startTimestamp);
        }
    }

    function removeLimits(address token, address[] calldata protectedAddresses) external onlyProtectionAdmin(token) {
        for(uint8 i = 0; i < protectedAddresses.length; i++) {
            delete protection[token].limits[protectedAddresses[i]];
            guardian.removeProtectedAddresses(token, protectedAddresses[i]);
        }
    }

    // @dev Pausing is just adding a limit with amount 0 in the front on the limits array.
    // @dev We need to keep it at the front to reduce the gas costs of iterating through the array.
    function pause(address token, address protectedAddress) external onlyProtectionAdmin(token) {
        require(controller.isAddressProtected(token, protectedAddress), "LOSSLESS: Address not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        Limit storage firstLimit = limits[0];
        uint256 maxPossibleCheckpointTime = type(uint256).max - firstLimit.periodInSeconds;
        require(firstLimit.lastCheckpointTime != maxPossibleCheckpointTime, "LOSSLESS: Already paused");

        limits.push(cloneLimit(0, limits));

        // Set first element to have zero amount left and make it so it never enters new period
        firstLimit.amountLeftInCurrentPeriod = 0;
        firstLimit.lastCheckpointTime = maxPossibleCheckpointTime;

        emit Paused(token, protectedAddress);
    }

    // @dev Removing the first limit in the array in case it is 0.
    // @dev In case project sets a 0 limit as the first limit's array element, this would allow removing it.
    function unpause(address token, address protectedAddress) external onlyProtectionAdmin(token) { 
        require(controller.isAddressProtected(token, protectedAddress), "LOSSLESS: Address not protected");
        Limit[] storage limits = protection[token].limits[protectedAddress];
        uint256 maxPossibleCheckpointTime = type(uint256).max - limits[0].periodInSeconds;
        require(limits[0].lastCheckpointTime == maxPossibleCheckpointTime, "LOSSLESS: not paused");
        
        limits[0] = cloneLimit(limits.length - 1, limits);
        delete limits[limits.length - 1];
        limits.pop();

        emit Unpaused(token, protectedAddress);
    }

    // @dev Limit is reset every period.
    // @dev Every period has it's own amountLeftInCurrentPeriod which gets decreased on every transfer.
    // @dev This method modifies state so should be callable only by the trusted address!
    // @dev Unused recipien variable is neede to comply with the strategy interface, it is used in the other strategies.
    function isTransferAllowed(address token, address sender, address recipient, uint256 amount) external {
        require(msg.sender == address(controller), "LOSSLESS: LSS Controller only");
        Limit[] storage limits = protection[token].limits[sender];
        
        for(uint8 i = 0; i < limits.length; i++) {
            Limit storage limit = limits[i];

            // Is transfer is in the same period ?
            if (limit.lastCheckpointTime + limit.periodInSeconds > block.timestamp) {
                limit.amountLeftInCurrentPeriod = calculateAmountLeft(amount, limit.amountLeftInCurrentPeriod);
            }
            // New period started, update checkpoint and reset amount
            else {
                limit.lastCheckpointTime = calculateUpdatedCheckpoint(limit.lastCheckpointTime, limit.periodInSeconds);
                limit.amountLeftInCurrentPeriod = calculateAmountLeft(amount, limit.amountPerPeriod);
            }
            
            require(limit.amountLeftInCurrentPeriod > 0, "LOSSLESS: Strategy limit reached");
        }
    }

    // --- INTERNAL METHODS ---

    function saveLimits(     
        address token,   
        address protectedAddress,
        uint256[] calldata periodsInSeconds,
        uint256[] calldata amountsPerPeriod,
        uint256[] calldata startTimestamp
    ) internal {
        Limit[] storage limits = protection[token].limits[protectedAddress];
        for(uint8 i = 0; i < periodsInSeconds.length; i ++) {
            Limit memory limit;
            limit.periodInSeconds = periodsInSeconds[i];
            limit.amountPerPeriod = amountsPerPeriod[i];
            limit.lastCheckpointTime = startTimestamp[i];
            limit.amountLeftInCurrentPeriod = amountsPerPeriod[i];
            limits.push(limit);
        }
    }

    function calculateAmountLeft(uint256 amount, uint256 amountLeftInCurrentPeriod) internal pure returns (uint256)  {
        if (amount >= amountLeftInCurrentPeriod) {
            return 0;
        } else {
            return amountLeftInCurrentPeriod - amount;
        }
    }

    function calculateUpdatedCheckpoint(uint256 lastCheckpointTime, uint256 periodInSeconds) internal view returns(uint256) {
        return lastCheckpointTime + (periodInSeconds * ((block.timestamp - lastCheckpointTime) / periodInSeconds));
    }

    function cloneLimit(uint256 indexFrom, Limit[] memory limits) internal pure returns (Limit memory limitCopy)  {
        limitCopy.periodInSeconds = limits[indexFrom].periodInSeconds;
        limitCopy.amountPerPeriod = limits[indexFrom].amountPerPeriod;
        limitCopy.lastCheckpointTime = limits[indexFrom].lastCheckpointTime;
        limitCopy.amountLeftInCurrentPeriod = limits[indexFrom].amountLeftInCurrentPeriod;
    }

    // --- VIEWS ---

    function getLimitsLength(address token, address protectedAddress) external view returns(uint256) {
        return protection[token].limits[protectedAddress].length;
    }

    function getLimit(address token, address protectedAddress, uint256 index) external view returns(Limit memory) {
        return protection[token].limits[protectedAddress][index];
    }
}