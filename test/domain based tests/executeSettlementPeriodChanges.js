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

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);

    await env.lssController.connect(adr.lerc20Admin)
      .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);
  });

  describe('when executing the proposal', () => {
    it('should not revert after timeLock', async () => {
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(13)),
      ]);

      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.not.be.reverted;
    });

    it('should revert on executing proposal if it\'s not admin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.be.revertedWith('LSS: Must be Token Admin');
    });

    it('should revert on executing proposal before timelock expiration', async () => {
      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.be.revertedWith('LSS: Time lock in progress');
    });

    it('should revert on executing proposal before timelock expiration', async () => {
      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.be.revertedWith('LSS: Time lock in progress');
    });
  });
});
