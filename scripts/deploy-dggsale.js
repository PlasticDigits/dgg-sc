const hre = require("hardhat");
const loadJsonFile = require("load-json-file");

const {ethers} = hre;
const { parseEther } = ethers.utils;
const ITERABLE_ARRAY = "0x4222FFCf286610476B7b5101d55E72436e4a6065";

async function main() {

  const DggSale = await ethers.getContractFactory("DggSale",{
          libraries: {
            IterableArrayWithoutDuplicateKeys: ITERABLE_ARRAY,
          },
        });;
  const dggSale = await DggSale.deploy();
  await dggSale.deployed();
  console.log("DggSale deployed to:", dggSale.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
