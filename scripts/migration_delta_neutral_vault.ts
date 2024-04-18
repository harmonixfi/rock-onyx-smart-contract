const { ethers, network } = require("hardhat");
import axios from "axios";

import * as Contracts from "../typechain-types";
import {
  CHAINID
} from "../constants";

const chainId: CHAINID = network.config.chainId;
const privateKey = process.env.PRIVATE_KEY || "";

let rockOnyxDeltaNeutralVaultContract: Contracts.RockOnyxDeltaNeutralVault;
let newRockOnyxDeltaNeutralVaultContract: Contracts.RockOnyxDeltaNeutralVault;

async function main() {
    console.log('-------------migration delta neutral---------------');
    const admin = new ethers.Wallet(privateKey, ethers.provider);
    const vaultAddress = "0x607b19a600F2928FB4049d2c593794fB70aaf9aa";
    rockOnyxDeltaNeutralVaultContract = await ethers.getContractAt("RockOnyxDeltaNeutralVault", vaultAddress);
    
    const newVaultAddress = "";
    newRockOnyxDeltaNeutralVaultContract = await ethers.getContractAt("RockOnyxDeltaNeutralVault", vaultAddress);

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await rockOnyxDeltaNeutralVaultContract
      .connect(admin)
      .exportVaultState();
  
    console.log(exportVaultStateTx);
    console.log(exportVaultStateTx[0][0][1]);
    console.log(exportVaultStateTx[1][0][1]);
    
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
    console.log(exportVaultStateTx[1][0][1]);
  }
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  