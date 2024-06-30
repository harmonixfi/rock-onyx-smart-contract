// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/IWithdrawRestakingPool.sol";
import "../../interfaces/IRenzoRestakeProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RenzoWithdrawRestakingPool is IWithdrawRestakingPool {

    constructor(address _renzoDepositAddress, IERC20 _stakingToken) {
    }

    function withdraw(address token, uint256 amount) external {
    }
}