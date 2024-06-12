// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, network } from "hardhat";

import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  RSETH_ADDRESS,
  ZIRCUIT_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_REF_ID,
  UNI_SWAP_ADDRESS,
} from "../constants";
import * as Contracts from "../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const usdcAddress = USDC_ADDRESS[chainId] || "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const daiAddress = DAI_ADDRESS[chainId] || "";
const wethAddress = WETH_ADDRESS[chainId] || "";
const rsEthAddress = RSETH_ADDRESS[chainId] || "";
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || "";
const aevoAddress = AEVO_ADDRESS[chainId] || "";
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || "";
const kelpDepositAddress = KELP_DEPOSIT_ADDRESS[chainId] || "";
const kelpDepositRefId = KELP_DEPOSIT_REF_ID[chainId] || "";
const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || "";

const contractAdmin = '0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D';
const aevoRecipientAddress = "0xF4aF6504462E5D574EDBdB161F1063633CCa0274";

let kelpRestakingDNVault: Contracts.KelpRestakingDeltaNeutralVault;

async function deployKelpRestakingDeltaNeutralVault() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );

  kelpRestakingDNVault = await kelpRestakingDeltaNeutralVault.deploy(
    contractAdmin,
    usdcAddress,
    6,
    BigInt(5 * 1e6),
    BigInt(1000000 * 1e6),
    BigInt(1 * 1e6),
    wethAddress,
    aevoAddress,
    aevoRecipientAddress,
    aevoConnectorAddress,
    rsEthAddress,
    BigInt(1 * 1e6),
    [kelpDepositAddress, zircuitDepositAddress],
    kelpDepositRefId,
    uniSwapAddress,
    [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
    [wethAddress, wethAddress, usdcAddress, usdtAddress],
    [500, 100, 100, 100]
  );
  await kelpRestakingDNVault.waitForDeployment();

  console.log(
    "deploy kelpRestakingDNVault successfully: %s",
    await kelpRestakingDNVault.getAddress()
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // MAINNET
  await deployKelpRestakingDeltaNeutralVault();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
