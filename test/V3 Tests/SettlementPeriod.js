/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('./utilsV3');

let adr;
let env;

describe('Settlement Period', () => {
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

  describe('when the token admin sets the settlement period', () => {
    describe('when proposing a new settlement period', () => {
      it('should not revert', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.not.be.reverted;
      });

      it('should revert if it\'s not token admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.be.revertedWith('LSS: Must be Token Admin');
      });

      it('should revert on new proposal before timelock expiration', async () => {
        await env.lssController.connect(adr.lerc20Admin)
          .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.be.revertedWith('LSS: Time lock in progress');
      });

      it('should revert on executing proposal if there\'s no proposal', async () => {
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

      it('should revert on executing proposal before timelock expiration', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .executeNewSettlementPeriod(lerc20Token.address),
        ).to.be.revertedWith('LSS: Time lock in progress');
      });
    });
  });

  describe('when the settlement period is active', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lerc20Admin)
        .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(13)),
      ]);

      await env.lssController.connect(adr.lerc20Admin)
        .executeNewSettlementPeriod(lerc20Token.address);
    });

    describe('when transfering to a dex', () => {
      beforeEach(async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
      });

      it('should revert when transfering unsettled over the dex threshold', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 145),
        ).to.be.revertedWith('LSS: Cannot transfer over the dex threshold');
      });

      it('should not revert when transfering unsettled below the dex threshold', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 115),
        ).to.not.be.reverted;
      });

      it('should not revert when transfering settled tokens', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 99),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering between users', () => {
      beforeEach(async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
      });

      it('should not revert if it\'s the first unsettled transfer in a period', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 145),
        ).to.not.be.reverted;
      });

      it('should not revert if transfering settled tokens', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 50),
        ).to.not.be.reverted;
      });

      it('should not revert when settlement period pass', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 150),
        ).to.not.be.reverted;
      });

      it('should revert if it\'s not the first unsettled transfer in a period', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 110),
        ).to.not.be.reverted;

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 10),
        ).to.be.revertedWith('LSS: Transfers limit reached');
      });
    });

    describe('when in emergency mode', () => {
      beforeEach(async () => {
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.reporter1.address, env.reportingAmount);

        await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssReporting.connect(adr.reporter1)
          .report(lerc20Token.address, adr.maliciousActor1.address);

        await lerc20Token.connect(adr.lerc20InitialHolder)
          .transfer(adr.regularUser1.address, env.stakingAmount + 200);
      });

      describe('when transfering to a dex', () => {
        it('should revert when transfering unsettled to dex', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 5),
          ).to.be.revertedWith('LSS: Emergency mode active, cannot transfer unsettled tokens');
        });

        it('should not revert when transfering settled to dex', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(6)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 5),
          ).to.not.be.reverted;
        });
      });

      describe('when transfering between users', () => {
        it('should revert when transfering unsettled to dex', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 5),
          ).to.be.revertedWith('LSS: Emergency mode active, cannot transfer unsettled tokens');
        });

        it('should not revert when transfering settled to dex', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(6)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 5),
          ).to.not.be.reverted;
        });
      });
    });
  });

  describe('when settlement period is inactive', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lerc20Admin)
        .proposeNewSettlementPeriod(lerc20Token.address, 0);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(13)),
      ]);

      await env.lssController.connect(adr.lerc20Admin)
        .executeNewSettlementPeriod(lerc20Token.address);
    });

    describe('when transfering to a dex', () => {
      beforeEach(async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
      });

      it('should not revert when transfering unsettled over the dex threshold', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 145),
        ).to.not.be.reverted;
      });

      it('should not revert when transfering unsettled below the dex threshold', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 115),
        ).to.not.be.reverted;
      });

      it('should not revert when transfering settled tokens', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 99),
        ).to.not.be.reverted;
      });
    });

    describe('when transfering between users', () => {
      beforeEach(async () => {
        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
      });

      it('should not revert if it\'s the first unsettled transfer in a period', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 145),
        ).to.not.be.reverted;
      });

      it('should not revert if transfering settled tokens', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 50),
        ).to.not.be.reverted;
      });

      it('should not revert when settlement period pass', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(6)),
        ]);

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 150),
        ).to.not.be.reverted;
      });

      it('should not revert if it\'s not the first unsettled transfer in a period', async () => {
        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 110),
        ).to.not.be.reverted;

        await expect(
          lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser2.address, 10),
        ).to.not.be.reverted;
      });
    });
  });
});
