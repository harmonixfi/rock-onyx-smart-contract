const { ethers, network } = require("hardhat");
import axios from "axios";

import * as Contracts from "../typechain-types";
import {
  CHAINID
} from "../constants";

const chainId: CHAINID = network.config.chainId;
const privateKey = process.env.PRIVATE_KEY || "";
const oldPrivateKey = process.env.OLD_PRIVATE_KEY || "";

async function main() {
    console.log('-------------migration contract---------------');
    const oldAdmin = new ethers.Wallet(oldPrivateKey, ethers.provider);
    console.log("old admin address %s", await oldAdmin.getAddress());
    const contractAdmin = await ethers.getImpersonatedSigner("0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D");
    const oldVaultAddress = '0xF30353335003E71b42a89314AAaeC437E7Bc8F0B';
    const exportABI = [{
      "inputs": [],
      "name": "exportVaultState",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "shares",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "depositAmount",
                  "type": "uint256"
                }
              ],
              "internalType": "struct DepositReceipt",
              "name": "depositReceipt",
              "type": "tuple"
            }
          ],
          "internalType": "struct DepositReceiptArr[]",
          "name": "",
          "type": "tuple[]"
        },
        {
          "components": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "shares",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "pps",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "profit",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "performanceFee",
                  "type": "uint256"
                },
                {
                  "internalType": "uint256",
                  "name": "withdrawAmount",
                  "type": "uint256"
                }
              ],
              "internalType": "struct Withdrawal",
              "name": "withdrawal",
              "type": "tuple"
            }
          ],
          "internalType": "struct WithdrawalArr[]",
          "name": "",
          "type": "tuple[]"
        },
        {
          "components": [
            {
              "internalType": "uint8",
              "name": "decimals",
              "type": "uint8"
            },
            {
              "internalType": "address",
              "name": "asset",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "minimumSupply",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "cap",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "performanceFeeRate",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "managementFeeRate",
              "type": "uint256"
            }
          ],
          "internalType": "struct VaultParams",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "performanceFeeAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "managementFeeAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "withdrawPoolAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "pendingDepositAmount",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "totalShares",
              "type": "uint256"
            }
          ],
          "internalType": "struct VaultState",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "unAllocatedBalance",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "totalBalance",
              "type": "uint256"
            }
          ],
          "internalType": "struct EthRestakingState",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "unAllocatedBalance",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "perpDexBalance",
              "type": "uint256"
            }
          ],
          "internalType": "struct PerpDexState",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }];
    const oldContract = new ethers.Contract(oldVaultAddress, exportABI, oldAdmin);

    const newAdmin = new ethers.Wallet(privateKey, ethers.provider);
    console.log("new admin address %s", await newAdmin.getAddress());
    const newVaultAddress = "";
    const newContract = await ethers.getContractAt("KelpRestakingDeltaNeutralVault", newVaultAddress);

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await oldContract
      .connect(oldAdmin)
      .exportVaultState();
  
    console.log(exportVaultStateTx);
    
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
      withdrawFeePoolAmount: 0,
      lastUpdateManagementFeeDate: 0
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
      .connect(newAdmin)
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
      .connect(newAdmin)
      .exportVaultState();
  
    console.log(exportVaultStateTx);
  }
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  