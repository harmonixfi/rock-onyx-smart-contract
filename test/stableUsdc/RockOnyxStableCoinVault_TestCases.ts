const { ethers } = require("hardhat");
import { expect } from "chai";
import axios from "axios";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDCE_ADDRESS,
  WSTETH_ADDRESS,
  ARB_ADDRESS,
  NonfungiblePositionManager,
  SWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDCE_IMPERSONATED_SIGNER_ADDRESS,
  NFT_POSITION_ADDRESS,
  ANGLE_REWARD_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH__ETH_PRICE_FEED_ADDRESS,
  USDC_PRICE_FEED_ADDRESS,
  ARB_PRICE_FEED_ADDRESS
} from "../../constants";
import {
  Signer,
  BigNumberish,
} from "ethers";

// const chainId: CHAINID = network.config.chainId;
const chainId: CHAINID = 42161;

describe("RockOnyxStableCoinVault", function () {
  let admin: Signer,
    user1: Signer,
    user2: Signer,
    user3: Signer,
    user4: Signer;

  let optionsReceiver: Signer;
  let camelotLiquidityContract: Contracts.CamelotLiquidity;
  let rockOnyxUSDTVaultContract: Contracts.RockOnyxUSDTVault;
  let aevoContract: Contracts.Aevo;
  let camelotSwapContract: Contracts.CamelotSwap;
  let priceConsumerContract: Contracts.PriceConsumer;

  let usdc: Contracts.IERC20;
  let usdce: Contracts.IERC20;
  let wsteth: Contracts.IERC20;

  const PRECISION = 2 * 1e6;

  const nftPositionAddress = NFT_POSITION_ADDRESS[chainId];
  const rewardAddress = ANGLE_REWARD_ADDRESS[chainId];
  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdceImpersonatedSigner = USDCE_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const nonfungiblePositionManager = NonfungiblePositionManager[chainId];
  const usdcAddress = USDC_ADDRESS[chainId];
  const usdceAddress = USDCE_ADDRESS[chainId];
  const wstethAddress = WSTETH_ADDRESS[chainId];
  const wethAddress = WETH_ADDRESS[chainId];
  const arbAddress = ARB_ADDRESS[chainId];
  const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];

  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const wsteth_ethPriceFeed = WSTETH__ETH_PRICE_FEED_ADDRESS[chainId];
  const usdcePriceFeed = USDC_PRICE_FEED_ADDRESS[chainId];
  const arbPriceFeed = ARB_PRICE_FEED_ADDRESS[chainId];

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");
    priceConsumerContract = await factory.deploy(
      [wethAddress, wstethAddress, usdceAddress, arbAddress],
      [usdcAddress, wethAddress, usdcAddress, usdcAddress],
      [ethPriceFeed, wsteth_ethPriceFeed, usdcePriceFeed, arbPriceFeed]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deployCamelotLiquidity() {
    const camelotLiquidity = await ethers.getContractFactory(
      "CamelotLiquidity"
    );
    camelotLiquidityContract = await camelotLiquidity.deploy(
      nonfungiblePositionManager
    );
    await camelotLiquidityContract.waitForDeployment();

    console.log(
      "deploy CamelotLiquidity successfully: %s",
      await camelotLiquidityContract.getAddress()
    );
  }

  async function deployCamelotSwapContract() {
    const factory = await ethers.getContractFactory("CamelotSwap");
    camelotSwapContract = await factory.deploy(swapRouterAddress, priceConsumerContract.getAddress());
    await camelotSwapContract.waitForDeployment();

    console.log(
      "Deployed Camelot Swap contract at address %s",
      await camelotSwapContract.getAddress()
    );
  }

  async function deployAevoContract() {
    const factory = await ethers.getContractFactory("Aevo");
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

  async function deployRockOnyxUSDTVault() {
    const rockOnyxUSDTVault = await ethers.getContractFactory(
      "RockOnyxUSDTVault"
    );

    rockOnyxUSDTVaultContract = await rockOnyxUSDTVault.deploy(
      usdcAddress,
      await camelotLiquidityContract.getAddress(),
      rewardAddress,
      nftPositionAddress,
      await camelotSwapContract.getAddress(),
      await aevoContract.getAddress(),
      await optionsReceiver.getAddress(),
      usdceAddress,
      wethAddress,
      wstethAddress,
      arbAddress,
      BigInt(1 * 1e6)
    );
    await rockOnyxUSDTVaultContract.waitForDeployment();

    console.log(
      "deploy rockOnyxEthLiquidityStrategyContract successfully: %s",
      await rockOnyxUSDTVaultContract.getAddress()
    );

    const bytecode = await ethers.provider.getCode(
      rockOnyxUSDTVaultContract.getAddress()
    );
    const size = bytecode.length / 2;
    console.log("rockOnyxEthLiquidityStrategyContract size: %s", size);
  }

  beforeEach(async function () {
    [admin, optionsReceiver, user1, user2, user3, user4] =
      await ethers.getSigners();

    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdce = await ethers.getContractAt("IERC20", usdceAddress);

    wsteth = await ethers.getContractAt("IERC20", wstethAddress);
    await deployPriceConsumerContract();
    await deployCamelotLiquidity();
    await deployCamelotSwapContract();
    await deployAevoContract();
    await deployRockOnyxUSDTVault();
  });

  // Helper function for deposit
  async function deposit(sender: Signer, amount: BigNumberish) {
    await usdc
      .connect(sender)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), amount);

    await rockOnyxUSDTVaultContract.connect(sender).deposit(amount);
  }

  async function transferUsdcForUser(from: Signer, to: Signer, amount: number) {
    const transferTx = await usdc.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function transferUsdceForUser(from: Signer, to: Signer, amount: number) {
    const transferTx = await usdce.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await rockOnyxUSDTVaultContract
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );
    const usdceSigner = await ethers.getImpersonatedSigner(
      usdceImpersonatedSigner
    );

    await transferUsdcForUser(usdcSigner, user1, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user2, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user3, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user4, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, optionsReceiver, 10000 * 1e6);

    await transferUsdceForUser(usdceSigner, optionsReceiver, 1000 * 1e6);
  });

  it("deposit to rockOnyxUSDTVault, WETH in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------mintEthLP position on Camelot---------------");
    const mintEthLPPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(2000, 2101, 5000, 4);
    await mintEthLPPositionTx.wait();

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(10 * 1e6, PRECISION);

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(100 * 1e6),
      PRECISION
    );
  });

  it("deposit to rockOnyxUSDTVault, wstETH in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------mintEthLP position on Camelot---------------");
    const mintEthLPPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(1442, 1445, 5000, 4);
    await mintEthLPPositionTx.wait();

    let wstEthBalance = await wsteth.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log(
      "Vault wstETH amount after mint %s",
      ethers.formatUnits(wstEthBalance, 18)
    );

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    let totalValueLock2 = await logAndReturnTotalValueLock();
    expect(totalValueLock2).to.approximately(8.5 * 1e6, PRECISION);

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);
    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(100 * 1e6),
      PRECISION
    );
  });

  it("deposit to rockOnyxUSDTVault, USDC in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------mintUsdLP position on Camelot---------------");

    let usdcBalance = await usdc.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log(
      "Vault usdce amount after mint %s",
      ethers.formatUnits(usdcBalance, 6)
    );

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    let totalValueLock2 = await logAndReturnTotalValueLock();
    expect(totalValueLock2).to.approximately(10 * 1e6, PRECISION);

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(100 * 1e6),
      PRECISION
    );
  });

  it("calculate performance fee rockOnyxUSDTVault, USDC in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log(
      "-------------calculate performance fee rockOnyxUSDTVault---------------"
    );
    await deposit(user2, 100 * 1e6);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(30 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    const getAllocatedRatio = await rockOnyxUSDTVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("getAllocatedRatio = %s", getAllocatedRatio);

    const roundWdAmount = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getRoundWithdrawAmount();

    console.log("roundWdAmount = %s", roundWdAmount);
    let usdcAmount = (roundWdAmount * getAllocatedRatio[2]) / BigInt(1e4);
    console.log("usdcAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), usdcAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(usdcAmount);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    console.log("------------- Claim all fees ---------------");
    await completeWithdrawalTx.wait();
  });

  it("Full flow with multiple users deposit and withdraw all money", async function () {
    console.log(
      "-------------calculate performance fee rockOnyxUSDTVault---------------"
    );
    await deposit(user1, 200 * 1e6);
    await deposit(user2, 100 * 1e6);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    let usdcBalance = await usdc.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log(
      "Vault usdc amount after mint %s",
      ethers.formatUnits(usdcBalance, 6)
    );
    let withdrawShares = 100 * 1e6;
    console.log("-------------Users initial withdrawals---------------");
    // user 1 initates withdrawal
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(withdrawShares);
    await initiateWithdrawalTx1.wait();

    // user 2 initates withdrawal
    const initiateWithdrawalTx2 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(200 * 1e6);
    await initiateWithdrawalTx2.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(90 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    const getAllocatedRatio = await rockOnyxUSDTVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("getAllocatedRatio = %s", getAllocatedRatio);

    const roundWdAmount = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getRoundWithdrawAmount();

    console.log("roundWdAmount = %s", roundWdAmount);
    let usdcAmount = (roundWdAmount * getAllocatedRatio[2]) / BigInt(1e4);
    console.log("usdceAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), usdcAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(usdcAmount);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    // let user2Balance = await usdc.connect(user2).balanceOf(user2);

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    const completeWithdrawalTx2 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .completeWithdrawal(200 * 1e6);
    await completeWithdrawalTx2.wait();

    console.log("------------- Claim all fees ---------------");
    await completeWithdrawalTx.wait();
  });

  it("Full flow with multiple users deposit and withdraw all money in losses", async function () {
    console.log(
      "-------------calculate performance fee rockOnyxUSDTVault---------------"
    );
    await deposit(user1, 200 * 1e6);
    await deposit(user2, 100 * 1e6);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    let usdcBalance = await usdc.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log(
      "Vault usdc amount after mint %s",
      ethers.formatUnits(usdcBalance, 6)
    );
    let withdrawShares = 100 * 1e6;
    console.log("-------------Users initial withdrawals---------------");
    // user 1 initates withdrawal
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(withdrawShares);
    await initiateWithdrawalTx1.wait();

    // user 2 initates withdrawal
    const initiateWithdrawalTx2 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(200 * 1e6);
    await initiateWithdrawalTx2.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(40 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    const getAllocatedRatio = await rockOnyxUSDTVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("getAllocatedRatio = %s", getAllocatedRatio);

    const roundWdAmount = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getRoundWithdrawAmount();

    console.log("roundWdAmount = %s", roundWdAmount);
    let usdcAmount = (roundWdAmount * getAllocatedRatio[2]) / BigInt(1e4);
    console.log("usdcAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), usdcAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(usdcAmount);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    // let user2Balance = await usdc.connect(user2).balanceOf(user2);

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    const completeWithdrawalTx2 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .completeWithdrawal(200 * 1e6);
    await completeWithdrawalTx2.wait();

    console.log("------------- Claim all fees ---------------");
    await completeWithdrawalTx.wait();
  });

  it("user deposit -> close round -> depoist -> init withdraw -> close round -> close round -> completed withdraw", async function () {
    console.log(
      "-------------calculate performance fee rockOnyxUSDTVault---------------"
    );

    console.log("-------------deposit time 1: 50$---------------");
    await deposit(user1, 50 * 1e6);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6);

    console.log("-------------initial withdrawals time 1: 5$---------------");
    const initiateWithdrawal1Tx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(5 * 1e6);
    await initiateWithdrawal1Tx.wait();

    console.log("-------------close round time 2---------------");
    const closeRound2Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound2Tx.wait();

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------close round time 3---------------");
    await closeRound2Tx.wait();

    console.log("-------------complete withdrawals 1---------------");
    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .completeWithdrawal(5 * 1e6);
    await completeWithdrawalTx.wait();

    let pps = await rockOnyxUSDTVaultContract.connect(admin).pricePerShare();
    console.log("pricePerShare", pps);
  });

  it("user deposit -> close round -> depoist -> init withdraw -> close round -> close round -> completed withdraw -> deposit", async function () {
    console.log(
      "-------------calculate performance fee rockOnyxUSDTVault---------------"
    );

    console.log("-------------deposit time 1: 50$---------------");
    await deposit(user1, 50 * 1e6);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("-------------initial withdrawals time 1: 5$---------------");
    const initiateWithdrawal1Tx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(5 * 1e6);
    await initiateWithdrawal1Tx.wait();

    console.log("-------------initial withdrawals time 2: 5$---------------");
    const initiateWithdrawal2Tx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(5 * 1e6);
    await initiateWithdrawal2Tx.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(30 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round time 2---------------");
    const closeRound2Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound2Tx.wait();

    const getAllocatedRatio = await rockOnyxUSDTVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("getAllocatedRatio = %s", getAllocatedRatio);

    const roundWdAmount = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getRoundWithdrawAmount();

    console.log("roundWdAmount = %s", roundWdAmount);
    let usdcAmount = (roundWdAmount * getAllocatedRatio[2]) / BigInt(1e4);
    console.log("usdceAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), usdcAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(usdcAmount);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------close round time 3---------------");
    const closeRound3Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound3Tx.wait();

    console.log("-------------complete withdrawals 1---------------");
    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .completeWithdrawal(5 * 1e6);
    await completeWithdrawalTx.wait();

    let pps = await rockOnyxUSDTVaultContract.connect(admin).pricePerShare();
    console.log("pricePerShare", pps);

    console.log("-------------deposit time 3: 50$---------------");
    await deposit(user1, 50 * 1e6);

    pps = await rockOnyxUSDTVaultContract.connect(admin).pricePerShare();
    console.log("pricePerShare", pps);

    console.log("-------------close round time 4---------------");
    const closeRound4Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound4Tx.wait();

    pps = await rockOnyxUSDTVaultContract.connect(admin).pricePerShare();
    console.log("pricePerShare", pps);
  });

  it("user deposit -> deposit to eavo -> mint eth -> mint usd-> update profit -> close round -> deposit", async function () {
    console.log("-------------deposit time: 50$---------------");
    await deposit(user1, 50 * 1e6);
    await deposit(user1, 100 * 1e6);
    await deposit(user1, 50 * 1e6);
    await deposit(user1, 5 * 1e6);
    await deposit(user1, 5 * 1e6);
    await deposit(user1, 5 * 1e6);
    await deposit(user1, 50 * 1e6);
    await deposit(user1, 600 * 1e6);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(30 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round time ---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    console.log("-------------deposit time 2: 50$---------------");
    await deposit(user1, 50 * 1e6);
  });

  it("user deposit -> deposit to eavo -> mint eth -> mint usd-> update profit -> close round -> decrease eth -> decrease usd -> mint new eth -> mint new usd", async function () {
    console.log("-------------deposit time: 50$---------------");
    const initialDepositAmount = 1000;
    await deposit(user1, 500 * 1e6);
    await deposit(user1, 500 * 1e6);

    // expect TVL = initialDepositAmount
    let totalValueLocked = await logAndReturnTotalValueLock();
    expect(Number(totalValueLocked) / 1e6).to.equal(initialDepositAmount);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("------------- mint ETH LP Position ---------------");
    // mint ETH LP position
    const mintEthLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(1448, 1474, 9030, 4);
    await mintEthLpPositionTx.wait();

    console.log("------------- get ETH LP State ---------------");
    const ethLPState = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getEthLPState();
    console.log("ETH LP State:", ethLPState);
    expect(ethLPState[1]).to.greaterThan(0);

    console.log("------------- mint USD LP Position ---------------");
    // mint USD LP position
    const mintUsdLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintUsdLPPosition(-2, 2, 4525, 4);
    await mintUsdLpPositionTx.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    // assume we have profit 5%
    const optionsBalance = 0.2 * initialDepositAmount * 1.05;

    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(optionsBalance * 1e6);

    await updateProfitTx.wait();

    console.log("-------------close round time ---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    // expect TVL = initialDepositAmount
    totalValueLocked = await logAndReturnTotalValueLock();
    expect(totalValueLocked).to.greaterThanOrEqual(
      initialDepositAmount + 0.2 * initialDepositAmount * 0.05
    );

    console.log("------------- Get Price Per Share ---------------");
    const pricePerShare1 = await rockOnyxUSDTVaultContract.pricePerShare();
    console.log("Price per Share:", Number(pricePerShare1.toString()) / 1e6);

    console.log("------------- decrease ETH LP Position ---------------");
    // decrease ETH LP position
    const decreaseEthLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .decreaseEthLPLiquidity(ethLPState[1]);
    await decreaseEthLpPositionTx.wait();

    const ethLPState2 = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getEthLPState();
    console.log("ETH LP State:", ethLPState2);
    expect(ethLPState2[4]).to.greaterThan(0);

    console.log("------------- decrease USD LP Position ---------------");
    // get usd lp state
    const usdLPStateBeforeDecreasing =
      await rockOnyxUSDTVaultContract.getUsdLPState();
    console.log("USD LP State before decreasing:", usdLPStateBeforeDecreasing);

    // decrease USD LP position
    const decreaseUsdLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .decreaseUsdLPLiquidity(usdLPStateBeforeDecreasing[1]);
    await decreaseUsdLpPositionTx.wait();

    const usdLPStateAfterDecreasing =
      await rockOnyxUSDTVaultContract.getUsdLPState();
    console.log("USD LP State after decreasing:", usdLPStateAfterDecreasing);

    const vaultUsdcBalance = await usdc.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log("USDC balance of vault contract:", vaultUsdcBalance.toString());
    expect(Number(vaultUsdcBalance) / 1e6).to.be.gt(initialDepositAmount * 0.5);

    const totalValueLocked2 = await logAndReturnTotalValueLock();
    // precision around 5% of TVL because we cannot control the eth price
    const precision = parseInt((Number(totalValueLocked) * 0.05).toString());
    console.log("precision %s", precision);
    expect(totalValueLocked2).to.approximately(totalValueLocked, precision);

    const ethLPStateAfterDecreasing = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getEthLPState();
    console.log("ETH LP State after mint:", ethLPStateAfterDecreasing);
    expect(ethLPStateAfterDecreasing[1]).to.eq(0);

    console.log("------------- Mint new ETH LP Position again ---------------");
    // mint new ETH LP position
    const mintEthLpPositionAgainTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(1458, 1486, 9030, 4);
    await mintEthLpPositionAgainTx.wait();

    const ethLPStateAfterMint = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getEthLPState();
    console.log("ETH LP State after mint:", ethLPStateAfterMint);
    expect(ethLPStateAfterMint[1]).to.greaterThan(0);

    console.log("------------- Mint new USD LP Position again ---------------");
    const usdLPStateBeforeMint =
      await rockOnyxUSDTVaultContract.getUsdLPState();
    console.log("USD LP State before Mint:", usdLPStateBeforeMint);
    // mint new USD LP position
    const mintUsdLpPositionAgainTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintUsdLPPosition(-2, 2, 4525, 4);
    await mintUsdLpPositionAgainTx.wait();

    const usdLPStateAfterMint = await rockOnyxUSDTVaultContract.getUsdLPState();
    console.log("USD LP State after mint:", usdLPStateAfterMint);
    expect(usdLPStateAfterMint[1]).to.greaterThan(0);

    console.log("------------- Get Price Per Share ---------------");
    const pricePerShare = await rockOnyxUSDTVaultContract.pricePerShare();
    console.log("Price per Share:", Number(pricePerShare.toString()) / 1e6);

    const vaultUsdcBalance2 = await usdc.balanceOf(
      await rockOnyxUSDTVaultContract.getAddress()
    );
    console.log(
      "USDC balance of vault contract:",
      vaultUsdcBalance2.toString()
    );

    // Assert that vaultUsdcBalance2 is not greater than 5% of totalValueLocked2
    expect(Number(vaultUsdcBalance2) / 1e6).to.be.lte(
      Number(totalValueLocked2) * 0.05
    );
  });

  it("migration test, user deposit -> close round -> depoist -> deposit to aevo -> init withdraw -> close round -> export data -> deploy new contract and import data", async function () {
    console.log("-------------deposit time 1: 50$---------------");
    await deposit(user1, 50 * 1e6);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6);

    console.log("-------------export vault state---------------");
    let exportVaultStateTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    let depositReceiptShares = exportVaultStateTx[3][0][1][0];
    let depositReceiptAmount = exportVaultStateTx[3][0][1][1];
    expect(Number(depositReceiptShares)).to.equal(55000965);
    expect(Number(depositReceiptAmount)).to.equal(55000000);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("-------------initial withdrawals time 1: 5$---------------");
    const initiateWithdrawal1Tx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(5 * 1e6);
    await initiateWithdrawal1Tx.wait();

    console.log("-------------initial withdrawals time 2: 5$---------------");
    const initiateWithdrawal2Tx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(5 * 1e6);
    await initiateWithdrawal2Tx.wait();

    console.log("-------------export vault state---------------");
    exportVaultStateTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    depositReceiptShares = exportVaultStateTx[3][0][1][0];
    depositReceiptAmount = exportVaultStateTx[3][0][1][1];
    let withdrawShares = exportVaultStateTx[4][0][1][0];

    expect(Number(depositReceiptShares)).to.equal(45000965);
    expect(Number(depositReceiptAmount)).to.equal(55000000);
    expect(Number(withdrawShares)).to.equal(10000000);

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(30 * 1e6);
    await updateProfitTx.wait();

    console.log("-------------close round time 2---------------");
    const closeRound2Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound2Tx.wait();

    console.log("-------------export vault state---------------");
    exportVaultStateTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[3][0]);
    console.log(exportVaultStateTx[4][0]);

    const rockOnyxUSDTVault = await ethers.getContractFactory(
      "RockOnyxUSDTVault"
    );

    const newRockOnyxUSDTVaultContract = await rockOnyxUSDTVault.deploy(
      usdcAddress,
      await camelotLiquidityContract.getAddress(),
      rewardAddress,
      nftPositionAddress,
      await camelotSwapContract.getAddress(),
      await aevoContract.getAddress(),
      await optionsReceiver.getAddress(),
      usdceAddress,
      wethAddress,
      wstethAddress,
      arbAddress,
      BigInt(0 * 1e6)
    );
    await rockOnyxUSDTVaultContract.waitForDeployment();

    console.log(
      "deploy newRockOnyxUSDTVaultContract successfully: %s",
      await newRockOnyxUSDTVaultContract.getAddress()
    );

    console.log("-------------import vault state---------------");
    const _currentRound = exportVaultStateTx[0];
    const _roundWithdrawalShares = [...exportVaultStateTx[1]];
    const _roundPricePerShares = [...exportVaultStateTx[2]];

    const _depositReceiptArr = exportVaultStateTx[3].map((element) => {
      return {
        owner: element[0],
        depositReceipt: {
          shares: element[1][0],
          depositAmount: element[1][1],
        },
      };
    });

    const _withdrawalArr = exportVaultStateTx[4].map((element) => {
      return {
        owner: element[0],
        withdrawal: {
          shares: element[1][0],
          round: element[1][1],
        },
      };
    });

    const _vaultParams = {
      decimals: exportVaultStateTx[5][0],
      asset: exportVaultStateTx[5][1],
      minimumSupply: exportVaultStateTx[5][2],
      cap: exportVaultStateTx[5][3],
      performanceFeeRate: exportVaultStateTx[5][4],
      managementFeeRate: exportVaultStateTx[5][5],
    };

    const _vaultState = {
      performanceFeeAmount: exportVaultStateTx[6][0],
      managementFeeAmount: exportVaultStateTx[6][1],
      currentRoundFeeAmount: exportVaultStateTx[6][2],
      withdrawPoolAmount: exportVaultStateTx[6][3],
      pendingDepositAmount: exportVaultStateTx[6][4],
      totalShares: exportVaultStateTx[6][5],
      lastLockedAmount: exportVaultStateTx[6][6],
    };

    const _allocateRatio = {
      ethLPRatio: exportVaultStateTx[7][0],
      usdLPRatio: exportVaultStateTx[7][1],
      optionsRatio: exportVaultStateTx[7][2],
      decimals: exportVaultStateTx[7][3],
    };

    const _ethLPState = {
      tokenId: exportVaultStateTx[8][0],
      liquidity: exportVaultStateTx[8][1],
      lowerTick: exportVaultStateTx[8][2],
      upperTick: exportVaultStateTx[8][3],
      unAllocatedBalance: exportVaultStateTx[8][4],
    };

    const _usdLPState = {
      tokenId: exportVaultStateTx[9][0],
      liquidity: exportVaultStateTx[9][1],
      lowerTick: exportVaultStateTx[9][2],
      upperTick: exportVaultStateTx[9][3],
      unAllocatedUsdcBalance: exportVaultStateTx[9][4],
      unAllocatedUsdceBalance: exportVaultStateTx[9][5],
    };

    const _optiondsState = {
      allocatedUsdcBalance: exportVaultStateTx[10][0],
      unAllocatedUsdcBalance: exportVaultStateTx[10][1],
      unsettledProfit: exportVaultStateTx[10][2],
      unsettledLoss: exportVaultStateTx[10][3],
    };

    const importVaultStateTx = await newRockOnyxUSDTVaultContract
      .connect(admin)
      .importVaultState(
        _currentRound,
        _roundWithdrawalShares,
        _roundPricePerShares,
        _depositReceiptArr,
        _withdrawalArr,
        _vaultParams,
        _vaultState,
        _allocateRatio,
        _ethLPState,
        _usdLPState,
        _optiondsState
      );

    console.log("-------------export vault state---------------");
    const exportVaultStateTx2 = await newRockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    console.log(exportVaultStateTx2);
    console.log(exportVaultStateTx2[3][0]);
    console.log(exportVaultStateTx2[4][0]);
  });

  it("emergencyShutdown", async function () {
    await deposit(user1, 500 * 1e6);

    console.log("-------------emergencyShutdown---------------");
    await rockOnyxUSDTVaultContract
      .connect(admin)
      .emergencyShutdown(admin, usdc, 500 * 1e6);
  });

  it("user deposit -> deposit to eavo -> mint eth -> mint usd-> update profit -> close round -> decrease eth -> decrease usd", async function () {
    console.log("-------------deposit time: 50$---------------");
    const initialDepositAmount = 50;
    await deposit(user1, 50 * 1e6);

    // expect TVL = initialDepositAmount
    let totalValueLocked = await logAndReturnTotalValueLock();
    expect(Number(totalValueLocked) / 1e6).to.equal(initialDepositAmount);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("------------- mint ETH LP Position ---------------");
    // mint ETH LP position
    const mintEthLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(1475, 1499, 9000, 4);
    await mintEthLpPositionTx.wait();

    console.log("------------- get ETH LP State ---------------");
    const ethLPState = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getEthLPState();
    console.log("ETH LP State:", ethLPState);
    expect(ethLPState[1]).to.greaterThan(0);

    console.log("------------- mint USD LP Position ---------------");
    // mint USD LP position
    const mintUsdLpPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintUsdLPPosition(-2, 2, 4375, 4);
    await mintUsdLpPositionTx.wait();

    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    // assume we have profit 5%
    const optionsBalance = 10;

    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(optionsBalance * 1e6);

    await updateProfitTx.wait();

    console.log("-------------close round time ---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(20 * 1e6);
    await initiateWithdrawalTx1.wait();

    // assume we have profit 5%
    console.log("-------------close round 2 time ---------------");
    const closeRoundTx2 = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx2.wait();

    const usdcAmount = 4.850591 * 1e6;
    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), usdcAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(usdcAmount);

    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();
  });

  // https://arbiscan.io/address/0x55c4c840F9Ac2e62eFa3f12BaBa1B57A1208B6F5
  // it("deposit error", async function () {
  //   console.log(
  //     "-------------deposit error 0x55c4c840F9Ac2e62eFa3f12BaBa1B57A1208B6F5---------------"
  //   );
  //   rockOnyxUSDTVaultContract = await ethers.getContractAt(
  //     "RockOnyxUSDTVault",
  //     "0x55c4c840F9Ac2e62eFa3f12BaBa1B57A1208B6F5"
  //   );

  //   console.log("-------------deposit time 1: 50$---------------");

  //   await usdc
  //     .connect(user1)
  //     .approve(await rockOnyxUSDTVaultContract.getAddress(), 50 * 1e6);

  //   console.log(
  //     "rockOnyxUSDTVaultContract address: ",
  //     await rockOnyxUSDTVaultContract.getAddress()
  //   );
  //   await rockOnyxUSDTVaultContract.connect(user1).deposit(50 * 1e6);
  // });
});
