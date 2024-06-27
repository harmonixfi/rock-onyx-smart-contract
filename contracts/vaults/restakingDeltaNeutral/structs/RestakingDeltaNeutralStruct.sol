// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct VaultParams {
    uint8 decimals;
    address asset;
    uint256 minimumSupply;
    uint256 cap;
    uint256 performanceFeeRate;
    uint256 managementFeeRate;
}

struct VaultState {
    uint256 withdrawPoolAmount;
    uint256 pendingDepositAmount;
    uint256 totalShares;
    uint256 totalFeePoolAmount;
    uint256 lastUpdateManagementFeeDate;
}

struct DepositReceipt {
    uint256 shares;
    uint256 depositAmount;
}

struct Withdrawal {
    uint256 shares;
    uint256 pps;
    uint256 profit;
    uint256 performanceFee;
    uint256 withdrawAmount;
}

struct DepositReceiptArr {
    address owner;
    DepositReceipt depositReceipt;
}

struct WithdrawalArr {
    address owner;
    Withdrawal withdrawal;
}

struct EthRestakingState {
    uint256 unAllocatedBalance;
    uint256 totalBalance;
}

struct PerpDexState {
    uint256 unAllocatedBalance;
    uint256 perpDexBalance;
}