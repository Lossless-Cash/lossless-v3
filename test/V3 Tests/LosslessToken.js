/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('./utilsV3');

let adr;
let env;

describe('Lossless Token', () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment(adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin);

    await env.lssController.connect(adr.lssAdmin)
      .proposeNewSettlementPeriod(env.lssToken.address, 5 * 60);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.hours(13)),
    ]);

    await env.lssController.connect(adr.lssAdmin)
      .executeNewSettlementPeriod(env.lssToken.address);
  });

  describe('when transfering between users', () => {
    beforeEach(async () => {
      await env.lssToken.connect(adr.lssInitialHolder).transfer(adr.regularUser1.address, 100);
      await env.lssToken.connect(adr.lssInitialHolder).transfer(adr.regularUser2.address, 100);
    });

    it('should not revert if 5 minutes haven\'t passed if it\'s the first transfer', async () => {
      await expect(
        env.lssToken.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
      ).to.not.be.reverted;
    });

    it('should revert if 5 minutes haven\'t passed if it\'s not the first transfer', async () => {
      await expect(
        env.lssToken.connect(adr.regularUser2).transfer(adr.regularUser3.address, 5),
      ).to.not.be.reverted;
      await expect(
        env.lssToken.connect(adr.regularUser2).transfer(adr.regularUser3.address, 5),
      ).to.be.revertedWith('LSS: Transfers limit reached');
    });

    it('should not revert', async () => {
      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await expect(
        env.lssToken.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
      ).to.not.be.reverted;

      expect(
        await env.lssToken.balanceOf(adr.regularUser3.address),
      ).to.be.equal(5);
    });
  });
});
