// require('dotenv').config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const { PRIVATE_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    ethereum: {
      url: "https://mainnet.infura.io/v3/85cde589ce754dafa0a57001c326104d",
      accounts: [
        `0xbf6f8abb7aed7edfac8f49aeaf5eed9d18686db608bc969d84dd3192d1dd1431`,
      ],
      chainId: 1,
    },

    // arbitrum: {
    //   url: "https://arbitrum-mainnet.infura.io/v3/85cde589ce754dafa0a57001c326104d",
    //   accounts: [
    //     `0xbf6f8abb7aed7edfac8f49aeaf5eed9d18686db608bc969d84dd3192d1dd1431`,
    //   ],
    //   chainId: 42161
    // },

    // hardhat: {
    //   forking: {
    //     url: "https://arbitrum-mainnet.infura.io/v3/85cde589ce754dafa0a57001c326104d",
    //     blockNumber: 213925666,
    //   },
    //   chainId: 42161
    // },
    hardhat: {
      forking: {
        url: "https://mainnet.infura.io/v3/85cde589ce754dafa0a57001c326104d",
        blockNumber: 19940030,
      },
      chainId: 1,
    },
    // hardhat: {
    //   forking: {
    //     url: "https://sepolia.infura.io/v3/85cde589ce754dafa0a57001c326104d",
    //     blockNumber: 5020140,
    //   },
    //   chainId: 11155111
    // },
    
    // sepolia: {
    //   url: "https://sepolia.infura.io/v3/85cde589ce754dafa0a57001c326104d",
    //   accounts: [
    //     `${PRIVATE_KEY}`,
    //   ],
    //   chainId: 11155111,
    // },
    // sepolia_local: {
    //   url: "http://127.0.0.1:8545",
    //   accounts: [
    //     `${PRIVATE_KEY}`,
    //     `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`,
    //     `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`,
    //     `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`,
    //     `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`,
    //     `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a`,
    //     `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba`,
    //   ],
    //   chainId: 11155111,
    // },
    // localhost: {
    //   url: "http://127.0.0.1:8545",
    //   accounts: [
    //     `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`,
    //     `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`,
    //     `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`,
    //     `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`,
    //     `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a`,
    //     `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba`,
    //     `${PRIVATE_KEY}`,
    //   ],
    //   chainId: 42161,
    // },
  },
};

export default config;