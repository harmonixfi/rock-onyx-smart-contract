import { ethers } from "hardhat";

async function main() {
  // Get the ContractFactory and Signers here.
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // Replace 'MyContract' with the actual contract name and provide the necessary constructor arguments if any
  const MyContractFactory = await ethers.getContractFactory("MyContract");
  const myContract = await MyContractFactory.deploy();
  await myContract.waitForDeployment();

  console.log("MyContract deployed to:", await myContract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});