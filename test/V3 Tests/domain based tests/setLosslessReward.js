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
    env = await setupEnvironment(
      adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin,
    );
  });

  describe('when setting the Lossless Reward', () => {
    it('should revert when not admin', async () => {
      await expect(
        env.lssReporting.connect(adr.regularUser1).setLosslessReward(1),
      ).to.be.revertedWith('LSS: Must be admin');
    });

    it('should revert when more than 100 percent', async () => {
      await expect(
        env.lssReporting.connect(adr.lssAdmin).setStakersFee(103),
      ).to.be.revertedWith('LSS: Total exceed 100');
    });

    it('should revert when if total fees exceed 100 percent', async () => {
      await expect(
        env.lssReporting.connect(adr.lssAdmin).setLosslessReward(100),
      ).to.be.revertedWith('LSS: Total exceed 100');
    });

    it('should not revert when sent by admin', async () => {
      await expect(env.lssReporting.connect(adr.lssAdmin).setLosslessReward(3))
        .to.not.be.reverted;

      expect(await env.lssReporting.losslessReward()).to.be.equal(3);
    });
  });
});
