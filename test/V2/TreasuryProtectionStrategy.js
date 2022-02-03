/* eslint-disable max-len */
const { expect } = require('chai');
const { setupControllerAndTokens, deployProtection } = require('./utils');

let vars;
let protection;

describe('TreasuryProtectionStrategy', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.anotherAccount)
            .setGuardian(vars.anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: Not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed', async () => {
        await protection.treasuryProtectionStrategy
          .connect(vars.lssAdmin)
          .setGuardian(vars.anotherAccount.address);

        expect(
          await protection.treasuryProtectionStrategy.guardian(),
        ).to.be.equal(vars.anotherAccount.address);
      });
    });
  });

  describe('setProtectedAddress', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[1].address, true);

      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);

      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(
          vars.erc20s[1].address,
          vars.oneMoreAccount.address,
        );

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.treasuryProtectionStrategy.address],
          true,
        );
    });

    describe('when sender is not protection admin', () => {
      it('should revert', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              [vars.recipient.address],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.oneMoreAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              [vars.recipient.address],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin', () => {
      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );
        await protection.treasuryProtectionStrategy
          .connect(vars.guardianAdmin)
          .setProtectedAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            [vars.recipient.address],
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
      });

      it('should emit NewProtectedAddress event', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.guardianAdmin)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              [vars.recipient.address],
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            protection.treasuryProtectionStrategy.address,
          );
      });

      it('should not affect other tokens', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[1].address, true);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[2].address, true);

        await protection.guardian
          .connect(vars.admin)
          .setProtectionAdmin(
            vars.erc20s[1].address,
            vars.guardianAdmin.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[1].address,
            vars.initialHolder.address,
            true,
          );
        await protection.treasuryProtectionStrategy
          .connect(vars.guardianAdmin)
          .setProtectedAddress(
            vars.erc20s[1].address,
            vars.initialHolder.address,
            [vars.recipient.address],
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
      });

      it('should emit an event with a whitelist addresses array', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[1].address, true);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[2].address, true);

        await protection.guardian
          .connect(vars.admin)
          .setProtectionAdmin(
            vars.erc20s[1].address,
            vars.guardianAdmin.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[1].address,
            vars.initialHolder.address,
            true,
          );

        await expect(
          protection.treasuryProtectionStrategy.connect(vars.guardianAdmin).setProtectedAddress(
            vars.erc20s[1].address,
            vars.initialHolder.address,
            [vars.recipient.address],
          ),
        ).to.emit(protection.treasuryProtectionStrategy, 'WhitelistAddresses').withArgs(vars.erc20s[1].address, vars.initialHolder.address, [vars.recipient.address], true);
      });
    });
  });

  describe('Removing from whitelist with setWhitelistState', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[1].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[2].address, true);

      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(
          vars.erc20s[1].address,
          vars.oneMoreAccount.address,
        );
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[2].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.treasuryProtectionStrategy.address],
          true,
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );

      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          [vars.recipient.address, vars.anotherAccount.address],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[1].address,
          vars.initialHolder.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.oneMoreAccount)
        .setProtectedAddress(
          vars.erc20s[1].address,
          vars.initialHolder.address,
          [vars.recipient.address, vars.anotherAccount.address],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[2].address,
          vars.initialHolder.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[2].address,
          vars.initialHolder.address,
          [vars.recipient.address, vars.anotherAccount.address],
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.anotherAccount)
            .setWhitelistState(vars.erc20s[0].address, vars.initialHolder.address, [
              vars.oneMoreAccount.address,
              vars.initialHolder.address,
            ], false),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.oneMoreAccount)
            .setWhitelistState(vars.erc20s[0].address, vars.initialHolder.address, [
              vars.oneMoreAccount.address,
              vars.initialHolder.address,
            ], false),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is admin', () => {
      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);

        await expect(protection.treasuryProtectionStrategy
          .connect(vars.guardianAdmin)
          .setWhitelistState(vars.erc20s[0].address, vars.initialHolder.address, [
            vars.initialHolder.address,
          ], false)).to.emit(protection.treasuryProtectionStrategy, 'WhitelistAddresses').withArgs(vars.erc20s[0].address, vars.initialHolder.address, [vars.initialHolder.address], false);

        expect(
          await protection.treasuryProtectionStrategy.isAddressWhitelisted(vars.erc20s[0].address, vars.initialHolder.address, vars.initialHolder.address),
        ).to.be.equal(false);
      });

      it('should emit WhitelistAddresses event', async () => {
        await expect(
          protection.treasuryProtectionStrategy
            .connect(vars.guardianAdmin)
            .setWhitelistState(vars.erc20s[0].address, vars.initialHolder.address, [
              vars.initialHolder.address,
            ], false),
        )
          .to.emit(protection.treasuryProtectionStrategy, 'WhitelistAddresses').withArgs(vars.erc20s[0].address, vars.initialHolder.address, [vars.initialHolder.address], false);
      });

      it('should succeed with a list of protected addresses', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(vars.erc20s[0].address, vars.recipient.address, true);
        await protection.treasuryProtectionStrategy
          .connect(vars.guardianAdmin)
          .setProtectedAddress(vars.erc20s[0].address, vars.recipient.address, [
            vars.anotherAccount.address,
          ]);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.recipient.address,
          ),
        ).to.be.equal(true);

        await protection.treasuryProtectionStrategy
          .connect(vars.guardianAdmin)
          .setWhitelistState(vars.erc20s[0].address, vars.initialHolder.address, [
            vars.initialHolder.address,
            vars.recipient.address,
          ], false);

        expect(
          await protection.treasuryProtectionStrategy.isAddressWhitelisted(vars.erc20s[0].address, vars.initialHolder.address, vars.initialHolder.address),
        ).to.be.equal(false);

        expect(
          await protection.treasuryProtectionStrategy.isAddressWhitelisted(vars.erc20s[0].address, vars.initialHolder.address, vars.recipient.address),
        ).to.be.equal(false);
      });

      it('should not affect other tokens', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);

        await protection.treasuryProtectionStrategy
          .connect(vars.oneMoreAccount)
          .setWhitelistState(vars.erc20s[1].address, vars.initialHolder.address, [
            vars.initialHolder.address,
          ], false);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(false);
      });
    });
  });

  describe('LERC20.transfer', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[1].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[2].address, true);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[1].address, vars.guardianAdmin.address);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[2].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.treasuryProtectionStrategy.address],
          true,
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          [vars.recipient.address, vars.anotherAccount.address],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[1].address,
          vars.anotherAccount.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[1].address,
          vars.anotherAccount.address,
          [vars.recipient.address, vars.initialHolder.address],
        );

      await vars.erc20s[1]
        .connect(vars.initialHolder)
        .transfer(vars.anotherAccount.address, 100);
    });

    describe('when transfering to whitelisted', async () => {
      it('should suceed for token 1', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 10);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 10);

        await vars.erc20s[0]
          .connect(vars.recipient)
          .transfer(vars.anotherAccount.address, 10);

        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(10);
      });

      it('should suceed for token 2', async () => {
        await vars.erc20s[1]
          .connect(vars.anotherAccount)
          .transfer(vars.recipient.address, 10);

        await vars.erc20s[1]
          .connect(vars.anotherAccount)
          .transfer(vars.initialHolder.address, 10);
        expect(
          await vars.erc20s[1].balanceOf(vars.recipient.address),
        ).to.be.equal(10);
      });
    });

    describe('when transfering not to whitelisted', async () => {
      it('should revert for token 1', async () => {
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.oneMoreAccount.address, 101),
        ).to.be.revertedWith('LOSSLESS: not whitelisted');
      });

      it('should revert for token 2', async () => {
        await expect(
          vars.erc20s[1]
            .connect(vars.anotherAccount)
            .transfer(vars.oneMoreAccount.address, 101),
        ).to.be.revertedWith('LOSSLESS: not whitelisted');
      });
    });
  });

  describe('LERC20.transferFrom', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[1].address, true);
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[2].address, true);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[1].address, vars.guardianAdmin.address);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[2].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.treasuryProtectionStrategy.address],
          true,
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          [vars.recipient.address, vars.anotherAccount.address],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[1].address,
          vars.anotherAccount.address,
          true,
        );
      await protection.treasuryProtectionStrategy
        .connect(vars.guardianAdmin)
        .setProtectedAddress(
          vars.erc20s[1].address,
          vars.anotherAccount.address,
          [vars.recipient.address, vars.initialHolder.address],
        );

      await vars.erc20s[1]
        .connect(vars.initialHolder)
        .transfer(vars.anotherAccount.address, 100);
      await vars.erc20s[0]
        .connect(vars.initialHolder)
        .approve(vars.oneMoreAccount.address, 100);
      await vars.erc20s[0]
        .connect(vars.anotherAccount)
        .approve(vars.oneMoreAccount.address, 100);
      await vars.erc20s[1]
        .connect(vars.initialHolder)
        .approve(vars.oneMoreAccount.address, 100);
      await vars.erc20s[1]
        .connect(vars.anotherAccount)
        .approve(vars.oneMoreAccount.address, 100);
    });

    describe('when transfering to whitelisted', async () => {
      it('should suceed for token 1', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 10);

        expect(
          await vars.erc20s[0].balanceOf(vars.recipient.address),
        ).to.be.equal(10);
      });

      it('should suceed for token 2', async () => {
        await vars.erc20s[1]
          .connect(vars.oneMoreAccount)
          .transferFrom(
            vars.anotherAccount.address,
            vars.recipient.address,
            10,
          );

        expect(
          await vars.erc20s[1].balanceOf(vars.recipient.address),
        ).to.be.equal(10);
      });
    });

    describe('when transfering not to whitelisted', async () => {
      it('should revert for token 1', async () => {
        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.oneMoreAccount.address,
              101,
            ),
        ).to.be.revertedWith('LOSSLESS: not whitelisted');
      });

      it('should revert for token 2', async () => {
        await expect(
          vars.erc20s[1]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.anotherAccount.address,
              vars.oneMoreAccount.address,
              101,
            ),
        ).to.be.revertedWith('LOSSLESS: not whitelisted');
      });
    });
  });
});