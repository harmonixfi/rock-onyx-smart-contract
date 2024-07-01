import { ethers, network } from "hardhat";
import {
  AddressZero,
  CHAINID,
  RSETH_ADDRESS,
  USDC_ADDRESS,
  WSTETH_ADDRESS,
} from "../../constants";

async function main() {
  const chainId: CHAINID = network.config.chainId || 0;
  console.log("chainId", chainId);
  const oldPrivateKey = process.env.OLD_PRIVATE_KEY || AddressZero;
  const usdcAddress = USDC_ADDRESS[chainId] || AddressZero;
  const wstETHAddress = WSTETH_ADDRESS[chainId] || AddressZero;

  const oldAdmin = new ethers.Wallet(oldPrivateKey, ethers.provider);
  const oldVaultAddress = "0xC9A079d7d1CF510a6dBa8dA8494745beaE7736E2";
  const oldContract = await ethers.getContractAt(
    "KelpRestakingDeltaNeutralVault",
    oldVaultAddress
  );

  const newVaultAddress = "0x389b5702FA8bF92759d676036d1a90516C1ce0C4";

  // Connect to the USDC contract
  const usdcContract = await ethers.getContractAt("IERC20", usdcAddress);
  const wstEthContract = await ethers.getContractAt("IERC20", wstETHAddress);

  console.log("-------------Transfer USDC ---------------");
  let totalUSDC = await usdcContract.balanceOf(
    await oldContract.getAddress()
  );
  console.log(
    "USDC balance of %s %s",
    await oldContract.getAddress(),
    totalUSDC
  );

  // TEST 10 USDC FIRST
  totalUSDC = BigInt(10 * 1e6);

  await oldContract
    .connect(oldAdmin)
    .emergencyShutdown(newVaultAddress, usdcAddress, totalUSDC);

  let newVaultBalance = await usdcContract.balanceOf(newVaultAddress);
  console.log("USDC balance of newVaultAddress: %s", newVaultBalance);

  // const totalWstEth = await wstEthContract.balanceOf(
  //   await oldContract.getAddress()
  // );
  // console.log(
  //   "wstETH balance of %s %s",
  //   await oldContract.getAddress(),
  //   totalWstEth
  // );

  // console.log("-------------Transfer wstETH ---------------");

  // await oldContract
  //   .connect(oldAdmin)
  //   .emergencyShutdown(newVaultAddress, wstEthContract, totalWstEth);

  // newVaultBalance = await totalWstEth.balanceOf(newVaultAddress);
  // console.log("wstETH balance of newVaultAddress: %s", newVaultBalance);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
