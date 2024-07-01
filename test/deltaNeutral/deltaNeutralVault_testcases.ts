const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDCE_ADDRESS,
  WSTETH_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH_ETH_PRICE_FEED_ADDRESS,
  USDC_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  DAI_IMPERSONATED_SIGNER_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  NETWORK_COST,
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ", chainId);
const PRECISION = 2 * 1e6;

describe("RockOnyxDeltaNeutralVault", function () {
  let admin: Signer, user1: Signer, user2: Signer, user3: Signer, user4: Signer;

  let optionsReceiver: Signer;

  let rockOnyxDeltaNeutralVaultContract: Contracts.RockOnyxDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let wsteth: Contracts.IERC20;
  let usdt: Contracts.IERC20;
  let dai: Contracts.IERC20;

  let aevoContract: Contracts.Aevo;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const usdceAddress = USDCE_ADDRESS[chainId] || "";
  const wstethAddress = WSTETH_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId];
  const uniSwapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const wsteth_ethPriceFeed = WSTETH_ETH_PRICE_FEED_ADDRESS[chainId];
  const usdcePriceFeed = USDC_PRICE_FEED_ADDRESS[chainId];
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId];
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let priceConsumerContract: Contracts.PriceConsumer;
  let camelotSwapContract: Contracts.CamelotSwap;
  let uniSwapContract: Contracts.UniSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");
    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, wstethAddress, usdceAddress, usdtAddress, daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdcAddress, usdtAddress],
      [
        ethPriceFeed,
        wsteth_ethPriceFeed,
        usdcePriceFeed,
        usdtPriceFeed,
        daiPriceFeed,
      ]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deployCamelotSwapContract() {
    const factory = await ethers.getContractFactory("CamelotSwap");
    camelotSwapContract = await factory.deploy(
      admin,
      swapRouterAddress,
      priceConsumerContract.getAddress()
    );
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

  async function deployUniSwapContract() {
    const factory = await ethers.getContractFactory("UniSwap");
    uniSwapContract = await factory.deploy(
      admin,
      uniSwapRouterAddress,
      priceConsumerContract.getAddress(),
      chainId
    );
    await uniSwapContract.waitForDeployment();

    console.log(
      "Deployed uni swap contract at address %s",
      await uniSwapContract.getAddress()
    );
  }

  async function deployRockOnyxDeltaNeutralVault() {
    const rockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    rockOnyxDeltaNeutralVaultContract = await upgrades.deployProxy(
      rockOnyxDeltaNeutralVault,
      [
        await admin.getAddress(),
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        networkCost,
        await camelotSwapContract.getAddress(),
        await aevoContract.getAddress(),
        await optionsReceiver.getAddress(),
        wethAddress,
        wstethAddress,
        BigInt(1 * 1e6),
        await uniSwapContract.getAddress(),
        [usdtAddress, daiAddress],
        [usdcAddress, usdtAddress],
        [100, 100],
      ],
      { initializer: "initialize" }
    );
    await rockOnyxDeltaNeutralVaultContract.waitForDeployment();

    console.log(
      "deploy rockOnyxDeltaNeutralVaultContract successfully: %s",
      await rockOnyxDeltaNeutralVaultContract.getAddress()
    );
  }

  beforeEach(async function () {
    [admin, optionsReceiver, user1, user2, user3, user4] =
      await ethers.getSigners();

    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdt = await ethers.getContractAt("IERC20", usdtAddress);
    dai = await ethers.getContractAt("IERC20", daiAddress);
    wsteth = await ethers.getContractAt("IERC20", wstethAddress);

    await deployPriceConsumerContract();
    await deployCamelotSwapContract();
    await deployUniSwapContract();
    await deployAevoContract();
    await deployRockOnyxDeltaNeutralVault();
  });

  // Helper function for deposit
  async function deposit(
    sender: Signer,
    amount: BigNumberish,
    token: Contracts.IERC20,
    tokenTransit: Contracts.IERC20
  ) {
    await token
      .connect(sender)
      .approve(await rockOnyxDeltaNeutralVaultContract.getAddress(), amount);

    await rockOnyxDeltaNeutralVaultContract
      .connect(sender)
      .deposit(amount, token, tokenTransit);
  }

  async function transferForUser(
    token: Contracts.IERC20,
    from: Signer,
    to: Signer,
    amount: BigNumberish
  ) {
    const transferTx = await token.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  // define function getWstEthPrice
  async function getWstEthPrice() {
    const wstEthAmount = 1; // we convert 1 wstEth to usdc
    const price = await camelotSwapContract.getPriceOf(
      wstethAddress,
      wethAddress
    );

    // convert wstEth to eth, parse price BigInt to float
    const ethAmount = (wstEthAmount * parseFloat(price.toString())) / 1e18;

    // get eth price in usdc
    const ethPrice = await camelotSwapContract.getPriceOf(
      wethAddress,
      usdcAddress
    );

    // convert eth to usdc
    const usdcAmount = (ethAmount * parseFloat(ethPrice.toString())) / 1e6;

    return usdcAmount;
  }

  // define function getWstEthPrice
  async function getWstEthToEthPrice() {
    const price = await camelotSwapContract.getPriceOf(
      wstethAddress,
      wethAddress
    );

    return price;
  }

  async function getEthPrice() {
    // get current priceOf from CamelotSwapContract
    const _ethPrice = await camelotSwapContract.getPriceOf(
      wethAddress,
      usdcAddress
    );
    // parse priceOf to float
    const ethPrice = parseFloat(_ethPrice.toString()) / 1e6;
    console.log("ethPrice %s", ethPrice);
    return ethPrice;
  }

  it.skip("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );
    const usdtSigner = await ethers.getImpersonatedSigner(
      usdtImpersonatedSigner
    );
    const daiSigner = await ethers.getImpersonatedSigner(daiImpersonatedSigner);

    await transferForUser(usdc, usdcSigner, user1, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user2, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user3, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, user4, 10000 * 1e6);
    await transferForUser(usdc, usdcSigner, optionsReceiver, 1000 * 1e6);

    await transferForUser(usdt, usdtSigner, user2, 100000 * 1e6);
    await transferForUser(dai, daiSigner, user2, BigInt(100000 * 1e18));
  });

  it.skip("user deposit -> withdraw, do not deposit to perp dex", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 50 * 1e6, usdt, usdt);
    await deposit(user2, BigInt(50 * 1e18), dai, usdt);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(99 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(49957050n + 49957050n);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .completeWithdrawal(99 * 1e6);
    await completeWithdrawalTx.wait();

    let user2BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user2BalanceAfterWithdraw);
    expect(user2BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(98 * 1e6),
      PRECISION
    );
  });

  it.skip("user deposit -> open position -> close position -> withdraw, do not deposit to perp dex", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();

    console.log("-------------close position---------------");
    const closePositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .closePosition(BigInt(0.01 * 1e18));
    await closePositionTx.wait();

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------acquireWithdrawalFunds---------------");
    const acquireWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(49957050n + 49957050n);
    await acquireWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
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

  it.skip("user deposit -> open position -> deposit to vender -> withdraw", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxDeltaNeutralVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------close position---------------");
    const closePositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .closePosition(BigInt(0.01 * 1e18));
    await closePositionTx.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    // 49957050 49957050
    const usdcAmount = 49957050n;
    console.log("usdcAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(
        await rockOnyxDeltaNeutralVaultContract.getAddress(),
        usdcAmount
      );

    const handlePostWithdrawTx = await rockOnyxDeltaNeutralVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawFromVendor(usdcAmount);
    await handlePostWithdrawTx.wait();

    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(49957050n + 49957050n);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(99 * 1e6),
      PRECISION
    );
  });

  it.skip("user deposit1 -> open position -> deposit to vender -> user deposit2 -> open position -> deposit to vender -> withdraw", async function () {
    console.log(
      "-------------deposit1 to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);
    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position1---------------");
    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxDeltaNeutralVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log(
      "-------------deposit2 to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user2, 100 * 1e6, usdc, usdc);

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(210 * 1e6, PRECISION);

    console.log("-------------open position 2---------------");
    const openPosition1Tx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPosition1Tx.wait();

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxDeltaNeutralVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(210 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------close position---------------");
    const closePositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .closePosition(BigInt(0.01 * 1e18));
    await closePositionTx.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    // 49957050 49957050
    const usdcAmount = 49957050n;
    console.log("usdcAmount %s", usdcAmount);

    await usdc
      .connect(optionsReceiver)
      .approve(
        await rockOnyxDeltaNeutralVaultContract.getAddress(),
        usdcAmount
      );

    const handlePostWithdrawTx = await rockOnyxDeltaNeutralVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawFromVendor(usdcAmount);
    await handlePostWithdrawTx.wait();

    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(49957050n + 49957050n);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
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

  it.skip("user deposit -> deposit to vendor -> open position -> sync profit -> withdraw -> close position -> complete withdraw", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );

    const inititalDeposit = 10 + 100;
    const user2_initDeposit = 100;

    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, user2_initDeposit * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    // parse totalValueLock to float
    let tvlNumber = parseFloat(totalValueLock.toString()) / 1e6;

    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxDeltaNeutralVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("-------------open position---------------");
    let ethPrice = await getEthPrice();

    // calculate eth amount for totalvaluelocked / 2 usd amount
    // round ethAmount to 2 decimal places
    const ethAmount = parseFloat(
      (Math.floor((tvlNumber / 2 / ethPrice) * 100) / 100).toFixed(2)
    );
    console.log("ethAmount to open position %s", ethAmount);

    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(ethAmount * 1e18));
    await openPositionTx.wait();

    // get ETH balance of rockOnyxDeltaNeutralVaultContract
    const wstEthBalance1 = await wsteth.balanceOf(
      await rockOnyxDeltaNeutralVaultContract.getAddress()
    );
    console.log(
      "wstETH balance of rockOnyxDeltaNeutralVaultContract: ",
      Number(wstEthBalance1.toString()) / 1e18
    );

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------sync derpDex balance---------------");
    // assume that the funding fee return 0.01% every 1 hour
    // we sync balance after 7 days
    // get balanceOf wstEth for rockOnyxDeltaNeutralVaultContract
    const wstEthBalance = await wsteth.balanceOf(
      await rockOnyxDeltaNeutralVaultContract.getAddress()
    );
    console.log("wstEthBalance %s", wstEthBalance);

    // get wstEthPrice
    const wstEthPrice = await getWstEthPrice();
    const spotBalance =
      wstEthPrice * (parseFloat(wstEthBalance.toString()) / 1e18);

    const allocatedToPerp = inititalDeposit - spotBalance; // we assume that the spot - perp no loss
    const dexBalance = allocatedToPerp * (1 + 0.0001 * 7 * 24);
    console.log("dexBalance %s", dexBalance);

    const syncDerpDexBalanceTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .syncBalance(BigInt(parseInt((dexBalance * 1e6).toString())));
    await syncDerpDexBalanceTx.wait();

    // get current price per share from contract
    const pricePerShare = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .pricePerShare();
    console.log("pricePerShare %s", pricePerShare);
    expect(pricePerShare).to.greaterThan(1 * 1e6);

    totalValueLock = await logAndReturnTotalValueLock();
    console.log("inititalDeposit %s", inititalDeposit);
    expect(totalValueLock).to.approximately(
      BigInt(parseInt((inititalDeposit / 2 + dexBalance).toString()) * 1e6),
      PRECISION
    );

    // get user profit & loss
    console.log("-------------get user profit & loss---------------");
    const userVaultState = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .getUserVaultState();
    const user2Profit = Number(userVaultState[2]) / 1e6;
    console.log("user profit: ", user2Profit);

    console.log("-------------Users initial withdrawals---------------");
    const withdrawalShares = 100;
    const withdrawalAmount =
      (withdrawalShares * parseFloat(pricePerShare.toString())) / 1e6;
    console.log("withdrawalAmount %s", withdrawalAmount);

    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(withdrawalShares * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log(
      "------------- close position to release fund for user ---------------"
    );
    // get allocatedRatio ratio from vault
    const allocatedRatio2 = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("allocatedRatio %s", allocatedRatio2);

    const stakingRatio = parseFloat(allocatedRatio2[0].toString()) / 1e4;
    const perpRatio = parseFloat(allocatedRatio2[1].toString()) / 1e4;
    const withdrawalAmountInSpot = withdrawalAmount * stakingRatio;
    console.log("withdrawalAmountInSpot %s", withdrawalAmountInSpot);
    const withdrawalAmountInPerp = withdrawalAmount * perpRatio;
    console.log("withdrawalAmountInPerp %s", withdrawalAmountInPerp);

    // calculate eth amount from withdrawalAmount
    ethPrice = await getEthPrice();
    let withdrawalEthAmount = withdrawalAmountInSpot / ethPrice;
    console.log("withdrawalEthAmount %s", withdrawalEthAmount);
    withdrawalEthAmount = Math.ceil(withdrawalEthAmount * 100) / 100;
    console.log("ethAmountFromUsd %s", withdrawalEthAmount);

    // estimate the ETH balance based on wstEthBalance
    let wstEthEthPrice = await getWstEthToEthPrice();
    const estimatedEthAmount =
      (parseFloat(wstEthBalance.toString()) / 1e18) *
      (Number(wstEthEthPrice) / 1e18);
    console.log("estimated ETH balance: ", estimatedEthAmount);

    // we can't sell more than we have, so sell all if the withdrawal amount > vault's eth balance
    withdrawalEthAmount = Math.min(estimatedEthAmount, withdrawalEthAmount);
    console.log("withdrawalEthAmount 2: %s", withdrawalEthAmount);

    const closePositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .closePosition(BigInt(withdrawalEthAmount * 1e18));
    await closePositionTx.wait();

    console.log("------------- trader send fund back to vault ---------------");
    // optionsReceiver approve usdc to vault
    const amountToSend = BigInt(
      parseInt((withdrawalAmountInPerp * 1e6).toString())
    );
    await usdc
      .connect(optionsReceiver)
      .approve(
        await rockOnyxDeltaNeutralVaultContract.getAddress(),
        amountToSend
      );

    // optionsReceiver call handlePostWithdrawFromVendor to return withdrawalAmountInPerp to vault
    const handlePostWithdrawTx = await rockOnyxDeltaNeutralVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawFromVendor(amountToSend);
    await handlePostWithdrawTx.wait();

    console.log("-------------acquireWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(withdrawalAmount * 1e6);
    await handleWithdrawalFundsTx.wait();

    // get getPerpDexUnAllocatedBalance from contract
    const perpDexState =
      await rockOnyxDeltaNeutralVaultContract.getPerpDexState();
    console.log("perpDexUnAllocatedBalance: ", perpDexState);

    const perpDexBalance = perpDexState[0];

    const pricePerShare2 = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .pricePerShare();
    console.log("pricePerShare2 %s", pricePerShare2);
    const pricePerShare2Int = Number(pricePerShare2) / 1e6;
    console.log("pricePerShare2Int %s", pricePerShare2Int);

    const expectedPerpDexBalance = 10 * pricePerShare2Int * perpRatio;
    console.log("expectedPerpDexBalance %s", expectedPerpDexBalance);
    console.log("perpRatio %s", perpRatio);

    expect(perpDexBalance).to.approximately(
      BigInt(parseInt((expectedPerpDexBalance * 1e6).toString())),
      2 * 1e6
    );

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", Number(user2Balance) / 1e6);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log(
      "usdc of user after withdraw %s",
      Number(user1BalanceAfterWithdraw) / 1e6
    );

    const expectedUser2Balance =
      Number(user2Balance) / 1e6 + user2_initDeposit * (1 + user2Profit);
    console.log("expectedUser2Balance %s", expectedUser2Balance);
    expect(user1BalanceAfterWithdraw).to.approximately(
      BigInt(parseInt((expectedUser2Balance * 1e6).toString())),
      PRECISION
    );
  });

  it.skip("migration test, user deposit -> deposit to vendor -> open position -> sync profit -> withdraw -> close position -> complete withdraw -> migration", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );

    const inititalDeposit = 10 + 100;
    const user2_initDeposit = 100;

    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, user2_initDeposit * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    let tvlNumber = parseFloat(totalValueLock.toString()) / 1e6;

    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxDeltaNeutralVaultContract.connect(admin).depositToVendor({
      value: ethers.parseEther("0.000159539385325246"),
    });

    console.log("-------------open position---------------");
    let ethPrice = await getEthPrice();

    // calculate eth amount for totalvaluelocked / 2 usd amount
    // round ethAmount to 2 decimal places
    const ethAmount = parseFloat(
      (Math.floor((tvlNumber / 2 / ethPrice) * 100) / 100).toFixed(2)
    );
    console.log("ethAmount to open position %s", ethAmount);

    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(ethAmount * 1e18));
    await openPositionTx.wait();

    // get ETH balance of rockOnyxDeltaNeutralVaultContract
    const wstEthBalance1 = await wsteth.balanceOf(
      await rockOnyxDeltaNeutralVaultContract.getAddress()
    );
    console.log(
      "wstETH balance of rockOnyxDeltaNeutralVaultContract: ",
      Number(wstEthBalance1.toString()) / 1e18
    );

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------sync derpDex balance---------------");
    // assume that the funding fee return 0.01% every 1 hour
    // we sync balance after 7 days
    // get balanceOf wstEth for rockOnyxDeltaNeutralVaultContract
    const wstEthBalance = await wsteth.balanceOf(
      await rockOnyxDeltaNeutralVaultContract.getAddress()
    );
    console.log("wstEthBalance %s", wstEthBalance);

    // get wstEthPrice
    const wstEthPrice = await getWstEthPrice();
    const spotBalance =
      wstEthPrice * (parseFloat(wstEthBalance.toString()) / 1e18);

    const allocatedToPerp = inititalDeposit - spotBalance; // we assume that the spot - perp no loss
    const dexBalance = allocatedToPerp * (1 + 0.0001 * 7 * 24);
    console.log("dexBalance %s", dexBalance);

    const syncDerpDexBalanceTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .syncBalance(BigInt(parseInt((dexBalance * 1e6).toString())));
    await syncDerpDexBalanceTx.wait();

    // get current price per share from contract
    const pricePerShare = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .pricePerShare();
    console.log("pricePerShare %s", pricePerShare);
    expect(pricePerShare).to.greaterThan(1 * 1e6);

    totalValueLock = await logAndReturnTotalValueLock();
    console.log("inititalDeposit %s", inititalDeposit);
    expect(totalValueLock).to.approximately(
      BigInt(parseInt((inititalDeposit / 2 + dexBalance).toString()) * 1e6),
      PRECISION
    );

    // get user profit & loss
    console.log("-------------get user profit & loss---------------");
    const userVaultState = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .getUserVaultState();
    const user2Profit = Number(userVaultState[2]) / 1e6;
    console.log("user profit: ", user2Profit);

    console.log("-------------export vault state---------------");
    let exportVaultStateTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();

    let depositReceiptShares = exportVaultStateTx[0][1][1][0];
    let depositReceiptAmount = exportVaultStateTx[0][1][1][1];
    expect(Number(depositReceiptShares)).to.equal(100000000n);
    expect(Number(depositReceiptAmount)).to.equal(100000000n);

    console.log("-------------Users initial withdrawals---------------");
    const withdrawalShares = 100;
    const withdrawalAmount =
      (withdrawalShares * parseFloat(pricePerShare.toString())) / 1e6;
    console.log("withdrawalAmount %s", withdrawalAmount);

    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(withdrawalShares * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log(
      "------------- close position to release fund for user ---------------"
    );
    // get allocatedRatio ratio from vault
    const allocatedRatio2 = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .allocatedRatio();
    console.log("allocatedRatio %s", allocatedRatio2);

    const stakingRatio = parseFloat(allocatedRatio2[0].toString()) / 1e4;
    const perpRatio = parseFloat(allocatedRatio2[1].toString()) / 1e4;
    const withdrawalAmountInSpot = withdrawalAmount * stakingRatio;
    console.log("withdrawalAmountInSpot %s", withdrawalAmountInSpot);
    const withdrawalAmountInPerp = withdrawalAmount * perpRatio;
    console.log("withdrawalAmountInPerp %s", withdrawalAmountInPerp);

    // calculate eth amount from withdrawalAmount
    ethPrice = await getEthPrice();
    let withdrawalEthAmount = withdrawalAmountInSpot / ethPrice;
    console.log("withdrawalEthAmount %s", withdrawalEthAmount);
    withdrawalEthAmount = Math.ceil(withdrawalEthAmount * 100) / 100;
    console.log("ethAmountFromUsd %s", withdrawalEthAmount);

    // estimate the ETH balance based on wstEthBalance
    let wstEthEthPrice = await getWstEthToEthPrice();
    const estimatedEthAmount =
      (parseFloat(wstEthBalance.toString()) / 1e18) *
      (Number(wstEthEthPrice) / 1e18);
    console.log("estimated ETH balance: ", estimatedEthAmount);

    // we can't sell more than we have, so sell all if the withdrawal amount > vault's eth balance
    withdrawalEthAmount = Math.min(estimatedEthAmount, withdrawalEthAmount);
    console.log("withdrawalEthAmount 2: %s", withdrawalEthAmount);

    const closePositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .closePosition(BigInt(withdrawalEthAmount * 1e18));
    await closePositionTx.wait();

    console.log("------------- trader send fund back to vault ---------------");
    // optionsReceiver approve usdc to vault
    const amountToSend = BigInt(
      parseInt((withdrawalAmountInPerp * 1e6).toString())
    );
    await usdc
      .connect(optionsReceiver)
      .approve(
        await rockOnyxDeltaNeutralVaultContract.getAddress(),
        amountToSend
      );

    // optionsReceiver call handlePostWithdrawFromVendor to return withdrawalAmountInPerp to vault
    const handlePostWithdrawTx = await rockOnyxDeltaNeutralVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawFromVendor(amountToSend);
    await handlePostWithdrawTx.wait();

    console.log("-------------acquireWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(withdrawalAmount * 1e6);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", Number(user2Balance) / 1e6);

    const completeWithdrawalTx = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log(
      "usdc of user after withdraw %s",
      Number(user1BalanceAfterWithdraw) / 1e6
    );

    const expectedUser2Balance =
      Number(user2Balance) / 1e6 + user2_initDeposit * (1 + user2Profit);
    console.log("expectedUser2Balance %s", expectedUser2Balance);
    expect(user1BalanceAfterWithdraw).to.approximately(
      BigInt(parseInt((expectedUser2Balance * 1e6).toString())),
      PRECISION
    );

    console.log("-------------export vault state---------------");
    exportVaultStateTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();

    depositReceiptShares = exportVaultStateTx[0][1][1][0];
    depositReceiptAmount = exportVaultStateTx[0][1][1][1];
    let withdrawShares = exportVaultStateTx[1][0][1][0];

    expect(Number(depositReceiptShares)).to.equal(0n);
    expect(Number(depositReceiptAmount)).to.equal(0n);
    expect(Number(withdrawShares)).to.equal(0n);

    const newRockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    const newRockOnyxDeltaNeutralVaultContract =
      await newRockOnyxDeltaNeutralVault.deploy(
        admin,
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        networkCost,
        await camelotSwapContract.getAddress(),
        await aevoContract.getAddress(),
        await optionsReceiver.getAddress(),
        wethAddress,
        wstethAddress,
        BigInt(1 * 1e6),
        await uniSwapContract.getAddress(),
        [usdtAddress, daiAddress],
        [usdcAddress, usdtAddress],
        [100, 100]
      );
    await newRockOnyxDeltaNeutralVaultContract.waitForDeployment();

    console.log(
      "deploy new rockOnyxDeltaNeutralVaultContract successfully: %s",
      await newRockOnyxDeltaNeutralVaultContract.getAddress()
    );

    console.log("-------------import vault state---------------");
    const _depositReceiptArr = exportVaultStateTx[0].map((element) => {
      return {
        owner: element[0],
        depositReceipt: {
          shares: element[1][0],
          depositAmount: element[1][1],
        },
      };
    });
    const _withdrawalArr = exportVaultStateTx[1].map((element) => {
      return {
        owner: element[0],
        withdrawal: {
          shares: element[1][0],
          pps: element[1][1],
          profit: element[1][2],
          performanceFee: element[1][3],
          withdrawAmount: element[1][4],
        },
      };
    });
    const _vaultParams = {
      decimals: exportVaultStateTx[2][0],
      asset: exportVaultStateTx[2][1],
      minimumSupply: exportVaultStateTx[2][2],
      cap: exportVaultStateTx[2][3],
      performanceFeeRate: exportVaultStateTx[2][4],
      managementFeeRate: exportVaultStateTx[2][5],
    };
    const _vaultState = {
      withdrawPoolAmount: exportVaultStateTx[3][0],
      pendingDepositAmount: exportVaultStateTx[3][1],
      totalShares: exportVaultStateTx[3][2],
      totalFeePoolAmount: exportVaultStateTx[3][3],
      lastUpdateManagementFeeDate: exportVaultStateTx[3][4],
    };
    const _ethStakeLendState = {
      unAllocatedBalance: exportVaultStateTx[4][0],
      totalBalance: exportVaultStateTx[4][1],
    };
    const _perpDexState = {
      unAllocatedBalance: exportVaultStateTx[5][0],
      perpDexBalance: exportVaultStateTx[5][1],
    };

    const importVaultStateTx = await newRockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .importVaultState(
        _depositReceiptArr,
        _withdrawalArr,
        _vaultParams,
        _vaultState,
        _ethStakeLendState,
        _perpDexState
      );

    console.log("-------------export vault state---------------");
    const exportVaultStateTx2 = await newRockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();

    console.log(exportVaultStateTx);
    depositReceiptShares = exportVaultStateTx2[0][1][1][0];
    depositReceiptAmount = exportVaultStateTx2[0][1][1][1];
    withdrawShares = exportVaultStateTx2[1][0][1][0];

    expect(Number(depositReceiptShares)).to.equal(0n);
    expect(Number(depositReceiptAmount)).to.equal(0n);
    expect(Number(withdrawShares)).to.equal(0n);
  });

  it.skip("user deposit -> open position -> close position", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    const contractAddress =
      await rockOnyxDeltaNeutralVaultContract.getAddress();
    await deposit(user1, 1000 * 1e6, usdc, usdc);
    await deposit(user2, 1000 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(2000 * 1e6, PRECISION);

    console.log("-------------open position---------------");

    var openEvent =
      rockOnyxDeltaNeutralVaultContract.getEvent("PositionOpened");
    var closeEvent =
      rockOnyxDeltaNeutralVaultContract.getEvent("PositionClosed");

    await rockOnyxDeltaNeutralVaultContract.on(
      closeEvent,
      async (
        usdAmount: any,
        wstEthEthPrice: any,
        ethToUsdPrice: any,
        ethAmountFomUsd: any,
        wstEthAmountFomEth: any,
        convertedWEthAmount: any,
        convertedUsdAmount: any
      ) => {
        console.log(
          "Position closed - USD Amount: %s",
          usdAmount.toString(),
          "WSTETH/ETH Price: %s",
          wstEthEthPrice.toString(),
          "ETH/USD Price: %s",
          ethToUsdPrice.toString(),
          "ETH Amount From USD: %s",
          ethAmountFomUsd.toString(),
          "WSTETH Amount From ETH: %s",
          wstEthAmountFomEth.toString(),
          "Converted WETH Amount: %s",
          convertedWEthAmount.toString(),
          "Converted USD Amount: %s",
          convertedUsdAmount.toString()
        );

        expect(usdAmount).to.approximately(convertedUsdAmount, 5 * 1e6);
      }
    );

    await rockOnyxDeltaNeutralVaultContract.on(openEvent, async () => {
      console.log("-------------close position---------------");

      console.log("test 1 %s", contractAddress);

      const wstEthVaultBalance = await wsteth.balanceOf(contractAddress);
      console.log(
        "RockOnyxDeltaNeutralVault balance of WSTETH: %s",
        (Number(wstEthVaultBalance) / 1e18).toFixed(8)
      );

      const wstEthEthPrice = await camelotSwapContract.getPriceOf(
        wstethAddress,
        wethAddress
      );
      console.log("WSTETH/ETH Price: %s", Number(wstEthEthPrice) / 1e18);

      const ethPrice = await camelotSwapContract.getPriceOf(
        wethAddress,
        usdcAddress
      );
      console.log("WETH/USDC Price: %s", (Number(ethPrice) / 1e6).toFixed(8));

      // Convert WSTETH balance to ETH
      const ethVaultBalance =
        (Number(wstEthVaultBalance) * Number(wstEthEthPrice)) / 1e18;
      console.log("ethVaultBalance: %s", ethVaultBalance);

      // Convert ETH balance to USDC
      const usdcVaultBalance = parseInt(
        ((Number(ethVaultBalance) * Number(ethPrice)) / 1e18).toString()
      );
      console.log("usdcVaultBalance: %s", usdcVaultBalance);

      const closePositionTx = await rockOnyxDeltaNeutralVaultContract
        .connect(admin)
        .closePosition(BigInt(usdcVaultBalance));
      await closePositionTx.wait();
    });

    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();

    // add a sleep here to keep the main loop running while the event listener working
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it("migration, export and import data to new delta neutral vault - 200265516", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner(
      "0x7E38b79D0645BE0D9539aec3501f6a8Fb6215392"
    );
    const contractAddress = "0xC9A079d7d1CF510a6dBa8dA8494745beaE7736E2";
    const exportABI = [
      {
        inputs: [],
        name: "exportVaultState",
        outputs: [
          {
            components: [
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "shares",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "depositAmount",
                    type: "uint256",
                  },
                ],
                internalType: "struct DepositReceipt",
                name: "depositReceipt",
                type: "tuple",
              },
            ],
            internalType: "struct DepositReceiptArr[]",
            name: "",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "shares",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "pps",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "profit",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "performanceFee",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "withdrawAmount",
                    type: "uint256",
                  },
                ],
                internalType: "struct Withdrawal",
                name: "withdrawal",
                type: "tuple",
              },
            ],
            internalType: "struct WithdrawalArr[]",
            name: "",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "uint8",
                name: "decimals",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "asset",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "minimumSupply",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "cap",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "performanceFeeRate",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "managementFeeRate",
                type: "uint256",
              },
            ],
            internalType: "struct VaultParams",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "performanceFeeAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "managementFeeAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "withdrawPoolAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "pendingDepositAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "totalShares",
                type: "uint256",
              },
            ],
            internalType: "struct VaultState",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "ethStakeLendRatio",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "perpDexRatio",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "decimals",
                type: "uint8",
              },
            ],
            internalType: "struct DeltaNeutralAllocateRatio",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "unAllocatedBalance",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "totalBalance",
                type: "uint256",
              },
            ],
            internalType: "struct EthStakeLendState",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "unAllocatedBalance",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "perpDexBalance",
                type: "uint256",
              },
            ],
            internalType: "struct PerpDexState",
            name: "",
            type: "tuple",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const contract = new ethers.Contract(
      contractAddress,
      exportABI,
      contractAdmin
    );

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await contract
      .connect(contractAdmin)
      .exportVaultState();

    console.log("DepositReceiptArr %s", exportVaultStateTx[0]);
    console.log("WithdrawalArr %s", exportVaultStateTx[1]);
    console.log("VaultParams %s", exportVaultStateTx[2]);
    console.log("VaultState %s", exportVaultStateTx[3]);
    console.log("DeltaNeutralAllocateRatio %s", exportVaultStateTx[4]);
    console.log("EthStakeLendState %s", exportVaultStateTx[5]);
    console.log("PerpDexState %s", exportVaultStateTx[6]);

    const newContractFactory = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    const newContract = await upgrades.deployProxy(
      newContractFactory,
      [
        await admin.getAddress(),
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        networkCost,
        await camelotSwapContract.getAddress(),
        await aevoContract.getAddress(),
        await optionsReceiver.getAddress(),
        wethAddress,
        wstethAddress,
        BigInt(1 * 1e6),
        await uniSwapContract.getAddress(),
        [usdtAddress, daiAddress],
        [usdcAddress, usdtAddress],
        [100, 100],
      ],
      { initializer: "initialize" }
    );

    await newContract.waitForDeployment();

    console.log("Deposit ");
    exportVaultStateTx[0].forEach((element: any[][]) => {
      console.log(element);
    });
    console.log("withdraw ");
    exportVaultStateTx[1].forEach((element: any[][]) => {
      console.log(element);
    });

    console.log("-------------import vault state---------------");
    const _depositReceiptArr = exportVaultStateTx[0].map((element: any[][]) => {
      return {
        owner: element[0],
        depositReceipt: {
          shares: element[1][0],
          depositAmount: element[1][1],
        },
      };
    });
    const _withdrawalArr = exportVaultStateTx[1].map((element: any[][]) => {
      return {
        owner: element[0],
        withdrawal: {
          shares: element[1][0],
          pps: element[1][1],
          profit: element[1][2],
          performanceFee: element[1][3],
          withdrawAmount: element[1][4],
        },
      };
    });
    const _vaultParams = {
      decimals: exportVaultStateTx[2][0],
      asset: exportVaultStateTx[2][1],
      minimumSupply: exportVaultStateTx[2][2],
      cap: exportVaultStateTx[2][3],
      performanceFeeRate: exportVaultStateTx[2][4],
      managementFeeRate: exportVaultStateTx[2][5],
    };
    const _vaultState = {
      withdrawPoolAmount: exportVaultStateTx[3][2],
      pendingDepositAmount: exportVaultStateTx[3][3],
      totalShares: exportVaultStateTx[3][4],
      totalFeePoolAmount: exportVaultStateTx[3][0] + exportVaultStateTx[3][1],
      lastUpdateManagementFeeDate: (await ethers.provider.getBlock("latest"))
        .timestamp,
    };
    const _ethStakeLendState = {
      unAllocatedBalance: exportVaultStateTx[5][0],
      totalBalance: exportVaultStateTx[5][1],
    };
    const _perpDexState = {
      unAllocatedBalance: exportVaultStateTx[6][0],
      perpDexBalance: exportVaultStateTx[6][1],
    };
    const importVaultStateTx = await newContract
      .connect(admin)
      .importVaultState(
        _depositReceiptArr,
        _withdrawalArr,
        _vaultParams,
        _vaultState,
        _ethStakeLendState,
        _perpDexState
      );
    console.log("-------------export new vault state---------------");
    exportVaultStateTx = await newContract.connect(admin).exportVaultState();

    console.log("DepositReceiptArr %s", exportVaultStateTx[0]);
    console.log("WithdrawalArr %s", exportVaultStateTx[1]);
    console.log("VaultParams %s", exportVaultStateTx[2]);
    console.log("VaultState %s", exportVaultStateTx[3]);
    console.log("EthStakeLendState %s", exportVaultStateTx[4]);
    console.log("PerpDexState %s", exportVaultStateTx[5]);
  });
});
