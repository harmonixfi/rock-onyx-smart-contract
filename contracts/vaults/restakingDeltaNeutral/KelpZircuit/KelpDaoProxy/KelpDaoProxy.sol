// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../../interfaces/IKelpRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWETH.sol";
import "../../../../extensions/Uniswap/Uniswap.sol";
import "../../Base/BaseSwapVault.sol";
import "../../Base/proxy/BaseKelpRenzoProxy.sol";

contract KelpDaoProxy is BaseKelpRenzoProxy, BaseSwapVault {
    constructor(
        address _addressContractKelpRestake,
        address _addressContractZircuit,
        address _ethToken
    ) {
        baseKelpRenzoProxyInit(
            msg.sender,
            _addressContractKelpRestake,
            _addressContractZircuit,
            _ethToken
        );
    }

    // function init(
    //     address _admin,
    //     address _addressContractKelpRestake,
    //     address _addressContractZircuit,
    //     address _ethToken
    // ) internal {
    //     super.baseKelpRenzoProxyInit(
    //         _admin,
    //         _addressContractKelpRestake,
    //         _addressContractZircuit,
    //         _ethToken
    //     );
    // }

    function depositToRestakingProxy(
        string memory refId
    ) external payable override {
        require(msg.value > 0, "INVALID_AMOUNT_ETH");
        require(
            address(kelpRestakeProxy) != address(0),
            "INVALID_ADDRESS_KELP_RESTAKING_0x"
        );
        // ethereum
        kelpRestakeProxy.depositETH{value: msg.value}(0, refId);
    }

    function withdrawFromZircuitRestakingProxy(
        uint256 amount,
        address addressReceive
    ) external override {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        zircuitRestakeProxy.withdraw(address(restakingToken), amount);
        withdrawBack(restakingToken, addressReceive, amount);
    }

    function withdrawFromKelpRestakePool(
        uint256 amount,
        address addressReceive
    ) external override {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        kelpWithdrawRestakingPool.withdraw(address(restakingToken), amount);
        withdrawBack(restakingToken, addressReceive, amount);
    }

    function depositForZircuit() external override {
        restakingToken.approve(
            address(zircuitRestakeProxy),
            restakingToken.balanceOf(address(this))
        );
        zircuitRestakeProxy.depositFor(
            address(restakingToken),
            address(this),
            restakingToken.balanceOf(address(this))
        );
    }

    function withdrawBack(
        IERC20 token,
        address addressReceive,
        uint256 amount
    ) internal override {
        require(amount > 0, "INVALID_AMOUNT_UNDER_ZERO");
        require(
            amount <= token.balanceOf(address(this)),
            "AMOUNT_WITH_DRAW_NOT_ENOUGH"
        );
        token.transferFrom(address(this), addressReceive, amount);
    }

    function updateNewAdmin(address _adminNew) external {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        updateAdmin(_adminNew);
    }

    function getRestakingTokenCurrent() external view returns (address) {
        return address(restakingToken);
    }

    function getAdminCurrent() external view override returns (address) {
        return admin;
    }

    function getKelpRestakeProxy() external view returns (address) {
        return address(kelpRestakeProxy);
    }

    receive() external payable {}

    fallback() external payable {}
}
