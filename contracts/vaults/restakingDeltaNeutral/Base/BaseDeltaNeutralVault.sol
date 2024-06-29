// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "../../../extensions/Uniswap/Uniswap.sol";
import "../../../lib/ShareMath.sol";
import "../Base/BaseSwapVault.sol";
import "./../structs/RestakingDeltaNeutralStruct.sol";
import "hardhat/console.sol";

abstract contract BaseDeltaNeutralVault is
    BaseSwapVault,
    RockOnyxAccessControl,
    ReentrancyGuardUpgradeable
{
    uint256 internal initialPPS;
    uint256 internal networkCost;
    using ShareMath for uint256;

    mapping(address => DepositReceipt) internal depositReceipts;
    mapping(address => Withdrawal) internal withdrawals;
    VaultParams internal vaultParams;
    VaultState internal vaultState;

    // migration
    DepositReceiptArr[] depositReceiptArr;
    WithdrawalArr[] withdrawalArr;
    // end migration

    event Deposited(address indexed account, address indexed tokenIn, uint256 amount, uint256 shares);
    event InitiateWithdrawal(address indexed account, uint256 amount, uint256 shares);
    event Withdrawn(address indexed account, uint256 amount, uint256 shares);
    event FeeRatesUpdated(uint256 performanceFee, uint256 managementFee);
    event RequestFunds(address indexed account, uint256 withdrawalAmount, uint256 shares);

    function baseDeltaNeutralVault_Initialize(
        address _admin,
        address _usdc,
        uint8 _decimals,
        uint256 _minimumSupply,
        uint256 _cap,
        uint256 _networkCost,
        uint256 _initialPPS,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) internal virtual {
        vaultParams = VaultParams(_decimals, _usdc, _minimumSupply, _cap, 10, 1);
        vaultState = VaultState(0, 0, 0, 0, block.timestamp);
        initialPPS = _initialPPS;
        networkCost = _networkCost;

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
        
        baseSwapVault_Initialize(_swapAddress, _token0s, _token1s, _fees);
        accessControl_Initialize();
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

    receive() external payable {}

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

        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amount);
        if(tokenIn != vaultParams.asset){
            if(tokenIn != transitToken){
                TransferHelper.safeApprove(tokenIn, address(swapProxy), amount);
                amount = swapProxy.swapTo(
                    address(this),
                    address(tokenIn),
                    amount,
                    address(transitToken),
                    getFee(address(tokenIn), address(transitToken))
                );
            }

            TransferHelper.safeApprove(transitToken, address(swapProxy), amount);
            amount = swapProxy.swapTo(
                address(this),
                address(transitToken),
                amount,
                address(vaultParams.asset),
                getFee(address(transitToken), address(vaultParams.asset))
            );
        }

        uint256 shares = _issueShares(amount);
        depositReceipts[msg.sender].shares += shares;
        depositReceipts[msg.sender].depositAmount += amount;
        vaultState.pendingDepositAmount += amount;
        vaultState.totalShares += shares;

        allocateAssets();

        emit Deposited(msg.sender, tokenIn, amount, shares);

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
        uint256 feeAmount = performanceFee + networkCost;
        vaultState.totalFeePoolAmount += feeAmount;

        require( vaultState.withdrawPoolAmount > withdrawAmount - feeAmount, "EXCEED_WD_POOL_CAP");
        withdrawAmount = vaultState.withdrawPoolAmount < withdrawAmount ? vaultState.withdrawPoolAmount : withdrawAmount;
        vaultState.withdrawPoolAmount -= withdrawAmount;
        withdrawals[msg.sender].withdrawAmount -= withdrawAmount;
        withdrawals[msg.sender].shares -= shares;
        vaultState.totalShares -= shares;

        TransferHelper.safeTransfer(vaultParams.asset, msg.sender, withdrawAmount - feeAmount);
        emit Withdrawn(msg.sender, withdrawAmount, withdrawals[msg.sender].shares);
        
        // migration
        updateDepositArr(depositReceipts[msg.sender]);
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     * @notice claimFee to claim vault fee.
     */
    function claimFee(address receiver, uint256 amount) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        if (amount > vaultState.totalFeePoolAmount) {
            vaultState.totalFeePoolAmount = 0;
            TransferHelper.safeTransfer(vaultParams.asset, receiver, vaultState.totalFeePoolAmount);
            return;
        }

        vaultState.totalFeePoolAmount -= amount;
        TransferHelper.safeTransfer(vaultParams.asset, receiver, amount);
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

    function allocatedRatio() external view returns (uint256, uint256) {
        return _allocatedRatio();
    }

    function _allocatedRatio() internal virtual view returns (uint256, uint256) {}
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
    function getManagementFee() public view returns (uint256, uint256) {
        return (_getManagementFee(block.timestamp), block.timestamp);
    }

    function _getManagementFee(uint256 timestamp) internal view returns (uint256) {
        uint256 perSecondRate = vaultParams.managementFeeRate * 1e12 / (365 * 86400) + 1; // +1 mean round up second rate
        uint256 period = timestamp - vaultState.lastUpdateManagementFeeDate;
        return ((_totalValueLocked() - vaultState.withdrawPoolAmount) * perSecondRate * period) / 1e14;
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
            (_totalValueLocked() * 10 ** vaultParams.decimals) / vaultState.totalShares;
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
