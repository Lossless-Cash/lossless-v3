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

    await env.lssController.connect(adr.lssAdmin).setDexList(
      [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
    );
  });

  describe('when Dex Listing an account', () => {
    it('should set governance contract', async () => {
      expect(
        await env.lssController.dexList(env.lssGovernance.address),
      ).to.be.equal(true);
    });
    it('should set reporting contract', async () => {
      expect(
        await env.lssController.dexList(env.lssReporting.address),
      ).to.be.equal(true);
    });
    it('should set reporting contract', async () => {
      expect(
        await env.lssController.dexList(env.lssStaking.address),
      ).to.be.equal(true);
    });
  });
});
