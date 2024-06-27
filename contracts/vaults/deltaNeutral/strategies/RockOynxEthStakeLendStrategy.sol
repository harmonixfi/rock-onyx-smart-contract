// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "../../../lib/ShareMath.sol";
import "../../../lib/LiquidityAmounts.sol";
import "../../../interfaces/IVenderLiquidityProxy.sol";
import "../../../interfaces/ISwapProxy.sol";
import "../../../interfaces/IRewardVendor.sol";
import "../../../interfaces/IERC721Receiver.sol";
import "../structs/DeltaNeutralStruct.sol";
import "hardhat/console.sol";

contract RockOynxEthStakeLendStrategy is
    RockOnyxAccessControl,
    ReentrancyGuardUpgradeable
{
    using LiquidityAmounts for uint256;
    ISwapProxy internal ethSwapProxy;

    address usd;
    address weth;
    address wstEth;

    EthStakeLendState ethStakeLendState;

    /************************************************
     *  EVENTS
     ***********************************************/
    event PositionOpened(
        uint256 inputUsdAmount,
        uint256 ethPrice,
        uint256 wethAmount,
        uint256 wstEthAmount
    );
    event PositionClosed(
        uint256 usdAmount,
        uint256 wstEthEthPrice,
        uint256 ethToUsdPrice,
        uint256 ethAmountFomUsd,
        uint256 wstEthAmountFomEth,
        uint256 convertedWEthAmount,
        uint256 convertedUsdAmount
    );

    function ethStakeLend_Initialize(
        address _swapAddress,
        address _usd,
        address _weth,
        address _wstEth
    ) internal {
        accessControl_Initialize();
        ethStakeLendState = EthStakeLendState(0, 0);
        ethSwapProxy = ISwapProxy(_swapAddress);
        usd = _usd;
        weth = _weth;
        wstEth = _wstEth;
    }

    function openPosition(uint256 ethAmount) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        uint256 ethPrice = ethSwapProxy.getPriceOf(weth, usd);
        uint256 usdcAmount = (ethAmount * ethPrice) / 1e18;
        require(
            usdcAmount < ethStakeLendState.unAllocatedBalance,
            "INVALID_REACH_UNALLOCATED_BALANCE"
        );
        uint256 usedUsdAmount = _ethStakeLendSwapToWithOutput(
            usd,
            ethAmount,
            weth
        );
        ethStakeLendState.unAllocatedBalance -= usedUsdAmount;
        uint256 wstEthAmount = _ethStakeLendSwapTo(weth, ethAmount, wstEth);
        emit PositionOpened(usdcAmount, ethPrice, ethAmount, wstEthAmount);
    }

    function closePosition(uint256 ethAmount) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        uint256 ethPrice = ethSwapProxy.getPriceOf(weth, usd);
        uint256 usdcAmount = (ethAmount * ethPrice) / 1e18;
        uint256 ethWstEthPrice = ethSwapProxy.getPriceOf(weth, wstEth);
        uint256 wstEthAmount = (ethAmount * ethWstEthPrice) / 1e18;
        if (
            IERC20(wstEth).balanceOf(address(this)) <
            (wstEthAmount * (1e4 + ethSwapProxy.getSlippage())) / 1e4
        ) {
            ethAmount = _ethStakeLendSwapTo(
                wstEth,
                IERC20(wstEth).balanceOf(address(this)),
                weth
            );
        } else {
            _ethStakeLendSwapToWithOutput(wstEth, ethAmount, weth);
        }
        uint256 receivedUsdAmount = _ethStakeLendSwapTo(weth, ethAmount, usd);
        ethStakeLendState.unAllocatedBalance += receivedUsdAmount;
        emit PositionClosed(
            usdcAmount,
            ethWstEthPrice,
            ethPrice,
            ethAmount,
            wstEthAmount,
            ethAmount,
            receivedUsdAmount
        );
    }

    /**
     * @dev Retrieves the current state of the Ethereum liquidity position.
     * @return The current state of the Ethereum liquidity position.
     */
    function getEthStakeLendState()
        external
        view
        returns (EthStakeLendState memory)
    {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        return ethStakeLendState;
    }

    /**
     * @dev Deposit an amount into the Ethereum Stake & Lend strategy.
     * @param amount The amount to deposit into the Ethereum Stake & Lend strategy.
     */
    function depositToEthStakeLendStrategy(uint256 amount) internal {
        ethStakeLendState.unAllocatedBalance += amount;
        ethStakeLendState.totalBalance += amount;
    }

    function syncEthStakeLendBalance() internal {
        uint256 wstEthPrice = (ethSwapProxy.getPriceOf(wstEth, weth) *
            ethSwapProxy.getPriceOf(weth, usd)) / 1e18;
        ethStakeLendState.totalBalance =
            ethStakeLendState.unAllocatedBalance +
            (IERC20(wstEth).balanceOf(address(this)) * wstEthPrice) /
            1e18;
    }

    function acquireFundsFromEthStakeLend(
        uint256 amount
    ) internal returns (uint256) {
        uint256 unAllocatedBalance = ethStakeLendState.unAllocatedBalance;
        require(amount <= unAllocatedBalance, "INVALID_ACQUIRE_AMOUNT");

        ethStakeLendState.unAllocatedBalance -= amount;
        ethStakeLendState.totalBalance -= amount;
        return amount;
    }

    /**
     * @dev Calculates the total assets in the Ethereum liquidity position.
     * @return The total value of assets in the Ethereum liquidity position.
     */
    function getTotalEthStakeLendAssets() internal view returns (uint256) {
        return ethStakeLendState.totalBalance;
    }

    /**
     * @dev Retrieves the unallocated balance in the Ethereum Stake & Lend strategy.
     * @return The unallocated balance in the Ethereum Stake & Lend strategy.
     */
    function getEthStakingUnAllocatedBalance() external view returns (uint256) {
        return ethStakeLendState.unAllocatedBalance;
    }

    /**
     * @dev Swaps an amount of one token for another in the Ethereum liquidity position.
     * @param tokenIn Address of the input token.
     * @param amountIn Amount of input token to swap.
     * @param tokenOut Address of the output token.
     * @return amountOut The amount of output token received after the swap.
     */
    function _ethStakeLendSwapTo(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) private returns (uint256 amountOut) {
        IERC20(tokenIn).approve(address(ethSwapProxy), amountIn);
        return ethSwapProxy.swapTo(address(this), tokenIn, amountIn, tokenOut);
    }

    function _ethStakeLendSwapToWithOutput(
        address tokenIn,
        uint256 amountOut,
        address tokenOut
    ) private returns (uint256 amountIn) {
        IERC20(tokenIn).approve(
            address(ethSwapProxy),
            IERC20(tokenIn).balanceOf(address(this))
        );
        return
            ethSwapProxy.swapToWithOutput(
                address(this),
                tokenIn,
                amountOut,
                tokenOut
            );
    }
}
