// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IKelpRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";
import "../KelpDaoProxy/KelpDaoProxy.sol";
import "../../../../interfaces/IKelpDaoProxy.sol";

contract KelpZircuitRestakingStrategy is BaseRestakingStrategy {
    IKelpRestakeProxy private kelpRestakeProxy;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    KelpDaoProxy private kelpDaoProxy;
    IERC20 private stakingToken;
    string private refId;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address[] memory _restakingPoolAddresses,
        string memory _refId,
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

        refId = _refId;
        kelpRestakeProxy = IKelpRestakeProxy(_restakingPoolAddresses[0]);
        kelpDaoProxy = new KelpDaoProxy(
            _restakingPoolAddresses[0],
            _restakingPoolAddresses[1],
            address(ethToken)
        );
        // kelpDaoProxy = IKelpDaoProxy(address(this));
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
        if (address(kelpRestakeProxy) != address(0)) {
            IWETH(address(ethToken)).withdraw(ethAmount);

            // arbitrum
            // kelpRestakeProxy.swapToRsETH{value: ethAmount}(0, refId);

            // ethereum
            kelpDaoProxy.depositToRestakingProxy{value: ethAmount}(refId);
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
            IERC20(restakingToken).transferFrom(
                address(this),
                address(kelpDaoProxy),
                restakingToken.balanceOf(address(this))
            );
            kelpDaoProxy.depositForZircuit();
        }
    }

    function withdrawFromRestakingProxy(uint256 ethAmount) internal override {
        kelpDaoProxy.withdrawFromRestakingProxy(ethAmount, address(this));
    }

    function updateKelpWithdrawRestaking(
        address _kelpWithdrawRestakingPoolAddress
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        kelpDaoProxy.updateKelpWithdrawRestaking(
            _kelpWithdrawRestakingPoolAddress
        );
    }

    function updateRestakingPoolAddresses(
        address[] memory _restakingPoolAddresses
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        kelpRestakeProxy = IKelpRestakeProxy(_restakingPoolAddresses[0]);
        kelpDaoProxy.updateZirCuitRestakeProxy(_restakingPoolAddresses[1]);
    }
}
