import { ethers, upgrades, network } from "hardhat";

import {
    CHAINID,
    WETH_ADDRESS,
    USDC_ADDRESS,
    USDT_ADDRESS,
    DAI_ADDRESS,
    AEVO_ADDRESS,
    AEVO_CONNECTOR_ADDRESS,
    EZETH_ADDRESS,
    RENZO_DEPOSIT_ADDRESS,
    UNI_SWAP_ADDRESS,
    RENZO_TOKEN_HOLDER_ADDRESS
} from "../constants";
import * as Contracts from "../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const usdcAddress = USDC_ADDRESS[chainId] || "";
const usdtAddress = USDT_ADDRESS[chainId] || "";
const daiAddress = DAI_ADDRESS[chainId] || "";
const wethAddress = WETH_ADDRESS[chainId] || "";
const ezEthAddress = EZETH_ADDRESS[chainId] || "";
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || "";
const aevoAddress = AEVO_ADDRESS[chainId] || "";
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || "";
const renzoDepositAddress = RENZO_DEPOSIT_ADDRESS[chainId] || "";
const renzoTokenHolderAddress = RENZO_TOKEN_HOLDER_ADDRESS[chainId] || "";
const admin = '0xDA323b84De8a94088a942F8Cc4437aC40ceE2C56';

/** TEST */
// ether mainnet wallet
const aevoRecipientAddress = "0x8513268F086f87a4973295cD23603EdFd3cb0121";

let renzoRestakingDNVault: Contracts.RenzoRestakingDeltaNeutralVault;

async function deployRenzoRestakingDeltaNeutralVault() {
    const renzoRestakingDeltaNeutralVault = await ethers.getContractFactory(
        "RenzoRestakingDeltaNeutralVault"
    );

    renzoRestakingDNVault = await upgrades.deployProxy(
        renzoRestakingDeltaNeutralVault,
        [
            admin,
            usdcAddress,
            6,
            BigInt(5 * 1e6),
            BigInt(1000000 * 1e6),
            BigInt(1 * 1e6),
            wethAddress,
            aevoAddress,
            aevoRecipientAddress,
            aevoConnectorAddress,
            ezEthAddress,
            BigInt(1 * 1e6),
            [renzoDepositAddress, renzoTokenHolderAddress],
            uniSwapAddress,
            [usdcAddress, ezEthAddress, usdtAddress, daiAddress],
            [wethAddress, wethAddress, usdcAddress, usdtAddress],
            [500, 100, 100, 100]
        ],
        { initializer: "initialize" }
    );

    await renzoRestakingDNVault.waitForDeployment();

    const proxyAddress = await renzoRestakingDNVault.getAddress();
    console.log(
        "Deploy renzoRestakingDNVault successfully: %s",
        proxyAddress
    );

    // Print the implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(
        "renzoRestakingDNVault implementation address: %s",
        implementationAddress
    );
}

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log(
        "Deploying contracts with the account:",
        await deployer.getAddress()
    );

    // MAINNET 
    await deployRenzoRestakingDeltaNeutralVault();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
