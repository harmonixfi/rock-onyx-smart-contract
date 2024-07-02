// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, upgrades, network } from "hardhat";

import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  WSTETH_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  PRICE_CONSUMER_ADDRESS,
  UNI_SWAP_ADDRESS,
  NETWORK_COST,
  CAMELOT_SWAP_ADDRESS,
  AddressZero
} from "../../constants";
import * as Contracts from "../../typechain-types";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;

const usdcAddress = USDC_ADDRESS[chainId] ?? "";
const wstethAddress = WSTETH_ADDRESS[chainId] ?? "";
const wethAddress = WETH_ADDRESS[chainId] ?? "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const daiAddress = DAI_ADDRESS[chainId] || "";
const aevoAddress = AEVO_ADDRESS[chainId] ?? "";
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] ?? "";
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || "";
const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);
const admin = "0x7E38b79D0645BE0D9539aec3501f6a8Fb6215392";

let aevoContract: Contracts.Aevo;
let rockOnyxDeltaNeutralVaultContract: Contracts.RockOnyxDeltaNeutralVault;
let deployer: Signer;

async function deployAevoContract() {
  const factory = await ethers.getContractFactory("Aevo");
  console.log(usdcAddress, aevoAddress, aevoConnectorAddress);

  aevoContract = await factory.deploy(
    usdcAddress,
    aevoAddress,
    aevoConnectorAddress
  );
  await aevoContract.waitForDeployment();

  console.log(
    "Deployed AEVO contract at address %s",
    await aevoContract.getAddress()
  );
}

let camelotSwapContract: Contracts.CamelotSwap;
const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId] || "";

async function deployCamelotSwapContract() {
  const priceConsumerAddress = PRICE_CONSUMER_ADDRESS[chainId] || "";
  const factory = await ethers.getContractFactory("CamelotSwap");
  camelotSwapContract = await factory.deploy(
    admin,
    swapRouterAddress,
    priceConsumerAddress
  );
  await camelotSwapContract.waitForDeployment();

  console.log(
    "Deployed Camelot Swap contract at address %s",
    await camelotSwapContract.getAddress()
  );
}
const UPGRADEABLE_PROXY = "0xd531d9212cB1f9d27F9239345186A6e9712D8876";

async function deployVault() {
  const camelotSwapAddress = CAMELOT_SWAP_ADDRESS[chainId] || AddressZero;
  const aevoAddress = "0x3D75e9366Fe5A2f1B7481a4Fb05deC21f8038467";

  // MAINNET
  const aevoRecipientAddress = "0x0aDf03D895617a95F317892125Cd6fb9ca3b99c1";

  // await deployCamelotSwapContract();
  // const camelotSwapAddress = await camelotSwapContract.getAddress();

  const rockOnyxDeltaNeutralVault = await ethers.getContractFactory(
    "RockOnyxDeltaNeutralVault"
  );

  rockOnyxDeltaNeutralVaultContract = await upgrades.deployProxy(
    rockOnyxDeltaNeutralVault,
    [
      admin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      camelotSwapAddress,
      aevoAddress,
      aevoRecipientAddress,
      wethAddress,
      wstethAddress,
      BigInt(parseInt((1 * 1e6).toString())),
      uniSwapAddress,
      [usdtAddress, daiAddress],
      [usdcAddress, usdtAddress],
      [100, 100],
    ],
    { initializer: "initialize" }
  );
  await rockOnyxDeltaNeutralVaultContract.waitForDeployment();

  console.log(
    "deploy Delta Neutral proxy successfully: %s",
    await rockOnyxDeltaNeutralVaultContract.getAddress()
  );

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(await rockOnyxDeltaNeutralVaultContract.getAddress());
  console.log(
    "Delta Neutral implementation address: %s",
    implementationAddress
  );
}

async function upgradeProxy() {
  const deltaNeutralVault = await ethers.getContractFactory(
    "RockOnyxDeltaNeutralVault"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    deltaNeutralVault
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function main() {
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // await deployVault();
  await upgradeProxy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
