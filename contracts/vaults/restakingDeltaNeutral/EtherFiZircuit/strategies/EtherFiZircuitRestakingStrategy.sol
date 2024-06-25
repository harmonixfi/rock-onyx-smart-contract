// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../Base/strategies/BaseRestakingStrategy.sol";

contract EtherFiZircuitRestakingStrategy is BaseRestakingStrategy {
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
    }
}
