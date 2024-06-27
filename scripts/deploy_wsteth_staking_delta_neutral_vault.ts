// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, network } from "hardhat";

import {
    AddressZero,
    CHAINID,
    WETH_ADDRESS,
    USDC_ADDRESS,
    WSTETH_ADDRESS,
    USDT_ADDRESS,
    UNI_SWAP_ADDRESS,
    BSX_ADDRESS,
    NETWORK_COST
} from "../constants";
import * as Contracts from "../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ",chainId);

const usdcAddress = USDC_ADDRESS[chainId] || "";
const wstethAddress = WSTETH_ADDRESS[chainId] || "";
const wethAddress = WETH_ADDRESS[chainId] || "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const perDexAddress = BSX_ADDRESS[chainId] || "";
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || "";
const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

const admin = '0x39c76363E9514a7D11976d963B09b7588B5DFBf3';
const perDexRecipientAddress = "0x84231f1cCeba8591239cD8f9b0C906DB38961Bd5";

let wstEthStakingDNVault: Contracts.WstEthStakingDeltaNeutralVault;

async function deployWstEthStakingDeltaNeutralVault() {
    const wstEthStakingDeltaneutralVault = await ethers.getContractFactory(
      "WstEthStakingDeltaNeutralVault"
    );

    wstEthStakingDNVault = await wstEthStakingDeltaneutralVault.deploy(
      admin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      wethAddress,
      perDexAddress,
      perDexRecipientAddress,
      AddressZero,
      wstethAddress,
      BigInt(1 * 1e6),
      uniSwapAddress,
      [wethAddress, wstethAddress,  usdtAddress],
      [usdcAddress, wethAddress, usdcAddress],
      [500, 100, 100]
    );
    await wstEthStakingDNVault.waitForDeployment();

    console.log(
      "deploy wstEthStakingDNVault successfully: %s",
      await wstEthStakingDNVault.getAddress()
    );
  }

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deployWstEthStakingDeltaNeutralVault();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });