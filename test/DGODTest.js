// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
// If you read this, know that I love you even if your mom doesnt <3
const chai = require('chai');
const {
  time, impersonateAccount
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { parseEther, formatEther, defaultAbiCoder } = ethers.utils;
const { toNum, toBN } = require("./utils/bignumberConverter");
const parse = require('csv-parse');

const BASE_CZUSD_LP_WAD = parseEther("10000");
const CZUSD_TOKEN = "0xE68b79e51bf826534Ff37AA9CeE71a3842ee9c70";
const BUSD_TOKEN = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const DOGECOIN_TOKEN = "0xbA2aE424d960c26247Dd6c32edC70B295c744C43";
const PCS_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const PCS_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const DEPLOYER = "0x70e1cB759996a1527eD1801B169621C18a9f38F9";


describe("DGOD", function () {
  let owner, manager, trader, trader1, trader2, trader3;
  let deployer;
  let dgod, czusd, busd, dogeCoin, pcsRouter, dgodCzusdPair;
  before(async function() {
    [owner, manager, trader, trader1, trader2, trader3] = await ethers.getSigners();
    await impersonateAccount(DEPLOYER);
    deployer = await ethers.getSigner(DEPLOYER);

    pcsRouter = await ethers.getContractAt("IAmmRouter02", PCS_ROUTER);
    czusd = await ethers.getContractAt("CZUsd", CZUSD_TOKEN);
    dogeCoin = await ethers.getContractAt("IERC20", DOGECOIN_TOKEN);
    busd = await ethers.getContractAt("IERC20", BUSD_TOKEN);

    const Dgod = await ethers.getContractFactory("DGOD");
    dgod = await Dgod.deploy(
      CZUSD_TOKEN,
      PCS_ROUTER,
      PCS_FACTORY,
      manager.address,
      BASE_CZUSD_LP_WAD,
      parseEther("200000")
    );
    
    const dgodCzusdPair_address = await dgod.ammCzusdPair();
    dgodCzusdPair = await ethers.getContractAt("IAmmPair", dgodCzusdPair_address);
    
    await czusd
    .connect(deployer)
    .grantRole(ethers.utils.id("MINTER_ROLE"), dgod.address);

    await czusd.connect(deployer).mint(owner.address,BASE_CZUSD_LP_WAD);
    await dgod.approve(pcsRouter.address,ethers.constants.MaxUint256);
    await czusd.approve(pcsRouter.address,ethers.constants.MaxUint256);
    await pcsRouter.addLiquidity(
      czusd.address,
      dgod.address,
      BASE_CZUSD_LP_WAD,
      parseEther("200000"),
      0,
      0,
      dgod.address,
      ethers.constants.MaxUint256
    );
  });
  it("Should deploy dgod", async function () {
    const pairCzusdBal = await czusd.balanceOf(dgodCzusdPair.address);
    const pairDgodal = await dgod.balanceOf(dgodCzusdPair.address);
    const baseCzusdLocked = await dgod.baseCzusdLocked();
    const totalCzusdSpent = await dgod.totalCzusdSpent();
    const ownerIsExempt = await dgod.isExempt(owner.address);
    const pairIsExempt = await dgod.isExempt(dgodCzusdPair.address);
    const tradingOpen = await dgod.tradingOpen();
    expect(pairCzusdBal).to.eq(BASE_CZUSD_LP_WAD);
    expect(pairDgodal).to.eq(parseEther("200000"));
    expect(baseCzusdLocked).to.eq(BASE_CZUSD_LP_WAD);
    expect(totalCzusdSpent).to.eq(0);
    expect(ownerIsExempt).to.be.true;
    expect(pairIsExempt).to.be.false;
    expect(tradingOpen).to.be.false;
  });
  it("Should revert buy when trading not open", async function () {
    await czusd.connect(deployer).mint(trader.address,parseEther("10000"));
    await czusd.connect(trader).approve(pcsRouter.address,ethers.constants.MaxUint256);
    
    await expect(pcsRouter.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        parseEther("100"),
        0,
        [czusd.address,dgod.address],
        trader.address,
        ethers.constants.MaxUint256
    )).to.be.reverted;
  });
  it("Should burn 10% when buying and increase wad available", async function () {    
    await dgod.ADMIN_openTrading();
    await pcsRouter.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        parseEther("100"),
        0,
        [czusd.address,dgod.address],
        trader.address,
        ethers.constants.MaxUint256
    );
    const totalCzusdSpent = await dgod.totalCzusdSpent();
    const lockedCzusd = await dgod.lockedCzusd();
    const availableWadToSend = await dgod.availableWadToSend();
    const totalSupply = await dgod.totalSupply();
    const traderBal = await dgod.balanceOf(trader.address);
    const lpBal = await dgod.balanceOf(dgodCzusdPair.address);
    expect(totalCzusdSpent).to.eq(0);
    expect(lockedCzusd).to.be.closeTo(parseEther("10010.3"),parseEther("0.1"));
    expect(availableWadToSend).to.eq(lockedCzusd.sub(BASE_CZUSD_LP_WAD).sub(totalCzusdSpent));
    expect(totalSupply).to.be.closeTo(parseEther("199802.4"),parseEther("0.1"));
    expect(totalSupply).to.eq(traderBal.add(lpBal));
  });
  it("Should send reward to dev wallet", async function() {
    const devWalletBalInitial = await dogeCoin.balanceOf(manager.address);
    const availableWadToSendInitial = await dgod.availableWadToSend();
    await dgod.performUpkeep(0);
    const devWalletBalFinal = await dogeCoin.balanceOf(manager.address);
    const availableWadToSendFinal = await dgod.availableWadToSend();
    const totalCzusdSpent = await dgod.totalCzusdSpent();

    expect(totalCzusdSpent).to.eq(availableWadToSendInitial);
    expect(totalCzusdSpent).to.be.closeTo(parseEther("10"),parseEther("1"));
    expect(availableWadToSendFinal).to.eq(0);
    //dogecoin has 8 decimals, divide 18 decimals by 10*10 to get 8.
    expect(devWalletBalFinal.sub(devWalletBalInitial)).closeTo(parseEther("158").div(10**10),parseEther("1").div(10**10));

  })
});