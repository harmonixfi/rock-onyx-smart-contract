const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  WSTETH_ADDRESS,
  USDT_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  BSX_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH_ETH_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  NETWORK_COST
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ",chainId);
let perDexRecipientAddress : string;
let perDexConnectorAddress : string;

const PRECISION = 2 * 1e6;

describe("WstEthStakingDeltaNeutralVault", function () {
  let admin: Signer,
    user1: Signer,
    user2: Signer,
    user4: Signer;

  let wstEthStakingDNVault: Contracts.WstEthStakingDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let usdt: Contracts.IERC20;
  let wsteth: Contracts.IERC20;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const wstethAddress = WSTETH_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const uniSwapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
  const perDexAddress = BSX_ADDRESS[chainId];
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const wsteth_ethPriceFeed = WSTETH_ETH_PRICE_FEED_ADDRESS[chainId];
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let priceConsumerContract: Contracts.PriceConsumer;
  let uniSwapContract: Contracts.UniSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, wstethAddress, usdtAddress],
      [usdcAddress, wethAddress, usdcAddress],
      [ethPriceFeed, wsteth_ethPriceFeed, usdtPriceFeed]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
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

  async function deployWstEthStakingDeltaNeutralVault() {
    const wstEthStakingDeltaneutralVault = await ethers.getContractFactory(
      "WstEthStakingDeltaNeutralVault"
    );

    wstEthStakingDNVault = await wstEthStakingDeltaneutralVault.deploy(
      admin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      wethAddress,
      perDexAddress,
      perDexRecipientAddress,
      perDexConnectorAddress,
      wstethAddress,
      BigInt(1 * 1e6),
      await uniSwapContract.getAddress(),
      [wethAddress, wstethAddress,  usdtAddress],
      [usdcAddress, wethAddress, usdcAddress],
      [500, 100, 100]
    );
    await wstEthStakingDNVault.waitForDeployment();

    console.log(
      "deploy wstEthStakingDNVault successfully: %s",
      await wstEthStakingDNVault.getAddress()
    );
  }

  beforeEach(async function () {
    [admin, user1, user2, user4] = await ethers.getSigners();
    perDexRecipientAddress = await user4.getAddress();
    perDexConnectorAddress = await user4.getAddress();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdt = await ethers.getContractAt("IERC20", usdtAddress);
    wsteth = await ethers.getContractAt("IERC20", wstethAddress);

    console.log("deployWstEthStakingDeltaNeutralVault");
    await deployPriceConsumerContract();
    await deployUniSwapContract();
    await deployWstEthStakingDeltaNeutralVault();
    console.log("deployWstEthStakingDeltaNeutralVault");
  });

  async function deposit(sender: Signer, amount: BigNumberish, token: Contracts.IERC20, tokenTransit: Contracts.IERC20) {
    await token
      .connect(sender)
      .approve(await wstEthStakingDNVault.getAddress(), amount);

    await wstEthStakingDNVault.connect(sender).deposit(amount, token, tokenTransit);
  }

  async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
    const transferTx = await token.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await wstEthStakingDNVault
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  async function getWstEthPrice() {
    const price = await uniSwapContract.getPriceOf(wstethAddress, wethAddress);
    const ethPrice = await uniSwapContract.getPriceOf(wethAddress, usdcAddress);
    const ethAmount = parseFloat(price.toString()) / 1e18;
    return (ethAmount * parseFloat(ethPrice.toString())) / 1e6;
  }

  async function getWstEthToEthPrice() {
    const price = await uniSwapContract.getPriceOf(wstethAddress, wethAddress);
    return price;
  }

  async function getEthPrice() {
    const _ethPrice = await uniSwapContract.getPriceOf(wethAddress, usdcAddress);
    return parseFloat(_ethPrice.toString()) / 1e6;
  }

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(usdcImpersonatedSigner);
    const usdtSigner = await ethers.getImpersonatedSigner(usdtImpersonatedSigner);

    await transferForUser(usdc, usdcSigner, user1, 1000 * 1e6);
    await transferForUser(usdc, usdcSigner, admin, 1000 * 1e6);
    await transferForUser(usdc, usdcSigner, user2, 1000 * 1e6);
    await transferForUser(usdt, usdtSigner, user2, 1000 * 1e6);
  });

  it.skip("user deposit -> withdraw", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdt, usdt);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await wstEthStakingDNVault
      .connect(user2)
      .initiateWithdrawal(99.5 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await wstEthStakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(99.5 * 1e6);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await wstEthStakingDNVault
      .connect(user2)
      .completeWithdrawal(99.5 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost,PRECISION);
  });

  it.skip("user deposit -> deposit to perp dex -> deposit to kelp -> deposit to zircuit", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await wstEthStakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await wstEthStakingDNVault
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();
  });

  it.skip("user deposit -> deposit to perp dex -> open position -> close position -> sync restaking balance -> withdraw", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 200 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await wstEthStakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await wstEthStakingDNVault
      .connect(admin)
      .openPosition(BigInt(0.02 * 1e18));
    await openPositionTx.wait();

    console.log("-------------sync restaking balance---------------");
    const syncBalanceTx = await wstEthStakingDNVault
      .connect(admin)
      .syncBalance(150*1e6);
    await syncBalanceTx.wait();

    console.log("-------------close position---------------");
    const closePositionTx = await wstEthStakingDNVault
      .connect(admin)
      .closePosition(BigInt(0.01 * 1e18));
    await closePositionTx.wait();

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await wstEthStakingDNVault
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    await usdc.connect(admin).approve(await wstEthStakingDNVault.getAddress(), 50 * 1e6);
    const handlePostWithdrawTx = await wstEthStakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(50*1e6);
    await handlePostWithdrawTx.wait();
    
    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await wstEthStakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(100*1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await wstEthStakingDNVault
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user2Balance + BigInt(100 * 1e6) - networkCost,
      PRECISION
    );
  });

  it.skip("user deposit -> deposit to perp dex -> withdraw", async function () {
    console.log("-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 200 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await wstEthStakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await wstEthStakingDNVault
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    await usdc.connect(admin).approve(await wstEthStakingDNVault.getAddress(), 50 * 1e6);
    const handlePostWithdrawTx = await wstEthStakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(50*1e6);
    await handlePostWithdrawTx.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await wstEthStakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(100*1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await wstEthStakingDNVault
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost, PRECISION);
    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(200 * 1e6, PRECISION);
  });

  it("user deposit -> deposit to vendor -> open position -> sync profit -> withdraw -> close position -> complete withdraw", async function () {
    console.log("-------------deposit to rockOnyxDeltaNeutralVault---------------");

    const inititalDeposit = 10 + 100;
    const user2_initDeposit = 100;

    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, user2_initDeposit * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    // parse totalValueLock to float
    let tvlNumber = parseFloat(totalValueLock.toString()) / 1e6;

    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await wstEthStakingDNVault.connect(admin).depositToVendor();

    console.log("-------------open position---------------");
    let ethPrice = await getEthPrice();

    // calculate eth amount for totalvaluelocked / 2 usd amount
    // round ethAmount to 2 decimal places
    const ethAmount = parseFloat(
      (Math.floor((tvlNumber / 2 / ethPrice) * 100) / 100).toFixed(2)
    );
    console.log("ethAmount to open position %s", ethAmount);

    const openPositionTx = await wstEthStakingDNVault
      .connect(admin)
      .openPosition(BigInt(ethAmount * 1e18));
    await openPositionTx.wait();

    // get ETH balance of wstEthStakingDNVault
    const wstEthBalance1 = await wsteth.balanceOf(
      await wstEthStakingDNVault.getAddress()
    );
    console.log(
      "wstETH balance of wstEthStakingDNVault: ",
      Number(wstEthBalance1.toString()) / 1e18
    );

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(inititalDeposit * 1e6, PRECISION);

    console.log("-------------sync derpDex balance---------------");
    // assume that the funding fee return 0.01% every 1 hour
    // we sync balance after 7 days
    // get balanceOf wstEth for wstEthStakingDNVault
    const wstEthBalance = await wsteth.balanceOf(
      await wstEthStakingDNVault.getAddress()
    );
    console.log("wstEthBalance %s", wstEthBalance);

    // get wstEthPrice
    const wstEthPrice = await getWstEthPrice();
    const spotBalance =
      wstEthPrice * (parseFloat(wstEthBalance.toString()) / 1e18);

    const allocatedToPerp = inititalDeposit - spotBalance; // we assume that the spot - perp no loss
    const dexBalance = allocatedToPerp * (1 + 0.0001 * 7 * 24);
    console.log("dexBalance %s", dexBalance);

    const syncDerpDexBalanceTx = await wstEthStakingDNVault
      .connect(admin)
      .syncBalance(BigInt(parseInt((dexBalance * 1e6).toString())));
    await syncDerpDexBalanceTx.wait();

    // get current price per share from contract
    const pricePerShare = await wstEthStakingDNVault
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
    const userVaultState = await wstEthStakingDNVault
      .connect(user2)
      .getUserVaultState();
    const user2Profit = Number(userVaultState[2]) / 1e6;
    console.log("user profit: ", user2Profit);

    console.log("-------------Users initial withdrawals---------------");
    const withdrawalShares = 100;
    const withdrawalAmount =
      (withdrawalShares * parseFloat(pricePerShare.toString())) / 1e6;
    console.log("withdrawalAmount %s", withdrawalAmount);

    const initiateWithdrawalTx1 = await wstEthStakingDNVault
      .connect(user2)
      .initiateWithdrawal(withdrawalShares * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log(
      "------------- close position to release fund for user ---------------"
    );
    // get allocatedRatio ratio from vault
    const allocatedRatio2 = await wstEthStakingDNVault
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

    const closePositionTx = await wstEthStakingDNVault
      .connect(admin)
      .closePosition(BigInt(withdrawalEthAmount * 1e18));
    await closePositionTx.wait();

    console.log("------------- trader send fund back to vault ---------------");
    // optionsReceiver approve usdc to vault
    const amountToSend = BigInt(
      parseInt((withdrawalAmountInPerp * 1e6).toString())
    );
    await usdc
      .connect(admin)
      .approve(
        await wstEthStakingDNVault.getAddress(),
        amountToSend
      );

    // optionsReceiver call handlePostWithdrawFromVendor to return withdrawalAmountInPerp to vault
    const handlePostWithdrawTx = await wstEthStakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(amountToSend);
    await handlePostWithdrawTx.wait();

    console.log("-------------acquireWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await wstEthStakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(withdrawalAmount * 1e6);
    await handleWithdrawalFundsTx.wait();

    // get getPerpDexUnAllocatedBalance from contract
    const perpDexState =
      await wstEthStakingDNVault.getPerpDexState();
    console.log("perpDexUnAllocatedBalance: ", perpDexState);

    const perpDexBalance = perpDexState[0];

    const pricePerShare2 = await wstEthStakingDNVault
      .connect(admin)
      .pricePerShare();
    console.log("pricePerShare2 %s", pricePerShare2);
    const pricePerShare2Int = Number(pricePerShare2) / 1e6;
    console.log("pricePerShare2Int %s", pricePerShare2Int);
    
    const expectedPerpDexBalance =
      10 * pricePerShare2Int * perpRatio;
    console.log("expectedPerpDexBalance %s", expectedPerpDexBalance);
    console.log("perpRatio %s", perpRatio);
    

    expect(perpDexBalance).to.approximately(
      BigInt(parseInt((expectedPerpDexBalance * 1e6).toString())),
      2 * 1e6
    );

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", Number(user2Balance) / 1e6);

    const completeWithdrawalTx = await wstEthStakingDNVault
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
});