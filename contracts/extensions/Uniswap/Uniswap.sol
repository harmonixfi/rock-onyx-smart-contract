// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../lib/BaseSwap.sol";
import "../../interfaces/UniSwap/IUniswapRouter.sol";
import "hardhat/console.sol";

contract UniSwap is BaseSwap {
    uint64 private constant BASE_NETWORK = 8453;

    IUniSwapRouter private swapRouter;
    IUniSwapRouterOnBase private swapRouterOnBase;
    uint64 private network;

    constructor(
        address _admin,
        address _swapRouterAddress,
        address _priceConsumer,
        uint64 _network
    ) BaseSwap(_admin, _priceConsumer) {
        swapRouter = IUniSwapRouter(_swapRouterAddress);
        swapRouterOnBase = IUniSwapRouterOnBase(_swapRouterAddress);
        network = _network;
    }

    function swapTo(
        address recipient,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 poolFee
    ) external returns (uint256) {
        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountIn
        );
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
        uint256 amountOutMinimum = getAmountOutMinimum(
            tokenIn,
            tokenOut,
            amountIn
        );

        if(network == BASE_NETWORK){
            IUniSwapRouterOnBase.ExactInputSingleParams memory wdParams = IUniSwapRouterOnBase
                .ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: poolFee,
                    recipient: recipient,
                    amountIn: amountIn,
                    amountOutMinimum: amountOutMinimum,
                    sqrtPriceLimitX96: 0
                });

            return swapRouterOnBase.exactInputSingle(wdParams);
        }
        
        IUniSwapRouter.ExactInputSingleParams memory params = IUniSwapRouter
                .ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: poolFee,
                    recipient: recipient,
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: amountOutMinimum,
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
        uint256 amountInMaximum = getAmountInMaximum(
            tokenIn,
            tokenOut,
            amountOut
        );
        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountInMaximum
        );
        
        TransferHelper.safeApprove(
            tokenIn,
            address(swapRouter),
            amountInMaximum
        );

        if(network == BASE_NETWORK){
            IUniSwapRouterOnBase.ExactOutputSingleParams memory wdParams = IUniSwapRouterOnBase
                .ExactOutputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: poolFee,
                    recipient: recipient,
                    amountOut: amountOut,
                    amountInMaximum: amountInMaximum,
                    sqrtPriceLimitX96: 0
                });

            return swapRouterOnBase.exactOutputSingle(wdParams);
        }

        IUniSwapRouter.ExactOutputSingleParams memory params = IUniSwapRouter
            .ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: recipient,
                deadline: block.timestamp,
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