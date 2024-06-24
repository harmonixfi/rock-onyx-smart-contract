// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct UserDepositSolv {
    address owner;
    bytes32 poolId;
    mapping(uint256 => address) openFundShareId;
    uint256 currentcyAmount;
}