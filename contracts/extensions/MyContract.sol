//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MyContract {
    uint256 public value;

    function initialize(uint256 _value) public {
        value = _value;
    }

    function setValue(uint256 _value) public {
        value = _value;
    }
}
