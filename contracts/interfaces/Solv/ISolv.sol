// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface ISolv {
    function subscribe(bytes32 _poolId, uint256 _currencyAmount, uint256 _openFundShareId, uint64 _expireTime) external payable;
    function requestRedeem(bytes32 _poolId, uint256 _openFundShareId, uint256 _openFundRedemptionId, uint256 _redeemValue) external;
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
}