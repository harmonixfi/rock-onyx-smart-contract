// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../extensions/TransferHelper.sol";
import "../interfaces/ISwapProxy.sol";
import "../interfaces/IPriceConsumerProxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

abstract contract BaseSwap {
    IPriceConsumerProxy internal priceConsumer;
    uint8 private slippage;
    address internal owner;

    constructor(
        address _admin,
        address _priceConsumer) {
        priceConsumer = IPriceConsumerProxy(_priceConsumer);
        slippage = 50;
        owner = _admin;
    }

    // slippage decimals: 4 ---- ex: 50 mean 0.5%
    function setSlippage(uint8 _slippage) external {
        require(msg.sender == owner, "INVALID_ADMIN");
        slippage = _slippage;
    }

    function getPoolCurrentTickOf(
        address token0,
        address token1
    ) external view virtual returns (int24) {}

    function getPriceOf(
        address token0,
        address token1
    ) external view returns (uint256) {
        return priceConsumer.getPriceOf(token0, token1);
    }

    function getAmountOutMinimum(
        address token0,
        address token1,
        uint256 amountIn
    ) public view returns (uint256) {
        return
            (amountIn *
                priceConsumer.getPriceOf(token0, token1) *
                (1e4 - slippage)) / (10 ** (ERC20(token0).decimals() + 4));
    }

    function getAmountInMaximum(
        address token0,
        address token1,
        uint256 amountOut
    ) public view returns (uint256) {
        return
            (amountOut *
                priceConsumer.getPriceOf(token1, token0) *
                (1e4 + slippage)) / (10 ** (ERC20(token1).decimals() + 4));
    }

    function getSlippage() external view returns (uint256) {
        return slippage;
    }
}
