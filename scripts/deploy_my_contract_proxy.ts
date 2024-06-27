// scripts/deploy.js
const { ethers, upgrades } = require("hardhat");

async function main() {
  const MyContract = await ethers.getContractFactory("MyContract");
  const myContract = await upgrades.deployProxy(MyContract, [42], {
    initializer: "initialize",
  });

  upgrades.a
  console.log("MyContract deployed to:", await myContract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
