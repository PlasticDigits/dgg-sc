const {
  time, impersonateAccount
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { parseEther, formatEther, defaultAbiCoder } = ethers.utils;

const ITERABLE_ARRAY = "0x4222FFCf286610476B7b5101d55E72436e4a6065";
const CZDEPLOYER = "0x70e1cB759996a1527eD1801B169621C18a9f38F9";
const CZUSD = "0xE68b79e51bf826534Ff37AA9CeE71a3842ee9c70";


describe("DggSale", function () {
  let owner, trader, trader1, trader2, trader3;
  let czDeployer;
  let dggSale, czusdSc;
  before(async function() {
    [owner, trader, trader1, trader2, trader3] = await ethers.getSigners();
    await impersonateAccount(CZDEPLOYER);
    czDeployer = await ethers.getSigner(CZDEPLOYER);
    
    czusdSc = await ethers.getContractAt("CZUsd", CZUSD);

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
  it("Should track first depositor", async function () {
    await dggSale.setHardcap(parseEther("16000"));
    await czusdSc.connect(czDeployer).mint(trader1.address,parseEther("1200"));

    await czusdSc.connect(trader1).approve(dggSale.address,parseEther("1200"));
    await dggSale.connect(trader1).depositCzusd(parseEther("125"));
    const totalDepositors = await dggSale.totalDepositors();
    const totalDeposits = await dggSale.totalDeposits();
    const firstDepositedAmount = await dggSale.depositedAmount(trader1.address);
    const firstDepositorAddress = await dggSale.getDepositorFromIndex(0);
    const firstDepositorIndex = await dggSale.getIndexFromDepositor(trader1.address);
    expect(totalDepositors).to.eq(1);
    expect(totalDeposits).to.eq(parseEther("125"));
    expect(firstDepositedAmount).to.eq(parseEther("125"));
    expect(firstDepositorIndex).to.eq(0);
    expect(firstDepositorAddress).to.eq(trader1.address);
  });
  it("Should revert when over maxDepositWad on second deposit", async function () {
    await expect(dggSale.connect(trader1).depositCzusd(parseEther("625.1"))).to.be.revertedWith("DggSale: Deposit too large");
  });
  it("Should track second depositor", async function () {
    await dggSale.connect(trader2).depositBnb(parseEther("507"),{value:parseEther("2")})
    const totalDepositors = await dggSale.totalDepositors();
    const totalDeposits = await dggSale.totalDeposits();
    const secondDepositedAmount = await dggSale.depositedAmount(trader2.address);
    const secondDepositorAddress = await dggSale.getDepositorFromIndex(1);
    const secondDepositorIndex = await dggSale.getIndexFromDepositor(trader2.address);
    expect(totalDepositors).to.eq(2);
    expect(totalDeposits).to.be.closeTo(parseEther("632.34"),parseEther("0.01"));
    expect(secondDepositedAmount).to.be.closeTo(parseEther("507.34"),parseEther("0.01"));
    expect(secondDepositorIndex).to.eq(1);
    expect(secondDepositorAddress).to.eq(trader2.address);
  });
  it("Should succeed when first depositor deposits a second time", async function () {
    await czusdSc.connect(trader1).approve(dggSale.address,parseEther("1200"));
    await dggSale.connect(trader1).depositCzusd(parseEther("625"));
    const totalDepositors = await dggSale.totalDepositors();
    const totalDeposits = await dggSale.totalDeposits();
    const firstDepositedAmount = await dggSale.depositedAmount(trader1.address);
    const firstDepositorAddress = await dggSale.getDepositorFromIndex(0);
    const firstDepositorIndex = await dggSale.getIndexFromDepositor(trader1.address);
    expect(totalDepositors).to.eq(2);
    expect(totalDeposits).to.be.closeTo(parseEther("1257.34"),parseEther("0.01"));
    expect(firstDepositedAmount).to.eq(parseEther("750"));
    expect(firstDepositorIndex).to.eq(0);
    expect(firstDepositorAddress).to.eq(trader1.address);
  });

})