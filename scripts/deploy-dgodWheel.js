const hre = require("hardhat");
const loadJsonFile = require("load-json-file");

const { ethers } = hre;
const { parseEther } = ethers.utils;

async function main() {

    const DgodWheel = await ethers.getContractFactory("DgodWheel");
    const dgodWheel = await DgodWheel.deploy();
    await dgodWheel.deployed();
    console.log("DgodWheel deployed to:", dgodWheel.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
