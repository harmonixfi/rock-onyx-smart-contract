// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../interfaces/IRestakingTokenHolder.sol";

contract BaseRestakingTokenHolder is IRestakingTokenHolder {
    using SafeERC20 for IERC20;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    IERC20 private restakingToken;
    mapping(address => uint256) private balances;

    constructor(address _restakingToken, IZircuitRestakeProxy _zircuitRestakeProxy){
        restakingToken = IERC20(_restakingToken);
        zircuitRestakeProxy = _zircuitRestakeProxy;
    }

    function deposit(uint256 amount) external {
        IERC20(restakingToken).safeTransferFrom(msg.sender, address(this), amount);
        depositToZircuit(amount);
        balances[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external returns(uint256){
        require(balances[msg.sender] >= 0, "INVALID_AMOUNT");
        if(balances[msg.sender] < amount) 
            amount = balances[msg.sender];
        balances[msg.sender] -= amount;
        widthdrawFromZircuit(amount);
        IERC20(restakingToken).safeTransfer(msg.sender, amount);
        return amount;
    }

    function depositToZircuit(uint256 amount) internal {
        if(address(zircuitRestakeProxy) != address(0)){
            restakingToken.approve(address(zircuitRestakeProxy), amount);
            zircuitRestakeProxy.depositFor(address(restakingToken), address(this), restakingToken.balanceOf(address(this)));
        }
    }

    function widthdrawFromZircuit(uint256 amount) internal {
        if(address(zircuitRestakeProxy) != address(0)){
            zircuitRestakeProxy.withdraw(address(restakingToken), amount);
        }
    }

    function balanceOf(address owwner) external view returns(uint256){
        return balances[owwner];
    }
}