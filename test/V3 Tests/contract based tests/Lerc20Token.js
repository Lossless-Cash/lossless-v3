/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

describe('Random LERC20 Token', () => {
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

  /* describe('when setting up the settlement period', () => {
    it('should revert when not token admin', async () => {
      await expect(
        env.lssController.connect(adr.regularUser1).setLockTimeframe(lerc20Token.address, 0),
      ).to.be.revertedWith('LSS: Must be Token Admin');
    });

    it('should revert when trying to change before the timelock', async () => {
      await expect(
        env.lssController.connect(adr.lerc20Admin).setLockTimeframe(lerc20Token.address, 10 * 60),
      ).to.be.revertedWith('LSS: Must wait to change');
    });

    it('should not revert when trying to change after the timelock by token admin', async () => {
      await expect(
        env.lssController.connect(adr.lerc20Admin).setLockTimeframe(lerc20Token.address, 10 * 60),
      ).to.be.revertedWith('LSS: Must wait to change');
    });
  }); */

  describe('when transfering between users', () => {
    beforeEach(async () => {
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);
    });

    it('should not revert if 5 minutes haven\'t passed but its the first transfer', async () => {
      await expect(
        lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
      ).to.not.be.reverted;
    });

    it('should not revert', async () => {
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await expect(
        lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
      ).to.not.be.reverted;

      expect(
        await lerc20Token.balanceOf(adr.regularUser3.address),
      ).to.be.equal(5);
    });
  });

  describe('when emergency mode is active', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakingAmount);
      await lerc20Token.connect(adr.lerc20InitialHolder)
        .transfer(adr.regularUser1.address, env.stakingAmount + 200);
      await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);
      await env.lssToken.connect(adr.regularUser1).approve(env.lssStaking.address, env.stakingAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssReporting.connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);
    });

    describe('when a settlement period passes', () => {
      it('should not revert', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1)
            .transfer(adr.regularUser1.address, env.stakingAmount + 5),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering settled tokens', () => {
      it('should not revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(1)),
        ]);

        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.regularUser1.address, env.stakingAmount);

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, env.stakingAmount),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering unsettled tokens for the first time in a period', () => {
      it('should not revert', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.regularUser1.address, env.stakingAmount);

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, env.stakingAmount),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering settled tokens multiple times', () => {
      it('should not revert', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.regularUser2.address, env.stakingAmount);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(16)),
        ]);

        await expect(
          lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
        ).to.not.be.reverted;

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(16)),
        ]);

        await expect(
          lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
        ).to.not.be.reverted;

        await expect(
          lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
        ).to.not.be.reverted;

        await expect(
          lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering all unsettled tokens once', () => {
      it('should not revert', async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.regularUser2.address, env.stakingAmount);

        await expect(
          lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, env.stakingAmount),
        ).to.be.revertedWith('LSS: Emergency mode active, cannot transfer unsettled tokens');
      });
    });
  });
});
