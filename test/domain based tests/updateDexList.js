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
  });

  describe('when Dex Listing an account', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setDexList(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );
    });

    it('should revert when non admin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).setDexList(
          [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
        ),
      ).to.be.revertedWith('LSS: Must be admin');
    });

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

    describe('when removing and address from the dex List', () => {
      it('should revert when non admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1).setDexList(
            [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], false,
          ),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should remove the address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setDexList(
            [env.lssGovernance.address], false,
          ),
        ).to.not.be.reverted;

        expect(
          await env.lssController.dexList(env.lssGovernance.address),
        ).to.be.equal(false);
      });
    });
  });
});
