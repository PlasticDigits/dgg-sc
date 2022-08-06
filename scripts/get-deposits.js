const hre = require("hardhat");
const loadJsonFile = require("load-json-file");

const {ethers} = hre;
const { parseEther, formatEther } = ethers.utils;

const DGG_SALE = "0x7f383f4171369EEE9521817Bd91e24EC83960335";

async function main() {

    const dggSale = await ethers.getContractAt("DggSale", DGG_SALE);
    
    console.log("getting count...");
    const count = await dggSale.totalDepositors();

    console.log("Got Count:",count);
    console.log();
    console.log();
    console.log();

    for(let i = 0; i< count; i++) {
      let depositor = await dggSale.getDepositorFromIndex(i);
      let wad = await dggSale.depositedAmount(depositor);
      console.log(depositor,formatEther(wad));
    }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
