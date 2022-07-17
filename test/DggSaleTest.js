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
  it("Should revert when time not set", async function () {
    await expect(dggSale.depositBusd(0)).to.be.revertedWith("DggSale: Not Open");
  });
  it("Should revert when start epoch is in future", async function () {
    const currentTime = await time.latest();
    await dggSale.setWhenOpen(currentTime+3600,currentTime+3600);
    await expect(dggSale.depositBusd(0)).to.be.revertedWith("DggSale: Not Open");
  });
  it("Should revert when end epoch is in past", async function () {
    const currentTime = await time.latest();
    await dggSale.setWhenOpen(currentTime-3600,currentTime-3600);
    await expect(dggSale.depositBusd(0)).to.be.revertedWith("DggSale: Not Open");
  });
  it("Should revert when paused", async function () {
    const currentTime = await time.latest();
    await dggSale.setWhenOpen(currentTime-3600,currentTime+3600);
    await dggSale.pause();
    await expect(dggSale.depositBusd(0)).to.be.revertedWith("Pausable: paused");
  });
  it("Should revert when under minDepositWad", async function () {
    await dggSale.unpause();
    await expect(dggSale.depositBnb(parseEther("1"),{value:parseEther("0.01")})).to.be.revertedWith("DggSale: Deposit too small");
  });
  it("Should revert when over maxDepositWad", async function () {
    await expect(dggSale.depositBnb(parseEther("1"),{value:parseEther("5")})).to.be.revertedWith("DggSale: Deposit too large");
  });
  it("Should revert when over hardcap", async function () {
    await dggSale.setHardcap(parseEther("200"));
    await expect(dggSale.depositBnb(parseEther("1"),{value:parseEther("2")})).to.be.revertedWith("DggSale: Over hardcap");
  });

})