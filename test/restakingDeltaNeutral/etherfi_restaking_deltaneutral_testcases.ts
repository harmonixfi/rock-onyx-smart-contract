import { EtherFiZircuitRestakingStrategy } from './../../typechain-types/contracts/vaults/restakingDeltaNeutral/EtherFiZircuit/strategies/EtherFiZircuitRestakingStrategy';
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
    WEETH_ADDRESS,
    EETH_ADDRESS,
} from '../../constants';
import { BigNumberish, Signer } from 'ethers';
import { log } from 'console';

const chainId: CHAINID = network.config.chainId;
console.log('chainId ', chainId);
let aevoRecipientAddress: string;
const ETH_AMOUNT = ethers.parseEther('1');
const PRECISION = 2 * 1e6;

describe('EtherFiRestakingDeltaNeutralVault', () => {
    let admin: Signer,
        user1: Signer,
        user2: Signer,
        user3: Signer,
        user4: Signer;

    let etherfiRestakingDNVault: Contracts.EtherFiRestakingDeltaNeutralVault;
    let etherfiRestakingStrategy: Contracts.EtherFiZircuitRestakingStrategy;
    let weth: Contracts.IERC20;
    let usdc: Contracts.IERC20;
    let usdt: Contracts.IERC20;
    let dai: Contracts.IERC20;
    let eeth: Contracts.IERC20;

    const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const wethImpersonatedSigner = WETH_IMPERSONATED_SIGNER_ADDRESS[chainId];
    const usdcAddress = USDC_ADDRESS[chainId] || '';
    const usdtAddress = USDT_ADDRESS[chainId] || '';
    const daiAddress = DAI_ADDRESS[chainId] || '';
    const wethAddress = WETH_ADDRESS[chainId] || '';
    const eethAddress = EETH_ADDRESS[chainId] || '';
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
                eethAddress,
                BigInt(1 * 1e6),
                [etherfiDepositAddress, zircuitDepositAddress],
                await uniSwapContract.getAddress(),
                [usdcAddress, eethAddress, usdtAddress, daiAddress],
                [wethAddress, wethAddress, usdcAddress, usdtAddress],
                [500, 100, 100, 100]
            );

        await etherfiRestakingDNVault.waitForDeployment();

        console.log(
            'deploy etherFiRestakingDeltaNeutralVault successfully: %s',
            await etherfiRestakingDNVault.getAddress()
        );
    }

    async function deployEtherFiRestakingStrategy() {
        const etherFiZircuitRestakingStrategy = await ethers.getContractFactory(
            'EtherFiZircuitRestakingStrategy'
        );

        etherfiRestakingStrategy = await etherFiZircuitRestakingStrategy.deploy();
        await etherfiRestakingStrategy.waitForDeployment();

        console.log(
            'deploy etherfiRestakingStrategy successfully: %s',
            await etherfiRestakingStrategy.getAddress()
        );
    }

    beforeEach(async function () {
        [admin, user1, user2, user3, user4] = await ethers.getSigners();
        aevoRecipientAddress = await user4.getAddress();
        weth = await ethers.getContractAt("IERC20", wethAddress);
        usdc = await ethers.getContractAt('IERC20', usdcAddress);
        usdt = await ethers.getContractAt('IERC20', usdtAddress);
        dai = await ethers.getContractAt('IERC20', daiAddress);
        eeth = await ethers.getContractAt('IERC20', eethAddress);

        await deployPriceConsumerContract();
        await deployUniSwapContract();
        await deployEtherFiRestakingDeltaNeutralVault();
        await deployEtherFiRestakingStrategy();
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

    async function depositToKelpDaoProxy() {
        await expect(() =>
            admin.sendTransaction({
                to: etherfiRestakingStrategy.getAddress(),
                value: ETH_AMOUNT,
            })
        ).to.changeEtherBalance(etherfiRestakingStrategy, ETH_AMOUNT);
    }

    it("seed data", async () => {
        const usdcSigner = await ethers.getImpersonatedSigner(
            usdcImpersonatedSigner
        );
        const usdtSigner = await ethers.getImpersonatedSigner(
            usdtImpersonatedSigner
        );
        const daiSigner = await ethers.getImpersonatedSigner(
            daiImpersonatedSigner
        );

        await transferForUser(usdc, usdcSigner, user1, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user2, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user3, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, user4, 100000 * 1e6);
        await transferForUser(usdc, usdcSigner, admin, 100000 * 1e6);

        await transferForUser(usdt, usdtSigner, user2, 100000 * 1e6);
    });

    it.skip("test rock onyx access contral", async () => {
        const ROCK_ONYX_ADMIN_ROLE = "0xdf7ae06225b060fdb3477e253632ba0fef61b138e661391f47b795efaa9c6388";
        //grant role user2 to admin
        const grantRoleTx = await etherfiRestakingDNVault.connect(admin).grantRole(ROCK_ONYX_ADMIN_ROLE, user2);
        await grantRoleTx.wait();
        //check user2 is admin
        let hasRoleTx = await etherfiRestakingDNVault.connect(admin).hasRole(ROCK_ONYX_ADMIN_ROLE, user2);
        console.log('hasRoleTx %s', hasRoleTx);
        expect(hasRoleTx).to.equal(true);
        //revoke role user admin
        const revokeRoleTx = await etherfiRestakingDNVault.connect(user2).revokeRole(ROCK_ONYX_ADMIN_ROLE, admin);
        await revokeRoleTx.wait();
        //check role current user admin
        hasRoleTx = await etherfiRestakingDNVault.connect(user2).hasRole(ROCK_ONYX_ADMIN_ROLE, admin);
        console.log('hasRoleTx %s', hasRoleTx);
        expect(hasRoleTx).to.equal(false);

        await deposit(user1, 10 * 1e6, usdc, usdc);
        await deposit(user2, 100 * 1e6, usdc, usdc);

        let totalValueLock = await logAndReturnTotalValueLock();
        expect(totalValueLock).to.approximately(110 * 1e6, PRECISION);
    })

    it("deposit to zircuit", async () => {
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
    }) 
});
