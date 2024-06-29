// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../Base/strategies/BaseRestakingStrategy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IEtherFiRestakeProxy.sol";
import "../../../../interfaces/IWithdrawRestakingPool.sol";
import "../../../../interfaces/IWETH.sol";
import "../../../../interfaces/IWEETHWrap.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract EtherFiZircuitRestakingStrategy is BaseRestakingStrategy {
    IEtherFiRestakeProxy private etherFiRestakeProxy;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    IWithdrawRestakingPool private etherfiWithdrawRestakingPool;
    IWEETHWrap private weEth;
    IERC20 private stakingToken;
    string private refId;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _wrapRestakingToken,
        address _usdcAddress,
        address _ethAddress,
        address[] memory _restakingPoolAddresses,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees
    ) internal {
        super.ethRestaking_Initialize(
            _restakingToken,
            _usdcAddress,
            _ethAddress,
            _swapAddress,
            _token0s,
            _token1s,
            _fees
        );
        etherFiRestakeProxy = IEtherFiRestakeProxy(_restakingPoolAddresses[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingPoolAddresses[1]);
        weEth = IWEETHWrap(_wrapRestakingToken);
    }

    function syncRestakingBalance() internal override {
        uint256 restakingTokenAmount = restakingToken.balanceOf(address(this));
        if (address(zircuitRestakeProxy) != address(0)) {
            restakingTokenAmount += zircuitRestakeProxy.balance(
                address(restakingToken),
                address(this)
            );
        }

        uint256 ethAmount = (restakingTokenAmount *
            swapProxy.getPriceOf(address(restakingToken), address(ethToken))) /
            1e18;
        restakingState.totalBalance =
            restakingState.unAllocatedBalance +
            (ethAmount *
                swapProxy.getPriceOf(address(ethToken), address(usdcToken))) /
            1e18;
    }

    function depositToRestakingProxy(uint256 ethAmount) internal override {
        if (address(etherFiRestakeProxy) != address(0)) {
            IWETH(address(ethToken)).withdraw(ethAmount);
            etherFiRestakeProxy.deposit{value: ethAmount}();

            console.log("eETH %s", restakingToken.balanceOf(address(this)));
        } else {
            ethToken.approve(address(swapProxy), ethAmount);
            swapProxy.swapTo(
                address(this),
                address(ethToken),
                ethAmount,
                address(restakingToken),
                getFee(address(ethToken), address(restakingToken))
            );
        }
        
        if (address(zircuitRestakeProxy) != address(0)) {
            restakingToken.approve(address(weEth), restakingToken.balanceOf(address(this)));
            weEth.wrap(restakingToken.balanceOf(address(this)));
            IERC20(address(weEth)).approve(
                address(zircuitRestakeProxy),
                IERC20(address(weEth)).balanceOf(address(this)));
            zircuitRestakeProxy.depositFor(
                address(weEth),
                address(this),
                IERC20(address(weEth)).balanceOf(address(this))
            );
        }
    }

    function withdrawFromRestakingProxy(uint256 ethAmount) internal override {
        uint256 stakingTokenAmount = swapProxy.getAmountInMaximum(
            address(restakingToken),
            address(ethToken),
            ethAmount
        );

        if (address(zircuitRestakeProxy) != address(0)) {
            etherfiWithdrawRestakingPool.withdraw(
                address(restakingToken),
                stakingTokenAmount
            );
        }

        if (
            address(etherFiRestakeProxy) != address(0) &&
            address(etherfiWithdrawRestakingPool) != address(0)
        ) {
            restakingToken.approve(address(swapProxy), stakingTokenAmount);
            etherfiWithdrawRestakingPool.withdraw(
                address(restakingToken),
                stakingTokenAmount
            );
        } else {
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

    function updateEtherFiWithdrawRestaking(address _etherfiWithdrawRestakingPoolAddress) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        etherfiWithdrawRestakingPool = IWithdrawRestakingPool(_etherfiWithdrawRestakingPoolAddress); 
    }

    function updateRestakingPoolAddress(address[] memory _restakingPoolAddress) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        etherFiRestakeProxy = IEtherFiRestakeProxy(_restakingPoolAddress[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingPoolAddress[1]);
    }
}
