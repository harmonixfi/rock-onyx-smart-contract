// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../../interfaces/IPerpDexProxy.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "../../../interfaces/IOptionsVendorProxy.sol";
import "../structs/RockOnyxStructs.sol";
import "hardhat/console.sol";

contract RockOnyxOptionStrategy is RockOnyxAccessControl, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    address perpDexAsset;
    address perpDexReceiver;
    address private perpDexConnector;
    IPerpDexProxy private perpDexProxy;
    OptionsStrategyState internal optionsState;

    /************************************************
     *  EVENTS
     ***********************************************/
    event OptionsVendorDeposited(
        address connector,
        address receiver,
        uint256 depositAmount
    );

    event OptionsVendorWithdrawed(uint256 amount);

    event OptionsBalanceChanged(uint256 oldBalance, uint256 newBlanace);

    constructor() {}

    function options_Initialize(
        address _perpDexAddress,
        address _perpDexReceiver,
        address _perpDexConnector,
        address _perpDexAsset
    ) internal {
        optionsState = OptionsStrategyState(0, 0, 0, 0);
        perpDexProxy = IPerpDexProxy(_perpDexAddress);
        perpDexAsset = _perpDexAsset;
        perpDexReceiver = _perpDexReceiver;
        perpDexConnector = _perpDexConnector;
    }

    /**
     * @dev Deposit an amount into the options strategy.
     * @param amountIn The amount to deposit into the options strategy.
     */
    function depositToOptionsStrategy(uint256 amountIn) internal {
        optionsState.unAllocatedUsdcBalance += amountIn;
    }

    /**
     * @notice Acquires withdrawal funds in USDC options
     * @param withdrawUsdOptionsAmount The requested withdrawal amount in USDC
     */
    function acquireWithdrawalFundsUsdOptions(
        uint256 withdrawUsdOptionsAmount
    ) internal returns (uint256) {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        if (optionsState.unAllocatedUsdcBalance > withdrawUsdOptionsAmount) {
            optionsState.unAllocatedUsdcBalance -= withdrawUsdOptionsAmount;
            return withdrawUsdOptionsAmount;
        }

        uint256 unAllocatedUsdcBalance = optionsState.unAllocatedUsdcBalance;
        optionsState.unAllocatedUsdcBalance = 0;
        return unAllocatedUsdcBalance;
    }

    /**
     * @notice submit amount to deposit to Vendor
     */
    function depositToVendor(uint32 gasLimit) external payable nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        bytes memory data = "";
        uint256 amount = optionsState.unAllocatedUsdcBalance;
        optionsState.unAllocatedUsdcBalance -= amount;
        IERC20(perpDexAsset).approve(address(perpDexProxy), amount);

        perpDexProxy.depositToAppChain{value: msg.value}(
            perpDexReceiver,
            perpDexAsset,
            amount,
            gasLimit,
            perpDexConnector,
            data
        );

        optionsState.allocatedUsdcBalance += amount;
        emit OptionsVendorDeposited(perpDexConnector, perpDexReceiver, amount);
    }

    /**
     * @dev Handles withdrawal from the vendor.
     * @param amount The amount to be withdrawn.
     */
    function handlePostWithdrawalFromVendor(
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "INVALID_WITHDRAW_AMOUNT");
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        IERC20(perpDexAsset).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        optionsState.unAllocatedUsdcBalance += amount;
        optionsState.allocatedUsdcBalance -= amount;

        emit OptionsBalanceChanged(
            optionsState.unAllocatedUsdcBalance,
            optionsState.unAllocatedUsdcBalance + amount
        );
    }

    /**
     * @dev Closes the current options round, adjusting balances based on settled profits and losses.
     */
    function closeOptionsRound() internal {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        if (optionsState.unsettledProfit > 0) {
            optionsState.allocatedUsdcBalance += optionsState.unsettledProfit;
            optionsState.unsettledProfit = 0;
        }

        if (optionsState.unsettledLoss > 0) {
            optionsState.allocatedUsdcBalance -= optionsState.unsettledLoss;
            optionsState.unsettledLoss = 0;
        }
    }

    /**
     * @dev Updates profit and loss balances from the vendor.
     * @param balance The updated balance from the vendor.
     */
    function updateProfitFromVendor(uint256 balance) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        optionsState.unsettledProfit = balance >
            optionsState.allocatedUsdcBalance
            ? balance - optionsState.allocatedUsdcBalance
            : 0;
        optionsState.unsettledLoss = balance < optionsState.allocatedUsdcBalance
            ? optionsState.allocatedUsdcBalance - balance
            : 0;
    }

    /**
     * @dev Returns the unallocated USDC balance of the options strategy.
     * @return The unallocated USDC balance.
     */
    function getUnallocatedUsdcBalance() public view returns (uint256) {
        return optionsState.unAllocatedUsdcBalance;
    }

    /**
     * @dev Calculates the total options amount based on allocated and unallocated balances.
     * @return The total options amount.
     */
    function getTotalOptionsAmount() internal view returns (uint256) {
        return
            optionsState.unAllocatedUsdcBalance +
            optionsState.allocatedUsdcBalance;
    }
}
