// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../../../extensions/RockOnyxAccessControl.sol";
import "../../../../extensions/Uniswap/Uniswap.sol";
import "./../../Base/BaseSwapVault.sol";
import "../../structs/RestakingDeltaNeutralStruct.sol";
import "hardhat/console.sol";

abstract contract BaseRestakingStrategy is BaseSwapVault, RockOnyxAccessControl, ReentrancyGuardUpgradeable {
    uint64 internal constant ARBTRIUM_NETWORK = 42161;
    uint64 internal constant ETHEREUM_NETWORK = 1;
    IERC20 internal usdcToken;
    IERC20 internal ethToken;
    IERC20 internal restakingToken;
    EthRestakingState internal restakingState;
    uint64 internal network;

    // Events
    event Deposited(address indexed proxy, uint256 amount);
    event Withdrawn(address indexed proxy, uint256 amount);

    event PositionOpened(uint256 usdcAmount, uint256 ethAmount);
    event PositionClosed(uint256 ethAmount, uint256 usdcAmount);

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees,
        uint64 _network
    ) internal virtual {
        usdcToken = IERC20(_usdcAddress);
        ethToken = IERC20(_ethAddress);
        restakingToken = IERC20(_restakingToken);
        network = _network;
        baseSwapVault_Initialize(_swapAddress, _token0s, _token1s, _fees);
    }

    // Function to handle deposits to the staking strategies and allocate points
    function depositToRestakingStrategy(uint256 amount) internal {
        require(amount > 0, "INVALID_AMOUNT");

        restakingState.unAllocatedBalance += amount;
        restakingState.totalBalance += amount;
    }

    function openPosition(uint256 ethAmount) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);
        require(restakingState.unAllocatedBalance > 0, "INSUFICIENT_BALANCE");

        usdcToken.approve(address(swapProxy), restakingState.unAllocatedBalance);
        uint256 usedUsdAmount = swapProxy.swapToWithOutput(
            address(this),
            address(usdcToken),
            ethAmount,
            address(ethToken), 
            getFee(address(usdcToken), address(ethToken))
        );

        restakingState.unAllocatedBalance -= usedUsdAmount;
        depositToRestakingProxy(ethAmount);

        emit PositionOpened(usedUsdAmount, ethAmount);
    }

    function closePosition(uint256 ethAmount) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        withdrawFromRestakingProxy(ethAmount);
        ethToken.approve(address(swapProxy), ethToken.balanceOf(address(this)));
        uint256 actualUsdcAmount = swapProxy.swapTo(
            address(this),
            address(ethToken),
            ethToken.balanceOf(address(this)),
            address(usdcToken),
            getFee(address(usdcToken), address(ethToken))
        );

        restakingState.unAllocatedBalance += actualUsdcAmount;
        emit PositionClosed(ethAmount, actualUsdcAmount);
    }

    function depositToRestakingProxy(uint256 ethAmount) internal virtual nonReentrant {}
    
    function withdrawFromRestakingProxy(uint256 ethAmount) internal virtual nonReentrant {}

    function syncRestakingBalance() internal virtual{
        uint256 ethAmount = restakingToken.balanceOf(address(this)) * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
    }

    function getTotalRestakingTvl() internal view returns (uint256) {
        return restakingState.totalBalance;
    }

    function acquireFundsFromRestakingStrategy(uint256 amount) internal returns (uint256){
        uint256 unAllocatedBalance = restakingState.unAllocatedBalance;
        require(amount <= unAllocatedBalance, "INVALID_ACQUIRE_AMOUNT");

        restakingState.unAllocatedBalance -= amount;
        restakingState.totalBalance -= amount;
        return amount;
    }

    /**
     * @dev Retrieves the unallocated balance in the Ethereum Stake & Lend strategy.
     * @return The unallocated balance in the Ethereum Stake & Lend strategy.
     */
    function getEthStakingState() external view returns (EthRestakingState memory) {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        
        return restakingState;
    }
}
