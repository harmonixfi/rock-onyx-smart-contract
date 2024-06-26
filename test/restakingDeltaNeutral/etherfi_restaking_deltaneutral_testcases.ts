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
    DAI_IMPERSONATED_SIGNER_ADDRESS,
    ETH_PRICE_FEED_ADDRESS,
    USDT_PRICE_FEED_ADDRESS,
    DAI_PRICE_FEED_ADDRESS,
    EZETH_ETH_PRICE_FEED_ADDRESS,
    EZETH_ADDRESS,
    ZIRCUIT_DEPOSIT_ADDRESS,
    ETHERFI_DEPOSIT_ADDRESS,
    NETWORK_COST,
    WETH_IMPERSONATED_SIGNER_ADDRESS,
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
    let weth: Contracts.IERC20;

    const wethImpersonatedSigner = WETH_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const usdcAddress = USDC_ADDRESS[chainId] || '';
    const usdtAddress = USDT_ADDRESS[chainId] || '';
    const daiAddress = DAI_ADDRESS[chainId] || '';
    const wethAddress = WETH_ADDRESS[chainId] || '';
    const ezEthAddress = EZETH_ADDRESS[chainId] || '';
    const swapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
    const aevoAddress = AEVO_ADDRESS[chainId];
    const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];
    const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
    const ezEth_EthPriceFeed = EZETH_ETH_PRICE_FEED_ADDRESS[chainId];
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
            [wethAddress, ezEthAddress, usdtAddress, daiAddress],
            [usdcAddress, wethAddress, usdcAddress, usdtAddress],
            [ethPriceFeed, ezEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed]
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

        etherfiRestakingDNVault =
            await etherFiRestakingDeltaNeutralVault.deploy(
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
                [etherfiDepositAddress, zircuitDepositAddress],
                await uniSwapContract.getAddress(),
                [usdcAddress, ezEthAddress, usdtAddress, daiAddress],
                [wethAddress, wethAddress, usdcAddress, usdtAddress],
                [500, 100, 100, 100]
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
        weth = await ethers.getContractAt("IERC20", wethAddress);
        console.log("NINVB => weth ", weth);
        
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

    it("seed data", async () => {
        
    })
});
