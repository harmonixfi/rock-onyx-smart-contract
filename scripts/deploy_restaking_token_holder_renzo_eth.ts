// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, network } from "hardhat";
import { Signer } from "ethers";

import {
  CHAINID,
  AddressZero,
  EZETH_ADDRESS,
  ZIRCUIT_DEPOSIT_ADDRESS,
} from "../constants";

const chainId: CHAINID = network.config.chainId ?? 1;
let deployer: Signer;

const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || AddressZero;
const ezEthAddress = EZETH_ADDRESS[chainId] || AddressZero;
const admin = '';

async function deployRestakingTokenHolderContract() {
  const factory = await ethers.getContractFactory("BaseRestakingTokenHolder");
  const restakingTokenHolder = await factory.deploy(
    admin,
    ezEthAddress,
    zircuitDepositAddress
  );
  await restakingTokenHolder.waitForDeployment();

  console.log(
    "Deployed restaking token holder contract at address %s",
    await restakingTokenHolder.getAddress()
  );
}

async function main() {
  [deployer] = await ethers.getSigners();
  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  deployRestakingTokenHolderContract();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
