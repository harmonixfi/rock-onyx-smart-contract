// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../../../interfaces/IZircuitRestakeProxy.sol";
import "../../../../extensions/Uniswap/Uniswap.sol";
import "../../../../interfaces/IWithdrawRestakingPool.sol";
import "../../../../interfaces/IKelpRestakeProxy.sol";
import "../../../../extensions/RockOnyxAccessControl.sol";

abstract contract BaseKelpRenzoProxy is ReentrancyGuard, RockOnyxAccessControl {
    IZircuitRestakeProxy internal zircuitRestakeProxy;
    IKelpRestakeProxy internal kelpRestakeProxy;
    IERC20 internal restakingToken;
    IERC20 internal ethToken;
    IWithdrawRestakingPool internal kelpWithdrawRestakingPool;
    address internal admin;

    function baseKelpRenzoProxyInit(address _admin, address _addressContractKelpRestake, address _addressContractZircuit, address _ethToken) internal virtual {
        zircuitRestakeProxy = IZircuitRestakeProxy(_addressContractZircuit);
        kelpRestakeProxy = IKelpRestakeProxy(_addressContractKelpRestake);
        admin = _admin;
        ethToken = IERC20(_ethToken);
        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
    }

    function updateKelpWithdrawRestaking (address _kelpWithdrawRestakingPoolAddress) external nonReentrant {
        kelpWithdrawRestakingPool = IWithdrawRestakingPool(_kelpWithdrawRestakingPoolAddress);
    }

    function updateZirCuitRestakeProxy (address _addressContractZircuit) external nonReentrant {
        zircuitRestakeProxy = IZircuitRestakeProxy(_addressContractZircuit);
    }

    function depositToRestakingProxy(string memory refId) external virtual payable nonReentrant {}

    function withdrawFromRestakingProxy(uint256 ethAmount, address addressWithdraw) external virtual nonReentrant {}

    function depositForZircuit() external virtual nonReentrant {}

    function withdrawBack(IERC20 token, address addressReceive, uint256 amount) internal virtual nonReentrant {}

    function updateAdmin(address _adminNew) internal nonReentrant {
        admin = _adminNew;
        _grantRole(ROCK_ONYX_ADMIN_ROLE, admin);
    }

    function getAdminCurrent() external virtual view returns(address) {}

    function updateRestakingToken(address _restakingToken) external nonReentrant {
        restakingToken = IERC20(_restakingToken);
    }
}