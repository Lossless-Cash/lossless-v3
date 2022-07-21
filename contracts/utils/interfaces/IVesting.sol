// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IVesting {     
    function claim(address _address) external;
    function accruedBalanceOf(address beneficiaryAddress) external view returns (uint256);
    function isBeneficiary(address beneficiaryAddress) external view returns(bool);
}