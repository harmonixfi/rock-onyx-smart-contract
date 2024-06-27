import { ethers, upgrades, network } from "hardhat";
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

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const usdcAddress =
  USDC_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const usdtAddress =
  USDT_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const daiAddress =
  DAI_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const wethAddress =
  WETH_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const rsEthAddress =
  RSETH_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const uniSwapAddress =
  UNI_SWAP_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const aevoAddress =
  AEVO_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const aevoConnectorAddress =
  AEVO_CONNECTOR_ADDRESS[chainId] ||
  "0x0000000000000000000000000000000000000000";
const kelpDepositAddress =
  KELP_DEPOSIT_ADDRESS[chainId] || "0x0000000000000000000000000000000000000000";
const kelpDepositRefId =
  KELP_DEPOSIT_REF_ID[chainId] || "0x0000000000000000000000000000000000000000";
const zircuitDepositAddress =
  ZIRCUIT_DEPOSIT_ADDRESS[chainId] ||
  "0x0000000000000000000000000000000000000000";

const contractAdmin = "0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D";

// mainnet
const aevoRecipientAddress = "0x0F8C856907DfAFB96871AbE09a76586311632ef8";

async function deployKelpRestakingDeltaNeutralVault() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );

  const kelpRestakingDNVault = await upgrades.deployProxy(
    kelpRestakingDeltaNeutralVault,
    [
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
      [500, 100, 100, 100],
    ],
    { initializer: "initialize" }
  );

  await kelpRestakingDNVault.waitForDeployment();

  console.log(
    "deploy kelpRestakingDNVault proxy successfully: %s",
    await kelpRestakingDNVault.getAddress()
  );

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(await kelpRestakingDNVault.getAddress());
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deployKelpRestakingDeltaNeutralVault();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
