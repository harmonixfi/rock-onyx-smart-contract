const { ethers, network } = require('hardhat');
import { expect } from 'chai';

import * as Contracts from '../../typechain-types';
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
    ETH_PRICE_FEED_ADDRESS,
    USDT_PRICE_FEED_ADDRESS,
    DAI_PRICE_FEED_ADDRESS,
    ZIRCUIT_DEPOSIT_ADDRESS,
    ETHERFI_DEPOSIT_ADDRESS,
    NETWORK_COST,
    WEETH_ADDRESS,
    EETH_ADDRESS,
    WEETH_ETH_PRICE_FEED_ADDRESS,
} from '../../constants';
import { BigNumberish, Signer } from 'ethers';

const chainId: CHAINID = network.config.chainId;
console.log('chainId ', chainId);
let aevoRecipientAddress: string;
const PRECISION = 2 * 1e6;

describe('EtherFiRestakingDeltaNeutralVault', () => {
    let admin: Signer,
        user1: Signer,
        user2: Signer,
        user3: Signer,
        user4: Signer;

    let etherfiRestakingDNVault: Contracts.EtherFiRestakingDeltaNeutralVault;
    let usdc: Contracts.IERC20;
    let usdt: Contracts.IERC20;

    const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const usdcAddress = USDC_ADDRESS[chainId] || '';
    const usdtAddress = USDT_ADDRESS[chainId] || '';
    const daiAddress = DAI_ADDRESS[chainId] || '';
    const wethAddress = WETH_ADDRESS[chainId] || '';
    const eethAddress = EETH_ADDRESS[chainId] || '';
    const weEthAddress = WEETH_ADDRESS[chainId] || '';
    const swapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
    const aevoAddress = AEVO_ADDRESS[chainId];
    const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];
    const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
    const weEth_EthPriceFeed = WEETH_ETH_PRICE_FEED_ADDRESS[chainId];
    const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
    const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId];
    const etherfiDepositAddress = ETHERFI_DEPOSIT_ADDRESS[chainId];
    const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId];
    const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

    let priceConsumerContract: Contracts.PriceConsumer;
    let uniSwapContract: Contracts.UniSwap;

    async function deployPriceConsumerContract() {
        const factory = await ethers.getContractFactory('PriceConsumer');

        priceConsumerContract = await factory.deploy(
            admin,
            [wethAddress, weEthAddress, usdtAddress, daiAddress],
            [usdcAddress, wethAddress, usdcAddress, usdtAddress],
            [ethPriceFeed, weEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed]
        );
        await priceConsumerContract.waitForDeployment();

        console.log(
            'Deployed price consumer contract at address %s',
            await priceConsumerContract.getAddress()
        );
    }

    async function deployUniSwapContract() {
        const factory = await ethers.getContractFactory('UniSwap');
        uniSwapContract = await factory.deploy(
            admin,
            swapRouterAddress,
            priceConsumerContract.getAddress(),
            chainId
        );
        await uniSwapContract.waitForDeployment();

        console.log(
            'Deployed uni swap contract at address %s',
            await uniSwapContract.getAddress()
        );
    }

    async function deployEtherFiRestakingDeltaNeutralVault() {
        const etherFiRestakingDeltaNeutralVault =
        await ethers.getContractFactory(
            'EtherFiRestakingDeltaNeutralVault'
        );

        etherfiRestakingDNVault = await upgrades.deployProxy(
            etherFiRestakingDeltaNeutralVault,
            [
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
                weEthAddress,
                eethAddress,
                BigInt(1 * 1e6),
                [etherfiDepositAddress, zircuitDepositAddress],
                await uniSwapContract.getAddress(),
                [usdcAddress, weEthAddress, usdtAddress, daiAddress],
                [wethAddress, wethAddress, usdcAddress, usdtAddress],
                [500, 500, 100, 100],
                chainId
            ],
            { initializer: "initialize" }
        );

        await etherfiRestakingDNVault.waitForDeployment();

        console.log(
            'deploy etherFiRestakingDeltaNeutralVault successfully: %s',
            await etherfiRestakingDNVault.getAddress()
        );
    }

    beforeEach(async function () {
        [admin, user1, user2, user3, user4] = await ethers.getSigners();
        aevoRecipientAddress = await user4.getAddress();
        usdc = await ethers.getContractAt('IERC20', usdcAddress);
        usdt = await ethers.getContractAt('IERC20', usdtAddress);

        await deployPriceConsumerContract();
        await deployUniSwapContract();
        await deployEtherFiRestakingDeltaNeutralVault();
        console.log('deployEtherFiRestakingDeltaNeutralVault');
    });

    async function deposit(
        sender: Signer,
        amount: BigNumberish,
        token: Contracts.IERC20,
        tokenTransit: Contracts.IERC20
    ) {
        await token
            .connect(sender)
            .approve(await etherfiRestakingDNVault.getAddress(), amount);
        await etherfiRestakingDNVault
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
        const totalValueLocked = await etherfiRestakingDNVault
            .connect(admin)
            .totalValueLocked();

        console.log('totalValueLocked %s', totalValueLocked);

        return totalValueLocked;
    }


    it("seed data", async () => {
        const usdcSigner = await ethers.getImpersonatedSigner(
            usdcImpersonatedSigner
        );
        const usdtSigner = await ethers.getImpersonatedSigner(
            usdtImpersonatedSigner
        );

        await transferForUser(usdc, usdcSigner, user1, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user2, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user3, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user4, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, admin, 100000 * 1e6);

        await transferForUser(usdt, usdtSigner, user2, 100000 * 1e6);
    });

    it.skip("deposit to zircuit", async () => {
        await deposit(user1, 10 * 1e6, usdc, usdc);
        await deposit(user2, 100 * 1e6, usdc, usdc);

        let totalValueLock = await logAndReturnTotalValueLock();
        expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);

        console.log('-------------open position---------------');
        const openPositionTx = await etherfiRestakingDNVault
            .connect(admin)
            .openPosition(BigInt(0.01 * 1e18));
        await openPositionTx.wait();
        console.log('NINVB => openPositionTx ', await openPositionTx);
    });

    it("user deposit -> deposit to perp dex -> open position -> close position -> sync restaking balance -> withdraw", async function () {
        this.timeout(120000);
        console.log(
          "-------------deposit to restakingDeltaNeutralVault---------------"
        );
        await deposit(user1, 100 * 1e6, usdc, usdc);
        await deposit(user2, 200 * 1e6, usdc, usdc);
    
        let totalValueLock = await logAndReturnTotalValueLock();
        expect(totalValueLock).to.approximately(300 * 1e6, PRECISION);
    
        console.log("-------------deposit to vendor on aevo---------------");
        await etherfiRestakingDNVault.connect(admin).depositToVendor(500000);
          totalValueLock = await logAndReturnTotalValueLock();
    
        console.log("-------------open position---------------");
        const openPositionTx = await etherfiRestakingDNVault
          .connect(admin)
          .openPosition(BigInt(0.02 * 1e18));
        await openPositionTx.wait();
    
        console.log("-------------sync restaking balance---------------");
        const syncBalanceTx = await etherfiRestakingDNVault
          .connect(admin)
          .syncBalance(150 * 1e6);
        await syncBalanceTx.wait();

        console.log("-------------sync restaking balance---------------");
        const syncBalanceTx1 = await etherfiRestakingDNVault
          .connect(admin)
          .syncBalance(150 * 1e6);
        await syncBalanceTx1.wait();
    
        console.log("-------------close position---------------");
        const closePositionTx = await etherfiRestakingDNVault
          .connect(admin)
          .closePosition(BigInt(0.01 * 1e18));
        await closePositionTx.wait();
    
        console.log("-------------Users initial withdrawals---------------");
        const initiateWithdrawalTx1 = await etherfiRestakingDNVault
          .connect(user2)
          .initiateWithdrawal(100 * 1e6);
        await initiateWithdrawalTx1.wait();
    
        await usdc
          .connect(admin)
          .approve(await etherfiRestakingDNVault.getAddress(), 50 * 1e6);
        const handlePostWithdrawTx = await etherfiRestakingDNVault
          .connect(admin)
          .handlePostWithdrawFromVendor(50 * 1e6);
        await handlePostWithdrawTx.wait();
    
        console.log("-------------handleWithdrawalFunds---------------");
        await initiateWithdrawalTx1.wait();
    
        console.log("-------------complete withdrawals---------------");
        let user2Balance = await usdc.connect(user2).balanceOf(user2);
        console.log("usdc of user before withdraw %s", user2Balance);
    
        const completeWithdrawalTx = await etherfiRestakingDNVault
          .connect(user2)
          .completeWithdrawal(100 * 1e6);
        await completeWithdrawalTx.wait();
    
        let user2BalanceAfterWithdraw = await usdc.connect(user2).balanceOf(user2);
        console.log("usdc of user after withdraw %s", user2BalanceAfterWithdraw);
        expect(user2BalanceAfterWithdraw).to.approximately(
          user2Balance + BigInt(100 * 1e6) - networkCost,
          PRECISION
        );
      });
});
