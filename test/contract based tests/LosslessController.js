/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe.only('Lossless Controller', () => {
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

    await env.lssController.connect(adr.lerc20Admin)
      .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.hours(13)),
    ]);

    await env.lssController.connect(adr.lerc20Admin)
      .executeNewSettlementPeriod(lerc20Token.address);
  });

  describe('when setting a new admin', () => {
    it('should revert when not recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).setAdmin(adr.regularUser2.address),
      ).to.be.revertedWith('LSS: Must be recoveryAdmin');
    });

    it('should revert when setting zero address', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(ZERO_ADDRESS),
      ).to.be.revertedWith('LERC20: Cannot be zero address');
    });

    it('should not revert when recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.regularUser1.address),
      ).to.not.be.reverted;
    });

    it('should emit event', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.regularUser1.address),
      ).to.emit(env.lssController, 'AdminChanged').withArgs(
        adr.lssAdmin.address, adr.regularUser1.address,
      );
    });
  });

  describe('when setting a new pause admin', () => {
    it('should revert when not recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).setPauseAdmin(adr.regularUser2.address),
      ).to.be.revertedWith('LSS: Must be recoveryAdmin');
    });

    it('should revert when setting zero address', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(ZERO_ADDRESS),
      ).to.be.revertedWith('LERC20: Cannot be zero address');
    });

    it('should not revert when recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.regularUser1.address),
      ).to.not.be.reverted;
    });

    it('should emit event', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.regularUser1.address),
      ).to.emit(env.lssController, 'PauseAdminChanged').withArgs(
        adr.lssPauseAdmin.address, adr.regularUser1.address,
      );
    });
  });

  describe('when setting a new recovery admin', () => {
    it('should revert when not recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).setRecoveryAdmin(adr.regularUser2.address),
      ).to.be.revertedWith('LSS: Must be recoveryAdmin');
    });

    it('should revert when setting zero address', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(ZERO_ADDRESS),
      ).to.be.revertedWith('LERC20: Cannot be zero address');
    });

    it('should not revert when recoveryAdmin', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.regularUser1.address),
      ).to.not.be.reverted;
    });

    it('should emit event', async () => {
      await expect(
        env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.regularUser1.address),
      ).to.emit(env.lssController, 'RecoveryAdminChanged').withArgs(
        adr.lssRecoveryAdmin.address, adr.regularUser1.address,
      );
    });
  });

  describe('when pausing', () => {
    it('should revert when not pause admin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).pause(),
      ).to.be.revertedWith('LSS: Must be pauseAdmin');
    });

    it('should not revert when not pause admin', async () => {
      await expect(
        env.lssController.connect(adr.lssPauseAdmin).pause(),
      ).to.not.be.reverted;
    });

    describe('when paused', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lssPauseAdmin).pause();
      });

      it('should prevent from executing setGuardian', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setGuardian(adr.regularUser1.address),
        ).to.be.revertedWith('Pausable: paused');
      });
    });
  });

  describe('when unpausing', () => {
    beforeEach(async () => {
      await expect(
        env.lssController.connect(adr.lssPauseAdmin).pause(),
      ).to.not.be.reverted;
    });
    it('should revert when not pause admin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).unpause(),
      ).to.be.revertedWith('LSS: Must be pauseAdmin');
    });

    it('should not revert when not pause admin', async () => {
      await expect(
        env.lssController.connect(adr.lssPauseAdmin).unpause(),
      ).to.not.be.reverted;
    });

    describe('when paused', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lssPauseAdmin).unpause();
      });

      it('should not revert with paused message', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setGuardian(adr.regularUser1.address),
        ).to.not.be.revertedWith('Pausable: paused');
      });
    });
  });

  describe('when whitelisting an account', () => {
    it('should set governance contract', async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );
      expect(
        await env.lssController.whitelist(env.lssGovernance.address),
      ).to.be.equal(true);
      it('should set reporting contract', async () => {
        expect(
          await env.lssController.whitelist(env.lssReporting.address),
        ).to.be.equal(true);
      });
      it('should set reporting contract', async () => {
        expect(
          await env.lssController.whitelist(env.lssStaking.address),
        ).to.be.equal(true);
      });
    });
  });
});
