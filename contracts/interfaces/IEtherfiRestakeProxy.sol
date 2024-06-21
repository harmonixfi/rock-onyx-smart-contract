// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IEtherfiRestakeProxy {
    function deposit(address tokenIn, uint256 amountIn, uint256 minAmountOut) external payable;
}