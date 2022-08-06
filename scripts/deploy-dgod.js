const hre = require("hardhat");
const loadJsonFile = require("load-json-file");

const {ethers} = hre;
const { parseEther } = ethers.utils;

const ITERABLE_ARRAY = "0x4222FFCf286610476B7b5101d55E72436e4a6065";
const BASE_CZUSD_LP_WAD = parseEther("50018");
const INITIAL_CZUSD_LP_WAD = parseEther("68518");
const INITIAL_SUPPLY = parseEther("10000000000");
const INITIAL_DGOD_LP_WAD = parseEther("7300000000");
const CZUSD_TOKEN = "0xE68b79e51bf826534Ff37AA9CeE71a3842ee9c70";
const BUSD_TOKEN = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const DOGECOIN_TOKEN = "0xbA2aE424d960c26247Dd6c32edC70B295c744C43";
const PCS_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PCS_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const DEPLOYER = "0x70e1cB759996a1527eD1801B169621C18a9f38F9";
const AUTO_REWARD_POOL = "0x8D9DD4389f607b90171E5a441f081e1C5b6d2130";
const DGOD = "0x99F4cc2BAE97F82A823CA80DcAe52EF972B7F270";
const DGG_LOCK = "0xAEa5CF8d4d2C30847b3BCdb7806abb6C072391eE";

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {

    const czusd = await ethers.getContractAt("CZUsd", CZUSD_TOKEN);
    const dogeCoin = await ethers.getContractAt("IERC20", DOGECOIN_TOKEN);
    const busd = await ethers.getContractAt("IERC20", BUSD_TOKEN);
    const autoRewardPool = await ethers.getContractAt("AutoRewardPool", AUTO_REWARD_POOL);
    const dgod = await ethers.getContractAt("DGOD", DGOD);
    const dggLock = await ethers.getContractAt("DggLock", DGG_LOCK);
    
    console.log("initialize autoRewardPool");

    const dgodCzusdPair_address = await dgod.ammCzusdPair();

    autoRewardPool.initialize(dgod.address,dgodCzusdPair_address,DEPLOYER,dggLock.address);

    console.log("waiting 15 seconds...");
    await delay(15000);
    console.log("grant czusd mint role");

    await czusd.grantRole(ethers.utils.id("MINTER_ROLE"), dgod.address);

    console.log("waiting 15 seconds...");
    await delay(15000);
    console.log("minting czusd for liq");
    await czusd.mint(DEPLOYER,INITIAL_CZUSD_LP_WAD);
    console.log("waiting 15 seconds...");
    await delay(15000);
    console.log("approve czusd for liq");
    await czusd.approve(PCS_ROUTER,ethers.constants.MaxUint256);
    console.log("waiting 15 seconds...");
    await delay(15000);
    console.log("approve dgod for liq");
    await dgod.approve(PCS_ROUTER,ethers.constants.MaxUint256);
    console.log("waiting 15 seconds...");
    await delay(15000);
    console.log("add liq");
    await pcsRouter.addLiquidity(
      czusd.address,
      dgod.address,
      INITIAL_CZUSD_LP_WAD,
      INITIAL_DGOD_LP_WAD,
      0,
      0,
      dgod.address,
      ethers.constants.MaxUint256
    );
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
