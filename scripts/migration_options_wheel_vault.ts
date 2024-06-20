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
    console.log('-------------migration option wheel---------------');
     const oldAdmin = new ethers.Wallet(oldPrivateKey, ethers.provider);
    console.log("old admin address %s", await oldAdmin.getAddress());
    const oldVaultAddress = "0x316CDbBEd9342A1109D967543F81FA6288eBC47D";
    const exportABI = [{
      "inputs": [],
      "name": "exportVaultState",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
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
                  "name": "round",
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
              "name": "currentRoundFeeAmount",
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
            },
            {
              "internalType": "uint256",
              "name": "lastLockedAmount",
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
              "name": "ethLPRatio",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "usdLPRatio",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "optionsRatio",
              "type": "uint256"
            },
            {
              "internalType": "uint8",
              "name": "decimals",
              "type": "uint8"
            }
          ],
          "internalType": "struct AllocateRatio",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "tokenId",
              "type": "uint256"
            },
            {
              "internalType": "uint128",
              "name": "liquidity",
              "type": "uint128"
            },
            {
              "internalType": "int24",
              "name": "lowerTick",
              "type": "int24"
            },
            {
              "internalType": "int24",
              "name": "upperTick",
              "type": "int24"
            },
            {
              "internalType": "uint256",
              "name": "unAllocatedBalance",
              "type": "uint256"
            }
          ],
          "internalType": "struct EthLPState",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "tokenId",
              "type": "uint256"
            },
            {
              "internalType": "uint128",
              "name": "liquidity",
              "type": "uint128"
            },
            {
              "internalType": "int24",
              "name": "lowerTick",
              "type": "int24"
            },
            {
              "internalType": "int24",
              "name": "upperTick",
              "type": "int24"
            },
            {
              "internalType": "uint256",
              "name": "unAllocatedUsdcBalance",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "unAllocatedUsdceBalance",
              "type": "uint256"
            }
          ],
          "internalType": "struct UsdLPState",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "allocatedUsdcBalance",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "unAllocatedUsdcBalance",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "unsettledProfit",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "unsettledLoss",
              "type": "uint256"
            }
          ],
          "internalType": "struct OptionsStrategyState",
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

    const newVaultAddress = "0x316CDbBEd9342A1109D967543F81FA6288eBC47D";
    const newContract = await ethers.getContractAt("RockOnyxUSDTVault", newVaultAddress);

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await oldContract
      .connect(oldAdmin)
      .exportVaultState();
    
    console.log("currentRound %s", exportVaultStateTx[0]);
    console.log("exportRoundWithdrawalShares %s", exportVaultStateTx[1]);
    console.log("exportRoundPricePerShares %s", exportVaultStateTx[2]);
    console.log("depositReceiptArr %s", exportVaultStateTx[3]);
    console.log("withdrawalArr %s", exportVaultStateTx[4]);
    console.log("vaultParams %s", exportVaultStateTx[5]);
    console.log("vaultState %s", exportVaultStateTx[6]);
    console.log("allocateRatio %s", exportVaultStateTx[7]);
    console.log("ethLPState %s", exportVaultStateTx[8]);
    console.log("usdLPState %s", exportVaultStateTx[9]);
    console.log("optionsState %s", exportVaultStateTx[10]);

    console.log("-------------import vault state---------------");
    const _currentRound = exportVaultStateTx[0];
    const _roundWithdrawalShares = [...exportVaultStateTx[1]];
    const _roundPricePerShares = [...exportVaultStateTx[2]];
    const _depositReceiptArr = exportVaultStateTx[3].map((element : any[][]) => {
        return {
          owner: element[0],
          depositReceipt: {
            shares: element[1][0],
            depositAmount: element[1][1],
          },
        };
    });
    const _withdrawalArr = exportVaultStateTx[4].map((element : any[][]) => {
        return {
          owner: element[0],
          withdrawal: {
            shares: element[1][0],
            round: element[1][1],
          },
        };
    });
    const _vaultParams = {
        decimals: exportVaultStateTx[5][0],
        asset: exportVaultStateTx[5][1],
        minimumSupply: exportVaultStateTx[5][2],
        cap: exportVaultStateTx[5][3],
        performanceFeeRate: exportVaultStateTx[5][4],
        managementFeeRate: exportVaultStateTx[5][5]
    };
    const _vaultState = {
        withdrawPoolAmount: exportVaultStateTx[6][3],
        pendingDepositAmount: exportVaultStateTx[6][4],
        totalShares: exportVaultStateTx[6][5],
        totalFeePoolAmount: exportVaultStateTx[6][0] + exportVaultStateTx[6][1],
        lastUpdateManagementFeeDate: (await ethers.provider.getBlock('latest')).timestamp,
    };
    const _allocateRatio = {
        ethLPRatio: exportVaultStateTx[7][0],
        usdLPRatio: exportVaultStateTx[7][1],
        optionsRatio: exportVaultStateTx[7][2],
        decimals: exportVaultStateTx[7][3],
    };
    const _ethLPState = {
        tokenId: exportVaultStateTx[8][0],
        liquidity: exportVaultStateTx[8][1],
        lowerTick: exportVaultStateTx[8][2],
        upperTick: exportVaultStateTx[8][3],
        unAllocatedBalance: exportVaultStateTx[8][4],
    };
    const _usdLPState = {
        tokenId: exportVaultStateTx[9][0],
        liquidity: exportVaultStateTx[9][1],
        lowerTick: exportVaultStateTx[9][2],
        upperTick: exportVaultStateTx[9][3],
        unAllocatedUsdcBalance: exportVaultStateTx[9][4],
        unAllocatedUsdceBalance: exportVaultStateTx[9][5],
    };
    const _optiondsState = {
        allocatedUsdcBalance: exportVaultStateTx[10][0],
        unAllocatedUsdcBalance: exportVaultStateTx[10][1],
        unsettledProfit: exportVaultStateTx[10][2],
        unsettledLoss: exportVaultStateTx[10][3],
    };

    const importVaultStateTx = await newContract
      .connect(newAdmin)
      .importVaultState(
          _currentRound,
          _roundWithdrawalShares,
          _roundPricePerShares,
          _depositReceiptArr,
          _withdrawalArr,
          _vaultParams,
          _vaultState,
          _allocateRatio,
          _ethLPState,
          _usdLPState,
          _optiondsState
      );
    
    console.log("-------------export new vault state---------------");
    exportVaultStateTx = await newContract
      .connect(newAdmin)
      .exportVaultState();
    
    console.log("currentRound %s", exportVaultStateTx[0]);
    console.log("exportRoundWithdrawalShares %s", exportVaultStateTx[1]);
    console.log("exportRoundPricePerShares %s", exportVaultStateTx[2]);
    console.log("depositReceiptArr %s", exportVaultStateTx[3]);
    console.log("withdrawalArr %s", exportVaultStateTx[4]);
    console.log("vaultParams %s", exportVaultStateTx[5]);
    console.log("vaultState %s", exportVaultStateTx[6]);
    console.log("allocateRatio %s", exportVaultStateTx[7]);
    console.log("ethLPState %s", exportVaultStateTx[8]);
    console.log("usdLPState %s", exportVaultStateTx[9]);
    console.log("optionsState %s", exportVaultStateTx[10]);
  }
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });