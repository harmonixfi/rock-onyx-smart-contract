// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IKelpRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";

contract KelpZircuitRestakingStrategy is BaseRestakingStrategy {
    IWithdrawRestakingPool private kelpWithdrawRestakingPool;
    IKelpRestakeProxy private kelpRestakeProxy;
    IZircuitRestakeProxy private zircuitRestakeProxy;
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
        super.ethRestaking_Initialize(_restakingToken, _usdcAddress, _ethAddress, _swapAddress, _token0s, _token1s, _fees);

        refId = _refId;
        kelpRestakeProxy = IKelpRestakeProxy(_restakingPoolAddresses[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingPoolAddresses[1]);
    }

    function syncRestakingBalance() internal override{
        uint256 restakingTokenAmount = restakingToken.balanceOf(address(this));
        if(address(zircuitRestakeProxy) != address(0)){
            restakingTokenAmount += zircuitRestakeProxy.balance(address(restakingToken), address(this));
        }

        uint256 ethAmount = restakingTokenAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(ethToken), address(usdcToken)) / 1e18;
    }

    function depositToRestakingProxy(uint256 ethAmount) internal override {
        if(address(kelpRestakeProxy) != address(0)) {
            IWETH(address(ethToken)).withdraw(ethAmount);

            // arbitrum
            // kelpRestakeProxy.swapToRsETH{value: ethAmount}(0, refId);

            // ethereum
            kelpRestakeProxy.depositETH{value: ethAmount}(0, refId);
        }else{
            ethToken.approve(address(swapProxy), ethAmount);
            swapProxy.swapTo(
                address(this),
                address(ethToken),
                ethAmount,
                address(restakingToken),
                getFee(address(ethToken), address(restakingToken))
            );
        }
        
        if(address(zircuitRestakeProxy) != address(0)){
            restakingToken.approve(address(zircuitRestakeProxy), restakingToken.balanceOf(address(this)));
            zircuitRestakeProxy.depositFor(address(restakingToken), address(this), restakingToken.balanceOf(address(this)));
        }
    }

    function withdrawFromRestakingProxy(uint256 ethAmount) internal override {
        
        uint256 stakingTokenAmount = swapProxy.getAmountInMaximum(address(restakingToken), address(ethToken), ethAmount);
        
        if(address(zircuitRestakeProxy) != address(0)){
            zircuitRestakeProxy.withdraw(address(restakingToken), stakingTokenAmount);
        }

        if(address(kelpRestakeProxy) != address(0) && address(kelpWithdrawRestakingPool) != address(0)) {
            restakingToken.approve(address(swapProxy), stakingTokenAmount);
            kelpWithdrawRestakingPool.withdraw(address(restakingToken), stakingTokenAmount);
        }else{
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

    function updateKelpWithdrawRestaking(address _kelpWithdrawRestakingPoolAddress) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        kelpWithdrawRestakingPool = IWithdrawRestakingPool(_kelpWithdrawRestakingPoolAddress);
    }

    function updateRestakingPoolAddresses(address[] memory _restakingPoolAddresses) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        kelpRestakeProxy = IKelpRestakeProxy(_restakingPoolAddresses[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingPoolAddresses[1]);
    }
}