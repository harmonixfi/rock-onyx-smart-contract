const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  BSX_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  WEETH_ETH_PRICE_FEED_ADDRESS,
  WEETH_ADDRESS,
  ETHERFI_DEPOSIT_ADDRESS,
  NETWORK_COST
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ",chainId);
let perpDexRecipientAddress : string;

const PRECISION = 2 * 1e6;

describe("EtherfiRestakingDeltaNeutralVault", function () {
  let admin: Signer,
    user1: Signer,
    user2: Signer,
    user3: Signer,
    user4: Signer;

  let etherfiRestakingDNVault: Contracts.EtherfiRestakingDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let usdt: Contracts.IERC20;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const weEthAddress = WEETH_ADDRESS[chainId] || "";
  const swapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId] || "";
  const bsxAddress = BSX_ADDRESS[chainId] || "";
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId] || "";
  const weEth_EthPriceFeed = WEETH_ETH_PRICE_FEED_ADDRESS[chainId] || "";
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId] || "";
  const etherfiDepositAddress = ETHERFI_DEPOSIT_ADDRESS[chainId] || "";
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let priceConsumerContract: Contracts.PriceConsumer;
  let uniSwapContract: Contracts.UniSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, weEthAddress, usdtAddress],
      [usdcAddress, wethAddress, usdcAddress],
      [ethPriceFeed, weEth_EthPriceFeed, usdtPriceFeed]
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
      swapRouterAddress,
      priceConsumerContract.getAddress()
    );
    await uniSwapContract.waitForDeployment();

    console.log(
      "Deployed uni swap contract at address %s",
      await uniSwapContract.getAddress()
    );
  }

  async function deployEtherfiRestakingDeltaNeutralVault() {
    const etherfiRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "EtherfiRestakingDeltaNeutralVault"
    );

    etherfiRestakingDNVault = await etherfiRestakingDeltaNeutralVault.deploy(
      admin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      wethAddress,
      bsxAddress,
      perpDexRecipientAddress,
      weEthAddress,
      BigInt(1 * 1e6),
      [etherfiDepositAddress],
      await uniSwapContract.getAddress(),
      [usdcAddress, usdtAddress],
      [wethAddress, usdcAddress],
      [500, 100]
    );
    await etherfiRestakingDNVault.waitForDeployment();

    console.log(
      "deploy rockOnyxDeltaNeutralVaultContract successfully: %s",
      await etherfiRestakingDNVault.getAddress()
    );
  }

  beforeEach(async function () {
    [admin, user1, user2, user3, user4] = await ethers.getSigners();
    perpDexRecipientAddress = await user4.getAddress();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdt = await ethers.getContractAt("IERC20", usdtAddress);

    await deployPriceConsumerContract();
    await deployUniSwapContract();
    await deployEtherfiRestakingDeltaNeutralVault();
    console.log("deployEtherfiRestakingDeltaNeutralVault");
  });

  async function deposit(sender: Signer, amount: BigNumberish, token: Contracts.IERC20, tokenTransit: Contracts.IERC20) {
    await token
      .connect(sender)
      .approve(await etherfiRestakingDNVault.getAddress(), amount);

    await etherfiRestakingDNVault.connect(sender).deposit(amount, token, tokenTransit);
  }

  async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
    const transferTx = await token.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await etherfiRestakingDNVault
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
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
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await etherfiRestakingDNVault
      .connect(user2)
      .initiateWithdrawal(99.9 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await etherfiRestakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(99.9 * 1e6);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await etherfiRestakingDNVault
      .connect(user2)
      .completeWithdrawal(99.9 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost,PRECISION);
  });

  it.skip("user deposit -> deposit to perp dex -> deposit to etherfi", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await etherfiRestakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await etherfiRestakingDNVault
      .connect(admin)
      .openPosition(BigInt(0.01 * 1e18));
    await openPositionTx.wait();
  });

  it("user deposit -> deposit to perp dex -> open position -> close position -> sync restaking balance -> withdraw", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 200 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await etherfiRestakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await etherfiRestakingDNVault
      .connect(admin)
      .openPosition(BigInt(0.02 * 1e18));
    await openPositionTx.wait();

    console.log("-------------sync restaking balance---------------");
    const syncBalanceTx = await etherfiRestakingDNVault
      .connect(admin)
      .syncBalance(200*1e6);
    await syncBalanceTx.wait();

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(350 * 1e6, PRECISION);
  });

  it.skip("user deposit -> deposit to perp dex -> withdraw", async function () {
    console.log("-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 200 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    await etherfiRestakingDNVault.connect(admin).depositToVendor();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await etherfiRestakingDNVault
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    await usdc.connect(admin).approve(await etherfiRestakingDNVault.getAddress(), 50 * 1e6);
    const handlePostWithdrawTx = await etherfiRestakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(50*1e6);
    await handlePostWithdrawTx.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await etherfiRestakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(100*1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await etherfiRestakingDNVault
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost, PRECISION);
    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(200 * 1e6, PRECISION);
  });

  it.skip("migration, export and import data to new delta neutral vault", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner("0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D");
    const contract = await ethers.getContractAt("EtherfiRestakingDeltaNeutralVault", "0x2B7cDAD36a86fd05Ac1680CDc42a0EA16804D80c");

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await contract
    .connect(contractAdmin)
    .exportVaultState();
    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[0][0][1]);
    console.log(exportVaultStateTx[0][1][1]);
  
    console.log("Deposit ");
    exportVaultStateTx[0].forEach((element: any[][]) => {
      console.log(element);
    });

    console.log("withdraw ");
    exportVaultStateTx[1].forEach((element: any[][]) => {
      console.log(element);
    });

    const etherfiRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "EtherfiRestakingDeltaNeutralVault"
    );

    const newContract = await etherfiRestakingDeltaNeutralVault.deploy(
      admin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      wethAddress,
      aevoAddress,
      aevoRecipientAddress,
      aevoConnectorAddress,
      rsEthAddress,
      BigInt(1 * 1e6),
      [etherfiDepositAddress, zircuitDepositAddress],
      etherfiDepositRefId,
      await uniSwapContract.getAddress(),
      [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
      [wethAddress, wethAddress, usdcAddress, usdtAddress],
      // ethereum
      // [500, 500, 100, 100]
      // arbitrum
      [500, 100, 100, 100]
    );
    await newContract.waitForDeployment();

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
      networkCost: exportVaultStateTx[2][6] == 0 ? 1e6 : exportVaultStateTx[2][6]
    };
    const _vaultState = {
      performanceFeeAmount: exportVaultStateTx[3][0],
      managementFeeAmount: exportVaultStateTx[3][1],
      withdrawPoolAmount: exportVaultStateTx[3][2],
      pendingDepositAmount: exportVaultStateTx[3][3],
      totalShares: exportVaultStateTx[3][4],
    };
    const _ethStakeLendState = {
      unAllocatedBalance: exportVaultStateTx[4][0],
      totalBalance: exportVaultStateTx[4][1],
    };
    const _perpDexState = {
      unAllocatedBalance: exportVaultStateTx[5][0],
      perpDexBalance: exportVaultStateTx[5][1],
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
    exportVaultStateTx = await newContract
    .connect(admin)
    .exportVaultState();

    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[0][0][1]);
    console.log(exportVaultStateTx[0][1][1]);

    console.log("Deposit ");
    exportVaultStateTx[0].forEach((element: any[][]) => {
      console.log(element);
    });

    console.log("withdraw ");
    exportVaultStateTx[1].forEach((element: any[][]) => {
      console.log(element);
    });
  });
});