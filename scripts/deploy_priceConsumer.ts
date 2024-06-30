import { ethers, network } from "hardhat";
import * as Contracts from "../typechain-types";
import { Signer } from "ethers";

import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDCE_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  WSTETH_ADDRESS,
  ARB_ADDRESS,
  EZETH_ADDRESS,
  RSETH_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH_ETH_PRICE_FEED_ADDRESS,
  EZETH_ETH_PRICE_FEED_ADDRESS,
  RSETH_ETH_PRICE_FEED_ADDRESS,
  USDCE_USDC_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  ARB_PRICE_FEED_ADDRESS,
} from "../constants";

const chainId: CHAINID = network.config.chainId as CHAINID;

let deployer: Signer;
let contract: Contracts.PriceConsumer;

const wethAddress = WETH_ADDRESS[chainId] ?? "";
const wstethAddress = WSTETH_ADDRESS[chainId] ?? "";
const ezEthAddress = EZETH_ADDRESS[chainId] || "";
const rsEthAddress = RSETH_ADDRESS[chainId] || "";
const usdceAddress = USDCE_ADDRESS[chainId] ?? "";
const usdcAddress = USDC_ADDRESS[chainId] ?? "";
const arbAddress = ARB_ADDRESS[chainId] ?? "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const daiAddress = DAI_ADDRESS[chainId] || "";

const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId] ?? "";
const steth_ethPriceFeed = WSTETH_ETH_PRICE_FEED_ADDRESS[chainId] ?? "";
const usdcePriceFeed = USDCE_USDC_PRICE_FEED_ADDRESS[chainId] ?? "";
const arbPriceFeed = ARB_PRICE_FEED_ADDRESS[chainId] ?? "";
const ezEth_EthPriceFeed = EZETH_ETH_PRICE_FEED_ADDRESS[chainId] ?? "";
const rsEth_EthPriceFeed = RSETH_ETH_PRICE_FEED_ADDRESS[chainId] ?? "";
const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId] ?? "";
const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId] ?? "";

async function deployPriceConsumerContract() {
  const factory = await ethers.getContractFactory("PriceConsumer");
  let arr1, arr2, arr3;
  switch (chainId) {
    case CHAINID.ARBITRUM_MAINNET:
      arr1 = [wethAddress, wstethAddress, usdceAddress, arbAddress, ezEthAddress, rsEthAddress, usdtAddress, daiAddress];
      arr2 = [usdcAddress, wethAddress, usdcAddress, usdcAddress, wethAddress, wethAddress, usdcAddress, usdtAddress];
      arr3 = [ethPriceFeed, steth_ethPriceFeed, usdcePriceFeed, arbPriceFeed, ezEth_EthPriceFeed, rsEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed, ];
      break;
    case CHAINID.ETH_MAINNET:
      arr1 = [wethAddress, wstethAddress, ezEthAddress, rsEthAddress, usdtAddress, daiAddress];
      arr2 = [usdcAddress, wethAddress, wethAddress, wethAddress, usdcAddress, usdtAddress];
      arr3 = [ethPriceFeed, steth_ethPriceFeed, ezEth_EthPriceFeed, rsEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed];
      break;
    case CHAINID.BASE_MAINNET:
      arr1 = [wethAddress, wstethAddress, usdtAddress];
      arr2 = [usdcAddress, wethAddress, usdcAddress];
      arr3 = [ethPriceFeed, steth_ethPriceFeed, usdtPriceFeed];
      break;
  
    default:
      console.log("CHAIN is not supported");
      return;
  }

  const admin = "0xad38f5dd867ef07b8fe7df685f28743922bb33c4";
  
  contract = await factory.deploy(admin, arr1, arr2, arr3);
  await contract.waitForDeployment();

  console.log(
    "Deployed price consumer contract at address %s",
    await contract.getAddress()
  );
}
async function main() {
  [deployer] = await ethers.getSigners();
  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  deployPriceConsumerContract();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
