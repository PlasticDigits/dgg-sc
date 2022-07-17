const {
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { parseEther, formatEther, defaultAbiCoder } = ethers.utils;

const ITERABLE_ARRAY = "0x4222FFCf286610476B7b5101d55E72436e4a6065";


describe("DggSale", function () {
  let owner, trader, trader1, trader2, trader3;
  let dggSale;
  before(async function() {
    [owner, trader, trader1, trader2, trader3] = await ethers.getSigners();

    const DggSale = await ethers.getContractFactory("DggSale",{
          libraries: {
            IterableArrayWithoutDuplicateKeys: ITERABLE_ARRAY
          },
        });
    dggSale = await DggSale.deploy();
  });
  it("Should deploy dggSale", async function () {
    const minDepositWad = await dggSale.minDepositWad();
    const maxDepositWad = await dggSale.maxDepositWad();
    const hardcap = await dggSale.hardcap();
    const totalDeposits = await dggSale.totalDeposits();
    const startEpoch = await dggSale.startEpoch();
    const endEpoch = await dggSale.endEpoch();
    const totalDepositors = await dggSale.totalDepositors();
    expect(minDepositWad).to.eq(parseEther("20"));
    expect(maxDepositWad).to.eq(parseEther("750"));
    expect(hardcap).to.eq(parseEther("16000"));
    expect(totalDeposits).to.eq(parseEther("0"));
    expect(startEpoch).to.eq(0);
    expect(endEpoch).to.eq(0);
    expect(totalDepositors).to.eq(0);
  });

})