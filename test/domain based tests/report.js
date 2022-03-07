/* eslint-disable no-unused-expressions */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken, reportingAmount } = require('../utils');

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

  describe('when generating a report', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakingAmount);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.maliciousActor1.address, env.stakingAmount);

      await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);
      await env.lssToken.connect(adr.maliciousActor1).approve(env.lssReporting.address, env.stakingAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    describe('when reporting zero address', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Cannot report zero address');
      });
    });

    describe('when reporting a whitelisted account', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, env.lssReporting.address),
        ).to.be.revertedWith('LSS: Cannot report LSS protocol');
      });
    });

    describe('when reporting a Dex address', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);
      });
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.dexAddress.address),
        ).to.be.revertedWith('LSS: Cannot report Dex');
      });
    });

    describe('when succesfully generating a report', () => {
      it('should not revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address),
        ).to.not.be.reverted;
      });

      it('should blacklist address', async () => {
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        expect(
          await env.lssController.blacklist(adr.maliciousActor1.address),
        ).to.be.equal(true);
      });

      it('should emit event', async () => {
        expect(
          await env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address),
        ).to.emit(env.lssReporting, 'ReportSubmission').withArgs(
          lerc20Token.address,
          adr.maliciousActor1.address,
          1,
          reportingAmount
        );
      });

      it('should blacklist address', async () => {
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);
      });

      it('should prevent blacklisted account to transfer tokens', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.maliciousActor1.address, 200);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await expect(
          lerc20Token.connect(adr.maliciousActor1).transfer(adr.regularUser1.address, 10),
        ).to.be.revertedWith('LSS: You cannot operate');
      });

      it('should prevent blacklisted account to transferFrom tokens', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.maliciousActor1.address, 200);

        await lerc20Token.connect(adr.maliciousActor1).approve(adr.maliciousActor2.address, 200);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await expect(
          lerc20Token.connect(adr.maliciousActor2).transferFrom(adr.maliciousActor1.address, adr.maliciousActor2.address, 10),
        ).to.be.revertedWith('LSS: Sender is blacklisted');
      });

      it('should prevent blacklisted account to trigger transferFrom', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.maliciousActor1.address, 200);

        await lerc20Token.connect(adr.maliciousActor2).approve(adr.maliciousActor1.address, 200);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await expect(
          lerc20Token.connect(adr.maliciousActor1).transferFrom(adr.maliciousActor2.address, adr.maliciousActor3.address, 10),
        ).to.be.revertedWith('LSS: You cannot operate');
      });
    });

    describe('when reporting the same token and address twice', () => {
      it('should revert', async () => {
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: Report already exists');
      });
    });

    describe('when the reporter is blacklisted', () => {
      it('should revert', async () => {
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await expect(
          env.lssReporting.connect(adr.maliciousActor1)
            .report(lerc20Token.address, adr.reporter1.address),
        ).to.be.revertedWith('LSS: You cannot operate');
      });
    });

    describe('when lifeTime of a report passes', () => {
      beforeEach(async () => {
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(env.reportLifetime + 1)),
        ]);
      });

      it('should not revert when anyone tries to resolve', async () => {
        await expect(
          env.lssGovernance.connect(adr.reporter1).resolveReport(1),
        ).to.not.be.reverted;
      });

      it('should not revert when generating the same report', async () => {
        await expect(
          env.lssGovernance.connect(adr.reporter1).resolveReport(1),
        ).to.not.be.reverted;

        await expect(env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address)).to.not.be.reverted;
      });
    });
  });

  describe('when a malicious actor self reports for no reason', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.maliciousActor1.address, env.stakingAmount);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.maliciousActor2.address, 100);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakingAmount);

      await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);
      await env.lssToken.connect(adr.maliciousActor1)
        .approve(env.lssReporting.address, env.stakingAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    it('should let report himself', async () => {
      await expect(
        env.lssReporting.connect(adr.maliciousActor1)
          .report(lerc20Token.address, adr.maliciousActor2.address),
      ).to.not.be.reverted;
    });

    describe('when the report gets solved negatively', () => {
      beforeEach(async () => {
        await expect(
          env.lssReporting.connect(adr.maliciousActor1)
            .report(lerc20Token.address, adr.maliciousActor2.address),
        ).to.not.be.reverted;

        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
      });

      it('should resolve negatively', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        expect(
          await env.lssGovernance.isReportSolved(1),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.reportResolution(1),
        ).to.be.equal(false);
      });
    });

    describe('when a legit reports tries to take place to maliciousActor2', () => {
      beforeEach(async () => {
        await expect(
          env.lssReporting.connect(adr.maliciousActor1)
            .report(lerc20Token.address, adr.maliciousActor2.address),
        ).to.not.be.reverted;

        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);
      });

      it('should let report again', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor2.address),
        ).to.not.be.reverted;
      });
    });
  });
});
