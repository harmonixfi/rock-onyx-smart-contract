// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../../interfaces/IKelpRestakeProxy.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../interfaces/IWETH.sol";
import "../../../../extensions/Uniswap/Uniswap.sol";
import "../../Base/BaseSwapVault.sol";
import "../Base/BaseKelpRenzoProxy.sol";

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
        require(address(kelpRestakeProxy) != address(0), "INVALID_ADDRESS_KELP_RESTAKING_0x");
        // ethereum
        kelpRestakeProxy.depositETH{value: msg.value}(0, refId);
    }

    function withdrawFromRestakingProxy(
        uint256 ethAmount,
        address addressReceive
    ) external override {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        uint256 stakingTokenAmount = swapProxy.getAmountInMaximum(
            address(restakingToken),
            address(ethToken),
            ethAmount
        );

        if (address(zircuitRestakeProxy) != address(0)) {
            zircuitRestakeProxy.withdraw(
                address(restakingToken),
                stakingTokenAmount
            );
            withdrawBack(
                restakingToken,
                addressReceive,
                restakingToken.balanceOf(address(this))
            );
        }

        if (
            address(kelpRestakeProxy) != address(0) &&
            address(kelpWithdrawRestakingPool) != address(0)
        ) {
            restakingToken.approve(address(swapProxy), stakingTokenAmount);
            kelpWithdrawRestakingPool.withdraw(
                address(restakingToken),
                stakingTokenAmount
            );
            withdrawBack(restakingToken, addressReceive, stakingTokenAmount);
        } else {
            restakingToken.approve(address(swapProxy), stakingTokenAmount);
            swapProxy.swapToWithOutput(
                address(this),
                address(restakingToken),
                ethAmount,
                address(ethToken),
                getFee(address(restakingToken), address(ethToken))
            );
            withdrawBack(ethToken, addressReceive, ethAmount);
        }
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

    function getRestakingTokenCurrent() external view returns(address) {
        return address(restakingToken);
    }

    function getAdminCurrent() external override view returns(address) { 
        return admin;
    }

    function getKelpRestakeProxy() external view returns(address) {
        return address(kelpRestakeProxy);
    }

    receive() external payable {}
    
    fallback() external payable {}
}