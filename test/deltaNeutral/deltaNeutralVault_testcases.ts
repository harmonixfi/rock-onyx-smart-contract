const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  WSTETH_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDCE_IMPERSONATED_SIGNER_ADDRESS,
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

// const chainId: CHAINID = network.config.chainId;
const chainId: CHAINID = 42161;
const PRECISION = 2 * 1e6;

describe("RockOnyxDeltaNeutralVault", function () {
  let admin: Signer,
    user1: Signer,
    user2: Signer,
    user3: Signer,
    user4: Signer,
    user5: Signer;

  let optionsReceiver: Signer;

  let rockOnyxDeltaNeutralVaultContract: Contracts.RockOnyxDeltaNeutralVault;
  let onchainRockOnyxUSDTVaultContract: Contracts.RockOnyxDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let usdce: Contracts.IERC20;
  let wsteth: Contracts.IERC20;
  let weth: Contracts.IERC20;

  let aevoContract: Contracts.Aevo;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdceImpersonatedSigner = USDCE_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const wstethAddress = WSTETH_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];

  let camelotSwapContract: Contracts.CamelotSwap;

  async function deployCamelotSwapContract() {
    const factory = await ethers.getContractFactory("CamelotSwap");
    camelotSwapContract = await factory.deploy(swapRouterAddress);
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

  async function deployRockOnyxDeltaNeutralVault() {
    const rockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    rockOnyxDeltaNeutralVaultContract = await rockOnyxDeltaNeutralVault.deploy(
      usdcAddress,
      await camelotSwapContract.getAddress(),
      await aevoContract.getAddress(),
      await optionsReceiver.getAddress(),
      wethAddress,
      wstethAddress,
      BigInt(1 * 1e6)
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

    wsteth = await ethers.getContractAt("IERC20", wstethAddress);
    weth = await ethers.getContractAt("IERC20", wethAddress);
    await deployCamelotSwapContract();
    await deployAevoContract();
    await deployRockOnyxDeltaNeutralVault();
  });

  // Helper function for deposit
  async function deposit(sender: Signer, amount: BigNumberish) {
    await usdc
      .connect(sender)
      .approve(await rockOnyxDeltaNeutralVaultContract.getAddress(), amount);

    await rockOnyxDeltaNeutralVaultContract.connect(sender).deposit(amount);
  }

  async function transferUsdcForUser(from: Signer, to: Signer, amount: number) {
    const transferTx = await usdc.connect(from).transfer(to, amount);
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

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );

    await transferUsdcForUser(usdcSigner, user1, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user2, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user3, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, user4, 10000 * 1e6);
    await transferUsdcForUser(usdcSigner, optionsReceiver, 1000 * 1e6);
  });

  it("user deposit -> withdraw, do not deposit to perp dex", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxDeltaNeutralVaultContract
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    // 49957050 49957050
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

  it("user deposit -> open position -> close position -> withdraw, do not deposit to perp dex", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

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

    console.log("-------------handleWithdrawalFunds---------------");
    // 49957050 49957050
    const handleWithdrawalFundsTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .acquireWithdrawalFunds(49957050n + 49957050n);
    await initiateWithdrawalTx1.wait();

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

  it("user deposit -> open position -> deposit to vender -> withdraw", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);

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

  it("user deposit1 -> open position -> deposit to vender -> user deposit2 -> open position -> deposit to vender -> withdraw", async function () {
    console.log(
      "-------------deposit1 to rockOnyxDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6);
    await deposit(user2, 100 * 1e6);
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
    await deposit(user2, 100 * 1e6);

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

  it("user deposit -> deposit to vendor -> open position -> sync profit -> withdraw -> close position -> complete withdraw", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );

    const inititalDeposit = 10 + 100;
    const user2_initDeposit = 100;

    await deposit(user1, 10 * 1e6);
    await deposit(user2, user2_initDeposit * 1e6);

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
    console.log("pricePerShare %s", pricePerShare);
    const pricePerShare2Int = Number(pricePerShare2) / 1e6;

    const expectedPerpDexUnallocatedBalance =
      10 * pricePerShare2Int * perpRatio;
    console.log(
      "expectedPerpDexUnallocatedBalance %s",
      expectedPerpDexUnallocatedBalance
    );

    expect(perpDexBalance).to.approximately(
      BigInt(parseInt((expectedPerpDexUnallocatedBalance * 1e6).toString())),
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

  it("migration test, user deposit -> deposit to vendor -> open position -> sync profit -> withdraw -> close position -> complete withdraw", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );

    const inititalDeposit = 10 + 100;
    const user2_initDeposit = 100;

    await deposit(user1, 10 * 1e6);
    await deposit(user2, user2_initDeposit * 1e6);

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

    console.log("-------------export vault state---------------");
    exportVaultStateTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();

    depositReceiptShares = exportVaultStateTx[0][1][1][0];
    depositReceiptAmount = exportVaultStateTx[0][1][1][1];
    let withdrawShares = exportVaultStateTx[1][0][1][0];

    expect(Number(depositReceiptShares)).to.equal(0n);
    expect(Number(depositReceiptAmount)).to.equal(0n);
    expect(Number(withdrawShares)).to.equal(100000000n);

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
    withdrawShares = exportVaultStateTx[1][0][1][0];

    expect(Number(depositReceiptShares)).to.equal(0n);
    expect(Number(depositReceiptAmount)).to.equal(0n);
    expect(Number(withdrawShares)).to.equal(0n);

    const newRockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    const newRockOnyxDeltaNeutralVaultContract =
      await newRockOnyxDeltaNeutralVault.deploy(
        usdcAddress,
        await camelotSwapContract.getAddress(),
        await aevoContract.getAddress(),
        await optionsReceiver.getAddress(),
        wethAddress,
        wstethAddress,
        BigInt(1 * 1e6)
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
      performanceFeeAmount: exportVaultStateTx[3][0],
      managementFeeAmount: exportVaultStateTx[3][1],
      withdrawPoolAmount: exportVaultStateTx[3][2],
      pendingDepositAmount: exportVaultStateTx[3][3],
      totalShares: exportVaultStateTx[3][4],
    };

    const _allocateRatio = {
      ethStakeLendRatio: exportVaultStateTx[4][0],
      perpDexRatio: exportVaultStateTx[4][1],
      decimals: exportVaultStateTx[4][2],
    };

    const _ethStakeLendState = {
      unAllocatedBalance: exportVaultStateTx[5][0],
      totalBalance: exportVaultStateTx[5][1],
    };

    const _perpDexState = {
      unAllocatedBalance: exportVaultStateTx[6][0],
      perpDexBalance: exportVaultStateTx[6][1],
    };

    const importVaultStateTx = await newRockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .importVaultState(
        _depositReceiptArr,
        _withdrawalArr,
        _vaultParams,
        _vaultState,
        _allocateRatio,
        _ethStakeLendState,
        _perpDexState
      );

    console.log("-------------export vault state---------------");
    const exportVaultStateTx2 = await newRockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();

    depositReceiptShares = exportVaultStateTx2[0][1][1][0];
    depositReceiptAmount = exportVaultStateTx2[0][1][1][1];
    withdrawShares = exportVaultStateTx2[1][0][1][0];
  
    expect(Number(depositReceiptShares)).to.equal(0n);
    expect(Number(depositReceiptAmount)).to.equal(0n);
    expect(Number(withdrawShares)).to.equal(0n);
  });

  it("user deposit -> open position -> close position", async function () {
    console.log(
      "-------------deposit to rockOnyxDeltaNeutralVault---------------"
    );
    const contractAddress =
      await rockOnyxDeltaNeutralVaultContract.getAddress();
    await deposit(user1, 1000 * 1e6);
    await deposit(user2, 1000 * 1e6);

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

    await rockOnyxDeltaNeutralVaultContract.on(
      openEvent,
      async (
        usdAmount: any,
        price: any,
        wethAmount: any,
        wstEthAmount: any
      ) => {
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
          usdcAddress,
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
      }
    );

    const openPositionTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();

    // add a sleep here to keep the main loop running while the event listener working
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it("migration, export and import data to new delta neutral vault - 200265516", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner("0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7");
    rockOnyxDeltaNeutralVaultContract = await ethers.getContractAt("RockOnyxDeltaNeutralVault", "0x607b19a600F2928FB4049d2c593794fB70aaf9aa");

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await rockOnyxDeltaNeutralVaultContract
    .connect(contractAdmin)
    .exportVaultState();
    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[0][0][1]);
    console.log(exportVaultStateTx[0][1][1]);
  
    const newRockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RockOnyxDeltaNeutralVault"
    );

    const newRockOnyxDeltaNeutralVaultContract =
      await newRockOnyxDeltaNeutralVault.deploy(
        usdcAddress,
        await camelotSwapContract.getAddress(),
        await aevoContract.getAddress(),
        await optionsReceiver.getAddress(),
        wethAddress,
        wstethAddress,
        BigInt(1 * 1e6)
      );
    await newRockOnyxDeltaNeutralVaultContract.waitForDeployment();
  
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
      performanceFeeAmount: exportVaultStateTx[3][0],
      managementFeeAmount: exportVaultStateTx[3][1],
      withdrawPoolAmount: exportVaultStateTx[3][2],
      pendingDepositAmount: exportVaultStateTx[3][3],
      totalShares: exportVaultStateTx[3][4],
    };
    const _allocateRatio = {
      ethStakeLendRatio: exportVaultStateTx[4][0],
      perpDexRatio: exportVaultStateTx[4][1],
      decimals: exportVaultStateTx[4][2],
    };
    const _ethStakeLendState = {
      unAllocatedBalance: exportVaultStateTx[5][0],
      totalBalance: exportVaultStateTx[5][1],
    };
    const _perpDexState = {
      unAllocatedBalance: exportVaultStateTx[6][0],
      perpDexBalance: exportVaultStateTx[6][1],
    };
    const importVaultStateTx = await newRockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .importVaultState(
        _depositReceiptArr,
        _withdrawalArr,
        _vaultParams,
        _vaultState,
        _allocateRatio,
        _ethStakeLendState,
        _perpDexState
      );
    console.log("-------------export new vault state---------------");
    exportVaultStateTx = await newRockOnyxDeltaNeutralVaultContract
    .connect(admin)
    .exportVaultState();

    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[0][0][1]);
    console.log(exportVaultStateTx[0][1][1]);
  });
});
