// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../extensions/RockOnyxAccessControl.sol";
import "../../extensions/RockOnyx/BaseSwapVault.sol";
import "../../lib/ShareMath.sol";
import "./strategies/RockOnyxEthStakeLendStrategy.sol";
import "./strategies/RockOnyxPerpDexStrategy.sol";
import "./structs/DeltaNeutralStruct.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RockOnyxDeltaNeutralVault is
    Initializable,
    BaseSwapVault,
    RockOnyxEthStakeLendStrategy,
    RockOnyxPerpDexStrategy
{
    uint256 private initialPPS;
    using ShareMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private networkCost;
    mapping(address => DepositReceipt) private depositReceipts;
    mapping(address => Withdrawal) private withdrawals;
    VaultParams private vaultParams;
    VaultState internal vaultState;
    

    // migration
    DepositReceiptArr[] depositReceiptArr;
    WithdrawalArr[] withdrawalArr;
    // end migration

    /************************************************
     *  EVENTS
     ***********************************************/
    event Deposited(address indexed account, address indexed tokenIn, uint256 amount, uint256 shares);
    event InitiateWithdrawal(
        address indexed account,
        uint256 amount,
        uint256 shares
    );
    event Withdrawn(address indexed account, uint256 amount, uint256 shares);
    event FeeRatesUpdated(uint256 performanceFee, uint256 managementFee);
    event RequestFunds(
        address indexed account,
        uint256 withdrawalAmount,
        uint256 shares
    );

    function initialize(
        address _admin,
        address _usdc,
        uint8 _decimals,
        uint256 _minimumSupply,
        uint256 _cap,
        uint256 _networkCost,
        address _swapProxy,
        address _perpDexProxy,
        address _perpDexReceiver,
        address _weth,
        address _wstEth,
        uint256 _initialPPS,
        address _baseSwapProxy,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) public initializer {
        vaultParams = VaultParams(_decimals, _usdc, _minimumSupply, _cap, 10, 1);
        vaultState = VaultState(0, 0, 0, 0, 0);
        networkCost = _networkCost;

        accessControl_Initialize();
        
        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _perpDexReceiver);

        baseSwapVault_Initialize(_baseSwapProxy, _token0s, _token1s, _fees);
        ethStakeLend_Initialize(_swapProxy, _usdc, _weth, _wstEth);
        perpDex_Initialize(_perpDexProxy, _perpDexReceiver, _usdc);
        initialPPS = _initialPPS;
    }

    /**
     * @notice Mints the vault shares for depositor
     * @param amount is the amount of `asset` deposited
     */
    function deposit(uint256 amount, address tokenIn, address transitToken) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        uint256 assetDepositAmount = (tokenIn == vaultParams.asset) ? amount : 
                            (tokenIn == transitToken) ? amount * swapProxy.getPriceOf(tokenIn, vaultParams.asset) / 10 ** (ERC20(tokenIn).decimals()) :
                            (amount * swapProxy.getPriceOf(tokenIn, transitToken) * swapProxy.getPriceOf(transitToken, vaultParams.asset)) / 10 ** (ERC20(tokenIn).decimals() + (ERC20(transitToken).decimals()));

        require(assetDepositAmount >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(_totalValueLocked() + assetDepositAmount <= vaultParams.cap, "EXCEED_CAP");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        if(tokenIn != vaultParams.asset){
            if(tokenIn != transitToken){
                IERC20(tokenIn).approve(address(swapProxy), amount);
                amount = swapProxy.swapTo(
                    address(this),
                    address(tokenIn),
                    amount,
                    address(transitToken),
                    getFee(address(tokenIn), address(transitToken))
                );
            }

            IERC20(transitToken).approve(address(swapProxy), amount);
            amount = swapProxy.swapTo(
                address(this),
                address(transitToken),
                amount,
                address(vaultParams.asset),
                getFee(address(transitToken), address(vaultParams.asset))
            );
        }

        uint256 shares = _issueShares(amount);
        DepositReceipt storage depositReceipt = depositReceipts[msg.sender];
        depositReceipt.shares += shares;
        depositReceipt.depositAmount += amount;
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
        require(withdrawals[msg.sender].shares == 0, "INVALID_WITHDRAW_STATE");

        uint256 pps = _getPricePerShare();
        uint256 totalShareAmount = (depositReceipt.shares * pps) / 1e6;
        uint256 totalProfit = totalShareAmount <= depositReceipt.depositAmount
            ? 0
            : (totalShareAmount - depositReceipt.depositAmount) * 1e6;
        uint256 withdrawProfit = (totalProfit * shares) / depositReceipt.shares;
        uint256 performanceFee = withdrawProfit > 0
            ? (withdrawProfit * vaultParams.performanceFeeRate) / 1e14
            : 0;

        depositReceipt.depositAmount -=
            (depositReceipt.depositAmount * shares) /
            depositReceipt.shares;
        depositReceipt.shares -= shares;

        withdrawals[msg.sender].shares = shares;
        withdrawals[msg.sender].pps = pps;
        withdrawals[msg.sender].profit = withdrawProfit;
        withdrawals[msg.sender].performanceFee = performanceFee;
        withdrawals[msg.sender].withdrawAmount = ShareMath.sharesToAsset(
            shares,
            pps,
            vaultParams.decimals
        );

        emit RequestFunds(
            msg.sender,
            withdrawals[msg.sender].withdrawAmount,
            shares
        );

        // migration
        updateDepositArr(depositReceipts[msg.sender]);
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     * @notice acquire asset form vendor, prepare funds for withdrawal
     */
    function acquireWithdrawalFunds(uint256 usdAmount) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        
        require(usdAmount <= _totalValueLocked(), "INVALID_ACQUIRE_AMOUNT");

        vaultState.withdrawPoolAmount += _acquireFunds(usdAmount);
    }

    /**
     * @notice acquire asset, prepare funds for withdrawal
     */
    function acquireManagementFee(uint256 timestamp) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        uint256 feeAmount = _getManagementFee(timestamp);
        require(feeAmount <= _totalValueLocked(), "INVALID_ACQUIRE_AMOUNT");

        vaultState.totalFeePoolAmount += _acquireFunds(feeAmount);
        vaultState.lastUpdateManagementFeeDate = block.timestamp;
    }

    /**
     * @notice acquire asset, prepare funds
     */
    function _acquireFunds(uint256 amount) private returns(uint256) {
        (uint256 ethStakeRatio, uint256 perpDexRatio) = _allocatedRatio();
        return acquireFundsFromEthStakeLend(amount * ethStakeRatio / 1e4) + 
                                    acquireFundsFromPerpDex(amount * perpDexRatio / 1e4);
    }

    function allocatedRatio() external view returns (uint256, uint256) {
        return _allocatedRatio();
    }

    function _allocatedRatio() private view returns (uint256, uint256) {
        if(_totalValueLocked() == vaultState.pendingDepositAmount){
            return (5000, 5000);  
        }
        uint256 tvl = getTotalEthStakeLendAssets() + getTotalPerpDexAssets();
        return (getTotalEthStakeLendAssets() * 1e4 / tvl, getTotalPerpDexAssets() * 1e4 / tvl);
    }

    function syncBalance(uint256 perpDexbalance) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        syncEthStakeLendBalance();
        syncPerpDexBalance(perpDexbalance);
    }

    /**
     * @notice get vault state for user
     */
    function getUserVaultState()
        external
        view
        returns (uint256, uint256, uint256, uint256)
    {
        uint256 currentAmount = (depositReceipts[msg.sender].shares *
            _getPricePerShare()) / 1e6;
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

        require(vaultState.withdrawPoolAmount > withdrawAmount - feeAmount, "EXCEED_WD_POOL_CAP");
        withdrawAmount = vaultState.withdrawPoolAmount < withdrawAmount ? vaultState.withdrawPoolAmount : withdrawAmount;
        vaultState.withdrawPoolAmount -= withdrawAmount;
        withdrawals[msg.sender].withdrawAmount -= withdrawAmount;
        withdrawals[msg.sender].shares -= shares;
        vaultState.totalShares -= shares;

        IERC20(vaultParams.asset).safeTransfer(msg.sender, withdrawAmount- feeAmount);
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
            IERC20(vaultParams.asset).safeTransfer(msg.sender, vaultState.totalFeePoolAmount);
            return;
        }

        vaultState.totalFeePoolAmount -= amount;
        IERC20(vaultParams.asset).safeTransfer(receiver, amount);

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

        require(_performanceFeeRate <= 100, "INVALID_PERFORMANCE_FEE_RATE");
        require(_managementFeeRate <= 100, "INVALID_MANAGEMENT_FEE_RATE");
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
        return
            ShareMath.assetToShares(
                amount,
                _getPricePerShare(),
                vaultParams.decimals
            );
    }

    /**
     * @notice allocate assets to strategies
     */
    function allocateAssets() private {
        (uint256 ethStakeRatio, uint256 perpDexRatio) = _allocatedRatio();
        uint256 depositToEthStakeLendAmount = vaultState.pendingDepositAmount * ethStakeRatio / 1e4;
        uint256 depositToPerpDexAmount = vaultState.pendingDepositAmount * perpDexRatio / 1e4;
        vaultState.pendingDepositAmount -= (depositToEthStakeLendAmount + depositToPerpDexAmount);

        depositToEthStakeLendStrategy(depositToEthStakeLendAmount);
        depositToPerpDexStrategy(depositToPerpDexAmount);
    }

    function rebalanceAsset(uint256 amount) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        if (getTotalEthStakeLendAssets() > getTotalPerpDexAssets()) {
            rebalanceAssetToPerpDex(amount);
            return;
        }

        rebalanceAssetToEthStakeLend(amount);
    }

    /**
     * @notice Allow admin to settle the covered calls mechanism
     * @param amount the amount in ETH we should sell
     */
    function rebalanceAssetToPerpDex(uint256 amount) private {
        require(
            amount <= getTotalEthStakeLendAssets(),
            "INVALID_ETHSTAKELEND_ASSETS"
        );
        uint256 depositToPerpDexAmount = acquireFundsFromEthStakeLend(amount);
        depositToPerpDexStrategy(depositToPerpDexAmount);
    }

    /**
     * @notice Allow admin to settle the covered puts mechanism
     * @param amount the amount in usd we should buy eth
     */
    function rebalanceAssetToEthStakeLend(uint256 amount) private {
        require(amount <= getTotalPerpDexAssets(), "INVALID_PERPDEX_ASSETS");
        uint256 depositToEthStakeLendAmount = acquireFundsFromPerpDex(amount);
        depositToEthStakeLendStrategy(depositToEthStakeLendAmount);
    }

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
    function getFeeInfo()
        external
        view
        returns (
            uint256 depositFee,
            uint256 exitFee,
            uint256 performanceFee,
            uint256 managementFee
        )
    {
        depositFee = 0;
        exitFee = 0;
        performanceFee = vaultParams.performanceFeeRate;
        managementFee = vaultParams.managementFeeRate;
    }

    /**
     * @notice get total value locked vault
     */
    function _totalValueLocked() private view returns (uint256) {
        return
            vaultState.pendingDepositAmount +
            vaultState.withdrawPoolAmount +
            getTotalEthStakeLendAssets() +
            getTotalPerpDexAssets();
    }

    /**
     * @notice get current price per share
     */
    function _getPricePerShare() private view returns (uint256) {
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
        IERC20 token = IERC20(tokenAddress);
        require(amount > 0, "INVALID_AMOUNT");
        require(
            token.balanceOf(address(this)) >= amount,
            "INSUFFICIENT_BALANCE"
        );

        bool sent = token.transfer(receiver, amount);
        require(sent, "TOKEN_TRANSFER_FAILED");
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
    function exportVaultState()
        external
        view
        returns (
            DepositReceiptArr[] memory,
            WithdrawalArr[] memory,
            VaultParams memory,
            VaultState memory,
            EthStakeLendState memory,
            PerpDexState memory
        )
    {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        return (
            depositReceiptArr,
            withdrawalArr,
            vaultParams,
            vaultState,
            ethStakeLendState,
            perpDexState
        );
    }
    function importVaultState(
        DepositReceiptArr[] calldata _depositReceiptArr,
        WithdrawalArr[] calldata _withdrawalArr,
        VaultParams calldata _vaultParams,
        VaultState calldata _vaultState,
        EthStakeLendState calldata _ethStakeLendState,
        PerpDexState calldata _perpDexState
    ) external {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        depositReceiptArr = _depositReceiptArr;
        for (uint256 i = 0; i < _depositReceiptArr.length; i++) {
            depositReceipts[_depositReceiptArr[i].owner] = _depositReceiptArr[i]
                .depositReceipt;
        }

        withdrawalArr = _withdrawalArr;
        for (uint256 i = 0; i < _withdrawalArr.length; i++) {
            withdrawals[_withdrawalArr[i].owner] = _withdrawalArr[i].withdrawal;
        }

        vaultParams = _vaultParams;
        vaultState = _vaultState;
        ethStakeLendState = _ethStakeLendState;
        perpDexState = _perpDexState;
    }
    // end migration

    function version() public view returns (uint8) {
        return 1;
    }
}
