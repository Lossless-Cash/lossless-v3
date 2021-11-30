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
        .transfer(adr.reporter2.address, env.stakingAmount);

      await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
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
        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        expect(
          await env.lssReporting.reportTimestamps(1),
        ).to.not.be.empty;
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
  });
});
