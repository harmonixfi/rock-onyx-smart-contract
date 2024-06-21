// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IEtherfiRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";

contract EtherfiRestakingStrategy is BaseRestakingStrategy {
    IWithdrawRestakingPool private etherfiWithdrawRestakingPool;
    IEtherfiRestakeProxy private etherfiRestakeProxy;
    IERC20 private stakingToken;
    string private refId;
    address private etherfiEthDepositAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address[] memory _restakingPoolAddresses,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) internal {
        super.ethRestaking_Initialize(_restakingToken, _usdcAddress, _ethAddress, _swapAddress, _token0s, _token1s, _fees);

        etherfiRestakeProxy = IEtherfiRestakeProxy(_restakingPoolAddresses[0]);
    }

    function syncRestakingBalance() internal override{
        uint256 restakingTokenAmount = restakingToken.balanceOf(address(this));
        uint256 ethAmount = restakingTokenAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(ethToken), address(usdcToken)) / 1e18;
        console.log("restakingState.totalBalance ", restakingState.totalBalance);
    }

    function depositToRestakingProxy(uint256 ethAmount) internal override {
        uint256 amountOutMinimum = swapProxy.getAmountOutMinimum(address(ethToken), address(restakingToken), ethAmount);
        IWETH(address(ethToken)).withdraw(ethAmount);
        etherfiRestakeProxy.deposit{value: ethAmount}(etherfiEthDepositAddress, ethAmount, amountOutMinimum);
        console.log("restakingToken balance", restakingToken.balanceOf(address(this)));
    }

    function withdrawFromRestakingProxy(uint256 ethAmount) internal override {
        restakingToken.approve(address(swapProxy), ethAmount);
        etherfiWithdrawRestakingPool.withdraw(address(restakingToken), ethAmount);
    }

    function updateEtherfiWithdrawRestaking(address _etherfiWithdrawRestakingPoolAddress) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        etherfiWithdrawRestakingPool = IWithdrawRestakingPool(_etherfiWithdrawRestakingPoolAddress);
    }

    function updateRestakingPoolAddresses(address[] memory _restakingPoolAddresses) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        etherfiRestakeProxy = IEtherfiRestakeProxy(_restakingPoolAddresses[0]);
    }
}