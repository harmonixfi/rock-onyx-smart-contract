// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../lib/BaseSwap.sol";
import "../../interfaces/UniSwap/IUniswapRouter.sol";

contract UniSwap is BaseSwap {
    IUniSwapRouter private swapRouter;

    constructor(
        address _admin,
        address _swapRouterAddress,
        address _priceConsumer
    ) BaseSwap(_admin, _priceConsumer) {
        swapRouter = IUniSwapRouter(_swapRouterAddress);
    }

    function swapTo(
        address recipient,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 poolFee
    ) external returns (uint256) {
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
        uint256 amountOutMinimum = getAmountOutMinimum(
            tokenIn,
            tokenOut,
            amountIn
        );
            console.log("tokenIn ", address(tokenIn));
            console.log("tokenOut ", tokenOut);
            console.log("swapRouter ", address(swapRouter));
            console.log("amountOutMinimum ", amountOutMinimum);
        IUniSwapRouter.BaseExactInputSingleParams memory params = IUniSwapRouter
            .BaseExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        return swapRouter.exactInputSingle(params);
    }

    function swapToWithOutput(
        address recipient,
        address tokenIn,
        uint256 amountOut,
        address tokenOut,
        uint24 poolFee
    ) external returns (uint256) {
        uint256 amountInMaximum = getAmountInMaximum(tokenIn, tokenOut, amountOut);
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountInMaximum);
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountInMaximum);
        IUniSwapRouter.ExactOutputSingleParams memory params = IUniSwapRouter
            .ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: recipient,
                //deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        uint256 amountIn = swapRouter.exactOutputSingle(params);
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
            TransferHelper.safeTransfer(tokenIn, msg.sender, amountInMaximum - amountIn);
        }

        return amountIn;
    }
}