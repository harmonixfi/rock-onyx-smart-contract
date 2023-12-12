// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../structs/rockOnyxStructs.sol";

library ShareMath {

    uint256 internal constant PLACEHOLDER_UINT = 1;

    function assetToShares(
        uint256 assetAmount,
        uint256 assetPerShare,
        uint256 decimals
    ) internal pure returns (uint256) {
        require(assetPerShare > PLACEHOLDER_UINT, "Invalid assetPerShare");

        return assetAmount * (10**decimals) / (assetPerShare);
    }

    function sharesToAsset(
        uint256 shares,
        uint256 assetPerShare,
        uint256 decimals
    ) internal pure returns (uint256) {
        require(assetPerShare > PLACEHOLDER_UINT, "Invalid assetPerShare");

        return shares * (assetPerShare) / (10**decimals);
    }

    function pricePerShare(
        uint256 totalSupply,
        uint256 totalBalance,
        uint256 decimals
    ) internal pure returns (uint256) {
        uint256 singleShare = 10**decimals;
        return
            totalSupply > 0 ? singleShare * totalBalance / totalSupply : singleShare;
    }
}
