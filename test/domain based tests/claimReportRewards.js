/* eslint-disable no-unused-expressions */
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
const reporterReward = 0.02;

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

    await lerc20Token
      .connect(adr.lerc20InitialHolder)
      .transfer(adr.maliciousActor1.address, reportedAmount);

    await env.lssToken
      .connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);

    await env.lssToken
      .connect(adr.reporter1)
      .approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting
      .connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);
  });

  describe('when report has been solved positively', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    describe('when claiming', () => {
      describe('when verifying reporter claimable amount by the reporter', () => {
        it('should return amount', async () => {
          expect(
            await env.lssReporting
              .connect(adr.reporter1)
              .reporterClaimableAmount(1),
          ).to.be.equal(reportedAmount * reporterReward);
        });
      });
    });

    describe('when reporter claims', () => {
      it('should not revert', async () => {
        let balance;
        expect(
          (balance = await lerc20Token.balanceOf(adr.reporter1.address)),
        ).to.be.equal(0);

        expect(
          (balance = await env.lssToken.balanceOf(adr.reporter1.address)),
        ).to.be.equal(env.stakingAmount - env.reportingAmount);

        await env.lssReporting.connect(adr.reporter1).reporterClaim(1);

        expect(
          await lerc20Token.balanceOf(adr.reporter1.address),
        ).to.be.equal(reportedAmount * reporterReward);

        expect(
          (balance = await env.lssToken.balanceOf(adr.reporter1.address)),
        ).to.be.equal(env.stakingAmount);
      });
    });

    describe('when reporter claims two times', () => {
      it('should revert', async () => {
        await env.lssReporting.connect(adr.reporter1).reporterClaim(1);

        await expect(
          env.lssReporting.connect(adr.reporter1).reporterClaim(1),
        ).to.be.revertedWith('LSS: You already claimed');
      });
    });

    describe('when other than reporter claims', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.regularUser1).reporterClaim(1),
        ).to.be.revertedWith('LSS: Only reporter');
      });
    });
  });

  describe('when report has been solved negatively', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    describe('when reporter claims', () => {
      it('should revert', async () => {
        await expect(
          env.lssReporting.connect(adr.reporter1).reporterClaim(1),
        ).to.be.revertedWith('LSS: Report solved negatively');
      });
    });
  });
});
