
const { ethers, network } = require("hardhat");
import { expect } from "chai";

import * as Contracts from "../typechain-types";
import {
  CHAINID,
  USDC_ADDRESS,
  AEVO_ADDRESS,
} from "../constants";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;
const privateKey = process.env.PRIVATE_KEY || "";
const aevoAddress = AEVO_ADDRESS[chainId] || "";
const usdcAddress = USDC_ADDRESS[chainId] || "";
let usdc: Contracts.IERC20;

async function main() {
    console.log('-------------deposit to aevo---------------');

    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const user = new ethers.Wallet(privateKey, ethers.provider);

    const contract = await ethers.getContractAt("IPerpDexProxy", aevoAddress);
    const l1Token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const l2Token = "0x643aaB1618c600229785A5E06E4b2d13946F7a1A";

    // update aevoReceiver
    const aevoReceiver = 0x643aaB1618c600229785A5E06E4b2d13946F7a1A;
    //

    let balance = await usdc.connect(user).balanceOf(user);
    console.log("usdc of user before deposit %s", balance);

    const depositAmount = 1 * 1e6;
    
    await usdc.connect(user).approve(await contract.getAddress(), depositAmount);
    await contract.connect(user).depositERC20To(
        l1Token,
        l2Token,
        aevoReceiver,
        depositAmount,
        500000,
        "0x"
    );
    balance = await usdc.connect(user).balanceOf(user);
    console.log("usdc of user after deposit %s", balance);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  