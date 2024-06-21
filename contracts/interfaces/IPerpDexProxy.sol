// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IPerpDexProxy {
    function depositToAppChain(
        address receiver,
        address asset,
        uint256 amount,
        uint256 msgGasLimit,
        address connector,
        bytes memory data
    ) external payable;

    function depositERC20To(
        address l1Token,
        address l2Token,
        address to,
        uint256 amount,
        uint32 l2Gas,
        bytes memory data
    ) external payable;

    function deposit(
        address receiver, 
        address tokenAddress, 
        uint128 amount
    ) external;
}
