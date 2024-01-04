import { ethers } from "hardhat";
import { expect } from "chai";

import * as Contracts from "../typechain-types";
import { Signer, BigNumberish, ContractTransaction, AbiCoder, ContractTransactionReceipt } from "ethers";

describe("RockOnyxEthLiquidityStrategy", function () {
  let admin: Signer;
  let optionsReceiver: Signer;

  let camelotLiquidityContract: Contracts.CamelotLiquidity;
  let rockOnyxUSDTVaultContract: Contracts.RockOnyxUSDTVault;
  let usdc: Contracts.IERC20;
  let usdce: Contracts.IERC20;
  let wsteth: Contracts.IERC20;
  let weth: Contracts.IERC20;
  let nftPosition: Contracts.IERC721;
  let liquidityTokenId: number;
  let liquidityAmount: number;

  const LIQUIDITY_TOKEN_ID_INDEX = 0;
  const LIQUIDITY_AMOUNT_INDEX = 1;

  const aevoAddress = "0x80d40e32FAD8bE8da5C6A42B8aF1E181984D137c";
  const aevoConnectorAddress = "0x69Adf49285c25d9f840c577A0e3cb134caF944D3";
  let aevoOptionsContract: Contracts.AevoOptions;

  const nonfungiblePositionManager = "0x00c7f3082833e796A5b3e4Bd59f6642FF44DCD15"; 

  const nftPositionAddress = "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15";
  const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const usdceAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
  const usdcusdcePoolAddressPool = "0xc86Eb7B85807020b4548EE05B54bfC956eEbbfCD"; 

  const wstethAddress = "0x5979D7b546E38E414F7E9822514be443A4800529";
  const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    
  // swap router
  const swapRouterAddress: string = "0x1F721E2E82F6676FCE4eA07A5958cF098D339e18";
  let camelotSwapContract: Contracts.CamelotSwap;

  async function deployCamelotLiquidity() {
      const camelotLiquidity = await ethers.getContractFactory("CamelotLiquidity");
      camelotLiquidityContract = await camelotLiquidity.deploy(nonfungiblePositionManager);
      await camelotLiquidityContract.waitForDeployment();

      console.log("deploy CamelotLiquidity successfully: %s", await camelotLiquidityContract.getAddress());
  }

  async function deployCamelotSwapContract() {
    const factory = await ethers.getContractFactory("CamelotSwap");
    camelotSwapContract = (await factory.deploy(swapRouterAddress));
    await camelotSwapContract.waitForDeployment();

    console.log("Deployed Camelot Swap contract at address %s", await camelotSwapContract.getAddress());
  }

  async function deployAevoContract() {
    const factory = await ethers.getContractFactory("AevoOptions");
    aevoOptionsContract = (await factory.deploy(usdceAddress, aevoAddress, aevoConnectorAddress));
    await aevoOptionsContract.waitForDeployment();

    console.log("Deployed AEVO contract at address %s", await aevoOptionsContract.getAddress());
  }

  async function deployRockOnyxUSDTVault() {
    const rockOnyxUSDTVault = await ethers.getContractFactory("RockOnyxUSDTVault");
    rockOnyxUSDTVaultContract = await rockOnyxUSDTVault.deploy(
      usdcAddress,
      await camelotLiquidityContract.getAddress(),
      nftPositionAddress,
      await camelotSwapContract.getAddress(),
      await aevoOptionsContract.getAddress(),
      await optionsReceiver.getAddress(),
      usdceAddress,
      wethAddress,
      wstethAddress
    );
    await rockOnyxUSDTVaultContract.waitForDeployment();

    console.log("deploy rockOnyxEthLiquidityStrategyContract successfully: %s", await rockOnyxUSDTVaultContract.getAddress());
  }

  async function getMintPositionResult(tx : ContractTransactionReceipt, index: number) {
    // var camelotLiquidityContractAddressHex = AbiCoder.defaultAbiCoder().encode(["address"], [await camelotLiquidityContract.getAddress()]);
    // var zeroAddressHex = AbiCoder.defaultAbiCoder().encode(["address"], ["0x0000000000000000000000000000000000000000"]);
    var log = tx?.logs.find(l=> l.topics.includes("0x38296fd5286ebdb66bc9ab8003152f9666c9e808b447df47c94f7d2387fb3a54"));
    return AbiCoder.defaultAbiCoder().decode(["uint256", "uint128", "uint256", "uint256"], log!.data)[index];
}

async function getIncreasePositionResult(tx : ContractTransactionReceipt, index: number) {
    var log = tx?.logs.find(l=> l.topics.includes("0x0a65cc63f481035bddeace027bb12726628d84152598e98e29635cbcbb0bfa76"));
    return AbiCoder.defaultAbiCoder().decode(["uint256", "uint128", "uint256", "uint256"], log!.data)[index];
}

  beforeEach(async function () {
    nftPosition = await ethers.getContractAt("IERC721", nftPositionAddress);
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdce = await ethers.getContractAt("IERC20", usdceAddress);

    wsteth = await ethers.getContractAt("IERC20", wstethAddress);
    weth = await ethers.getContractAt("IERC20", wethAddress);
    
    [admin, optionsReceiver] = await ethers.getSigners();

    await deployCamelotLiquidity();
    await deployCamelotSwapContract();
    await deployAevoContract();
    await deployRockOnyxUSDTVault();
  });

  it.skip("seed data", async function(){
    const usdcSigner = await ethers.getImpersonatedSigner("0x463f5d63e5a5edb8615b0e485a090a18aba08578");
    const transferTx0 = await usdc.connect(usdcSigner).transfer(admin, ethers.parseUnits("1000", 6));
    await transferTx0.wait();
    console.log("balance of admin %s : %s usdc", admin, await usdc.connect(admin).balanceOf(admin));
  });

  it.skip("deposit to rockOnyxUSDTVault, should deposit successfully", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner("0x463f5d63e5a5edb8615b0e485a090a18aba08578");
    const transferTx0 = await usdc.connect(usdcSigner).transfer(admin, ethers.parseUnits("10000", 6));
    await transferTx0.wait();
    console.log("balance of admin : %s usdc", await usdc.connect(admin).balanceOf(admin));

    await usdc
      .connect(admin)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), 100);

    await rockOnyxUSDTVaultContract.connect(admin).deposit(100);

    console.log("balance of rockOnyxUSDTVaultContract : %s usdc", await usdc.connect(admin).balanceOf(admin));
  });

  it("fullflow deposit and stake to camelot liquidity, should successfully", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner("0x463f5d63e5a5edb8615b0e485a090a18aba08578");
    const transferTx0 = await usdc.connect(usdcSigner).transfer(admin, ethers.parseUnits("10000", 6));
    await transferTx0.wait();

    await usdc
      .connect(admin)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), 10000000);

    await rockOnyxUSDTVaultContract.connect(admin).deposit(10000000);

    console.log("balance usdc of rockOnyxUSDTVaultContract : %s usdc", await usdc.connect(admin).balanceOf(rockOnyxUSDTVaultContract));
    console.log("balance weth of rockOnyxUSDTVaultContract : %s weth", await weth.connect(admin).balanceOf(rockOnyxUSDTVaultContract));

    const transferTx1 = await rockOnyxUSDTVaultContract.connect(admin).mintPosition(
        -887272n,
        887272n,
        50
    );
    var transferTx1Result = await transferTx1.wait(); 

    liquidityTokenId = await getMintPositionResult(transferTx1Result!, LIQUIDITY_TOKEN_ID_INDEX);
    liquidityAmount = await getMintPositionResult(transferTx1Result!, LIQUIDITY_AMOUNT_INDEX);
    console.log("liquidityTokenId: %s liquidityAmount: %s", liquidityTokenId, liquidityAmount);

    const transferTx2 = await rockOnyxUSDTVaultContract.connect(admin).decreaseLiquidity();
    await transferTx2.wait(); 

    console.log("balance usdc of rockOnyxUSDTVaultContract : %s usdc", await usdc.connect(admin).balanceOf(rockOnyxUSDTVaultContract));
    console.log("balance weth of rockOnyxUSDTVaultContract : %s weth", await weth.connect(admin).balanceOf(rockOnyxUSDTVaultContract));
  });
});
