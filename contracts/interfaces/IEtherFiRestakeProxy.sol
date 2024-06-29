// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IEtherFiRestakeProxy {
    function deposit() external payable;
    function wrap(uint256 _wEthAmoutn) external;
}