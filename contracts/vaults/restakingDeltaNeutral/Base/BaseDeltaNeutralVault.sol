// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "../../../extensions/Uniswap/Uniswap.sol";
import "../../../lib/ShareMath.sol";
import "../Base/BaseSwapVault.sol";
import "./../structs/RestakingDeltaNeutralStruct.sol";
import "hardhat/console.sol";

abstract contract BaseDeltaNeutralVault is
    BaseSwapVault,
    RockOnyxAccessControl,
    ReentrancyGuard
{
    uint256 private constant NETWORK_COST = 5*1e6;
    uint256 internal initialPPS;
    using ShareMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => DepositReceipt) internal depositReceipts;
    mapping(address => Withdrawal) internal withdrawals;
    VaultParams internal vaultParams;
    VaultState internal vaultState;

    // migration
    DepositReceiptArr[] depositReceiptArr;
    WithdrawalArr[] withdrawalArr;
    // end migration

    event Deposited(address indexed account, uint256 amount, uint256 shares);
    event InitiateWithdrawal(address indexed account, uint256 amount, uint256 shares);
    event Withdrawn(address indexed account, uint256 amount, uint256 shares);
    event FeeRatesUpdated(uint256 performanceFee, uint256 managementFee);
    event RequestFunds(address indexed account, uint256 withdrawalAmount, uint256 shares);

    function baseDeltaNeutralVault_Initialize(
        address _usdc, 
        uint256 _initialPPS,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) internal virtual {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        vaultParams = VaultParams(6, _usdc, 5_000_000, 1_000_000 * 1e6, 10, 1);
        vaultState = VaultState(0, 0, 0, 0, 0);
        initialPPS = _initialPPS;
        baseSwapVault_Initialize(_swapAddress, _token0s, _token1s, _fees);
    }

    function updateFee(
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        for (uint8 i = 0; i < _fees.length; i++) {
            fees[_token0s[i]][_token1s[i]] = _fees[i];
        }
    }

    /**
     * @notice Mints the vault shares for depositor
     * @param amount is the amount of `dasset` deposited
     */
    function deposit(uint256 amount, address tokenIn, address transitToken) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        uint256 assetDepositAmount = (tokenIn == vaultParams.asset) ? amount : 
                            (tokenIn == transitToken) ? amount * swapProxy.getPriceOf(tokenIn, vaultParams.asset) / 10 ** (ERC20(tokenIn).decimals()) :
                            (amount * swapProxy.getPriceOf(tokenIn, transitToken) * swapProxy.getPriceOf(transitToken, vaultParams.asset)) / 10 ** (ERC20(tokenIn).decimals() + (ERC20(transitToken).decimals()));

        require(assetDepositAmount >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(_totalValueLocked() + assetDepositAmount <= vaultParams.cap, "EXCEED_CAP");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        uint256 assetAmount = amount;
        if(tokenIn != vaultParams.asset){
            if(tokenIn != transitToken){
                IERC20(tokenIn).approve(address(swapProxy), assetAmount);
                assetAmount = swapProxy.swapTo(
                    address(this),
                    address(tokenIn),
                    amount,
                    address(transitToken),
                    getFee(address(tokenIn), address(transitToken))
                );
            }

            IERC20(transitToken).approve(address(swapProxy), amount);
            assetAmount = swapProxy.swapTo(
                address(this),
                address(transitToken),
                assetAmount,
                address(vaultParams.asset),
                getFee(address(transitToken), address(vaultParams.asset))
            );
        }

        uint256 shares = _issueShares(assetAmount);
        depositReceipts[msg.sender].shares += shares;
        depositReceipts[msg.sender].depositAmount += assetAmount;
        vaultState.pendingDepositAmount += assetAmount;
        vaultState.totalShares += shares;

        allocateAssets();

        emit Deposited(msg.sender, amount, shares);

        // migration
        updateDepositArr(depositReceipts[msg.sender]);
        // end migration
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param shares is the number of shares to withdraw
     */
    function initiateWithdrawal(uint256 shares) external nonReentrant {
        DepositReceipt storage depositReceipt = depositReceipts[msg.sender];
        require(depositReceipt.shares >= shares, "INVALID_SHARES");
        require(withdrawals[msg.sender].shares == 0, "INVALID_WD_STATE");

        uint256 pps = _getPricePerShare();
        uint256 totalShareAmount = depositReceipt.shares * pps / 1e6;
        // uint256 totalProfit = totalShareAmount <= depositReceipt.depositAmount ? 0 : (totalShareAmount - depositReceipt.depositAmount) * 1e6;
        uint256 totalProfit = totalShareAmount <= depositReceipt.depositAmount ? 0 : (totalShareAmount - depositReceipt.depositAmount);
        uint256 withdrawProfit = (totalProfit * shares) / depositReceipt.shares;
        uint256 performanceFee = withdrawProfit > 0 ? (withdrawProfit * vaultParams.performanceFeeRate) / 1e14 : 0;

        depositReceipt.depositAmount -= ((depositReceipt.depositAmount * shares) / depositReceipt.shares);
        depositReceipt.shares -= shares;
        withdrawals[msg.sender].shares = shares;
        withdrawals[msg.sender].pps = pps;
        withdrawals[msg.sender].profit = withdrawProfit;
        withdrawals[msg.sender].performanceFee = performanceFee;
        withdrawals[msg.sender].withdrawAmount = ShareMath.sharesToAsset(shares, pps, vaultParams.decimals);
        
        emit RequestFunds(msg.sender, withdrawals[msg.sender].withdrawAmount, shares);

        // migration
        updateDepositArr(depositReceipts[msg.sender]);
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     * @notice get vault state for user
     */
    function getUserVaultState() external view returns (uint256, uint256, uint256, uint256) {
        uint256 currentAmount = (depositReceipts[msg.sender].shares * _getPricePerShare()) / 1e6;
        uint256 profit = currentAmount >
            depositReceipts[msg.sender].depositAmount
            ? ((currentAmount - depositReceipts[msg.sender].depositAmount) *
                1e6) / depositReceipts[msg.sender].depositAmount
            : 0;
        uint256 loss = currentAmount < depositReceipts[msg.sender].depositAmount
            ? ((depositReceipts[msg.sender].depositAmount - currentAmount) *
                1e6) / depositReceipts[msg.sender].depositAmount
            : 0;
        return (
            depositReceipts[msg.sender].depositAmount,
            depositReceipts[msg.sender].shares,
            profit,
            loss
        );
    }

    /**
     * @notice get withdrawl shares of user
     */
    function getUserWithdrawlShares() external view returns (uint256) {
        return withdrawals[msg.sender].shares;
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     * @param shares is the number of shares to withdraw
     */
    function completeWithdrawal(uint256 shares) external nonReentrant {
        require(withdrawals[msg.sender].shares >= shares, "INVALID_SHARES");
        uint256 withdrawAmount = (shares * withdrawals[msg.sender].withdrawAmount) / withdrawals[msg.sender].shares;
        uint256 performanceFee = (shares * withdrawals[msg.sender].performanceFee) / withdrawals[msg.sender].shares;
        withdrawAmount -= (performanceFee + NETWORK_COST);

        require( vaultState.withdrawPoolAmount > withdrawAmount, "EXCEED_WD_POOL_CAP");
        vaultState.performanceFeeAmount += performanceFee;
        vaultState.withdrawPoolAmount -= withdrawAmount;
        withdrawals[msg.sender].withdrawAmount -= withdrawAmount;
        withdrawals[msg.sender].shares -= shares;
        vaultState.totalShares -= shares;
        IERC20(vaultParams.asset).safeTransfer(msg.sender, withdrawAmount);
        emit Withdrawn(msg.sender, withdrawAmount, withdrawals[msg.sender].shares);
        // migration
        updateDepositArr(depositReceipts[msg.sender]);
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     * @notice claimFee to claim vault fee.
     */
    function claimFee() external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        if (vaultState.performanceFeeAmount + vaultState.managementFeeAmount > vaultState.withdrawPoolAmount) {
            IERC20(vaultParams.asset).safeTransfer(msg.sender, vaultState.withdrawPoolAmount);
            return;
        }

        vaultState.withdrawPoolAmount -= (vaultState.performanceFeeAmount + vaultState.managementFeeAmount);
        uint256 claimAmount = vaultState.performanceFeeAmount + vaultState.managementFeeAmount;
        vaultState.performanceFeeAmount = 0;
        vaultState.managementFeeAmount = 0;
        IERC20(vaultParams.asset).safeTransfer(msg.sender, claimAmount);
    }

    function getVaultState() external view returns (VaultState memory) {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        return vaultState;
    }

    /**
     * @notice Allows admin to update the performance and management fee rates
     * @param _performanceFeeRate The new performance fee rate (in percentage)
     * @param _managementFeeRate The new management fee rate (in percentage)
     */
    function setFeeRates(
        uint256 _performanceFeeRate,
        uint256 _managementFeeRate
    ) external {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        require(_performanceFeeRate <= 100, "INVALI_RATE");
        require(_managementFeeRate <= 100, "INVALID_RATE");
        vaultParams.performanceFeeRate = _performanceFeeRate;
        vaultParams.managementFeeRate = _managementFeeRate;
        emit FeeRatesUpdated(_performanceFeeRate, _managementFeeRate);
    }

    /**
     * @notice get withdraw pool amount of the vault
     */
    function getWithdrawPoolAmount() external view returns (uint256) {
        return vaultState.withdrawPoolAmount;
    }

    /**
     * @notice get number shares of user
     */
    function balanceOf(address owner) external view returns (uint256) {
        return depositReceipts[owner].shares;
    }

    /**
     * @notice get current price per share
     */
    function pricePerShare() external view returns (uint256) {
        return _getPricePerShare();
    }

    /**
     * @notice get total value locked vault
     */
    function totalValueLocked() external view returns (uint256) {
        return _totalValueLocked();
    }

    /**
     * @notice Mints the vault shares to the creditor
     * @param amount is the amount to issue shares
     * shares = amount / pricePerShare
     */
    function _issueShares(uint256 amount) private view returns (uint256) {
        return ShareMath.assetToShares(amount, _getPricePerShare(), vaultParams.decimals);
    }

    /**
     * @notice allocate assets to strategies
     */
    function allocateAssets() internal virtual {}

    /**
     * @notice get vault fees
     */
    function getManagementFee() internal view returns (uint256) {
        return (_totalValueLocked() * vaultParams.managementFeeRate) / 100 / 52;
    }

    /**
     * @notice get fee information
     */
    function getFeeInfo() external view returns (uint256 performanceFee, uint256 managementFee) {
        performanceFee = vaultParams.performanceFeeRate;
        managementFee = vaultParams.managementFeeRate;
    }

    /**
     * @notice get total value locked vault
     */
    function _totalValueLocked() internal view virtual returns (uint256) {}

    /**
     * @notice get current price per share
     */
    function _getPricePerShare() internal view returns (uint256) {
        if (vaultState.totalShares == 0) return initialPPS;

        return
            (_totalValueLocked() * 10 ** vaultParams.decimals) /
            vaultState.totalShares;
    }

    function emergencyShutdown(
        address receiver,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        IERC20(tokenAddress).transfer(receiver, amount);
    }

    // migration
    function updateDepositArr(DepositReceipt memory depositReceipt) internal {
        for (uint256 i = 0; i < depositReceiptArr.length; i++) {
            if (depositReceiptArr[i].owner == msg.sender) {
                depositReceiptArr[i].depositReceipt = depositReceipt;
                return;
            }
        }

        depositReceiptArr.push(DepositReceiptArr(msg.sender, depositReceipt));
    }
    function updateWithdrawalArr(Withdrawal memory withdrawal) internal {
        for (uint256 i = 0; i < withdrawalArr.length; i++) {
            if (withdrawalArr[i].owner == msg.sender) {
                withdrawalArr[i].withdrawal = withdrawal;
                return;
            }
        }

        withdrawalArr.push(WithdrawalArr(msg.sender, withdrawal));
    }
    // end migration
}
