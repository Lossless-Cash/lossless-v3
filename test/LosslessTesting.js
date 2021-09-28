const { time, constants } = require('@openzeppelin/test-helpers');
const { expect, assert } = require('chai');

let member1;
let member2;
let member3;
let member4;
let member5;

let maliciousActor1;
let maliciousActor2;
let maliciousActor3;

let reporter1;
let reporter2;

let staker1;
let staker2;
let staker3;
let staker4;
let staker5;

let regularUser1;
let regularUser2;
let regularUser3;
let regularUser4;
let regularUser5;

const stakeAmount = 2500;
const reportLifetime = time.duration.days(1);

const lssTeamVoteIndex = 0;
const projectTeamVoteIndex = 1;
const committeeVoteIndex = 2;

//LosslessToken

let lssInitialHolder;
let lssAdmin;
let lssPauseAdmin;
let lssRecoveryAdmin;
let lssBackupAdmin;

const lssName = 'Lossless';
const lssSymbol = 'LSS';
const lssSupply = 1000;
const lssInitialSupply = 1000000;

//LERC20 Token

let lerc20InitialHolder;
let lerc20Admin;
let lerc20PauseAdmin;
let lerc20RecoveryAdmin;
let lerc20BackupAdmin;

const lerc20Name = 'Random Token';
const lerc20Symbol = 'RAND';
const lerc20Supply = 2000;
const lerc20InitialSupply = 2000000;

const { ZERO_ADDRESS } = constants;


