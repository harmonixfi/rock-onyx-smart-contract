// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../../../interfaces/IAevo.sol";
import "../../../../extensions/RockOnyxAccessControl.sol";
import "../../structs/RestakingDeltaNeutralStruct.sol";
import "hardhat/console.sol";

contract PerpDexStrategy is RockOnyxAccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address perpDexAsset;
    PerpDexState internal perpDexState;
    address perpDexReceiver;
    address private perpDexConnector;
    IAevo private AEVO;

    // USDC
    address l1Token = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address l2Token = 0x643aaB1618c600229785A5E06E4b2d13946F7a1A;

    event PerpDexVendorDeposited(uint256 depositAmount);
    event PerpDexBalanceChanged(uint256 unAllocatedBalance, uint256 amountWithdrawn);
    event RequestFundsPerpDex(uint256 acquireAmount);

    function perpDex_Initialize(
        address _perpDexAddress,
        address _perpDexReceiver,
        address _usdc,
        address _perpDexConnector
    ) internal {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        perpDexState = PerpDexState(0, 0);
        perpDexAsset = _usdc;
        AEVO = IAevo(_perpDexAddress);
        perpDexReceiver = _perpDexReceiver;
        perpDexConnector = _perpDexConnector;
        
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, msg.sender);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, perpDexReceiver);
    }
    
    function depositToVendor(uint32 gasLimit) external payable nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        
        bytes memory data = "";
        uint256 amount = perpDexState.unAllocatedBalance;
        perpDexState.unAllocatedBalance -= amount;
        IERC20(perpDexAsset).approve(address(AEVO), amount);

        AEVO.depositERC20To{value: msg.value}(
            l1Token,
            l2Token,
            perpDexReceiver,
            amount,
            gasLimit,
            data
        );

        perpDexState.perpDexBalance += amount;
        emit PerpDexVendorDeposited(amount);
    }

    function depositToVendorL2(uint32 gasLimit) external payable nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        
        bytes memory data = "";
        uint256 amount = perpDexState.unAllocatedBalance;
        perpDexState.unAllocatedBalance -= amount;
        IERC20(perpDexAsset).approve(address(AEVO), amount);

        AEVO.depositToAppChain{value: msg.value}(
            perpDexReceiver,
            perpDexAsset,
            amount,
            gasLimit,
            perpDexConnector,
            data
        );

        perpDexState.perpDexBalance += amount;
        emit PerpDexVendorDeposited(amount);
    }

    function syncPerpDexBalance(uint256 balance) internal {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        perpDexState.perpDexBalance = balance;
    }

    /**
     * @dev Deposit an amount into the options strategy.
     * @param amount The amount to deposit into the options strategy.
     */
    function depositToPerpDexStrategy(uint256 amount) internal {
        perpDexState.unAllocatedBalance += amount;
    }

    /**
     * Acquire the amount of USDC to allow user withdraw
     * @param amount the amount need to be acquired
     */
    function acquireFundsFromPerpDex(uint256 amount) internal returns (uint256) {
        if (perpDexState.unAllocatedBalance > amount) {
            perpDexState.unAllocatedBalance -= amount;
            return amount;
        }

        uint256 unAllocatedBalance = perpDexState.unAllocatedBalance;
        perpDexState.unAllocatedBalance = 0;
        return unAllocatedBalance;
    }

    /**
     * @dev Handle the post withdraw process from Dex vendor
     * @param amount The amount of tokens to transfer.
     */
    function handlePostWithdrawFromVendor(uint256 amount) external nonReentrant {
        require(amount > 0, "INVALID_WD_AMOUNT");
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        IERC20(perpDexAsset).safeTransferFrom(msg.sender, address(this), amount);

        perpDexState.unAllocatedBalance += amount;
        perpDexState.perpDexBalance = (amount <= perpDexState.perpDexBalance)
            ? perpDexState.perpDexBalance - amount
            : 0;

        emit PerpDexBalanceChanged(perpDexState.unAllocatedBalance, amount);
    }

    /**
     * @dev Calculates the total options amount based on allocated and unallocated balances.
     * @return The total options amount.
     */
    function getTotalPerpDexTvl() internal view returns (uint256) {
        return perpDexState.unAllocatedBalance + perpDexState.perpDexBalance;
    }

    function getPerpDexState() external view returns (uint256, uint256) {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        return (perpDexState.perpDexBalance, perpDexState.unAllocatedBalance);
    }
}
