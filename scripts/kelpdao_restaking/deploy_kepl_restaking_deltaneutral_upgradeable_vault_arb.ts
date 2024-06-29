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
  KELP_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_REF_ID,
  UNI_SWAP_ADDRESS,
  AddressZero,
  KELPDAO_TOKEN_HOLDER_ADDRESS,
} from "../../constants";

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
const kelpdaoHolderAddress =
  KELPDAO_TOKEN_HOLDER_ADDRESS[chainId] || AddressZero;

const contractAdmin = "0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D";

const UPGRADEABLE_PROXY = "0x3C610CDE6d4c2a379F0F461d7eD05ed709779058";

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
      [kelpDepositAddress, kelpdaoHolderAddress],
      kelpDepositRefId,
      uniSwapAddress,
      [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
      [wethAddress, wethAddress, usdcAddress, usdtAddress],
      [500, 100, 100, 100],
      chainId,
    ],
    { initializer: "initialize" }
  );

  await kelpRestakingDNVault.waitForDeployment();

  console.log(
    "deploy kelpRestakingDNVault proxy successfully: %s",
    await kelpRestakingDNVault.getAddress()
  );

  // Print the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    await kelpRestakingDNVault.getAddress()
  );
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function upgradeProxy() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    kelpRestakingDeltaNeutralVault
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", upgrade.address);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deployKelpRestakingDeltaNeutralVault();
  await upgradeProxy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
