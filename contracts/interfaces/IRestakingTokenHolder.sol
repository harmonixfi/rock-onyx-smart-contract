// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IRestakingTokenHolder {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external returns(uint256);
    function balanceOf(address owwner) external view returns(uint256);
}