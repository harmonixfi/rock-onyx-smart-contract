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
  KELPDAO_TOKEN_HOLDER_ADDRESS,
  AddressZero,
} from "../../constants";
import * as Contracts from "../../typechain-types";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const usdcAddress = USDC_ADDRESS[chainId] || AddressZero;
const usdtAddress = USDT_ADDRESS[chainId] || AddressZero;
const daiAddress = DAI_ADDRESS[chainId] || AddressZero;
const wethAddress = WETH_ADDRESS[chainId] || AddressZero;
const rsEthAddress = RSETH_ADDRESS[chainId] || AddressZero;
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || AddressZero;
const aevoAddress = AEVO_ADDRESS[chainId] || AddressZero;
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || AddressZero;
const kelpDepositAddress = KELP_DEPOSIT_ADDRESS[chainId] || AddressZero;
const kelpDepositRefId = KELP_DEPOSIT_REF_ID[chainId] || AddressZero;
const kelpdaoHolderAddress = KELPDAO_TOKEN_HOLDER_ADDRESS[chainId] || AddressZero;

const contractAdmin = '0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D';

// mainnet
const aevoRecipientAddress = "0x0F8C856907DfAFB96871AbE09a76586311632ef8";

let kelpRestakingDNVault: Contracts.KelpRestakingDeltaNeutralVault;
let deployer: Signer;

async function deployKelpRestakingDeltaNeutralVault() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );

  kelpRestakingDNVault = await kelpRestakingDeltaNeutralVault.deploy();
  await kelpRestakingDNVault.waitForDeployment();

  kelpRestakingDNVault.connect(deployer).initialize(
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
    [kelpDepositAddress, kelpdaoHolderAddress],
    kelpDepositRefId,
    uniSwapAddress,
    [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
    [wethAddress, wethAddress, usdcAddress, usdtAddress],
    [500, 100, 100, 100],
    chainId
  );

  console.log(
    "deploy kelpRestakingDNVault successfully: %s",
    await kelpRestakingDNVault.getAddress()
  );
}

async function main() {
  [deployer] = await ethers.getSigners();

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