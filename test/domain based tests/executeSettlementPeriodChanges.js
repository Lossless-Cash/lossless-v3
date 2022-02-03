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
  });

  describe('when there is no proposal active', () => {
    it('should revert if there is no proposal', async () => {
      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.be.revertedWith('LSS: New Settlement not proposed');
    });
  });

  describe('when executing the proposal', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lerc20Admin)
        .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);
    });
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
  });

  describe('when setting a lower settlement timelock', () => {
    it('should not revert', async () => {
      await env.lssController.connect(adr.lerc20Admin)
        .proposeNewSettlementPeriod(lerc20Token.address, 10 * 60);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.seconds(61)),
      ]);

      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.not.be.reverted;

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(1)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 200);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(10)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 300);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssController.connect(adr.lerc20Admin)
        .proposeNewSettlementPeriod(lerc20Token.address, 1 * 60);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.seconds(61)),
      ]);

      await expect(
        env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address),
      ).to.not.be.reverted;

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 200);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.seconds(30)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.seconds(5)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 300);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 300);
    });
  });
});
