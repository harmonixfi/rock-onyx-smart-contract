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
    EZETH_ADDRESS,
    ZIRCUIT_DEPOSIT_ADDRESS,
    RENZO_DEPOSIT_ADDRESS,
    UNI_SWAP_ADDRESS
} from "../constants";
import * as Contracts from "../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ",chainId);


/** TEST */
// ether mainnet wallet
const aevoRecipientAddress = "0xc32eE4798BA7D190C96EAF6cab4000f602801334";

const usdcAddress = USDC_ADDRESS[chainId] || "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const daiAddress = DAI_ADDRESS[chainId] || "";
const wethAddress = WETH_ADDRESS[chainId] || "";
const ezEthAddress = EZETH_ADDRESS[chainId] || "";
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || "";
const aevoAddress = AEVO_ADDRESS[chainId] || "";
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || "";
const renzoDepositAddress = RENZO_DEPOSIT_ADDRESS[chainId] || "";
const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || "";
  
let renzoRestakingDNVault: Contracts.RenzoRestakingDeltaNeutralVault;

async function deployRenzoRestakingDeltaNeutralVault() {
    const renzoRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "RenzoRestakingDeltaNeutralVault"
    );

    renzoRestakingDNVault = await renzoRestakingDeltaNeutralVault.deploy(
      usdcAddress,
      wethAddress,
      aevoAddress,
      aevoRecipientAddress,
      aevoConnectorAddress,
      ezEthAddress,
      BigInt(1 * 1e6),
      [renzoDepositAddress, zircuitDepositAddress],
      uniSwapAddress,
      [usdcAddress, ezEthAddress, usdtAddress, daiAddress],
      [wethAddress, wethAddress, usdcAddress, usdtAddress],
      [500, 100, 100, 100]
    );
    await renzoRestakingDNVault.waitForDeployment();

    console.log(
      "deploy rockOnyxDeltaNeutralVaultContract successfully: %s",
      await renzoRestakingDNVault.getAddress()
    );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // MAINNET 
  await deployRenzoRestakingDeltaNeutralVault();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
