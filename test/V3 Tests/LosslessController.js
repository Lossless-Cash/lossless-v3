/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('./utilsV3');

let adr;
let env;

describe('Lossless Controller', () => {
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
  });

  describe('when whitelisting an account', () => {
    it('should set governance contract', async () => {
      await env.lssController.connect(adr.lssAdmin).addToWhitelist(env.lssGovernance.address);

      expect(
        await env.lssController.isWhitelisted(env.lssGovernance.address),
      ).to.be.equal(true);
    });

    it('should set reporting contract', async () => {
      await env.lssController.connect(adr.lssAdmin).addToWhitelist(env.lssReporting.address);

      expect(
        await env.lssController.isWhitelisted(env.lssReporting.address),
      ).to.be.equal(true);
    });

    it('should set reporting contract', async () => {
      await env.lssController.connect(adr.lssAdmin).addToWhitelist(env.lssStaking.address);

      expect(
        await env.lssController.isWhitelisted(env.lssStaking.address),
      ).to.be.equal(true);
    });
  });
});
