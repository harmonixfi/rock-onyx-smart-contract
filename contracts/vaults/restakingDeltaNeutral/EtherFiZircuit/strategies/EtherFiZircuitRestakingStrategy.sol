// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../Base/strategies/BaseRestakingStrategy.sol";
import "../../../../interfaces/IRenzoRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";

contract EtherFiZircuitRestakingStrategy is BaseRestakingStrategy {
    IWithdrawRestakingPool private renzoWithdrawRestakingPool;
    IRenzoRestakeProxy private renzoRestakeProxy;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    IERC20 private stakingToken;
    string private refId;

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
        super.ethRestaking_Initialize(
            _restakingToken,
            _usdcAddress,
            _ethAddress,
            _swapAddress,
            _token0s,
            _token1s,
            _fees
        );

        renzoRestakeProxy = IRenzoRestakeProxy(_restakingPoolAddresses[0]);
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
}
