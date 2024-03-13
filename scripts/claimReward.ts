const { ethers, network } = require("hardhat");
import axios from "axios";

import * as Contracts from "../typechain-types";
import {
  CHAINID,
  ARB_ADDRESS} from "../constants";

const chainId: CHAINID = network.config.chainId;
// const chainId: CHAINID = 42161;

let rockOnyxUSDTVaultContract: Contracts.RockOnyxUSDTVault;
let arb: Contracts.IERC20;

async function main() {
    console.log('-------------claim reward on Camelot---------------');
    const arbAddress = ARB_ADDRESS[chainId];
    arb = await ethers.getContractAt("IERC20", arbAddress);
    const contractAdmin = await ethers.getImpersonatedSigner("0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7");
    rockOnyxUSDTVaultContract = await ethers.getContractAt("RockOnyxUSDTVault", "0x01cdc1dc16c677dfd4cfde4478aaa494954657a0");

    interface TransactionData {
      [token: string]: {
        proof?: any; // Define the type for proof
        claim: any; // Define the type for claim
      };
    }

    let transactionData : TransactionData;
    try {
      const { data } = await axios.get(
        `https://api.angle.money/v1/merkl?chainId=42161&user=0x01cdc1dc16c677dfd4cfde4478aaa494954657a0`,
        {
          timeout: 5000,
        }
      );
      
      transactionData  = data[chainId].transactionData;
    } catch (error) {
      throw new Error("Angle API not responding");
    }
    const tokens = Object.keys(transactionData).filter(
      (k) => transactionData[k].proof !== undefined
    );
    const claims = tokens.map((t) => transactionData[t].claim);
    const proofs = tokens.map((t) => transactionData[t].proof);  
    const users = tokens.map((t) => "0x01cdc1dc16c677dfd4cfde4478aaa494954657a0");

    console.log(tokens);
    console.log(claims);
    console.log(proofs);
    console.log(await arb.balanceOf("0x01cdc1dc16c677dfd4cfde4478aaa494954657a0"));

    const claimlTx = await rockOnyxUSDTVaultContract
      .connect(contractAdmin)
      .claimReward(users, tokens, claims, proofs as string[][]);
    await claimlTx.wait();

    console.log(await arb.balanceOf("0x01cdc1dc16c677dfd4cfde4478aaa494954657a0"));
  }

  // We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  