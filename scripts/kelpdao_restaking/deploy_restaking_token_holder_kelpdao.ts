// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, network } from "hardhat";
import { Signer } from "ethers";

import {
  CHAINID,
  AddressZero,
  ZIRCUIT_DEPOSIT_ADDRESS,
  RSETH_ADDRESS
} from "../../constants";

const chainId: CHAINID = network.config.chainId ?? 1;
let deployer: Signer;

const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || AddressZero;
const rsEthAddress = RSETH_ADDRESS[chainId] || AddressZero;
const admin = '0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D';

async function deployRestakingTokenHolderContract() {
  const factory = await ethers.getContractFactory("BaseRestakingTokenHolder");
  const restakingTokenHolder = await factory.deploy(
    admin,
    rsEthAddress,
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
