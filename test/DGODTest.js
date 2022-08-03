// SPDX-License-Identifier: GPL-3.0
// Authored by Plastic Digits
// If you read this, know that I love you even if your mom doesnt <3
const chai = require('chai');
const {
  time, impersonateAccount, mine
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { parseEther, formatEther, defaultAbiCoder } = ethers.utils;
const { toNum, toBN } = require("./utils/bignumberConverter");
const parse = require('csv-parse');

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


describe("DGOD", function () {
  let owner, manager, trader, trader1, trader2, trader3, feeDistributor, vestor1, vestor2;
  let deployer;
  let dgod, czusd, busd, dogeCoin, pcsRouter, dgodCzusdPair, autoRewardPool, dggLock;
  before(async function() {
    [owner, manager, trader, trader1, trader2, trader3, feeDistributor,  vestor1, vestor2] = await ethers.getSigners();
    await impersonateAccount(DEPLOYER);
    deployer = await ethers.getSigner(DEPLOYER);

    pcsRouter = await ethers.getContractAt("IAmmRouter02", PCS_ROUTER);
    czusd = await ethers.getContractAt("CZUsd", CZUSD_TOKEN);
    dogeCoin = await ethers.getContractAt("IERC20", DOGECOIN_TOKEN);
    busd = await ethers.getContractAt("IERC20", BUSD_TOKEN);

    console.log("deploying autorewardpool")

    const AutoRewardPool = await ethers.getContractFactory("AutoRewardPool",{
          libraries: {
            IterableArrayWithoutDuplicateKeys: ITERABLE_ARRAY
          }});
    autoRewardPool = await AutoRewardPool.deploy();

    console.log("deploying Dgod")
    const Dgod = await ethers.getContractFactory("DGOD");
    dgod = await Dgod.deploy(
      CZUSD_TOKEN,
      PCS_ROUTER,
      PCS_FACTORY,
      autoRewardPool.address,
      BASE_CZUSD_LP_WAD,
      INITIAL_SUPPLY,
      manager.address
    );
    
    console.log("deploying DggLock")
    const DggLock = await ethers.getContractFactory("DggLock");
    dggLock = await DggLock.deploy(
      dgod.address,
      autoRewardPool.address);
    await dgod.MANAGER_setIsExempt(dggLock.address,true);
    
    console.log("getting ammCzusdPair")
    const dgodCzusdPair_address = await dgod.ammCzusdPair();
    dgodCzusdPair = await ethers.getContractAt("IAmmPair", dgodCzusdPair_address);

    console.log("initialize autoRewardPool")
    autoRewardPool.initialize(dgod.address,dgodCzusdPair.address,manager.address,dggLock.address);
    
    await czusd
    .connect(deployer)
    .grantRole(ethers.utils.id("MINTER_ROLE"), dgod.address);

    await czusd.connect(deployer).mint(owner.address,INITIAL_CZUSD_LP_WAD);
    await dgod.approve(pcsRouter.address,ethers.constants.MaxUint256);
    await czusd.approve(pcsRouter.address,ethers.constants.MaxUint256);
    console.log("add liq")
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
  });
  it("Should deploy dgod", async function () {
    const pairCzusdBal = await czusd.balanceOf(dgodCzusdPair.address);
    const pairDgodal = await dgod.balanceOf(dgodCzusdPair.address);
    const baseCzusdLocked = await dgod.baseCzusdLocked();
    const totalCzusdSpent = await dgod.totalCzusdSpent();
    const ownerIsExempt = await dgod.isExempt(owner.address);
    const pairIsExempt = await dgod.isExempt(dgodCzusdPair.address);
    const tradingOpen = await dgod.tradingOpen();
    expect(pairCzusdBal).to.eq(INITIAL_CZUSD_LP_WAD);
    expect(pairDgodal).to.eq(INITIAL_DGOD_LP_WAD);
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
  it("Should burn 15% when buying and increase wad available", async function () {    
    await dgod.ADMIN_openTrading();
    const totalStakedInitial = await autoRewardPool.totalStaked();
    const traderBalInitial = await dgod.balanceOf(trader.address);
    await pcsRouter.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        parseEther("100"),
        0,
        [czusd.address,dgod.address],
        trader.address,
        ethers.constants.MaxUint256
    );
    const pendingReward = await autoRewardPool.pendingReward(trader.address);
    const rewardPerSecond = await autoRewardPool.rewardPerSecond();
    const totalStakedFinal = await autoRewardPool.totalStaked();
    const totalCzusdSpent = await dgod.totalCzusdSpent();
    const lockedCzusd = await dgod.lockedCzusd();
    const availableWadToSend = await dgod.availableWadToSend();
    const totalSupply = await dgod.totalSupply();
    const traderBalFinal = await dgod.balanceOf(trader.address);
    expect(pendingReward).to.eq(0);
    expect(totalStakedFinal.sub(totalStakedInitial)).to.eq(traderBalFinal.sub(traderBalInitial));
    expect(totalStakedInitial).to.eq(0);
    expect(rewardPerSecond).to.eq(0);
    expect(totalCzusdSpent).to.eq(0);
    expect(lockedCzusd).to.be.closeTo(parseEther("50053.4"),parseEther("0.1"));
    expect(availableWadToSend).to.eq(lockedCzusd.sub(BASE_CZUSD_LP_WAD).sub(totalCzusdSpent));
    expect(totalSupply).to.be.closeTo(parseEther("9998408192"),parseEther("1"));
  });
  it("Should send reward to dev wallet", async function() {
    const devWalletBalInitial = await dogeCoin.balanceOf(manager.address);
    const autoRewardPoolBalInitial = await dogeCoin.balanceOf(autoRewardPool.address);
    const availableWadToSendInitial = await dgod.availableWadToSend();
    await dgod.performUpkeep(0);
    const devWalletBalFinal = await dogeCoin.balanceOf(manager.address);
    const autoRewardPoolBalFinal = await dogeCoin.balanceOf(autoRewardPool.address);
    const availableWadToSendFinal = await dgod.availableWadToSend();
    const totalCzusdSpent = await dgod.totalCzusdSpent();
    const traderBal = await dgod.balanceOf(trader.address);
    await dgod.connect(trader).transfer(trader1.address,traderBal);
    const trader1Bal = await dgod.balanceOf(trader1.address);
    await dgod.connect(trader1).transfer(trader.address,trader1Bal);
    const rewardPerSecond = await autoRewardPool.rewardPerSecond();

    expect(totalCzusdSpent).to.eq(availableWadToSendInitial);
    expect(totalCzusdSpent).to.be.closeTo(parseEther("35.4"),parseEther("0.1"));
    expect(availableWadToSendFinal).to.eq(0);
    //dogecoin has 8 decimals, divide 18 decimals by 10*10 to get 8.
    expect(devWalletBalFinal.sub(devWalletBalInitial)).closeTo(parseEther("90").div(10**10),parseEther("1").div(10**10));
    expect(autoRewardPoolBalFinal.sub(autoRewardPoolBalInitial)).closeTo(parseEther("452").div(10**10),parseEther("1").div(10**10));
    expect(autoRewardPoolBalFinal.sub(autoRewardPoolBalInitial).div(86400*7)).to.be.eq(rewardPerSecond);
    expect(rewardPerSecond).to.eq(74810);

  });
  it("Should properly set rps on second update", async function() {
    await time.increase(1*86400);
    await mine(1);
    const autoRewardPoolBalInitial = await dogeCoin.balanceOf(autoRewardPool.address);
    await dgod.performUpkeep(0);
    await time.increase(10);
    await mine(1);
    const autoRewardPoolBalFinal = await dogeCoin.balanceOf(autoRewardPool.address);
    const traderBal = await dgod.balanceOf(trader.address);
    await dgod.connect(trader).transfer(trader1.address,traderBal);
    const trader1Bal = await dgod.balanceOf(trader1.address);
    await dgod.connect(trader1).transfer(trader.address,trader1Bal);
    const rewardPerSecond = await autoRewardPool.rewardPerSecond();
    const totalRewardsPaid = await autoRewardPool.totalRewardsPaid();
    const traderRewardsReceived = await autoRewardPool.totalRewardsReceived(trader.address);
    const traderRewardBal = await dogeCoin.balanceOf(trader.address);
    const trader1RewardsReceived = await autoRewardPool.totalRewardsReceived(trader1.address);
    const trader1RewardBal = await dogeCoin.balanceOf(trader1.address);
    const autoRewardPoolBalPostRewards = await dogeCoin.balanceOf(autoRewardPool.address);
    const timestampEnd = await autoRewardPool.timestampEnd();
    const currentTime = await time.latest();
    const traderPending = await autoRewardPool.pendingReward(trader.address);
    const trader1Pending = await autoRewardPool.pendingReward(trader1.address);
    expect(traderPending).to.eq(0);
    expect(trader1Pending).to.eq(0);
    expect(traderRewardBal).closeTo(parseEther("64").div(10**10),parseEther("1").div(10**10));
    expect(trader1RewardBal).to.eq(164665)
    expect(traderRewardsReceived).to.eq(traderRewardBal);
    expect(trader1RewardsReceived).to.eq(trader1RewardBal);
    expect(totalRewardsPaid).to.eq(traderRewardBal.add(trader1RewardBal))
    expect(autoRewardPoolBalFinal.sub(autoRewardPoolBalInitial)).closeTo(parseEther("159").div(10**10),parseEther("1").div(10**10));
    expect(rewardPerSecond).to.eq(90547);
    expect(rewardPerSecond.mul(timestampEnd.sub(currentTime))).closeTo(autoRewardPoolBalPostRewards,10000000);
  });
  it("Should properly set pending rewards with third trader and third update", async function() {
    await czusd.connect(deployer).mint(trader2.address,parseEther("10000"));
    await czusd.connect(trader2).approve(pcsRouter.address,ethers.constants.MaxUint256);
    await pcsRouter.connect(trader2).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        parseEther("100"),
        0,
        [czusd.address,dgod.address],
        trader2.address,
        ethers.constants.MaxUint256
    );
    const currentTimeInitial = await time.latest();
    await time.increase(1*86400);
    await mine(1);
    const currentTimeMiddle = await time.latest();
    const autoRewardPoolBalInitial = await dogeCoin.balanceOf(autoRewardPool.address);
    await dgod.performUpkeep(0);
    const autoRewardPoolBalFinal = await dogeCoin.balanceOf(autoRewardPool.address);
    const traderBal = await dgod.balanceOf(trader.address);
    await dgod.connect(trader).transfer(trader1.address,traderBal);
    const trader1Bal = await dgod.balanceOf(trader1.address);
    await dgod.connect(trader1).transfer(trader.address,trader1Bal);
    const rewardPerSecond = await autoRewardPool.rewardPerSecond();
    const totalRewardsPaid = await autoRewardPool.totalRewardsPaid();
    const autoRewardPoolBalPostRewards = await dogeCoin.balanceOf(autoRewardPool.address);
    const currentTimeFinal = await time.latest();
    const timestampEnd = await autoRewardPool.timestampEnd();
    const traderPending = await autoRewardPool.pendingReward(trader.address);
    const trader1Pending = await autoRewardPool.pendingReward(trader1.address);
    const trader2Pending = await autoRewardPool.pendingReward(trader2.address);

    expect(rewardPerSecond).to.eq(114076);
    expect(traderPending).to.eq(0);
    expect(trader1Pending).to.eq(0);
    expect(trader2Pending).closeTo(parseEther("51").div(10**10),parseEther("1").div(10**10));
    expect(rewardPerSecond.mul(timestampEnd.sub(currentTimeFinal))).closeTo(autoRewardPoolBalPostRewards.sub(trader2Pending),10000000);
  });
  it("DggLock: should deploy", async function() {
    
    const dggLockDGGAddress = await dggLock.DGG();
    const dggLockautoRewardPoolAddress = await dggLock.autoRewardPool();
    expect(dggLockDGGAddress).to.eq(dgod.address);
    expect(dggLockautoRewardPoolAddress).to.eq(autoRewardPool.address);
  });
  it("DggLock: should accept vestors", async function() {
    const currentTime = await time.latest();
    await dggLock.setVestSchedule(currentTime+86400*7,currentTime+86400*8);
    await dgod.approve(dggLock.address,ethers.constants.MaxUint256);
    await dggLock.addVestings([vestor1.address,vestor2.address],[parseEther("500000000"),parseEther("1000000000")]);

    const vestor1DggInitial = await dggLock.accountDggInitial(vestor1.address);
    const vestor2DggInitial = await dggLock.accountDggInitial(vestor2.address);
    const vestor1DggClaimable = await dggLock.accountDggClaimable(vestor1.address);
    const vestor2DggClaimable = await dggLock.accountDggClaimable(vestor2.address);
    const vestor1DogeClaimable = await autoRewardPool.pendingReward(vestor1.address);
    const vestor2DogeClaimable = await autoRewardPool.pendingReward(vestor2.address);
    const firstUnlockEpoch = await dggLock.firstUnlockEpoch();
    const secondUnlockEpoch = await dggLock.secondUnlockEpoch();
    const lockBal = await dgod.balanceOf(dggLock.address);

    expect(vestor1DggClaimable).to.eq(parseEther("100000000"));
    expect(vestor2DggClaimable).to.eq(parseEther("200000000"));
    expect(vestor1DogeClaimable).to.eq(0);
    expect(vestor2DogeClaimable).to.eq(0);
    expect(vestor1DggInitial).to.eq(parseEther("500000000"));
    expect(vestor2DggInitial).to.eq(parseEther("1000000000"));
    expect(lockBal).to.eq(parseEther("1500000000"));
    expect(firstUnlockEpoch).to.eq(currentTime+86400*7);
    expect(secondUnlockEpoch).to.eq(currentTime+86400*8);
  });
  it("DggLock: Should properly set pending rewards for dggLock", async function() {
    await czusd.connect(deployer).mint(trader2.address,parseEther("10000"));
    await czusd.connect(trader2).approve(pcsRouter.address,ethers.constants.MaxUint256);
    await pcsRouter.connect(trader2).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        parseEther("10"),
        0,
        [czusd.address,dgod.address],
        trader2.address,
        ethers.constants.MaxUint256
    );
    await time.increase(5*86400);
    await mine(1);
    await dgod.performUpkeep(0);
    const traderBal = await dgod.balanceOf(trader.address);
    await dgod.connect(trader).transfer(trader1.address,traderBal);
    const trader1Bal = await dgod.balanceOf(trader1.address);
    await dgod.connect(trader1).transfer(trader.address,trader1Bal);
    const rewardPerSecond = await autoRewardPool.rewardPerSecond();
    const autoRewardPoolBalPostRewards = await dogeCoin.balanceOf(autoRewardPool.address);
    const currentTimeFinal = await time.latest();
    const timestampEnd = await autoRewardPool.timestampEnd();
    const traderPending = await autoRewardPool.pendingReward(trader.address);
    const trader1Pending = await autoRewardPool.pendingReward(trader1.address);
    const trader2Pending = await autoRewardPool.pendingReward(trader2.address);
    const vestor1LockPending = await autoRewardPool.pendingReward(vestor1.address);
    const vestor2LockPending = await autoRewardPool.pendingReward(vestor2.address);
    expect(rewardPerSecond).to.eq(48126);
    expect(traderPending).to.eq(0);
    expect(trader1Pending).to.eq(0);
    expect(trader2Pending).closeTo(parseEther("3.2").div(10**10),parseEther("0.1").div(10**10));
    expect(vestor1LockPending).closeTo(parseEther("162").div(10**10),parseEther("1").div(10**10));
    expect(vestor2LockPending).closeTo(parseEther("325").div(10**10),parseEther("1").div(10**10));
    expect(rewardPerSecond.mul(timestampEnd.sub(currentTimeFinal))).closeTo(autoRewardPoolBalPostRewards.sub(trader2Pending).sub(vestor2LockPending).sub(vestor1LockPending),10000000);
  });
  it("DggLock: Should claim rewards for vestor", async function() {

    const rewardPerSecond = await autoRewardPool.rewardPerSecond();

    const vestor1LockPendingInitial = await autoRewardPool.pendingReward(vestor1.address);
    await autoRewardPool.connect(vestor1).claim();
    const vestor1LockPendingFinal = await autoRewardPool.pendingReward(vestor1.address);

    const vestor2LockPendingInitial = await autoRewardPool.pendingReward(vestor2.address);
    await autoRewardPool.connect(vestor2).claim();
    const vestor2LockPendingFinal = await autoRewardPool.pendingReward(vestor2.address);

    const vestor1DogeBal = await dogeCoin.balanceOf(vestor1.address);
    const vestor2DogeBal = await dogeCoin.balanceOf(vestor2.address);

    expect(vestor1LockPendingInitial).closeTo(parseEther("162").div(10**10),parseEther("1").div(10**10));
    expect(vestor2LockPendingInitial).closeTo(parseEther("325").div(10**10),parseEther("1").div(10**10));
    expect(vestor1DogeBal).to.eq(vestor1LockPendingInitial);
    expect(vestor2DogeBal).to.eq(vestor2LockPendingInitial);
    expect(vestor1LockPendingFinal).to.eq(0);
    expect(vestor2LockPendingFinal).to.eq(0);

  });
  it("DggLock: Should send 20% dgod before first epoch", async function() {
    await dggLock.connect(vestor1).claimDgg();
    const vestor1Bal = await dgod.balanceOf(vestor1.address);
    expect(vestor1Bal).to.eq(parseEther("100000000"));
  });
  it("DggLock: Should send 40% dgod after first epoch before second epoch", async function() {
    await time.increase(2*86400);
    await dggLock.connect(vestor1).claimDgg();
    const vestor1Bal = await dgod.balanceOf(vestor1.address);
    expect(vestor1Bal).to.eq(parseEther("300000000"));
  });
  it("DggLock: Should send remaining dgod after second epoch", async function() {
    await time.increase(2*86400);
    await dggLock.connect(vestor1).claimDgg();
    await dggLock.connect(vestor2).claimDgg();
    const vestor1Bal = await dgod.balanceOf(vestor1.address);
    const vestor2Bal = await dgod.balanceOf(vestor2.address);
    expect(vestor1Bal).to.eq(parseEther("500000000"));
    expect(vestor2Bal).to.eq(parseEther("1000000000"));
  });
});