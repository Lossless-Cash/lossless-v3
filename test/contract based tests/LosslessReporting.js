/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;
let lerc20Token;

describe('Lossless Reporting', () => {
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

    await env.lssController.connect(adr.lerc20Admin)
      .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.hours(13)),
    ]);

    await env.lssController.connect(adr.lerc20Admin)
      .executeNewSettlementPeriod(lerc20Token.address);
  });

  describe('when pausing', () => {
    describe('when not pause admin', () => {
      it('should rever', async () => {
        await expect(
          env.lssReporting.connect(adr.regularUser1).pause(),
        ).to.be.revertedWith('LSS: Must be pauseAdmin');
      });
    });
    describe('when pause admin', () => {
      beforeEach(async () => {
        await env.lssReporting.connect(adr.lssPauseAdmin).pause();
      });

      it('should prevent reporting', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address),
        ).to.be.revertedWith('Pausable: paused');
      });

      it('should prevent second report', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.be.revertedWith('Pausable: paused');
      });

      it('should prevent reporter claiming', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .reporterClaim(1),
        ).to.be.revertedWith('Pausable: paused');
      });
    });
  });

  describe('when unpausing', () => {
    beforeEach(async () => {
      await env.lssReporting.connect(adr.lssPauseAdmin).pause();
    });

    describe('when not pause admin', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.regularUser1).unpause(),
        ).to.be.revertedWith('LSS: Must be pauseAdmin');
      });
    });
    describe('when pause admin', () => {
      beforeEach(async () => {
        await env.lssReporting.connect(adr.lssPauseAdmin).unpause();
      });

      it('should not prevent reporting', async () => {
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.reporter1.address, env.stakingAmount);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.reporter2.address, env.stakingAmount);

        await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

        await expect(
          env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address),
        ).to.not.be.reverted;
      });

      it('should prevent staker claiming', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });
  });

  describe('when generating another report', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
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

    describe('when generating another report on zero address', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(1, adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Cannot report zero address');
      });
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

    describe('when reporting another on a non existant report', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1)
            .secondReport(5, adr.maliciousActor2.address),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });

    describe('when reporting another by other than the original reporter', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter2)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.be.revertedWith('LSS: invalid reporter');
      });
    });

    describe('when reporting another multiple times', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter2)
            .secondReport(1, adr.maliciousActor2.address),
        ).to.be.revertedWith('LSS: invalid reporter');
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
