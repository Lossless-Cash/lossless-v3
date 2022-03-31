/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');
const { expect } = require('chai');
const exp = require('constants');
const path = require('path');
const { getEnabledCategories } = require('trace_events');
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

    const token = await ethers.getContractFactory('BridgeMintableTokenV2');

    lerc20Token = await token.connect(adr.lerc20Admin).deploy();
    await lerc20Token.connect(adr.lerc20Admin).initialize('Chainport LERC20',
      'CLERC',
      18,
      adr.regularUser1.address);

    await lerc20Token.connect(adr.lerc20Admin).setLosslessController(env.lssController.address);
    await lerc20Token.connect(adr.lerc20Admin).setLosslessAdmin(adr.lerc20Admin.address);
    await lerc20Token.connect(adr.lerc20Admin).mint(adr.lerc20InitialHolder.address, 1000000000000);

    anotherLerc20Token = await setupToken(2000000,
      'Another Token',
      'OTHER',
      adr.regularUser1, // Initial holder
      adr.regularUser1.address, // Admin
      adr.regularUser2.address, // Backup Admin
      Number(time.duration.days(1)),
      env.lssController.address);

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);
  });

  describe('when transfering among users', () => {
    beforeEach(async () => {
      await anotherLerc20Token.connect(adr.regularUser2).proposeLosslessTurnOff();
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.days(1)),
      ]);
      await anotherLerc20Token.connect(adr.regularUser2).executeLosslessTurnOff();
    });
    describe('when Lossless is turned off', () => {
      beforeEach(async () => {
        await anotherLerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 1000);
        await anotherLerc20Token.connect(adr.regularUser1).transfer(adr.regularUser4.address, 1000);
      });
      it('should allow transfering all received tokens', async () => {
        await expect(
          anotherLerc20Token.connect(adr.regularUser3).transfer(adr.regularUser4.address, 1000),
        ).to.not.be.reverted;
        await expect(
          anotherLerc20Token.connect(adr.regularUser4).transfer(adr.regularUser5.address, 2000),
        ).to.not.be.reverted;
      });
      it('should allow multiple transactions without restrictions', async () => {
        await expect(
          anotherLerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
        ).to.not.be.reverted;
        await expect(
          anotherLerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
        ).to.not.be.reverted;
        await expect(
          anotherLerc20Token.connect(adr.regularUser4).transfer(adr.regularUser5.address, 400),
        ).to.not.be.reverted;
        await expect(
          anotherLerc20Token.connect(adr.regularUser4).transfer(adr.regularUser5.address, 600),
        ).to.not.be.reverted;
        await expect(
          anotherLerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 2000),
        ).to.not.be.reverted;
      });
    });

    describe('when Lossless is turned on', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lerc20Admin).proposeNewSettlementPeriod(lerc20Token.address, 600);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(61)),
        ]);
        await env.lssController.connect(adr.lerc20Admin).executeNewSettlementPeriod(lerc20Token.address);
      });
      describe('when the settlement period is 10 minutes', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1000);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser4.address, 1000);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);
        });
        it('should allow transfering unsettled tokens once per period', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 500),
          ).to.not.be.reverted;
        });
        it('should revert transfering unsettled tokens more than once per period with large locks queue', async () => {
          for (let i = 0; i < 150; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser5.address, 1);
          }

          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser4.address, 101),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser4.address, 5),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
        it('should revert transfering unsettled tokens more than once per period', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 250),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 250),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
        it('should allow transfering settled tokens', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
          ).to.not.be.reverted;
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 500),
          ).to.not.be.reverted;
        });
        it('should allow transfering settled and some unsettled tokens once', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
          ).to.not.be.reverted;
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 500),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 750),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser1.address, 250),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
      });

      describe('when all checkpoints are expired', () => {
        it('should allow transfering all settled tokens', async () => {
          for (let i = 0; i < 20; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1);
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);
          }
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 20),
          ).to.not.be.reverted;
        });
      });

      describe('when all checkpoints are active', () => {
        beforeEach(async () => {
          for (let i = 0; i < 20; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1);
          }
        });
        it('should allow transfering unsettled tokens once per period', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 10),
          ).to.not.be.reverted;
        });
        it('should revert transfering unsettled tokens more than once per period', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 10),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 10),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
      });

      describe('when only one checkpoint is active', () => {
        beforeEach(async () => {
          for (let i = 0; i < 19; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1);
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(10)),
            ]);
          }
        });
        it('should allow transfering unsettled tokens once per period', async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 2);
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 1),
          ).to.not.be.reverted;
        });
        it('should revert transfering unsettled tokens more than once per period', async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 2);
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 20),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 1),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
        it('should allow transfering settled tokens', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 19),
          ).to.not.be.reverted;
        });
      });

      describe('when only one checkpoint is inactive', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1);
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(10)),
          ]);
          for (let i = 0; i < 19; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1);
          }
        });
        it('should allow transfering unsettled tokens once per period', async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 2);
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 1),
          ).to.not.be.reverted;
        });
        it('should revert transfering unsettled tokens more than once per period', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 19),
          ).to.not.be.reverted;
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 1),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });
        it('should allow transfering settled tokens', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transfer(adr.regularUser5.address, 1),
          ).to.not.be.reverted;
        });
      });
    });
  });

  describe('when transfering to a dex', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lerc20Admin).proposeNewSettlementPeriod(lerc20Token.address, 600);
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.seconds(61)),
      ]);
      await env.lssController.connect(adr.lerc20Admin).executeNewSettlementPeriod(lerc20Token.address);
    });
    it('should allow transfering settled tokens', async () => {
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1000);
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(10)),
      ]);
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 500);

      await expect(
        lerc20Token.connect(adr.regularUser3).transfer(adr.dexAddress.address, 1000),
      ).to.not.be.reverted;
    });
    it('should allow transfering unsettled below threshold', async () => {
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1000);
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(10)),
      ]);
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 500);

      await expect(
        lerc20Token.connect(adr.regularUser3).transfer(adr.dexAddress.address, 1020),
      ).to.not.be.reverted;
    });
    it('should revert transfering unsettled above threshold', async () => {
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 1000);
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(10)),
      ]);
      await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser3.address, 520);

      await expect(
        lerc20Token.connect(adr.regularUser3).transfer(adr.dexAddress.address, 1021),
      ).to.be.revertedWith('LSS: Cannot transfer over the dex threshol');
    });
  });
});
