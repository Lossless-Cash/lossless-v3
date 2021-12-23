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

  describe('when setting the wallet dispute period', () => {
    it('should revert when not admin', async () => {
      await expect(
        env.lssGovernance.connect(adr.regularUser1).setDisputePeriod(500),
      ).to.be.revertedWith('LSS: Must be admin');
    });

    it('should not revert when admin', async () => {
      await expect(
        env.lssGovernance.connect(adr.lssAdmin).setDisputePeriod(500),
      ).to.not.be.reverted;

      expect(
        await env.lssGovernance.walletDisputePeriod(),
      ).to.be.equal(500);
    });
  });
});
