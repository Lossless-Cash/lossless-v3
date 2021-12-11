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

  describe('when generating another report', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssController.connect(adr.lssAdmin).setDexList(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakingAmount * 2);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter2.address, env.stakingAmount);

      await env.lssToken.connect(adr.reporter1)
        .approve(env.lssReporting.address, env.stakingAmount * 2);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssReporting.connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);
    });

    describe('when generating another report successfully', () => {
      it('should not revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.not.be.reverted;
      });
    });

    describe('when reporting another on a whitelisted account', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, env.lssReporting.address),
        ).to.be.revertedWith('LSS: Cannot report LSS protocol');
      });
    });

    describe('when reporting another on a dex address', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.dexAddress.address),
        ).to.be.revertedWith('LSS: Cannot report Dex');
      });
    });

    describe('when reporting another on a non existant report', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(5, adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });

    describe('when reporting another on a expired report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(env.reportLifetime + 1)),
        ]);

        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(5, adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });

    describe('when reporting another by other than the original reporter', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter2)
            .secondReport(1, adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: invalid reporter');
      });
    });

    describe('when reporting another multiple times', () => {
      it('should revert', async () => {
        await env.lssReporting.connect(adr.reporter1)
          .secondReport(1, adr.maliciousActor2.address);

        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.be.revertedWith('LSS: Another already submitted');
      });
    });

    describe('when reporting another and the original report was solved', () => {
      it('should revert', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address]);

        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await expect(
          env.lssReporting.connect(adr.reporter2)
            .secondReport(1, adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: Report already solved');
      });
    });
  });
});
