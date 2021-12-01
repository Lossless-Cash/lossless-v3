/* eslint-disable no-unused-expressions */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

const scriptName = path.basename(__filename, '.js');

const reportedAmount = 1000000;

describe.only(scriptName, () => {
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
  });

  describe('when report is solved and claiming available', () => {
    beforeEach(async () => {
      await env.lssController
        .connect(adr.lssAdmin)
        .setWhitelist(
          [
            env.lssGovernance.address,
            env.lssReporting.address,
            env.lssStaking.address,
          ],
          true,
        );

      await env.lssToken
        .connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.lssInitialHolder)
        .transfer(adr.staker1.address, env.stakingAmount + env.stakingAmount);
      await env.lssToken
        .connect(adr.lssInitialHolder)
        .transfer(adr.staker2.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.lssInitialHolder)
        .transfer(adr.staker3.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.lssInitialHolder)
        .transfer(adr.staker4.address, env.stakingAmount * 2);

      await env.lssToken
        .connect(adr.reporter1)
        .approve(env.lssReporting.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.staker1)
        .approve(env.lssStaking.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.staker2)
        .approve(env.lssStaking.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.staker3)
        .approve(env.lssStaking.address, env.stakingAmount * 2);
      await env.lssToken
        .connect(adr.staker4)
        .approve(env.lssStaking.address, env.stakingAmount * 2);

      await lerc20Token
        .connect(adr.lerc20InitialHolder)
        .transfer(adr.maliciousActor1.address, reportedAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssReporting
        .connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);

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

      await env.lssGovernance
        .connect(adr.lssAdmin)
        .addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
        ]);

      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
      await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    describe('when verifying staker claimable amount by a staker', () => {
      it('should return amount', async () => {
        expect(
          await env.lssStaking.connect(adr.staker1).stakerClaimableAmount(1),
        ).to.not.be.empty;
      });
    });

    describe('when stakers claims', () => {
      it('should not revert', async () => {
        let balance;
        expect((balance = await lerc20Token.balanceOf(adr.staker1.address)))
          .to.not.be.empty;

        expect(
          (balance = await env.lssToken.balanceOf(adr.staker1.address)),
        ).to.be.equal(2500);

        await env.lssStaking.connect(adr.staker1).stakerClaim(1);

        expect(await lerc20Token.balanceOf(adr.staker1.address)).to.not.be
          .empty;

        expect(
          (balance = await env.lssToken.balanceOf(adr.staker1.address)),
        ).to.be.equal(env.stakingAmount * 2);
      });
    });

    describe('when stakers claims two times', () => {
      it('should revert', async () => {
        await env.lssStaking.connect(adr.staker1).stakerClaim(1);

        await expect(
          env.lssStaking.connect(adr.staker1).stakerClaim(1),
        ).to.be.revertedWith('LSS: You already claimed');
      });
    });

    describe('when all stakers claims', () => {
      // Calculations based on Test Case 2
      // https://docs.google.com/spreadsheets/d/1-ufuOixhv2pYbUu-dQozqBcZJv2Yg69Wi_yRwnulC00/edit?usp=sharing
      it('should not revert', async () => {
        await expect(
          // Should get around 7095.2
          env.lssStaking.connect(adr.staker1).stakerClaim(1),

          // Should get around 6872.7
          env.lssStaking.connect(adr.staker2).stakerClaim(1),

          // Should get around 4499.4
          env.lssStaking.connect(adr.staker3).stakerClaim(1),

          // Should get around 1532.8
          env.lssStaking.connect(adr.staker4).stakerClaim(1),
        ).to.not.be.reverted;

        expect(
          await lerc20Token.balanceOf(adr.staker1.address),
        ).to.be.equal(7095);

        expect(
          await lerc20Token.balanceOf(adr.staker2.address),
        ).to.be.equal(6872);

        expect(
          await lerc20Token.balanceOf(adr.staker3.address),
        ).to.be.equal(4499);

        expect(
          await lerc20Token.balanceOf(adr.staker4.address),
        ).to.be.equal(1532);
      });
    });
  });
});
