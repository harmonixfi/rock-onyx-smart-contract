// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/IPerpDexProxy.sol";
import "../../interfaces/IOptionsVendorProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract Aevo is IOptionsVendorProxy, ReentrancyGuard {
    IPerpDexProxy private AEVO;
    uint256 private gasLimit;
    address private immutable asset;
    address private connector;

    constructor(address _asset, address aevoAddress, address _connector) {
        AEVO = IPerpDexProxy(aevoAddress);
        connector = _connector;
        gasLimit = 650000;
        asset = _asset;
    }

    function depositToVendor(
        address receiver,
        uint256 amount
    ) external payable {
        require(amount > 0, "INVALID_DEPOSIT_AMOUNT");
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        IERC20(asset).approve(address(AEVO), amount);

        bytes memory data = "";

        AEVO.depositToAppChain{value: msg.value}(
            receiver,
            asset,
            amount,
            gasLimit,
            connector,
            data
        );
    }
}
