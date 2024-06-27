// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "../../../lib/LiquidityAmounts.sol";
import "../../../interfaces/IVenderLiquidityProxy.sol";
import "../../../interfaces/ISwapProxy.sol";
import "../../../interfaces/IRewardVendor.sol";
import "../structs/RockOnyxStructs.sol";
import "./BaseLiquidityStrategy.sol";
import "hardhat/console.sol";

contract RockOnyxEthLiquidityStrategy is BaseLiquidityStrategy,RockOnyxAccessControl,ReentrancyGuardUpgradeable
{
    using LiquidityAmounts for uint256;
    IRewardVendor internal ethReward;

    address weth;
    address wstEth;
    address arb;

    EthLPState ethLPState;
    /************************************************
     *  EVENTS
     ***********************************************/

    function ethLP_Initialize(
        address _liquidityProviderAddress,
        address _rewardAddress,
        address _ethNftPositionAddress,
        address _swapAddress,
        address _usd,
        address _weth,
        address _wstEth,
        address _arb
    ) internal {
        ethLPState = EthLPState(0, 0, 0, 0, 0);
        ethReward = IRewardVendor(_rewardAddress);
        usd = _usd;
        weth = _weth;
        wstEth = _wstEth;
        arb = _arb;
        BaseLP_Initialize(_liquidityProviderAddress, _ethNftPositionAddress, _swapAddress, _usd);
    }

    /**
     * @dev Deposit an amount into the Ethereum liquidity strategy.
     * @param amount The amount to deposit into the Ethereum liquidity strategy.
     */
    function depositToEthLiquidityStrategy(uint256 amount) internal {
        ethLPState.unAllocatedBalance += amount;
    }

    /**
     * @dev Mint an Ethereum liquidity position within the liquidity provider system.
     * @param lowerTick The lower tick of the price range for liquidity provision.
     * @param upperTick The upper tick of the price range for liquidity provision.
     * @param ratio Ratio used for rebalancing liquidity assets.
     * @param decimals Decimals used for rebalancing liquidity assets.
     */
    function mintEthLPPosition(
        int24 lowerTick,
        int24 upperTick,
        uint16 ratio,
        uint8 decimals
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        require(ethLPState.liquidity == 0, "POS_ALR_OPEN");

        _rebalanceEthLPAssets(ratio, decimals);
        (uint256 tokenId, uint128 liquidity,,) = mintLPPosition(
            lowerTick, 
            upperTick, 
            wstEth,
            _getBalanceOf(wstEth),
            weth,
            _getBalanceOf(weth));

        ethLPState.tokenId = tokenId;
        ethLPState.liquidity = liquidity;
        ethLPState.lowerTick = lowerTick;
        ethLPState.upperTick = upperTick;

        if (_getBalanceOf(wstEth) > 0) {
            _swapTo(wstEth, _getBalanceOf(wstEth), weth);
        }
    }

    /**
     * @dev Increases liquidity in the Ethereum liquidity position within the liquidity provider system.
     * @param ratio Ratio used for rebalancing liquidity assets.
     * @param decimals Decimals used for rebalancing liquidity assets.
     */
    function increaseEthLPLiquidity(
        uint16 ratio,
        uint8 decimals
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        require(ethLPState.liquidity > 0, "POS_NOT_OPEN");
        
        _rebalanceEthLPAssets(ratio, decimals);
        (uint128 liquidity,,) = increaseLPLiquidity(
            ethLPState.tokenId, 
            wstEth, 
            _getBalanceOf(wstEth),
            weth,
            _getBalanceOf(weth));

        ethLPState.liquidity += liquidity;
    }

    /**
     * @dev Decreases liquidity in the Ethereum liquidity position within the liquidity provider system.
     * @param liquidity Amount of liquidity to decrease. If set to 0, decreases all liquidity.
     */
    function decreaseEthLPLiquidity(uint128 liquidity) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        if (liquidity == 0) {
            liquidity = ethLPState.liquidity;
        }

        decreaseLPLiquidity(ethLPState.tokenId, liquidity);
        ethLPState.liquidity -= liquidity;
        if (_getBalanceOf(wstEth) > 0) {
            _swapTo(wstEth, _getBalanceOf(wstEth), weth);
        }

        ethLPState.unAllocatedBalance += _swapTo(weth, _getBalanceOf(weth), usd);
    }

    /**
     * @dev Closes the current Ethereum liquidity provision round by collecting fees.
     */
    function closeEthLPRound() internal {
        if (ethLPState.liquidity == 0) return;
        collectAllFees(ethLPState.tokenId);
    }

    /**
     * @dev Closes the current Ethereum liquidity provision round by collecting fees.
     */
    function acquireWithdrawalFundsEthLP(
        uint256 amount
    ) internal returns (uint256) {
        if (ethLPState.unAllocatedBalance >= amount) {
            ethLPState.unAllocatedBalance -= amount;
            return amount;
        }

        uint256 unAllocatedBalance = ethLPState.unAllocatedBalance;
        ethLPState.unAllocatedBalance = 0;
        uint256 unAllocatedAllAssetBalance = unAllocatedBalance +
            (_getBalanceOf(weth) * _getEthPrice()) / 1e18;

        if (unAllocatedAllAssetBalance > amount) {
            _swapTo(weth, ((amount - unAllocatedBalance) * 1e6) / _getEthPrice(), usd);
            return amount;
        }

        uint256 amountToAcquire = amount - unAllocatedAllAssetBalance;
        uint128 liquidity = 
            _amountToPoolLiquidity(
                amountToAcquire,
                ethLPState.lowerTick,
                ethLPState.upperTick,
                ethLPState.liquidity,
                wstEth,
                weth
            );
            
        liquidity = (liquidity > ethLPState.liquidity) ? ethLPState.liquidity : liquidity;
        decreaseLPLiquidity(ethLPState.tokenId, liquidity);
        ethLPState.liquidity -= liquidity;
        if (_getBalanceOf(wstEth) > 0) {
            _swapTo(wstEth, _getBalanceOf(wstEth), weth);
        }

        return unAllocatedBalance + _swapTo(weth, _getBalanceOf(weth), usd);
    }

    /**
     * @dev Claims rewards for specified users from the Ethereum reward contract.
     * @param users Addresses of the users to claim rewards for.
     * @param tokens Addresses of the tokens to claim as rewards.
     * @param amounts Amounts of tokens to claim as rewards.
     * @param proofs Merkle proofs for the claimed rewards.
     */
    function claimReward(
        address[] calldata users,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        ethReward.claim(users, tokens, amounts, proofs);
    }

    /**
     * @dev Converts rewards from ARB token to USDC token.
     */
    function convertRewardToUsdc() external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        ethLPState.unAllocatedBalance += _swapTo(arb, _getBalanceOf(arb), usd);
    }

    /**
     * @dev Calculates the total assets in the Ethereum liquidity position.
     * @return The total value of assets in the Ethereum liquidity position.
     */
    function getTotalEthLPAssets() internal view returns (uint256) {
        (uint256 wstethAmount, uint256 wethAmount) = (0, 0);
        if (ethLPState.liquidity > 0) {
            int24 tick = baseSwapProxy.getPoolCurrentTickOf(wstEth, weth);
            (wstethAmount, wethAmount) = LiquidityAmounts
                .getAmountsForLiquidityByTick(
                    tick,
                    ethLPState.lowerTick,
                    ethLPState.upperTick,
                    ethLPState.liquidity
                );
        }

        return
            ethLPState.unAllocatedBalance +
            (_getBalanceOf(arb) * baseSwapProxy.getPriceOf(arb, usd)) / 1e18 +
            ((_getBalanceOf(wstEth) + wstethAmount) * _getWstEthPrice()) / 1e18 +
            ((_getBalanceOf(weth) + wethAmount) * _getEthPrice()) / 1e18;
    }

    /**
     * @dev Retrieves the price of wrapped Ethereum (WstETH) in Ethereum.
     * @return The price of WstETH in Ethereum.
     */
    function _getWstEthPrice() private view returns (uint256) {
        return (baseSwapProxy.getPriceOf(wstEth, weth) * _getEthPrice()) / 1e18;
    }

    function _getEthPrice() private view returns (uint256) {
        return baseSwapProxy.getPriceOf(weth, usd);
    }

    function _getBalanceOf(address token) private view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

     /**
     * @dev Rebalances assets in the Ethereum liquidity position.
     * @param ratio Ratio used for rebalancing.
     * @param decimals Decimals used for ratio.
     */
    function _rebalanceEthLPAssets(uint16 ratio, uint8 decimals) private {
        uint256 amountToSwap = ethLPState.unAllocatedBalance;
        ethLPState.unAllocatedBalance = 0;
        _swapTo(usd, amountToSwap, weth);
        uint256 ethAmountToSwap = _getBalanceOf(weth) * ratio / 10 ** decimals;
        _swapTo(weth, ethAmountToSwap, wstEth);
    }

    /**
     * @dev Retrieves the current state of the Ethereum liquidity position.
     * @return The current state of the Ethereum liquidity position.
     */
    function getEthLPState() external view returns (EthLPState memory) {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        return ethLPState;
    }
}
