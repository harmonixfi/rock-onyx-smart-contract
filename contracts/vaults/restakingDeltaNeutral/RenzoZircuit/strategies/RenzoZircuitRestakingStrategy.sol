// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IRenzoRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWithdrawRestakingPool.sol";
import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";

contract RenzoZircuitRestakingStrategy is BaseRestakingStrategy {
    IWithdrawRestakingPool private renzoWithdrawRestakingPool;
    IRenzoRestakeProxy private renzoRestakeProxy;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    IERC20 private stakingToken;
    string private refId;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address[] memory _restakingProxies,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees,
        uint64 _network
    ) internal {
        super.ethRestaking_Initialize(_restakingToken, _usdcAddress, _ethAddress, _swapAddress, _token0s, _token1s, _fees, _network);

        renzoRestakeProxy = IRenzoRestakeProxy(_restakingProxies[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingProxies[1]);
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
        if(address(renzoRestakeProxy) != address(0)) {
            IWETH(address(ethToken)).withdraw(ethAmount);
            if(network == ARBTRIUM_NETWORK){
                renzoRestakeProxy.depositETH{value: ethAmount}(0, block.timestamp + 10 seconds);
            }else if(network == ETHEREUM_NETWORK){
                renzoRestakeProxy.depositETH{value: ethAmount}();
            }
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
        uint256 reTokenMaximum = swapProxy.getAmountInMaximum(address(restakingToken), address(ethToken), ethAmount);
        uint256 reTokenBalance = restakingToken.balanceOf(address(this));

        if(address(zircuitRestakeProxy) != address(0)){
            uint256 reTokenZircuitBalance = zircuitRestakeProxy.balance(address(restakingToken), address(this));
            reTokenBalance = reTokenZircuitBalance > reTokenMaximum ? reTokenMaximum: reTokenZircuitBalance;
            zircuitRestakeProxy.withdraw(address(restakingToken), reTokenBalance);
        }
        
        if(address(renzoRestakeProxy) != address(0) && address(renzoWithdrawRestakingPool) != address(0)) {        
            restakingToken.approve(address(renzoWithdrawRestakingPool), reTokenBalance);
            renzoWithdrawRestakingPool.withdraw(address(restakingToken), reTokenBalance);
        }else{
            restakingToken.approve(address(swapProxy), reTokenBalance);
            if(reTokenMaximum <= reTokenBalance){
                swapProxy.swapToWithOutput(
                    address(this),
                    address(restakingToken),
                    ethAmount,
                    address(ethToken),
                    getFee(address(restakingToken), address(ethToken))
                );
                return;
            }

            swapProxy.swapTo(
                address(this),
                address(restakingToken),
                reTokenBalance,
                address(ethToken),
                getFee(address(restakingToken), address(ethToken))
            );
        }
    }

    function updateRenzoWithdrawRestaking(address _renzoWithdrawRestakingPoolAddress) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        renzoWithdrawRestakingPool = IWithdrawRestakingPool(_renzoWithdrawRestakingPoolAddress);
    }

    function updateRestakingPoolAddresses(address[] memory _restakingPoolAddresses) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        renzoRestakeProxy = IRenzoRestakeProxy(_restakingPoolAddresses[0]);
        zircuitRestakeProxy = IZircuitRestakeProxy(_restakingPoolAddresses[1]);
    }
}