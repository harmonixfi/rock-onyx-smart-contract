// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface ISwapPool {
  function globalState()
    external
    view
    returns (
      uint160 price,
      int24 tick,
      uint16 feeZto,
      uint16 feeOtz,
      uint16 timepointIndex,
      uint8 communityFeeToken0,
      uint8 communityFeeToken1,
      bool unlocked
    );

    function token0() external view returns (address);

    function liquidity() external view returns (uint256);
    
}

interface ISwapFactory {
  function poolByPair(address tokenA, address tokenB) external view returns (address pool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
      address tokenIn;
      address tokenOut;
      address recipient;
      uint256 deadline;
      uint256 amountIn;
      uint256 amountOutMinimum;
      uint160 limitSqrtPrice;
    }

    struct ExactOutputSingleParams {
      address tokenIn;
      address tokenOut;
      uint24 fee;
      address recipient;
      uint256 deadline;
      uint256 amountOut;
      uint256 amountInMaximum;
      uint160 limitSqrtPrice;
    }
    
    /// @notice Swaps amountIn of one token for as much as possible of another token
    /// @param params The parameters necessary for the swap, encoded as ExactInputSingleParams in calldata
    /// @return amountOut The amount of the received token
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint amountOut);

    function exactOutputSingle(
        ExactOutputSingleParams calldata params
    ) external payable returns (uint amountIn);

    function factory() external view returns (address);
}