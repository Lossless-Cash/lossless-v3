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
        staker1,
        staker2,
        staker3,
        staker4,
        staker5,
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
        lerc20InitialHolder,
        lerc20Admin,
        lerc20PauseAdmin,
        lerc20RecoveryAdmin,
        lerc20BackupAdmin,
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

        describe('when succesfully generating a report', ()=>{
          it('should not revert', async ()=>{
            await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);

            expect(
              await lssReporting.getReportTimestamps(1)
            ).to.not.be.empty;
          });

          it('should blacklist address', async ()=>{

            await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);

            expect(
              await lssController.isBlacklisted(maliciousActor1.address),
            ).to.be.equal(true);
          });
        });

        describe('when reporting the same token and address twice', ()=>{
          it('should revert', async ()=>{

            await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);

            await expect(
               lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address),
            ).to.be.revertedWith("LSS: Report already exists");
          });
        });

      });

      describe('when generating another report', ()=>{
        beforeEach(async () => {
          await lssController.connect(lssAdmin).addToWhitelist(lssReporting.address);
        
          await lssToken.connect(lssInitialHolder).transfer(reporter1.address, stakeAmount*2);
          await lssToken.connect(lssInitialHolder).transfer(reporter2.address, stakeAmount);

          await lssToken.connect(reporter1).approve(lssReporting.address, stakeAmount*2);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);
        });

        describe('when generating another report successfully', ()=>{
          it('should not revert', async ()=>{
            await expect(
              lssReporting.connect(reporter1).reportAnother(1, randToken.address, maliciousActor2.address),
            ).to.not.be.reverted;
          });
        });

        describe('when reporting another on a whitelisted account', ()=>{
          it('should revert', async ()=>{
            await expect(
              lssReporting.connect(reporter1).reportAnother(1, randToken.address, lssReporting.address),
            ).to.be.revertedWith("LSS: Cannot report LSS protocol");
          });
        });

        describe('when reporting another on a non existant report', ()=>{
          it('should revert', async ()=>{
            await expect(
              lssReporting.connect(reporter1).reportAnother(5, randToken.address, maliciousActor1.address),
            ).to.be.revertedWith("LSS: report does not exists");
          });
        });

        describe('when reporting another by other than the original reporter', ()=>{
          it('should revert', async ()=>{
            await expect(
              lssReporting.connect(reporter2).reportAnother(1, randToken.address, maliciousActor1.address),
            ).to.be.revertedWith("LSS: invalid reporter");
          });
        });

        describe('when reporting another multiple times', ()=>{
          it('should revert', async ()=>{
            await expect(
              lssReporting.connect(reporter2).reportAnother(1, randToken.address, maliciousActor1.address),
            ).to.be.revertedWith("LSS: invalid reporter");
          });
        });
      });

    });
    describe('Lossless Staking', ()=>{
      describe('when the staking period is active', ()=>{
        beforeEach(async ()=>{
          await lssController.connect(lssAdmin).addToWhitelist(lssReporting.address);
          
          await lssToken.connect(lssInitialHolder).transfer(reporter1.address, stakeAmount);
          await lssToken.connect(lssInitialHolder).transfer(staker1.address, stakeAmount);
          await lssToken.connect(lssInitialHolder).transfer(staker2.address, stakeAmount);
          await lssToken.connect(lssInitialHolder).transfer(staker3.address, stakeAmount);
          await lssToken.connect(lssInitialHolder).transfer(staker4.address, stakeAmount);
  
          await lssToken.connect(reporter1).approve(lssReporting.address, stakeAmount);
          await lssToken.connect(staker1).approve(lssStaking.address, stakeAmount);
          await lssToken.connect(staker2).approve(lssStaking.address, stakeAmount)
          await lssToken.connect(staker3).approve(lssStaking.address, stakeAmount);
          await lssToken.connect(staker4).approve(lssStaking.address, stakeAmount);;
  
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);
          
          await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);
        });
  
        describe('when staking before the cooldown period', ()=> {
          it('should revert', async ()=>{
            await expect(
              lssStaking.connect(staker1).stake(1),
            ).to.be.revertedWith("LSS: Must wait 1 minute to stake");
          });
        });

        describe('when staking successfully', ()=> {
          it('should not revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);

            await lssStaking.connect(staker1).stake(1);

            expect(
              await lssStaking.getIsAccountStaked(1, staker1.address)
            ).to.be.equal(true);
            });
          });

        describe('when staking successfully with multiple addresses', ()=> {
          it('should not revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);

            await lssStaking.connect(staker1).stake(1);

            expect(
              await lssStaking.getIsAccountStaked(1, staker1.address)
            ).to.be.equal(true);

            await lssStaking.connect(staker2).stake(1);

            expect(
              await lssStaking.getIsAccountStaked(1, staker2.address)
            ).to.be.equal(true);

            await lssStaking.connect(staker3).stake(1);

            expect(
              await lssStaking.getIsAccountStaked(1, staker3.address)
            ).to.be.equal(true);

            await lssStaking.connect(staker4).stake(1);

            expect(
              await lssStaking.getIsAccountStaked(1, staker4.address)
            ).to.be.equal(true);
          });
        });
  
        describe('when staking on a non existant report', ()=>  {
          it('should revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);

            await expect(
              lssStaking.connect(staker1).stake(5),
            ).to.be.revertedWith("LSS: report does not exists");
          });
        });
  
        describe('when staker has insufficient balance', ()=>  {
          it('should revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);

            await expect(
              lssStaking.connect(staker5).stake(1),
            ).to.be.revertedWith("LSS: Not enough $LSS to stake");
          });
        });
  
        describe('when staking twice on the same report', ()=>  {
          it('should revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);

            await lssStaking.connect(staker1).stake(1);

            await expect(
              lssStaking.connect(staker1).stake(1),
            ).to.be.revertedWith("LSS: already staked");
          });
        });
  
        describe('when the reporter tries to stake on their report', ()=> {
          it('should revert', async ()=>{
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);
 
            await expect(
              lssStaking.connect(reporter1).stake(1),
            ).to.be.revertedWith( "LSS: reporter can not stake");
          });
        });
      });
      describe('when the staking period is inactive', ()=>{
        beforeEach(async ()=>{
          await lssController.connect(lssAdmin).addToWhitelist(lssReporting.address);
          
          await lssToken.connect(lssInitialHolder).transfer(reporter1.address, stakeAmount*2);
          await lssToken.connect(lssInitialHolder).transfer(staker1.address, stakeAmount+stakeAmount);
          await lssToken.connect(lssInitialHolder).transfer(staker2.address, stakeAmount*2);
          await lssToken.connect(lssInitialHolder).transfer(staker3.address, stakeAmount*2);
          await lssToken.connect(lssInitialHolder).transfer(staker4.address, stakeAmount*2);
  
          await lssToken.connect(reporter1).approve(lssReporting.address, stakeAmount*2);
          await lssToken.connect(staker1).approve(lssStaking.address, stakeAmount*2);
          await lssToken.connect(staker2).approve(lssStaking.address, stakeAmount*2)
          await lssToken.connect(staker3).approve(lssStaking.address, stakeAmount*2);
          await lssToken.connect(staker4).approve(lssStaking.address, stakeAmount*2);;

          await randToken.connect(lerc20InitialHolder).transfer(maliciousActor1.address, 1000);
  
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await lssStaking.connect(staker1).stake(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(45)),
          ]);

          await lssStaking.connect(staker2).stake(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(8)),
          ]);

          await lssStaking.connect(staker3).stake(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(10)),
          ]);

          await lssStaking.connect(staker4).stake(1);

          await lssGovernance.connect(lssAdmin).addCommitteeMembers([member1.address, member2.address, member3.address], 2);
          
          await lssGovernance.connect(lssAdmin).losslessVote(1, true);
          await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true);
          await lssGovernance.connect(member1).committeeMemberVote(1, true);
          await lssGovernance.connect(member2).committeeMemberVote(1, true);

          await lssGovernance.connect(lssAdmin).resolveReport(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);
        });

        describe('when trying to stake', ()=>{
          it('should revert', async ()=> {
            await expect(
              lssStaking.connect(staker1).stake(1),
            ).to.be.revertedWith("LSS: Report already resolved");
          });
        });

        describe('when claiming', ()=>{

          describe('when verifying reporter claimable amount by a non reporter', ()=>{
            it('should revert', async ()=> {
              await expect(
                lssStaking.connect(staker1).reporterClaimableAmount(1),
              ).to.be.revertedWith("LSS: Must be the reporter");
            });
          });

          describe('when verifying staker claimable amount by the reporter', ()=>{
            it('should revert', async ()=> {
              await expect(
                lssStaking.connect(reporter1).stakerClaimableAmount(1),
              ).to.be.revertedWith("LSS: You're not staking");
            });
          });

          describe('when verifying reporter claimable amount by the reporter', ()=>{
            it('should return amount', async ()=> {
              expect(
                await lssStaking.connect(reporter1).reporterClaimableAmount(1),
              ).to.not.be.empty;
            });
          });

          describe('when verifying staker claimable amount by a staker', ()=>{
            it('should return amount', async ()=> {
              expect(
                await lssStaking.connect(staker1).stakerClaimableAmount(1),
              ).to.not.be.empty;
            });
          });

          describe('when stakers claims', ()=>{
            it('should not revert', async ()=> {

              let balance;
              expect(
                balance = await randToken.balanceOf(staker1.address),
              ).to.be.equal(0);

              expect(
              balance = await lssToken.balanceOf(staker1.address),
              ).to.be.equal(2500);

              await lssStaking.connect(staker1).stakerClaim(1);

              expect(
                await randToken.balanceOf(staker1.address),
              ).to.not.be.equal(0);

              expect(
                balance = await lssToken.balanceOf(staker1.address),
              ).to.be.equal(stakeAmount*2);
            });
          });

          describe('when stakers claims two times', ()=>{
            it('should revert', async ()=> {

              await lssStaking.connect(staker1).stakerClaim(1);

              await expect(
                 lssStaking.connect(staker1).stakerClaim(1),
              ).to.be.revertedWith("LSS: You already claimed");
            });
          });

          describe('when all stakers claims', ()=>{
            it('should not revert', async ()=> {

              await expect(
                lssStaking.connect(staker1).stakerClaim(1),
                lssStaking.connect(staker2).stakerClaim(1),
                lssStaking.connect(staker3).stakerClaim(1),
                lssStaking.connect(staker4).stakerClaim(1),
              ).to.not.be.reverted;
          });
        });

        describe('when reporter claims', ()=>{
          it('should not revert', async ()=> {

            let balance;
            expect(
              balance = await randToken.balanceOf(reporter1.address),
            ).to.be.equal(0);

            expect(
            balance = await lssToken.balanceOf(reporter1.address),
            ).to.be.equal(2500);

            await lssStaking.connect(reporter1).reporterClaim(1);

            expect(
              await randToken.balanceOf(reporter1.address),
            ).to.be.equal(20);

            expect(
              balance = await lssToken.balanceOf(reporter1.address),
            ).to.be.equal(stakeAmount*2);
          });
        });

        describe('when reporter claims two times', ()=>{
          it('should revert', async ()=> {

            await lssStaking.connect(reporter1).reporterClaim(1);
            
            await expect(
               lssStaking.connect(reporter1).reporterClaim(1),
            ).to.be.revertedWith("LSS: You already claimed");
          });
        });

      });
      });
    });

    describe('Lossless Governance', ()=>{
      beforeEach(async ()=>{
        await lssToken.connect(lssInitialHolder).transfer(reporter1.address, stakeAmount);

        await lssToken.connect(reporter1).approve(lssReporting.address, stakeAmount);
        
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await lssReporting.connect(reporter1).report(randToken.address, maliciousActor1.address);
      });

      describe('when setting up the Committee', ()=>{
        describe('when adding Committe members', ()=>{
          it('should add members and update quorum', async ()=>{
            await lssGovernance.connect(lssAdmin).addCommitteeMembers([
              member1.address, 
              member2.address,
              member3.address],
              2);

            expect(
              await lssGovernance.isCommitteeMember(member1.address),
            ).to.be.equal(true);

            expect(
              await lssGovernance.isCommitteeMember(member2.address),
            ).to.be.equal(true);

            expect(
              await lssGovernance.isCommitteeMember(member3.address),
            ).to.be.equal(true);

            expect(
              await lssGovernance.quorumSize(),
            ).to.be.equal(2);
          });
        });

        describe('when removing Committee members', ()=>{
          it('should remove members and update quorum', async ()=>{
            await lssGovernance.connect(lssAdmin).addCommitteeMembers([
              member1.address, 
              member2.address,
              member3.address,
              member4.address,
              member5.address],
              3);

             await lssGovernance.connect(lssAdmin).removeCommitteeMembers([member2.address, member4.address], 2)

            expect(
              await lssGovernance.isCommitteeMember(member2.address),
            ).to.be.equal(false);

            expect(
              await lssGovernance.isCommitteeMember(member4.address),
            ).to.be.equal(false);

            expect(
              await lssGovernance.quorumSize(),
            ).to.be.equal(2);
          });

          });
      });

      describe('when voting takes place', ()=>{
        beforeEach(async ()=>{
          await lssGovernance.connect(lssAdmin).addCommitteeMembers([
            member1.address, 
            member2.address,
            member3.address,
            member4.address,
            member5.address],
            3);
        });

        describe('when the Lossless Team is voting', ()=>{
          it('should register Lossless Vote', async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, true);
            
            expect(
              await lssGovernance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should revert at a second attempt', async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, true);
            
            await expect(
              lssGovernance.connect(lssAdmin).losslessVote(1, true),
            ).to.be.revertedWith("LSS: LSS already voted.");
          });

        });

        describe('when the Token Owner is voting', ()=>{
          it('should register Token Owner vote', async ()=>{
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true);

            expect(
              await lssGovernance.getIsVoted(1, projectTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should revert at a second attemtp', async ()=>{
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true);

            await expect(
              lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true),
            ).to.be.revertedWith("LSS: owners already voted");
          });
        });

        describe('when the Committee is voting', ()=>{
          it('should register all members vote', async ()=>{
            await lssGovernance.connect(member1).committeeMemberVote(1, true);
            await lssGovernance.connect(member2).committeeMemberVote(1, true);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);

            expect(
              await lssGovernance.getCommitteeVotesCount(1),
            ).to.be.equal(3);
          });

          it('should revert at a second attempt', async ()=>{
            await lssGovernance.connect(member1).committeeMemberVote(1, true);
            await lssGovernance.connect(member2).committeeMemberVote(1, true);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);

            await expect(
              lssGovernance.connect(member1).committeeMemberVote(1, true),
            ).to.be.revertedWith("LSS: Member already voted.");
          });
        });
      });

      describe('when non members try to vote', ()=>{
        describe('when impersonating the Lossless Team', ()=>{
          it('should revert', async ()=>{          
            await expect(
              lssGovernance.connect(maliciousActor1).losslessVote(1, true),
            ).to.be.revertedWith("LSS: must be admin");
          });
        });
        describe('when impersonating the Token Owners', ()=>{
          it('should revert', async ()=>{          
            await expect(
              lssGovernance.connect(maliciousActor1).tokenOwnersVote(1, true),
            ).to.be.revertedWith("LSS: must be token owner");
          });
        });
        describe('when impersonating a committee member', ()=>{
          it('should revert', async ()=>{          
            await expect(
              lssGovernance.connect(maliciousActor1).committeeMemberVote(1, true),
            ).to.be.revertedWith("LSS: must be a committee member");
          });
        });
      });

      describe('when solving a report', ()=>{
        beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).addCommitteeMembers([
              member1.address, 
              member2.address,
              member3.address,
              member4.address,
              member5.address],
              3);
        });

        describe('when only Lossless Team votes positively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, true);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, false);
            await lssGovernance.connect(member1).committeeMemberVote(1, false);
            await lssGovernance.connect(member2).committeeMemberVote(1, false);
            await lssGovernance.connect(member3).committeeMemberVote(1, false);
            await lssGovernance.connect(member4).committeeMemberVote(1, false);
          });

          it('should save vote as positive', async () =>{
            expect(
              await lssGovernance.getVote(1, lssTeamVoteIndex)
            ).to.be.equal(true);
          });

          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });

        describe('when only Token Owner votes positively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, false);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true);
            await lssGovernance.connect(member1).committeeMemberVote(1, false);
            await lssGovernance.connect(member2).committeeMemberVote(1, false);
            await lssGovernance.connect(member3).committeeMemberVote(1, false);
            await lssGovernance.connect(member4).committeeMemberVote(1, false);
          });

          it('should save vote as positive', async () =>{
            expect(
              await lssGovernance.getVote(1, projectTeamVoteIndex)
            ).to.be.equal(true);
          });

          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });

        describe('when only the Committee votes positively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, false);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, false);
            await lssGovernance.connect(member1).committeeMemberVote(1, true);
            await lssGovernance.connect(member2).committeeMemberVote(1, true);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);
            await lssGovernance.connect(member4).committeeMemberVote(1, true);
          });

          it('should save vote as positive', async () =>{
            expect(
              await lssGovernance.getVote(1, committeeVoteIndex)
            ).to.be.equal(true);
          });

          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });

        describe('when committee mayority votes positively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, false);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, false);
            await lssGovernance.connect(member1).committeeMemberVote(1, false);
            await lssGovernance.connect(member2).committeeMemberVote(1, true);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);
            await lssGovernance.connect(member4).committeeMemberVote(1, true);
          });

          it('should save committee resolution as positive', async () =>{
            expect(
              await lssGovernance.getVote(1, committeeVoteIndex)
            ).to.be.equal(true);
          });
          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });

        describe('when committee mayority votes negatively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, false);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, false);
            await lssGovernance.connect(member1).committeeMemberVote(1, false);
            await lssGovernance.connect(member2).committeeMemberVote(1, false);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);
            await lssGovernance.connect(member4).committeeMemberVote(1, false);
          });
          it('should save committee resolution as negative', async () =>{
            expect(
              await lssGovernance.getVote(1, committeeVoteIndex)
            ).to.be.equal(false);
          });
          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });

        describe('when everyone votes positive', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, true);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, true);
            await lssGovernance.connect(member1).committeeMemberVote(1, true);
            await lssGovernance.connect(member2).committeeMemberVote(1, true);
            await lssGovernance.connect(member3).committeeMemberVote(1, true);
            await lssGovernance.connect(member4).committeeMemberVote(1, true);
          });

          it('should save all vote as positive', async () =>{
            expect(
              await lssGovernance.getVote(1, committeeVoteIndex)
            ).to.be.equal(true);

            expect(
              await lssGovernance.getVote(1, projectTeamVoteIndex)
            ).to.be.equal(true);

            expect(
              await lssGovernance.getVote(1, lssTeamVoteIndex)
            ).to.be.equal(true);
          });

          it('should resolve positively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(true);
          });
        });

        describe('when everyone votes negatively', ()=>{
          beforeEach(async ()=>{
            await lssGovernance.connect(lssAdmin).losslessVote(1, false);
            await lssGovernance.connect(lerc20Admin).tokenOwnersVote(1, false);
            await lssGovernance.connect(member1).committeeMemberVote(1, false);
            await lssGovernance.connect(member2).committeeMemberVote(1, false);
            await lssGovernance.connect(member3).committeeMemberVote(1, false);
            await lssGovernance.connect(member4).committeeMemberVote(1, false);
          });

          it('should save vote as negative', async () =>{
            expect(
              await lssGovernance.getVote(1, committeeVoteIndex)
            ).to.be.equal(false);

            expect(
              await lssGovernance.getVote(1, projectTeamVoteIndex)
            ).to.be.equal(false);

            expect(
              await lssGovernance.getVote(1, lssTeamVoteIndex)
            ).to.be.equal(false);
          });

          it('should resolve negatively', async () =>{
            await lssGovernance.connect(lssAdmin).resolveReport(1);

            expect(
              await lssGovernance.isReportSolved(1),
            ).to.be.equal(true);

            expect(
              await lssGovernance.reportResolution(1),
            ).to.be.equal(false);
          });
        });
      });
    });
  });
});