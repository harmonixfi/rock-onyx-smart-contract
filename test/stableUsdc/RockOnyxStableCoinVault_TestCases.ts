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
  USDT_ADDRESS,
  DAI_ADDRESS,
  NonfungiblePositionManager,
  SWAP_ROUTER_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDCE_IMPERSONATED_SIGNER_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  DAI_IMPERSONATED_SIGNER_ADDRESS,
  NFT_POSITION_ADDRESS,
  ANGLE_REWARD_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH_ETH_PRICE_FEED_ADDRESS,
  USDC_PRICE_FEED_ADDRESS,
  ARB_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  NETWORK_COST
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
  let camelotSwapContract: Contracts.CamelotSwap;
  let priceConsumerContract: Contracts.PriceConsumer;
  let uniSwapContract: Contracts.UniSwap;

  let usdc: Contracts.IERC20;
  let usdce: Contracts.IERC20;
  let wsteth: Contracts.IERC20;
  let usdt: Contracts.IERC20;
  let dai: Contracts.IERC20;

  const PRECISION = 2 * 1e6;

  const nftPositionAddress = NFT_POSITION_ADDRESS[chainId];
  const rewardAddress = ANGLE_REWARD_ADDRESS[chainId];
  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdceImpersonatedSigner = USDCE_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const nonfungiblePositionManager = NonfungiblePositionManager[chainId];
  const usdcAddress = USDC_ADDRESS[chainId];
  const usdceAddress = USDCE_ADDRESS[chainId];
  const wstethAddress = WSTETH_ADDRESS[chainId];
  const wethAddress = WETH_ADDRESS[chainId];
  const arbAddress = ARB_ADDRESS[chainId];
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId];
  const uniSwapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];

  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const wsteth_ethPriceFeed = WSTETH_ETH_PRICE_FEED_ADDRESS[chainId];
  const usdcePriceFeed = USDC_PRICE_FEED_ADDRESS[chainId];
  const arbPriceFeed = ARB_PRICE_FEED_ADDRESS[chainId];
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId];
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");
    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, wstethAddress, usdceAddress, arbAddress, usdtAddress, daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdcAddress, usdcAddress, usdtAddress],
      [ethPriceFeed, wsteth_ethPriceFeed, usdcePriceFeed, arbPriceFeed, usdtPriceFeed, daiPriceFeed]
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
    camelotSwapContract = await factory.deploy(admin, swapRouterAddress, priceConsumerContract.getAddress());
    await camelotSwapContract.waitForDeployment();

    console.log(
      "Deployed Camelot Swap contract at address %s",
      await camelotSwapContract.getAddress()
    );
  }

  async function deployUniSwapContract() {
    const factory = await ethers.getContractFactory("UniSwap");
    uniSwapContract = await factory.deploy(
      admin,
      uniSwapRouterAddress,
      priceConsumerContract.getAddress()
    );
    await uniSwapContract.waitForDeployment();

    console.log(
      "Deployed uni swap contract at address %s",
      await uniSwapContract.getAddress()
    );
  }

  async function deployRockOnyxUSDTVault() {
    const rockOnyxUSDTVault = await ethers.getContractFactory(
      "RockOnyxUSDTVault"
    );

    
    rockOnyxUSDTVaultContract = await upgrades.deployProxy(
      rockOnyxUSDTVault,
      [
        await admin.getAddress(),
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        networkCost,
        await camelotLiquidityContract.getAddress(),
        rewardAddress,
        nftPositionAddress,
        await camelotSwapContract.getAddress(),
        aevoAddress,
        await optionsReceiver.getAddress(),
        aevoConnectorAddress,
        usdceAddress,
        wethAddress,
        wstethAddress,
        arbAddress,
        BigInt(0 * 1e6),
        await uniSwapContract.getAddress(),
        [usdtAddress, daiAddress],
        [usdcAddress, usdtAddress],
        [100, 100],
      ],
      { initializer: "initialize" }
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
    usdt = await ethers.getContractAt("IERC20", usdtAddress);
    dai = await ethers.getContractAt("IERC20", daiAddress);
    wsteth = await ethers.getContractAt("IERC20", wstethAddress);

    await deployPriceConsumerContract();
    await deployCamelotLiquidity();
    await deployCamelotSwapContract();
    await deployUniSwapContract();
    await deployRockOnyxUSDTVault();
  });

   // Helper function for deposit
   async function deposit(sender: Signer, amount: BigNumberish, token: Contracts.IERC20, tokenTransit: Contracts.IERC20) {
    await token
      .connect(sender)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), amount);

    await rockOnyxUSDTVaultContract.connect(sender).deposit(amount, token, tokenTransit);
  }

  async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
    const transferTx = await token.connect(from).transfer(to, amount);
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
    const usdcSigner = await ethers.getImpersonatedSigner(usdcImpersonatedSigner);
    const usdtSigner = await ethers.getImpersonatedSigner(usdtImpersonatedSigner);
    const daiSigner = await ethers.getImpersonatedSigner(daiImpersonatedSigner);
    const usdceSigner = await ethers.getImpersonatedSigner(usdceImpersonatedSigner);

    await transferForUser(usdc, usdcSigner, user1, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user2, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user3, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user4, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, optionsReceiver, 10000 * 1e6);
    await transferForUser(usdce, usdceSigner, optionsReceiver, 1000 * 1e6);
    await transferForUser(usdt, usdtSigner, user2, 100000 * 1e6);
    await transferForUser(dai, daiSigner, user2, BigInt(100000 * 1e18));
  });

  it("deposit to rockOnyxUSDTVault, WETH in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 50 * 1e6, usdt, usdt);
    await deposit(user2, BigInt(51 * 1e18), dai, usdt);

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
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    let completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(50 * 1e6);
    await completeWithdrawalTx.wait();

    let user2BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user2BalanceAfterWithdraw);
    expect(user2BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(50 * 1e6),
      PRECISION
    );

    completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user2)
      .completeWithdrawal(50 * 1e6);
    await completeWithdrawalTx.wait();

    user2BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user2BalanceAfterWithdraw);
    expect(user2BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(99 * 1e6),
      PRECISION
    );
  });

  it("deposit to rockOnyxUSDTVault, wstETH in pending amount, should handle acquireWithdrawalFunds correctly", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

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
    expect(totalValueLock2).to.approximately(110 * 1e6, PRECISION);

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
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

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
    expect(totalValueLock2).to.approximately(110 * 1e6, PRECISION);

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
    await deposit(user2, 100 * 1e6, usdc, usdc);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 200 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 200 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    console.log("-------------mintUsdLP position on Camelot---------------");

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 50 * 1e6, usdc, usdc);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6, usdc, usdc);

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
    await deposit(user1, 50 * 1e6, usdc, usdc);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6, usdc, usdc);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 50 * 1e6, usdc, usdc);

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
    await deposit(user1, 50 * 1e6, usdc, usdc);
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user1, 50 * 1e6, usdc, usdc);
    await deposit(user1, 5 * 1e6, usdc, usdc);
    await deposit(user1, 5 * 1e6, usdc, usdc);
    await deposit(user1, 5 * 1e6, usdc, usdc);
    await deposit(user1, 50 * 1e6, usdc, usdc);
    await deposit(user1, 600 * 1e6, usdc, usdc);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 50 * 1e6, usdc, usdc);
  });

  it("user deposit -> deposit to eavo -> mint eth -> mint usd-> update profit -> close round -> decrease eth -> decrease usd -> mint new eth -> mint new usd", async function () {
    console.log("-------------deposit time: 50$---------------");
    const initialDepositAmount = 1000;
    await deposit(user1, 500 * 1e6, usdc, usdc);
    await deposit(user1, 500 * 1e6, usdc, usdc);

    // expect TVL = initialDepositAmount
    let totalValueLocked = await logAndReturnTotalValueLock();
    expect(Number(totalValueLocked) / 1e6).to.equal(initialDepositAmount);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
    await deposit(user1, 50 * 1e6, usdc, usdc);

    console.log("-------------close round time 1---------------");
    const closeRound1Tx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRound1Tx.wait();

    console.log("-------------deposit time 2: 5$---------------");
    await deposit(user1, 5 * 1e6, usdc, usdc);

    console.log("-------------export vault state---------------");
    let exportVaultStateTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    let depositReceiptShares = exportVaultStateTx[3][0][1][0];
    let depositReceiptAmount = exportVaultStateTx[3][0][1][1];
    expect(Number(depositReceiptShares)).to.equal(55000000);
    expect(Number(depositReceiptAmount)).to.equal(55000000);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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

    expect(Number(depositReceiptShares)).to.equal(45000000);
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

    console.log("currentRound %s", exportVaultStateTx[0]);
    console.log("exportRoundWithdrawalShares %s", exportVaultStateTx[1]);
    console.log("exportRoundPricePerShares %s", exportVaultStateTx[2]);
    console.log("depositReceiptArr %s", exportVaultStateTx[3]);
    console.log("withdrawalArr %s", exportVaultStateTx[4]);
    console.log("vaultParams %s", exportVaultStateTx[5]);
    console.log("vaultState %s", exportVaultStateTx[6]);
    console.log("allocateRatio %s", exportVaultStateTx[7]);
    console.log("ethLPState %s", exportVaultStateTx[8]);
    console.log("usdLPState %s", exportVaultStateTx[9]);
    console.log("optionsState %s", exportVaultStateTx[10]);

    const rockOnyxUSDTVault = await ethers.getContractFactory(
      "RockOnyxUSDTVault"
    );

    const newRockOnyxUSDTVaultContract = await rockOnyxUSDTVault.deploy(
      await admin.getAddress(),
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      await camelotLiquidityContract.getAddress(),
      rewardAddress,
      nftPositionAddress,
      await camelotSwapContract.getAddress(),
      aevoAddress,
      await optionsReceiver.getAddress(),
      aevoConnectorAddress,
      usdceAddress,
      wethAddress,
      wstethAddress,
      arbAddress,
      BigInt(0 * 1e6),
      await uniSwapContract.getAddress(),
      [usdtAddress, daiAddress],
      [usdcAddress, usdtAddress],
      [100, 100]
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
      managementFeeRate: exportVaultStateTx[5][5]
    };
    const _vaultState = {
      withdrawPoolAmount: exportVaultStateTx[6][0],
      pendingDepositAmount: exportVaultStateTx[6][1],
      totalShares: exportVaultStateTx[6][2],
      totalFeePoolAmount: exportVaultStateTx[6][3],
      lastUpdateManagementFeeDate: exportVaultStateTx[6][4],
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
    exportVaultStateTx = await newRockOnyxUSDTVaultContract
      .connect(admin)
      .exportVaultState();

    console.log("currentRound %s", exportVaultStateTx[0]);
    console.log("exportRoundWithdrawalShares %s", exportVaultStateTx[1]);
    console.log("exportRoundPricePerShares %s", exportVaultStateTx[2]);
    console.log("depositReceiptArr %s", exportVaultStateTx[3]);
    console.log("withdrawalArr %s", exportVaultStateTx[4]);
    console.log("vaultParams %s", exportVaultStateTx[5]);
    console.log("vaultState %s", exportVaultStateTx[6]);
    console.log("allocateRatio %s", exportVaultStateTx[7]);
    console.log("ethLPState %s", exportVaultStateTx[8]);
    console.log("usdLPState %s", exportVaultStateTx[9]);
    console.log("optionsState %s", exportVaultStateTx[10]);
  });

  it("user deposit -> deposit to eavo -> mint eth -> mint usd-> update profit -> close round -> decrease eth -> decrease usd", async function () {
    console.log("-------------deposit time: 50$---------------");
    const initialDepositAmount = 50;
    await deposit(user1, 50 * 1e6, usdc, usdc);

    // expect TVL = initialDepositAmount
    let totalValueLocked = await logAndReturnTotalValueLock();
    expect(Number(totalValueLocked) / 1e6).to.equal(initialDepositAmount);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
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
});
