// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../../extensions/RockOnyxAccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../interfaces/IRestakingTokenHolder.sol";
import "hardhat/console.sol";

contract BaseRestakingTokenHolder is IRestakingTokenHolder, RockOnyxAccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address private admin;
    IZircuitRestakeProxy private zircuitRestakeProxy;
    IERC20 private restakingToken;
    mapping(address => uint256) private balances;

    constructor(
        address _admin,
        address _restakingToken, 
        IZircuitRestakeProxy _zircuitRestakeProxy){
            admin = _admin;
            restakingToken = IERC20(_restakingToken);
            zircuitRestakeProxy = _zircuitRestakeProxy;

            _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
    }

    function deposit(uint256 amount) external nonReentrant{
        restakingToken.safeTransferFrom(msg.sender, address(this), amount);
        depositToZircuit(amount);
        balances[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external nonReentrant returns(uint256){
        require(balances[msg.sender] >= 0, "INVALID_AMOUNT");

        if(balances[msg.sender] < amount) 
            amount = balances[msg.sender];
            
        balances[msg.sender] -= amount;
        widthdrawFromZircuit(amount);
        restakingToken.safeTransfer(msg.sender, amount);
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

    function balanceOf(address owner) external view returns(uint256){
        return balances[owner];
    }

    function emergencyShutdown(
        address receiver,
        uint256 amount
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        widthdrawFromZircuit(amount);
        restakingToken.safeTransfer(receiver, amount);
    }
}