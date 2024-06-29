import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumberish, Signer } from "ethers";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  RSETH_ADDRESS,
  KELP_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_REF_ID,
  UNI_SWAP_ADDRESS,
  AddressZero,
  KELPDAO_TOKEN_HOLDER_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
} from "../../constants";
import * as Contracts from "../../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

describe("KelpRestakingDeltaNeutralVault", function () {
  let kelpRestakingDNVault: Contracts.KelpRestakingDeltaNeutralVault;
  let proxyAddress: string;
  let admin: Signer;
  let user: Signer;
  let usdc: Contracts.IERC20;

  const initialDeposit = BigInt(10000000); // 1000 USDC in 6 decimals

  const usdcImpersonatedSigner =
    USDC_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdcAddress = USDC_ADDRESS[chainId] || AddressZero;
  const usdtAddress = USDT_ADDRESS[chainId] || AddressZero;
  const daiAddress = DAI_ADDRESS[chainId] || AddressZero;
  const wethAddress = WETH_ADDRESS[chainId] || AddressZero;
  const rsEthAddress = RSETH_ADDRESS[chainId] || AddressZero;
  const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || AddressZero;
  const aevoAddress = AEVO_ADDRESS[chainId] || AddressZero;
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || AddressZero;
  const kelpDepositAddress = KELP_DEPOSIT_ADDRESS[chainId] || AddressZero;
  const kelpDepositRefId = KELP_DEPOSIT_REF_ID[chainId] || AddressZero;
  const kelpdaoHolderAddress =
    KELPDAO_TOKEN_HOLDER_ADDRESS[chainId] || AddressZero;

  async function transferForUser(
    token: Contracts.IERC20,
    from: Signer,
    to: Signer,
    amount: BigNumberish
  ) {
    const transferTx = await token
      .connect(from)
      .transfer(await to.getAddress(), amount);
    await transferTx.wait();
  }
  
  before(async function () {
    [admin, user] = await ethers.getSigners();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
  });

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );

    await transferForUser(usdc, usdcSigner, user, 100000 * 1e6);
  });

  it("should deploy the contract with upgradeable proxy", async function () {
    const KelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "KelpRestakingDeltaNeutralVault"
    );

    kelpRestakingDNVault = await upgrades.deployProxy(
      KelpRestakingDeltaNeutralVault,
      [
        admin,
        usdcAddress,
        6,
        BigInt(5 * 1e6),
        BigInt(1000000 * 1e6),
        BigInt(1 * 1e6),
        wethAddress,
        aevoAddress,
        AddressZero,
        aevoConnectorAddress,
        rsEthAddress,
        BigInt(1 * 1e6),
        [kelpDepositAddress, kelpdaoHolderAddress],
        kelpDepositRefId,
        uniSwapAddress,
        [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
        [wethAddress, wethAddress, usdcAddress, usdtAddress],
        [500, 100, 100, 100],
        chainId,
      ],
      { initializer: "initialize" }
    );

    await kelpRestakingDNVault.waitForDeployment();
    proxyAddress = await kelpRestakingDNVault.getAddress();
    console.log("Deploy contract V1 %s", proxyAddress);

  });

  it("should deposit to the deployed contract via proxy", async function () {
    await kelpRestakingDNVault
      .connect(user)
      .deposit(initialDeposit, usdcAddress, usdcAddress);

    const exportVaultStateTx = await kelpRestakingDNVault
      .connect(admin)
      .exportVaultState();
    console.log("DepositReceiptArr %s", exportVaultStateTx[0]);
    console.log("WithdrawalArr %s", exportVaultStateTx[1]);
    console.log("VaultParams %s", exportVaultStateTx[2]);
    console.log("VaultState %s", exportVaultStateTx[3]);
    console.log("EthRestakingState %s", exportVaultStateTx[4]);
    console.log("PerpDexState %s", exportVaultStateTx[5]);
  });

  it("should upgrade the contract to v2 with existing proxy address", async function () {
    const KelpRestakingDeltaNeutralVaultV2 = await ethers.getContractFactory(
      "KelpRestakingDeltaNeutralVault"
    );

    const upgraded = await upgrades.upgradeProxy(
      proxyAddress,
      KelpRestakingDeltaNeutralVaultV2
    );
    expect(await upgraded.getAddress()).to.equal(proxyAddress);
  });

  it("should check the state of the contract using exportVaultState function", async function () {

    const exportVaultStateTx = await kelpRestakingDNVault
      .connect(admin)
      .exportVaultState();
    console.log("DepositReceiptArr %s", exportVaultStateTx[0]);
    console.log("WithdrawalArr %s", exportVaultStateTx[1]);
    console.log("VaultParams %s", exportVaultStateTx[2]);
    console.log("VaultState %s", exportVaultStateTx[3]);
    console.log("EthRestakingState %s", exportVaultStateTx[4]);
    console.log("PerpDexState %s", exportVaultStateTx[5]);
  });
});
