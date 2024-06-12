const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  DAI_IMPERSONATED_SIGNER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  EZETH_ETH_PRICE_FEED_ADDRESS,
  EZETH_ADDRESS,
  ZIRCUIT_DEPOSIT_ADDRESS,
  RENZO_DEPOSIT_ADDRESS,
  NETWORK_COST
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ",chainId);
let aevoRecipientAddress : string;

const PRECISION = 2 * 1e6;

describe("RenzoRestakingDeltaNeutralVault", function () {
  let admin: Signer,
    user1: Signer,
    user2: Signer,
    user3: Signer,
    user4: Signer;

  let renzoRestakingDNVault: Contracts.RenzoRestakingDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let usdt: Contracts.IERC20;
  let dai: Contracts.IERC20;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const ezEthAddress = EZETH_ADDRESS[chainId] || "";
  const swapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const ezEth_EthPriceFeed = EZETH_ETH_PRICE_FEED_ADDRESS[chainId];
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId];
  const renzoDepositAddress = RENZO_DEPOSIT_ADDRESS[chainId];
  const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId];
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let priceConsumerContract: Contracts.PriceConsumer;
  let uniSwapContract: Contracts.UniSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, ezEthAddress, usdtAddress , daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdtAddress],
      [ethPriceFeed, ezEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed]
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

  async function deployRenzoRestakingDeltaNeutralVault() {
    const renzoRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "RenzoRestakingDeltaNeutralVault"
    );

    renzoRestakingDNVault = await renzoRestakingDeltaNeutralVault.deploy(
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
      ezEthAddress,
      BigInt(1 * 1e6),
      [renzoDepositAddress, zircuitDepositAddress],
      await uniSwapContract.getAddress(),
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

  beforeEach(async function () {
    [admin, user1, user2, user3, user4] = await ethers.getSigners();
    aevoRecipientAddress = await user4.getAddress();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdt = await ethers.getContractAt("IERC20", usdtAddress);
    dai = await ethers.getContractAt("IERC20", daiAddress);

    await deployPriceConsumerContract();
    await deployUniSwapContract();
    await deployRenzoRestakingDeltaNeutralVault();
    console.log("deployRenzoRestakingDeltaNeutralVault");
  });

  async function deposit(sender: Signer, amount: BigNumberish, token: Contracts.IERC20, tokenTransit: Contracts.IERC20) {
    await token
      .connect(sender)
      .approve(await renzoRestakingDNVault.getAddress(), amount);

    await renzoRestakingDNVault.connect(sender).deposit(amount, token, tokenTransit);
  }

  async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
    const transferTx = await token.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await renzoRestakingDNVault
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(usdcImpersonatedSigner);
    const usdtSigner = await ethers.getImpersonatedSigner(usdtImpersonatedSigner);
    const daiSigner = await ethers.getImpersonatedSigner(daiImpersonatedSigner);

    await transferForUser(usdc, usdcSigner, user1, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, user2, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, user3, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, user4, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, admin, 100000 * 1e6);

    await transferForUser(usdt, usdtSigner, user2, 100000 * 1e6);
    await transferForUser(dai, daiSigner, user2, BigInt(100000 * 1e18));
  });

  it("test rock onyx access contral", async function () {
    const ROCK_ONYX_ADMIN_ROLE = "0xdf7ae06225b060fdb3477e253632ba0fef61b138e661391f47b795efaa9c6388";
    const grantRoleTx = await renzoRestakingDNVault
    .connect(admin)
    .grantRole(ROCK_ONYX_ADMIN_ROLE, user2);
    await grantRoleTx.wait();

    let hasRoleTx = await renzoRestakingDNVault
    .connect(admin)
    .hasRole(ROCK_ONYX_ADMIN_ROLE, user2);
    
    console.log("hasRoleTx %s", hasRoleTx);
    expect(hasRoleTx).to.equals(true);

    const revokeRoleTx = await renzoRestakingDNVault
    .connect(user2)
    .revokeRole(ROCK_ONYX_ADMIN_ROLE, admin);
    await revokeRoleTx.wait();

    hasRoleTx = await renzoRestakingDNVault
    .connect(user2)
    .hasRole(ROCK_ONYX_ADMIN_ROLE, admin);    
    expect(hasRoleTx).to.equals(false);

    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    if(chainId == CHAINID.ETH_MAINNET){
      await expect(
        renzoRestakingDNVault.connect(admin).depositToVendor(500000)).to.be.revertedWith('ROCK_ONYX_ADMIN_ROLE_ERROR');
    }else{
      await expect(
        renzoRestakingDNVault.connect(admin).depositToVendorL2(650000, { 
          value: ethers.parseEther("0.000159539385325246")
        })).to.be.revertedWith('ROCK_ONYX_ADMIN_ROLE_ERROR');
    }
  });

  it("user deposit -> withdraw", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 50 * 1e6, usdt, usdt);
    await deposit(user2, BigInt(50 * 1e18), dai, usdt);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await renzoRestakingDNVault
      .connect(user2)
      .initiateWithdrawal(99.9 * 1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await renzoRestakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(99.9 * 1e6);
    await handleWithdrawalFundsTx.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await renzoRestakingDNVault
      .connect(user2)
      .completeWithdrawal(99.9 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost, PRECISION);
  });

  it("user deposit -> deposit to perp dex -> deposit to renzo -> deposit to zircuit", async function () {
    console.log(
      "-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 10 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    if(chainId == CHAINID.ETH_MAINNET){
      await renzoRestakingDNVault.connect(admin).depositToVendor(500000);
      totalValueLock = await logAndReturnTotalValueLock();
    }else{
      await renzoRestakingDNVault.connect(admin).depositToVendorL2(650000, {
        value: ethers.parseEther("0.000159539385325246"),
      });
    }
    expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await renzoRestakingDNVault
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
    if(chainId == CHAINID.ETH_MAINNET){
      await renzoRestakingDNVault.connect(admin).depositToVendor(500000);
      totalValueLock = await logAndReturnTotalValueLock();
    }else{
      await renzoRestakingDNVault.connect(admin).depositToVendorL2(650000, {
        value: ethers.parseEther("0.000159539385325246"),
      });
    }
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------open position---------------");
    const openPositionTx = await renzoRestakingDNVault
      .connect(admin)
      .openPosition(BigInt(0.02 * 1e18));
    await openPositionTx.wait();

    console.log("-------------sync restaking balance---------------");
    const syncBalanceTx = await renzoRestakingDNVault
      .connect(admin)
      .syncBalance(150*1e6);
    await syncBalanceTx.wait();

    console.log("-------------close position---------------");
    const closePositionTx = await renzoRestakingDNVault
      .connect(admin)
      .closePosition(BigInt(0.01 * 1e18));
    await closePositionTx.wait();

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await renzoRestakingDNVault
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    await usdc.connect(admin).approve(await renzoRestakingDNVault.getAddress(), 50 * 1e6);
    const handlePostWithdrawTx = await renzoRestakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(50*1e6);
    await handlePostWithdrawTx.wait();
    
    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await renzoRestakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(100*1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await renzoRestakingDNVault
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

  it("user deposit -> deposit to perp dex -> withdraw", async function () {
    console.log("-------------deposit to restakingDeltaNeutralVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 200 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------deposit to vendor on aevo---------------");
    if(chainId == CHAINID.ETH_MAINNET){
      await renzoRestakingDNVault.connect(admin).depositToVendor(500000);
      totalValueLock = await logAndReturnTotalValueLock();
    }else{
      await renzoRestakingDNVault.connect(admin).depositToVendorL2(650000, {
        value: ethers.parseEther("0.000159539385325246"),
      });
    }
    expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);

    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await renzoRestakingDNVault
      .connect(user2)
      .initiateWithdrawal(100 * 1e6);
    await initiateWithdrawalTx1.wait();

    await usdc.connect(admin).approve(await renzoRestakingDNVault.getAddress(), 50 * 1e6);
    const handlePostWithdrawTx = await renzoRestakingDNVault
      .connect(admin)
      .handlePostWithdrawFromVendor(50*1e6);
    await handlePostWithdrawTx.wait();

    console.log("-------------handleWithdrawalFunds---------------");
    const handleWithdrawalFundsTx = await renzoRestakingDNVault
      .connect(admin)
      .acquireWithdrawalFunds(100*1e6);
    await initiateWithdrawalTx1.wait();

    console.log("-------------complete withdrawals---------------");
    let user2Balance = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user before withdraw %s", user2Balance);

    const completeWithdrawalTx = await renzoRestakingDNVault
      .connect(user2)
      .completeWithdrawal(100 * 1e6);
    await completeWithdrawalTx.wait();

    let user1BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
    console.log("usdc of user after withdraw %s", user1BalanceAfterWithdraw);
    expect(user1BalanceAfterWithdraw).to.approximately(user2Balance + BigInt(100 * 1e6) - networkCost, PRECISION);
    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(201 * 1e6, PRECISION);
  });

  it.skip("migration, export and import data to new delta neutral vault - 213900665", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner("0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7");
    const contract = await ethers.getContractAt("RenzoRestakingDeltaNeutralVault", "0xAB2308327A35407d263A1D41eC2E80f0F10Ff45B");

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

    const newRockOnyxDeltaNeutralVault = await ethers.getContractFactory(
      "RenzoRestakingDeltaNeutralVault"
    );

    const newRockOnyxDeltaNeutralVaultContract =
      await newRockOnyxDeltaNeutralVault.deploy(
        usdcAddress,
        wethAddress,
        aevoAddress,
        aevoRecipientAddress,
        aevoConnectorAddress,
        ezEthAddress,
        BigInt(1 * 1e6),
        [renzoDepositAddress, zircuitDepositAddress],
        await uniSwapContract.getAddress(),
        [usdcAddress, ezEthAddress, usdtAddress, daiAddress],
        [wethAddress, wethAddress, usdcAddress, usdtAddress],
        [500, 100, 100, 100]
      );
    await newRockOnyxDeltaNeutralVaultContract.waitForDeployment();
  
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
    console.log("-------------export new vault state---------------");
    exportVaultStateTx = await newRockOnyxDeltaNeutralVaultContract
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

  it.skip("migration, export and import data to new delta neutral vault - 213900665", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner("0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7");
    const contract = await ethers.getContractAt("RenzoRestakingDeltaNeutralVault", "0xED6599C7308B2F6B7cd28A9c1FA794F090E48AC3");

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await contract
    .connect(contractAdmin)
    .exportVaultState();
    console.log(exportVaultStateTx);

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