/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken, stakingAmount } = require('../utils');

let adr;
let env;

const scriptName = path.basename(__filename, '.js');

const reportedAmount = 1000000;

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
  });

  describe('when the staking period is active', () => {
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

      await lerc20Token
        .connect(adr.lerc20InitialHolder)
        .transfer(adr.maliciousActor1.address, reportedAmount);

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
        .connect(adr.reporter1)
        .approve(env.lssReporting.address, env.stakingAmount);
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

      await env.lssReporting
        .connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);
    });

    describe('when staking successfully', () => {
      it('should not revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker1.address),
        ).to.be.equal(true);
      });

      it('should emit stake event', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.staker1).stake(1),
        ).to.emit(env.lssStaking, 'NewStake').withArgs(
          lerc20Token.address,
          adr.staker1.address,
          1,
          stakingAmount
        );
      });
    });

    describe('when blacklisted address tries to stake', () => {
      it('should revert', async () => {
        await expect(
          env.lssStaking.connect(adr.maliciousActor1).stake(1),
        ).to.be.revertedWith('LSS: You cannot operate');
      });
    });

    describe('when staking successfully with multiple addresses', () => {
      it('should not revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker1.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker2).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker2.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker3).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker3.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker4).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker4.address),
        ).to.be.equal(true);
      });
    });

    describe('when staking on a non existant report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.staker1).stake(5),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });

    describe('when staker has insufficient balance', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.staker5).stake(1),
        ).to.be.revertedWith('LERC20: transfer amount exceeds allowance');
      });
    });

    describe('when staking twice on the same report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        await expect(
          env.lssStaking.connect(adr.staker1).stake(1),
        ).to.be.revertedWith('LSS: already staked');
      });
    });

    describe('when the reporter tries to stake on their report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.reporter1).stake(1),
        ).to.be.revertedWith('LSS: reporter can not stake');
      });
    });
  });
  describe('when the staking period is inactive', () => {
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

    describe('when trying to stake', () => {
      it('should revert', async () => {
        await expect(
          env.lssStaking.connect(adr.staker1).stake(1),
        ).to.be.revertedWith('LSS: Report already resolved');
      });
    });
  });
});
