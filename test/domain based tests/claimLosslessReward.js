/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken } = require('../utils');

let adr;
let env;

const scriptName = path.basename(__filename, '.js');

const reportedAmount = 1000000;
const losslessReward = 0.1;

describe(scriptName, () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment(adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin);
    lerc20Token = await setupToken(2000000,
      'Random Token',
      'RAND',
      adr.lerc20InitialHolder,
      adr.lerc20Admin.address,
      adr.lerc20BackupAdmin.address,
      Number(time.duration.days(1)),
      env.lssController.address);

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, reportedAmount);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);

    await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
      adr.member1.address,
      adr.member2.address,
      adr.member3.address,
      adr.member4.address,
      adr.member5.address]);
      
    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.staker1.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.staker2.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.staker3.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.staker4.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.staker1)
      .approve(env.lssStaking.address, env.stakingAmount);
    await env.lssToken
      .connect(adr.staker2)
      .approve(env.lssStaking.address, env.stakingAmount);
    await env.lssToken
      .connect(adr.staker3)
      .approve(env.lssStaking.address, env.stakingAmount);
    await env.lssToken
      .connect(adr.staker4)
      .approve(env.lssStaking.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);
  });

  describe('when report has not been solved', () => {
    it('should revert', async () => {
      await expect(
        env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1),
      ).to.be.revertedWith('LSS: Report solved negatively');
    });
  });

  describe('when the report has been solved negatively', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
      await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(1)),
      ]);
    });
    describe('when lossless team claims', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1),
        ).to.be.revertedWith('LSS: Report solved negatively');
      });
    });
  });

  describe('when the report has been solved correctly', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
      await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssStaking.connect(adr.staker1).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(45)),
      ]);

      await env.lssStaking.connect(adr.staker2).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(8)),
      ]);

      await env.lssStaking.connect(adr.staker3).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(10)),
      ]);

      await env.lssStaking.connect(adr.staker4).stake(1);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(1)),
      ]);
    });
    describe('when lossless team claims', () => {
      it('should not revert', async () => {
        await env.lssGovernance.connect(adr.member1).claimCommitteeReward(1);
        await env.lssGovernance.connect(adr.member2).claimCommitteeReward(1);
        await env.lssGovernance.connect(adr.member3).claimCommitteeReward(1);
        await env.lssGovernance.connect(adr.member4).claimCommitteeReward(1);

        env.lssStaking.connect(adr.staker1).stakerClaim(1);
        env.lssStaking.connect(adr.staker2).stakerClaim(1);
        env.lssStaking.connect(adr.staker3).stakerClaim(1);
        env.lssStaking.connect(adr.staker4).stakerClaim(1);

        let balance;
        expect(
          (balance = await lerc20Token.balanceOf(adr.lssAdmin.address)),
        ).to.be.equal(0);

        await env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1);

        expect(await lerc20Token.balanceOf(adr.lssAdmin.address)).to.be.equal(
          reportedAmount * losslessReward,
        );
      });

      it('should emit event', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1),
        ).to.emit(env.lssGovernance, 'LosslessClaim').withArgs(
          lerc20Token.address,
          1,
          reportedAmount * losslessReward,
        );
      });
    });

    describe('when lossless team claims two times', () => {
      it('should revert', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessClaim(1),
        ).to.be.revertedWith('LSS: Already claimed');
      });
    });

    describe('when lossless claim is called other than lossless admin', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.reporter1).losslessClaim(1),
        ).to.be.revertedWith('LSS: Must be admin');
      });
    });
  });
});
