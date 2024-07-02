// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RockOnyxAccessControl is AccessControl {
    bytes32 public constant LIDO_STAKE_ROLE =
        0xd075646a086a8ab150b1b694257cb718a3966ee806d131633b662a95710ec8e1; // keccak256("LIDO_STAKE_ROLE");
    bytes32 public constant ROCK_ONYX_ADMIN_ROLE =
        0xdf7ae06225b060fdb3477e253632ba0fef61b138e661391f47b795efaa9c6388; // keccak256("ROCK_ONYX_ADMIN_ROLE");
    bytes32 public constant ROCK_ONYX_OPTIONS_TRADER_ROLE =
        0xdba08cde8c399a6fbf8256699a2770b1bbd56c0b91a34301c3cce302a72d9702; // keccak256("ROCK_ONYX_OPTIONS_TRADER_ROLE");

    mapping(bytes32 => string) private errors;

    bool internal paused;

    function accessControl_Initialize() internal {
        errors[LIDO_STAKE_ROLE] = "LIDO_STAKE_ROLE_ERROR";
        errors[ROCK_ONYX_ADMIN_ROLE] = "ROCK_ONYX_ADMIN_ROLE_ERROR";
        errors[
            ROCK_ONYX_OPTIONS_TRADER_ROLE
        ] = "ROCK_ONYX_OPTIONS_TRADER_ROLE_ERROR";
        paused = false;
    }

    function _auth(bytes32 _role) internal view {
        require(hasRole(_role, msg.sender), errors[_role]);
    }

    function grantRole(
        bytes32 role,
        address account
    ) public virtual override onlyRole(ROCK_ONYX_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeRole(
        bytes32 role,
        address account
    ) public virtual override onlyRole(ROCK_ONYX_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    function setPaused(bool _paused) external {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        paused = _paused;
    }
}
