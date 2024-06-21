const { ethers, network } = require("hardhat");

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  USDC_ADDRESS,
  AEVO_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;

describe("DepositToAevoTest", function () {
  let admin: Signer
  let usdc: Contracts.IERC20;

  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const aevoAddress = AEVO_ADDRESS[chainId] || "";

  async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
    const transferTx = await token.connect(from).transfer(to, amount);
    await transferTx.wait();
  }
  
  beforeEach(async function () {
    [admin] = await ethers.getSigners();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
  });

  it("Deposit to Aevo test", async function () {
    console.log('-------------deposit to aevo---------------');

    const usdcSigner = await ethers.getImpersonatedSigner(usdcImpersonatedSigner);
    await transferForUser(usdc, usdcSigner, admin, 100000 * 1e6);

    const contract = await ethers.getContractAt("IPerpDexProxy", aevoAddress);
    const l1Token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const l2Token = "0x643aaB1618c600229785A5E06E4b2d13946F7a1A";
    
    const aevoReceiver = admin;

    let adminBalance = await usdc.connect(admin).balanceOf(admin);
    console.log("usdc of user before deposit %s", adminBalance);
    
    const depositAmount = 1 * 1e6;

    await usdc.connect(admin).approve(await contract.getAddress(), depositAmount);
    await contract.connect(admin).depositERC20To(
        l1Token,
        l2Token,
        aevoReceiver,
        depositAmount,
        500000,
        "0x"
    );
    adminBalance = await usdc.connect(admin).balanceOf(admin);
    console.log("usdc of user after deposit %s", adminBalance);
  });
});
