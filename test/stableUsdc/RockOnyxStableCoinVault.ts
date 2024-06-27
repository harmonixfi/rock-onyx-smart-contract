const { ethers } = require("hardhat");
import { expect } from "chai";
import axios from "axios";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDCE_ADDRESS,
  WSTETH_ADDRESS,
  ARB_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  NonfungiblePositionManager,
  SWAP_ROUTER_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDCE_IMPERSONATED_SIGNER_ADDRESS,
  NFT_POSITION_ADDRESS,
  ANGLE_REWARD_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  WSTETH_ETH_PRICE_FEED_ADDRESS,
  USDC_PRICE_FEED_ADDRESS,
  ARB_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  NETWORK_COST,
} from "../../constants";
import {
  Signer,
  BigNumberish,
  AbiCoder,
  ContractTransactionReceipt,
} from "ethers";

// const chainId: CHAINID = network.config.chainId;
const chainId: CHAINID = 42161;

describe("RockOnyxStableCoinVault", function () {
  let admin: Signer, user1: Signer, user2: Signer, user3: Signer, user4: Signer;

  let optionsReceiver: Signer;
  let priceConsumerContract: Contracts.PriceConsumer;
  let camelotLiquidityContract: Contracts.CamelotLiquidity;
  let rockOnyxUSDTVaultContract: Contracts.RockOnyxUSDTVault;
  let uniSwapContract: Contracts.UniSwap;

  let usdc: Contracts.IERC20;
  let usdce: Contracts.IERC20;
  let arb: Contracts.IERC20;
  let reward: Contracts.IRewardVendor;
  let liquidityTokenId: number;
  let liquidityAmount: number;

  const LIQUIDITY_TOKEN_ID_INDEX = 0;
  const LIQUIDITY_AMOUNT_INDEX = 1;
  const PRECISION = 2 * 1e6;

  const rewardAddress = ANGLE_REWARD_ADDRESS[chainId];
  const nftPositionAddress = NFT_POSITION_ADDRESS[chainId];
  const usdcImpersonatedSigner = USDC_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const usdceImpersonatedSigner = USDCE_IMPERSONATED_SIGNER_ADDRESS[chainId];
  const nonfungiblePositionManager = NonfungiblePositionManager[chainId];
  const usdcAddress = USDC_ADDRESS[chainId];
  const usdceAddress = USDCE_ADDRESS[chainId];
  const wstethAddress = WSTETH_ADDRESS[chainId];
  const wethAddress = WETH_ADDRESS[chainId];
  const arbAddress = ARB_ADDRESS[chainId];
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const swapRouterAddress = SWAP_ROUTER_ADDRESS[chainId];
  const uniSwapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId];
  const aevoAddress = AEVO_ADDRESS[chainId];
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId];

  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const wsteth_ethPriceFeed = WSTETH_ETH_PRICE_FEED_ADDRESS[chainId];
  const usdcePriceFeed = USDC_PRICE_FEED_ADDRESS[chainId];
  const arbPriceFeed = ARB_PRICE_FEED_ADDRESS[chainId];
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId];
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId];
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let camelotSwapContract: Contracts.CamelotSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");
    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, wstethAddress, usdceAddress, arbAddress, usdtAddress, daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdcAddress, usdcAddress, usdtAddress],
      [ethPriceFeed, wsteth_ethPriceFeed, usdcePriceFeed, arbPriceFeed, usdtPriceFeed, daiPriceFeed]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deployCamelotLiquidity() {
    const camelotLiquidity =
      await ethers.getContractFactory("CamelotLiquidity");
    camelotLiquidityContract = await camelotLiquidity.deploy(
      nonfungiblePositionManager
    );
    await camelotLiquidityContract.waitForDeployment();

    console.log(
      "deploy CamelotLiquidity successfully: %s",
      await camelotLiquidityContract.getAddress()
    );
  }

  async function deployCamelotSwapContract() {
    const factory = await ethers.getContractFactory("CamelotSwap");
    camelotSwapContract = await factory.deploy(admin, swapRouterAddress, priceConsumerContract.getAddress());
    await camelotSwapContract.waitForDeployment();

    console.log(
      "Deployed Camelot Swap contract at address %s",
      await camelotSwapContract.getAddress()
    );
  }

  async function deployUniSwapContract() {
    const factory = await ethers.getContractFactory("UniSwap");
    uniSwapContract = await factory.deploy(
      admin,
      uniSwapRouterAddress,
      priceConsumerContract.getAddress(),
      chainId
    );
    await uniSwapContract.waitForDeployment();

    console.log(
      "Deployed uni swap contract at address %s",
      await uniSwapContract.getAddress()
    );
  }

  async function deployRockOnyxUSDTVault() {
    const rockOnyxUSDTVault =
      await ethers.getContractFactory("RockOnyxUSDTVault");

    rockOnyxUSDTVaultContract = await upgrades.deployProxy(
      rockOnyxUSDTVault,
      [
        await admin.getAddress(),
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        networkCost,
        await camelotLiquidityContract.getAddress(),
        rewardAddress,
        nftPositionAddress,
        await camelotSwapContract.getAddress(),
        aevoAddress,
        await optionsReceiver.getAddress(),
        aevoConnectorAddress,
        usdceAddress,
        wethAddress,
        wstethAddress,
        arbAddress,
        BigInt(0 * 1e6),
        await uniSwapContract.getAddress(),
        [usdtAddress, daiAddress],
        [usdcAddress, usdtAddress],
        [100, 100],
      ],
      { initializer: "initialize" }
    );
    await rockOnyxUSDTVaultContract.waitForDeployment();

    console.log(
      "deploy rockOnyxUSDTVaultContract successfully: %s",
      await rockOnyxUSDTVaultContract.getAddress()
    );
  }

  async function getMintPositionResult(
    tx: ContractTransactionReceipt,
    index: number
  ) {
    var log = tx?.logs.find((l) =>
      l.topics.includes(
        "0x38296fd5286ebdb66bc9ab8003152f9666c9e808b447df47c94f7d2387fb3a54"
      )
    );
    return AbiCoder.defaultAbiCoder().decode(
      ["uint256", "uint128", "uint256", "uint256"],
      log!.data
    )[index];
  }

  before(async function () {
    [admin, optionsReceiver, user1, user2, user3, user4] =
      await ethers.getSigners();

    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    usdce = await ethers.getContractAt("IERC20", usdceAddress);
    arb = await ethers.getContractAt("IERC20", arbAddress);

    await deployPriceConsumerContract();
    await deployCamelotLiquidity();
    await deployCamelotSwapContract();
    await deployUniSwapContract();
    await deployRockOnyxUSDTVault();
  });

  // Helper function for deposit
  async function deposit(
    sender: Signer,
    amount: BigNumberish,
    token: Contracts.IERC20,
    tokenTransit: Contracts.IERC20
  ) {
    await token
      .connect(sender)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), amount);

    await rockOnyxUSDTVaultContract
      .connect(sender)
      .deposit(amount, token, tokenTransit);
  }

  async function transferUsdcForUser(from: Signer, to: Signer, amount: number) {
    const transferTx = await usdc.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function transferUsdceForUser(
    from: Signer,
    to: Signer,
    amount: number
  ) {
    const transferTx = await usdce.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function transferArbForUser(from: Signer, to: Signer, amount: number) {
    const transferTx = await usdce.connect(from).transfer(to, amount);
    await transferTx.wait();
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await rockOnyxUSDTVaultContract
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );
    const usdceSigner = await ethers.getImpersonatedSigner(
      usdceImpersonatedSigner
    );

    await transferUsdcForUser(usdcSigner, user1, 1000 * 1e6);
    await transferUsdcForUser(usdcSigner, user2, 1000 * 1e6);
    await transferUsdcForUser(usdcSigner, user3, 1000 * 1e6);
    await transferUsdcForUser(usdcSigner, user4, 1000 * 1e6);
    await transferUsdcForUser(usdcSigner, optionsReceiver, 1000 * 1e6);
    await transferUsdceForUser(usdceSigner, optionsReceiver, 1000 * 1e6);
  });

  it("deposit to rockOnyxUSDTVault, should deposit successfully", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);
    await deposit(user3, 100 * 1e6, usdc, usdc);
    await deposit(user4, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(400 * 1e6, PRECISION);
  });

  it("get user profitt and loss, should get successfully", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");
    const getPnLTx = await rockOnyxUSDTVaultContract.connect(user1).getPnL();
    console.log("getPnL %s", getPnLTx);
  });

  it("mintEthLP position on Camelot, should mint successfully", async function () {
    console.log("-------------mintEthLP position on Camelot---------------");
    const mintEthLPPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintEthLPPosition(701, 2101, 5000, 4);
    var mintEthLPPositionTxResult = await mintEthLPPositionTx.wait();

    liquidityTokenId = await getMintPositionResult(
      mintEthLPPositionTxResult!,
      LIQUIDITY_TOKEN_ID_INDEX
    );
    liquidityAmount = await getMintPositionResult(
      mintEthLPPositionTxResult!,
      LIQUIDITY_AMOUNT_INDEX
    );

    console.log(
      "liquidityTokenId %s, liquidityAmount %s",
      liquidityTokenId,
      liquidityAmount
    );

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(400 * 1e6, PRECISION);
  });

  it("mintUsdLP position on Camelot, should mint successfully", async function () {
    console.log("-------------mintUsdLP position on Camelot---------------");
    const mintUsdLPPositionTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .mintUsdLPPosition(-5, 5, 5000, 4);
    var mintUsdLPPositionTxResult = await mintUsdLPPositionTx.wait();

    liquidityTokenId = await getMintPositionResult(
      mintUsdLPPositionTxResult!,
      LIQUIDITY_TOKEN_ID_INDEX
    );
    liquidityAmount = await getMintPositionResult(
      mintUsdLPPositionTxResult!,
      LIQUIDITY_AMOUNT_INDEX
    );

    console.log(
      "liquidityTokenId %s, liquidityAmount %s",
      liquidityTokenId,
      liquidityAmount
    );

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(400 * 1e6, PRECISION);
  });

  it("deposit to vendor on aevo, should deposit successfully", async function () {
    console.log("-------------deposit to vendor on aevo---------------");
    await rockOnyxUSDTVaultContract.connect(admin).depositToVendor(650000, {
      value: ethers.parseEther("0.001753"),
    });

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(400 * 1e6, PRECISION);
  });

  it("add more deposits to rockOnyxUSDTVault, should deposit successfully", async function () {
    console.log(
      "-------------add more deposits torockOnyxUSDTVault---------------"
    );
    await deposit(user1, 100 * 1e6, usdc, usdc);
    await deposit(user2, 100 * 1e6, usdc, usdc);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("Users initial withdrawals, should init successfully", async function () {
    console.log("-------------Users initial withdrawals---------------");
    const initiateWithdrawalTx1 = await rockOnyxUSDTVaultContract
      .connect(user1)
      .initiateWithdrawal(50 * 1e6);
    await initiateWithdrawalTx1.wait();

    const initiateWithdrawalTx2 = await rockOnyxUSDTVaultContract
      .connect(user2)
      .initiateWithdrawal(50 * 1e6);
    await initiateWithdrawalTx2.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("update allocated balance from aevo vendor, should update successfully", async function () {
    console.log(
      "-------------update allocated balance from aevo vendor---------------"
    );
    const updateProfitTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .updateProfitFromVendor(80 * 1e6);
    await updateProfitTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("acquire management fee, should close successfully", async function () {
    console.log("-------------acquire management fee---------------");
    const getManagementFeeTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getManagementFee();
    console.log("getManagementFeeTx ", getManagementFeeTx);

    const managementFee = getManagementFeeTx[0];
    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), managementFee);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(managementFee);

    const acquireManagementFeeTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireManagementFee(getManagementFeeTx[1]);
    await acquireManagementFeeTx.wait();

    const getVaultStateTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .getVaultState();

    console.log("getVaultStateTx ", getVaultStateTx);
  });

  it("close round, should close successfully", async function () {
    console.log("-------------close round---------------");
    const closeRoundTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .closeRound();
    await closeRoundTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("handle withdrawal from aevo vendor, should handle successfully", async function () {
    console.log(
      "-------------handle withdrawal from aevo vendor---------------"
    );

    const withdrawAmount = 50 * 1e6;
    await usdc
      .connect(optionsReceiver)
      .approve(await rockOnyxUSDTVaultContract.getAddress(), withdrawAmount);

    await rockOnyxUSDTVaultContract
      .connect(optionsReceiver)
      .handlePostWithdrawalFromVendor(withdrawAmount);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("accquire withdrawal funds for the round, should accquire successfully", async function () {
    console.log(
      "-------------accquire withdrawal funds for the round---------------"
    );
    const acquireWithdrawalFundsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .acquireWithdrawalFunds();
    await acquireWithdrawalFundsTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("Users initial withdrawals time 2, should init successfully", async function () {
    console.log("-------------Users initial withdrawals time 2---------------");

    await expect(
      rockOnyxUSDTVaultContract.connect(user1).initiateWithdrawal(50 * 1e6)
    ).to.be.revertedWith("INV_SHARES");

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(600 * 1e6, PRECISION);
  });

  it("complete withdrawals, should complete successfully", async function () {
    console.log("-------------complete withdrawals---------------");
    let user1Balance = await usdc.connect(user1).balanceOf(user1);

    const completeWithdrawalTx = await rockOnyxUSDTVaultContract
      .connect(user1)
      .completeWithdrawal(5 * 1e6);
    await completeWithdrawalTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(595 * 1e6, PRECISION);

    let user1BalanceAfterWithdraw = await usdc.connect(user1).balanceOf(user1);
    expect(user1BalanceAfterWithdraw).to.approximately(
      user1Balance + BigInt(5 * 1e6),
      PRECISION
    );
  });

  it("get user allocation ratios, should get successfully", async function () {
    console.log("-------------deposit to rockOnyxUSDTVault---------------");

    const getAllocatedRatio = await rockOnyxUSDTVaultContract
      .connect(user1)
      .allocatedRatio();

    console.log("getAllocatedRatio = %s", getAllocatedRatio);
  });

  it("handle settle covered calls, should handle successfully", async function () {
    console.log("-------------handle settle covered calls---------------");
    const settleCoveredCallsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .settleCoveredCalls(50 * 1e6);
    await settleCoveredCallsTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(595 * 1e6, PRECISION);
  });

  it("handle settle covered puts, should handle successfully", async function () {
    console.log("-------------handle settle covered puts---------------");
    const settleCoveredPutsTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .settleCoveredPuts(50 * 1e6);
    await settleCoveredPutsTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(595 * 1e6, PRECISION);
  });

  it.skip("convert reward to usdc, should convert successfully", async function () {
    console.log("-------------convert reward to usdc---------------");

    const arbSigner = await ethers.getImpersonatedSigner(
      "0x2e383d51d72507e8c8e803f1a7d6651cbe65b151"
    );
    const transferTx = await arb
      .connect(arbSigner)
      .transfer(rockOnyxUSDTVaultContract, 2000000000000000000n);
    await transferTx.wait();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(501 * 1e6, PRECISION);

    const convertRewardToUsdcTx = await rockOnyxUSDTVaultContract
      .connect(admin)
      .convertRewardToUsdc();
    await convertRewardToUsdcTx.wait();

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(501 * 1e6, PRECISION);
  });

  // Tx https://arbiscan.io/tx/0xc30f0c7ec499b362c9a9562826b6dfbb79fb02333a97668364fbb9b09aa55317
  it.skip("claim reward on Camelot - 164508868, should claim successfully", async function () {
    console.log("-------------claim reward on Camelot---------------");
    // const contractAdmin = await ethers.getImpersonatedSigner("0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7");
    // rockOnyxUSDTVaultContract = await ethers.getContractAt("RockOnyxUSDTVault", "0xb4415d533ba381d8057ae23c281ab329ab7a6778");

    const contractAdmin = admin;
    console.log("contractAdmin: ", await contractAdmin.getAddress());
    console.log(
      "rockOnyxUSDTVaultContract: ",
      await rockOnyxUSDTVaultContract.getAddress()
    );

    interface TransactionData {
      [token: string]: {
        proof?: any; // Define the type for proof
        claim: any; // Define the type for claim
      };
    }

    let transactionData: TransactionData;
    try {
      const { data } = await axios.get(
        `https://api.angle.money/v1/merkl?chainId=42161&user=0xb4415d533ba381d8057ae23c281ab329ab7a6778`,
        {
          timeout: 5000,
        }
      );

      transactionData = data[chainId].transactionData;
    } catch (error) {
      throw new Error("Angle API not responding");
    }
    const tokens = Object.keys(transactionData).filter(
      (k) => transactionData[k].proof !== undefined
    );
    const claims = tokens.map((t) => transactionData[t].claim);
    const proofs = tokens.map((t) => transactionData[t].proof);
    const users = tokens.map(
      () => "0xb4415d533ba381d8057ae23c281ab329ab7a6778"
    );

    console.log(users);
    console.log(tokens);
    console.log(claims);
    console.log(proofs);
    console.log(
      await arb.balanceOf("0xb4415d533ba381d8057ae23c281ab329ab7a6778")
    );
    const claimlTx = await rockOnyxUSDTVaultContract
      .connect(contractAdmin)
      .claimReward(users, tokens, claims, proofs as string[][]);
    await claimlTx.wait();
    console.log(
      await arb.balanceOf("0xb4415d533ba381d8057ae23c281ab329ab7a6778")
    );
  });

  // Tx https://arbiscan.io/tx/0xc30f0c7ec499b362c9a9562826b6dfbb79fb02333a97668364fbb9b09aa55317
  it.skip("test user claim reward on Camelot - 164508868, should claim successfully", async function () {
    console.log("-------------user claim reward on Camelot---------------");

    const user1aa = await ethers.getImpersonatedSigner(
      "0xbc05da14287317fe12b1a2b5a0e1d756ff1801aa"
    );
    interface TransactionData {
      [token: string]: {
        proof?: any; // Define the type for proof
        claim: any; // Define the type for claim
      };
    }

    let transactionData: TransactionData;
    try {
      const { data } = await axios.get(
        `https://api.angle.money/v1/merkl?chainId=42161&user=0xbc05da14287317fe12b1a2b5a0e1d756ff1801aa`,
        {
          timeout: 5000,
        }
      );

      transactionData = data[chainId].transactionData;
    } catch (error) {
      throw new Error("Angle API not responding");
    }

    const tokens = Object.keys(transactionData).filter(
      (k) => transactionData[k].proof !== undefined
    );

    const users = tokens.map(
      () => "0xbc05da14287317fe12b1a2b5a0e1d756ff1801aa"
    );
    const claims = tokens.map((t) => transactionData[t].claim);
    const proofs = tokens.map((t) => transactionData[t].proof);

    const contractAddress = "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae";
    reward = await ethers.getContractAt("IRewardVendor", contractAddress);

    console.log(users);
    console.log(tokens);
    console.log(claims);
    console.log(proofs);

    console.log(await arb.balanceOf(user1aa));
    await reward
      .connect(user1aa)
      .claim(users, tokens, claims, proofs as string[][]);
    console.log(await arb.balanceOf(user1aa));
  });

  // Tx https://arbiscan.io/tx/0xc30f0c7ec499b362c9a9562826b6dfbb79fb02333a97668364fbb9b09aa55317
  it.skip("mintEthLP position on Camelot - 182290590, should mint successfully", async function () {
    console.log("-------------user claim reward on Camelot---------------");
    const contractAdmin = await ethers.getImpersonatedSigner(
      "0x20f89bA1B0Fc1e83f9aEf0a134095Cd63F7e8CC7"
    );
    rockOnyxUSDTVaultContract = await ethers.getContractAt(
      "RockOnyxUSDTVault",
      "0x01cdc1dc16c677dfd4cfde4478aaa494954657a0"
    );

    let state = await rockOnyxUSDTVaultContract
      .connect(contractAdmin)
      .getEthLPState();

    console.log(state);

    state = await rockOnyxUSDTVaultContract
      .connect(contractAdmin)
      .getEthLPState();

    console.log(state);
  });

  it.skip("migration, export and import data to new option wheel vault", async function () {
    const contractAdmin = await ethers.getImpersonatedSigner(
      "0x0cD2568E24Ed7Ed47E42075545D49C21e895B54c"
    );
    const contractAddress = "0x316CDbBEd9342A1109D967543F81FA6288eBC47D";
    const exportABI = [
      {
        inputs: [],
        name: "exportVaultState",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
          {
            internalType: "uint256[]",
            name: "",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "",
            type: "uint256[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "shares",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "depositAmount",
                    type: "uint256",
                  },
                ],
                internalType: "struct DepositReceipt",
                name: "depositReceipt",
                type: "tuple",
              },
            ],
            internalType: "struct DepositReceiptArr[]",
            name: "",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "owner",
                type: "address",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "shares",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "round",
                    type: "uint256",
                  },
                ],
                internalType: "struct Withdrawal",
                name: "withdrawal",
                type: "tuple",
              },
            ],
            internalType: "struct WithdrawalArr[]",
            name: "",
            type: "tuple[]",
          },
          {
            components: [
              {
                internalType: "uint8",
                name: "decimals",
                type: "uint8",
              },
              {
                internalType: "address",
                name: "asset",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "minimumSupply",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "cap",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "performanceFeeRate",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "managementFeeRate",
                type: "uint256",
              },
            ],
            internalType: "struct VaultParams",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "performanceFeeAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "managementFeeAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "currentRoundFeeAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "withdrawPoolAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "pendingDepositAmount",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "totalShares",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "lastLockedAmount",
                type: "uint256",
              },
            ],
            internalType: "struct VaultState",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "ethLPRatio",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "usdLPRatio",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "optionsRatio",
                type: "uint256",
              },
              {
                internalType: "uint8",
                name: "decimals",
                type: "uint8",
              },
            ],
            internalType: "struct AllocateRatio",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
              },
              {
                internalType: "uint128",
                name: "liquidity",
                type: "uint128",
              },
              {
                internalType: "int24",
                name: "lowerTick",
                type: "int24",
              },
              {
                internalType: "int24",
                name: "upperTick",
                type: "int24",
              },
              {
                internalType: "uint256",
                name: "unAllocatedBalance",
                type: "uint256",
              },
            ],
            internalType: "struct EthLPState",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
              },
              {
                internalType: "uint128",
                name: "liquidity",
                type: "uint128",
              },
              {
                internalType: "int24",
                name: "lowerTick",
                type: "int24",
              },
              {
                internalType: "int24",
                name: "upperTick",
                type: "int24",
              },
              {
                internalType: "uint256",
                name: "unAllocatedUsdcBalance",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "unAllocatedUsdceBalance",
                type: "uint256",
              },
            ],
            internalType: "struct UsdLPState",
            name: "",
            type: "tuple",
          },
          {
            components: [
              {
                internalType: "uint256",
                name: "allocatedUsdcBalance",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "unAllocatedUsdcBalance",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "unsettledProfit",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "unsettledLoss",
                type: "uint256",
              },
            ],
            internalType: "struct OptionsStrategyState",
            name: "",
            type: "tuple",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const contract = new ethers.Contract(
      contractAddress,
      exportABI,
      contractAdmin
    );

    console.log("-------------export old vault state---------------");
    let exportVaultStateTx = await contract
      .connect(contractAdmin)
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

    const rockOnyxUSDTVault =
      await ethers.getContractFactory("RockOnyxUSDTVault");
    const newContract = await rockOnyxUSDTVault.deploy(
      await admin.getAddress(),
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      networkCost,
      await camelotLiquidityContract.getAddress(),
      rewardAddress,
      nftPositionAddress,
      await camelotSwapContract.getAddress(),
      aevoAddress,
      await optionsReceiver.getAddress(),
      aevoConnectorAddress,
      usdceAddress,
      wethAddress,
      wstethAddress,
      arbAddress,
      BigInt(0 * 1e6),
      await uniSwapContract.getAddress(),
      [usdtAddress, daiAddress],
      [usdcAddress, usdtAddress],
      [100, 100]
    );
    await rockOnyxUSDTVaultContract.waitForDeployment();

    console.log("-------------import vault state---------------");
    const _currentRound = exportVaultStateTx[0];
    const _roundWithdrawalShares = [...exportVaultStateTx[1]];
    const _roundPricePerShares = [...exportVaultStateTx[2]];
    const _depositReceiptArr = exportVaultStateTx[3].map((element: any[][]) => {
      return {
        owner: element[0],
        depositReceipt: {
          shares: element[1][0],
          depositAmount: element[1][1],
        },
      };
    });
    const _withdrawalArr = exportVaultStateTx[4].map((element: any[][]) => {
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
      managementFeeRate: exportVaultStateTx[5][5],
    };
    const _vaultState = {
      withdrawPoolAmount: exportVaultStateTx[6][3],
      pendingDepositAmount: exportVaultStateTx[6][4],
      totalShares: exportVaultStateTx[6][5],
      totalFeePoolAmount: exportVaultStateTx[6][0] + exportVaultStateTx[6][1],
      lastUpdateManagementFeeDate: (await ethers.provider.getBlock("latest"))
        .timestamp,
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
      .connect(admin)
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
    exportVaultStateTx = await newContract.connect(admin).exportVaultState();

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
  });
});
