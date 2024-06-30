import { ethers, network } from "hardhat";
import {
  CHAINID,
  RSETH_ADDRESS,
  USDC_ADDRESS,
  WSTETH_ADDRESS,
} from "../constants";

async function main() {
  const chainId: CHAINID = network.config.chainId || 0;
  console.log("chainId", chainId);
  const privateKey = process.env.PRIVATE_KEY || "";
  const oldPrivateKey = process.env.OLD_PRIVATE_KEY || "";
  const usdcAddress = USDC_ADDRESS[chainId];
  const wstETHAddress = WSTETH_ADDRESS[chainId];

  const oldAdmin = new ethers.Wallet(oldPrivateKey, ethers.provider);
  const oldVaultAddress = "0x09f2b45a6677858f016EBEF1E8F141D6944429DF";
  const oldContract = await ethers.getContractAt(
    "WstEthStakingDeltaNeutralVault",
    oldVaultAddress
  );

  const newVaultAddress = "0x99CD3fd86303eEfb71D030e6eBfA12F4870bD01F";

  // Connect to the USDC contract
  const usdcContract = await ethers.getContractAt("IERC20", usdcAddress);
  const wstEthContract = await ethers.getContractAt("IERC20", wstETHAddress);

  console.log("-------------Transfer USDC ---------------");
  const totalUSDC = await usdcContract.balanceOf(
    await oldContract.getAddress()
  );
  console.log(
    "USDC balance of %s %s",
    await oldContract.getAddress(),
    totalUSDC
  );

  if (totalUSDC > 0) {
    await oldContract
      .connect(oldAdmin)
      .emergencyShutdown(newVaultAddress, usdcAddress, totalUSDC);
  }

  let newVaultBalance = await usdcContract.balanceOf(newVaultAddress);
  console.log("USDC balance of newVaultAddress: %s", newVaultBalance);

  const totalRsEth = await wstEthContract.balanceOf(
    await oldContract.getAddress()
  );
  console.log(
    "wstETH balance of %s %s",
    await oldContract.getAddress(),
    totalRsEth
  );

  console.log("-------------Transfer wstETH ---------------");
  if (totalRsEth > 0) {
    await oldContract
      .connect(oldAdmin)
      .emergencyShutdown(newVaultAddress, wstETHAddress, totalRsEth);
  }

  newVaultBalance = await wstEthContract.balanceOf(newVaultAddress);
  console.log("rsETH balance of newVaultAddress: %s", newVaultBalance);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
