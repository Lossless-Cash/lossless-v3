// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../Interfaces/ILosslessERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "hardhat/console.sol";

contract MockTransfer is Initializable {

    ILERC20 public lerc20Token;
    
    function initialize(address _lerc20Token) public initializer {
        lerc20Token = ILERC20(_lerc20Token);
    }

    function testSameTimestamp(address from, address to, uint256 amount) public {
      lerc20Token.transferFrom(from, to, amount);
      lerc20Token.transferFrom(from, to, amount);
    }
}