describe.only('Lossless TestSuite', () => {
  beforeEach(async () => {
      [
        lssInitialHolder,
        lssAdmin,
        lssPauseAdmin,
        lssRecoveryAdmin,
        lssBackupAdmin,
        lerc20InitialHolder,
        lerc20Admin,
        lerc20PauseAdmin,
        lerc20RecoveryAdmin,
        lerc20BackupAdmin,
        member1,
        member2,
        member3,
        member4,
        member5,
       maliciousActor1,
       maliciousActor2,
       maliciousActor3,
        reporter1,
        reporter2,
      ] = await ethers.getSigners();

      [
        staker1,
        staker2,
        staker3,
        staker4,
        staker5,
        regularUser1,
        regularUser2,
        regularUser3,
        regularUser4,
        regularUser5,
      ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
        'LosslessController',
      );
  
      const LosslessStaking = await ethers.getContractFactory(
        'LosslessStaking',
      );
  
      const LosslessGovernance = await ethers.getContractFactory(
        'LosslessGovernance',
      );
  
      const LosslessReporting = await ethers.getContractFactory(
        'LosslessReporting',
      );
  
      lssController = await upgrades.deployProxy(
        LosslessController,
        [lssAdmin.address, lssRecoveryAdmin.address, lssPauseAdmin.address],
        { initializer: 'initialize' },
      );
  
      lssReporting = await upgrades.deployProxy(
        LosslessReporting,
        [lssAdmin.address, lssRecoveryAdmin.address, lssPauseAdmin.address],
        { initializer: 'initialize' },
      );

      lssGovernance = await upgrades.deployProxy(
        LosslessGovernance,
        [lssAdmin.address, lssRecoveryAdmin.address, lssPauseAdmin.address, lssReporting.address, lssController.address],
        { initializer: 'initialize' },
      );
  
      lssStaking = await upgrades.deployProxy(
        LosslessStaking,
        [lssAdmin.address, lssRecoveryAdmin.address, lssPauseAdmin.address, lssReporting.address, lssController.address, lssGovernance.address],
        { initializer: 'initialize' },
      );

      const LosslessToken = await ethers.getContractFactory('LERC20');

      lssToken = await LosslessToken.deploy(
        lssInitialSupply,
        lssName,
        lssSymbol,
        lssInitialHolder.address,
        lssAdmin.address,
        lssBackupAdmin.address,
        Number(time.duration.days(1)),
        lssController.address,
      );

      const randomToken = await ethers.getContractFactory('LERC20');

      randToken = await randomToken.deploy(
        lerc20InitialSupply,
        lerc20Name,
        lerc20Symbol,
        lerc20InitialHolder.address,
        lerc20Admin.address,
        lerc20BackupAdmin.address,
        Number(time.duration.days(1)),
        lssController.address,
      );

    await lssController.connect(lssAdmin).setStakeAmount(stakeAmount);
    await lssController.connect(lssAdmin).setReportLifetime(Number(reportLifetime));
    await lssController.connect(lssAdmin).setLosslessToken(lssToken.address);
    await lssController.connect(lssAdmin).setStakingContractAddress(lssStaking.address);
    await lssController.connect(lssAdmin).setReportingContractAddress(lssReporting.address);
    await lssController.connect(lssAdmin).setGovernanceContractAddress(lssGovernance.address);

    await lssStaking.connect(lssAdmin).setLosslessToken(lssToken.address);

    await lssReporting.connect(lssAdmin).setLosslessToken(lssToken.address);
    await lssReporting.connect(lssAdmin).setControllerContractAddress(lssController.address);
    await lssReporting.connect(lssAdmin).setStakingContractAddress(lssStaking.address);
    await lssReporting.connect(lssAdmin).setReporterReward(2);
    await lssReporting.connect(lssAdmin).setLosslessFee(10);
    
  });
  describe('Lossless Environment', () => {
    describe('On deployment', () =>{ 
        describe('when the Lossless Controller contract has been set up', () =>{
          it('should set the stake amount correctly', async () => {
            expect(
              await lssController.getStakeAmount(),
            ).to.be.equal(stakeAmount);
          });

          it('should set the report lifetime correctly', async () => {
            expect(
              await lssController.getReportLifetime(),
            ).to.be.equal(Number(reportLifetime));
          });

          it('should set the report Lossless Token address correctly', async () => {
            expect(
              await lssController.losslessToken(),
            ).to.be.equal(lssToken.address);
          });

          it('should set the report Lossless Staking address correctly', async () => {
            expect(
              await lssController.losslessStaking(),
            ).to.be.equal(lssStaking.address);
          });

          it('should set the report Lossless Reporting address correctly', async () => {
            expect(
              await lssController.losslessReporting(),
            ).to.be.equal(lssReporting.address);
          });

          it('should set the report Lossless Governance address correctly', async () => {
            expect(
              await lssController.losslessGovernance(),
            ).to.be.equal(lssGovernance.address);
          });
      });

      describe('when the Lossless Staking Contract has been set up', () =>{

      it('should set the report Lossless Token address correctly', async () => {
        expect(
          await lssStaking.losslessToken(),
        ).to.be.equal(lssToken.address);
      });
    
    });

      describe('when the Lossless Reporting Contract has been set up', () =>{

      it('should set the report Lossless Token address correctly', async () => {
        expect(
          await lssReporting.losslessToken(),
        ).to.be.equal(lssToken.address);
      });

      it('should set the report Lossless Staking address correctly', async () => {
        expect(
          await lssReporting.losslessController(),
        ).to.be.equal(lssController.address);
      });

      it('should set the reporter reward correctly', async () => {
        expect(
          await lssReporting.reporterReward(),
        ).to.be.equal(2);
      });

      it('should set the Lossless fee correctly', async () => {
        expect(
          await lssReporting.losslessFee(),
        ).to.be.equal(10);
      });
    });
    });
    describe('Lossless Token', () => {
      describe('when transfering between users', ()=>{
        beforeEach(async ()=>{
          await lssToken.connect(lssInitialHolder).transfer(regularUser1.address, 100);
          await lssToken.connect(lssInitialHolder).transfer(regularUser2.address, 100);
        });

        it('should revert if 5 minutes haven\'t passed', async () => {

          await expect(
            lssToken.connect(regularUser1).transfer(regularUser3.address, 5),
          ).to.be.revertedWith("LSS: Amt exceeds settled balance");

        });
        
        it('should not revert', async () => {
          
              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(5)),
              ]);

              await expect(
                lssToken.connect(regularUser1).transfer(regularUser3.address, 5),
              ).to.not.be.reverted;

              expect(
                await lssToken.balanceOf(regularUser3.address),
              ).to.be.equal(5);
         });
      });
    });
    describe('Random Token', () => {
      describe('when transfering between users', ()=>{
        beforeEach(async ()=>{
          await randToken.connect(lerc20InitialHolder).transfer(regularUser1.address, 100);
          await randToken.connect(lerc20InitialHolder).transfer(regularUser2.address, 100);
        });

        it('should revert if 5 minutes haven\'t passed', async () => {
          await expect(
            randToken.connect(regularUser2).transfer(regularUser4.address, 5),
          ).to.be.revertedWith("LSS: Amt exceeds settled balance");
        });
        
        it('should not revert', async () => {
              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(5)),
              ]);

              await expect(
                randToken.connect(regularUser1).transfer(regularUser3.address, 5),
              ).to.not.be.reverted;

              expect(
                await randToken.balanceOf(regularUser3.address),
              ).to.be.equal(5);
         });
      });
    });
    describe('Lossless Controller', ()=>{
      describe('when whitelisting an account', ()=>{
        it('should not revert', async ()=>{
          await lssController.connect(lssAdmin).addToWhitelist(lssGovernance.address);
          await lssController.connect(lssAdmin).addToWhitelist(lssReporting.address);
          await lssController.connect(lssAdmin).addToWhitelist(lssStaking.address);

          expect(
            await lssController.isWhitelisted(lssGovernance.address)
          ).to.be.equal(true);
          
          expect(
            await lssController.isWhitelisted(lssReporting.address)
          ).to.be.equal(true);

          expect(
            await lssController.isWhitelisted(lssStaking.address)
          ).to.be.equal(true);       

        });
      });
      describe('Lossless Reporting', ()=>{
        describe('when generating a report', ()=>{
          beforeEach(async ()=>{
            await lssController.connect(lssAdmin).addToWhitelist(lssReporting.address);
          
            await lssToken.connect(lssInitialHolder).transfer(reporter1.address, stakeAmount);
            await lssToken.connect(lssInitialHolder).transfer(reporter2.address, stakeAmount);

            await lssToken.connect(reporter1).approve(lssReporting.address, stakeAmount);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(5)),
            ]);
          });
          describe('when reporting a whitelisted account', ()=>{
            it('should revert', async ()=>{
              await expect(
                lssReporting.connect(reporter1).report(randToken.address, lssReporting.address),
              ).to.be.revertedWith("LSS: Cannot report LSS protocol");
            });
          });
        });
      });
    });
  }); 
});