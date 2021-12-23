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

    otherLerc20Token = await setupToken(2000000,
      'Random Token 2',
      'RAND2',
      adr.lerc20InitialHolder,
      adr.lerc20Admin.address,
      adr.lerc20BackupAdmin.address,
      Number(time.duration.days(1)),
      env.lssController.address);
  });

  describe('when setting up the stakers token', () => {
    describe('on Lossless Staking', () => {
      it('should revert when not admin', async () => {
        await expect(
          env.lssStaking.connect(adr.regularUser1).setStakingToken(otherLerc20Token.address),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should not revert when admin', async () => {
        await expect(
          env.lssStaking.connect(adr.lssAdmin).setStakingToken(otherLerc20Token.address),
        ).to.not.be.reverted;

        expect(
          await env.lssStaking.stakingToken(),
        ).to.be.equal(otherLerc20Token.address);
      });
    });
    describe('on Lossless Reporting', () => {
      it('should revert when not admin', async () => {
        await expect(
          env.lssReporting.connect(adr.regularUser1).setStakingToken(otherLerc20Token.address),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should not revert when admin', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setStakingToken(otherLerc20Token.address),
        ).to.not.be.reverted;

        expect(
          await env.lssReporting.stakingToken(),
        ).to.be.equal(otherLerc20Token.address);
      });
    });
  });
});
