// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";

contract WstEthStakingStrategy is BaseRestakingStrategy {
    IERC20 private stakingToken;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _wrapRestakingToken,
        address _usdcAddress,
        address _ethAddress,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) internal override
    {
        super.ethRestaking_Initialize(_restakingToken, _wrapRestakingToken, _usdcAddress, _ethAddress, _swapAddress, _token0s, _token1s, _fees);
    }

    function syncRestakingBalance() internal override{
        uint256 restakingTokenAmount = restakingToken.balanceOf(address(this));
        uint256 ethAmount = restakingTokenAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(ethToken), address(usdcToken)) / 1e18;
    }

    function depositToRestakingProxy(uint256 ethAmount) internal override {
        ethToken.approve(address(swapProxy), ethAmount);
            swapProxy.swapTo(
                address(this),
                address(ethToken),
                ethAmount,
                address(restakingToken),
                getFee(address(ethToken), address(restakingToken))
            );
    }

    function withdrawFromRestakingProxy(uint256 ethAmount) internal override {
        uint256 stakingTokenAmount = swapProxy.getAmountInMaximum(address(restakingToken), address(ethToken), ethAmount);
         if (restakingToken.balanceOf(address(this)) < stakingTokenAmount) {
            restakingToken.approve(address(swapProxy), restakingToken.balanceOf(address(this)));
            swapProxy.swapTo(
                address(this),
                address(restakingToken),
                restakingToken.balanceOf(address(this)),
                address(ethToken),
                getFee(address(restakingToken), address(ethToken))
            );
            return;
        } 

        restakingToken.approve(address(swapProxy), stakingTokenAmount);
        swapProxy.swapToWithOutput(
            address(this),
            address(restakingToken),
            ethAmount,
            address(ethToken),
            getFee(address(restakingToken), address(ethToken))
        );
    }
}