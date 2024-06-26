// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IKelpDaoProxy {
    function depositToRestakingProxy(string memory refId) external payable;
    function withdrawFromRestakingProxy(
        uint256 ethAmount,
        address addressReceive
    ) external;
    function depositForZircuit() external;
    function updateNewAdmin(address _newAdmin) external;
}
