const { expect } = require('chai');
const { setupControllerAndTokens, deployProtection } = require('./utils');

let vars;
let protection;

describe('LosslessGuardian', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setGuardian', () => {
    it('should revert when setting to zero address', async () => {
      await expect(
        vars.losslessController
          .connect(vars.lssAdmin)
          .setGuardian('0x0000000000000000000000000000000000000000'),
      ).to.be.revertedWith('LSS: Cannot be zero address');
    });

    it('should not revert when setting address', async () => {
      await expect(
        vars.losslessController
          .connect(vars.lssAdmin)
          .setGuardian(protection.guardian.address),
      ).to.not.be.reverted;
    });
  });

  describe('setProtectionAdmin', () => {
    describe('when token is not verified', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Token not verified');
      });
    });

    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address, true);

        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Not token admin');
      });
    });

    describe('when sender is token admin', () => {
      beforeEach(async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address, true);
      });

      it('should succeed', async () => {
        await protection.guardian
          .connect(vars.admin)
          .setProtectionAdmin(
            vars.erc20s[0].address,
            vars.guardianAdmin.address,
          );

        expect(
          await protection.guardian.protectionAdmin(vars.erc20s[0].address),
        ).to.be.equal(vars.guardianAdmin.address);
      });

      it('should succeed', async () => {
        await expect(
          protection.guardian
            .connect(vars.admin)
            .setProtectionAdmin(
              vars.erc20s[0].address,
              vars.guardianAdmin.address,
            ),
        )
          .to.emit(protection.guardian, 'ProtectionAdminSet')
          .withArgs(vars.erc20s[0].address, vars.guardianAdmin.address);
      });
    });
  });

  describe('verifyStrategies', () => {
    describe('set to true', () => {
      describe('when sender is not lossless admin', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.guardianAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                true,
              ),
          ).to.be.revertedWith('LOSSLESS: Not lossless admin');
        });
      });

      describe('when sender is lossless admin', () => {
        it('should succedd', async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies(
              [
                protection.treasuryProtectionStrategy.address,
                protection.liquidityProtectionMultipleLimitsStrategy.address,
              ],
              true,
            );

          expect(
            await protection.guardian.verifiedStrategies(
              protection.treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(true);
          expect(
            await protection.guardian.verifiedStrategies(
              protection.liquidityProtectionMultipleLimitsStrategy.address,
            ),
          ).to.be.equal(true);
        });

        it('should emit StrategyVerified events', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                true,
              ),
          )
            .to.emit(protection.guardian, 'StrategyVerified')
            .withArgs(protection.treasuryProtectionStrategy.address, true);

          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                true,
              ),
          )
            .to.emit(protection.guardian, 'StrategyVerified')
            .withArgs(
              protection.liquidityProtectionMultipleLimitsStrategy.address,
              true,
            );
        });

        describe('when sending empty array', () => {
          it('should succedd', async () => {
            await protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies([], true);

            expect(
              await protection.guardian.verifiedStrategies(
                protection.treasuryProtectionStrategy.address,
              ),
            ).to.be.equal(false);
            expect(
              await protection.guardian.verifiedStrategies(
                protection.liquidityProtectionMultipleLimitsStrategy.address,
                [],
              ),
            ).to.be.equal(false);
          });
        });
      });
    });

    describe('set to false', () => {
      beforeEach(async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyStrategies(
            [
              protection.treasuryProtectionStrategy.address,
              protection.liquidityProtectionMultipleLimitsStrategy.address,
            ],
            true,
          );
      });

      describe('when sender is not lossless admin', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.guardianAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                false,
              ),
          ).to.be.revertedWith('LOSSLESS: Not lossless admin');
        });
      });

      describe('when sender is lossless admin', () => {
        it('should succedd', async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyStrategies(
              [
                protection.treasuryProtectionStrategy.address,
                protection.liquidityProtectionMultipleLimitsStrategy.address,
              ],
              false,
            );

          expect(
            await protection.guardian.verifiedStrategies(
              protection.treasuryProtectionStrategy.address,
            ),
          ).to.be.equal(false);
          expect(
            await protection.guardian.verifiedStrategies(
              protection.liquidityProtectionMultipleLimitsStrategy.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit StrategyVerified events', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                false,
              ),
          )
            .to.emit(protection.guardian, 'StrategyVerified')
            .withArgs(protection.treasuryProtectionStrategy.address, false);

          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies(
                [
                  protection.treasuryProtectionStrategy.address,
                  protection.liquidityProtectionMultipleLimitsStrategy.address,
                ],
                false,
              ),
          )
            .to.emit(protection.guardian, 'StrategyVerified')
            .withArgs(
              protection.liquidityProtectionMultipleLimitsStrategy.address,
              false,
            );
        });

        describe('when sending empty array', () => {
          it('should succedd', async () => {
            await protection.guardian
              .connect(vars.lssAdmin)
              .verifyStrategies([], false);

            expect(
              await protection.guardian.verifiedStrategies(
                protection.treasuryProtectionStrategy.address,
              ),
            ).to.be.equal(true);
            expect(
              await protection.guardian.verifiedStrategies(
                protection.liquidityProtectionMultipleLimitsStrategy.address,
                [],
              ),
            ).to.be.equal(true);
          });
        });
      });
    });
  });

  describe('verifyToken', () => {
    describe('set to true', () => {
      describe('when sender is not lossless admin', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.guardianAdmin)
              .verifyToken(vars.erc20s[0].address, true),
          ).to.be.revertedWith('LOSSLESS: Not lossless admin');
        });
      });

      describe('when sender is lossless admin', () => {
        it('should suceed', async () => {
          expect(
            await protection.guardian.verifiedTokens(vars.erc20s[0].address),
          ).to.be.equal(false);
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address, true);

          expect(
            await protection.guardian.verifiedTokens(vars.erc20s[0].address),
          ).to.be.equal(true);
        });

        it('should emit TokenVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyToken(vars.erc20s[0].address, true),
          )
            .to.emit(protection.guardian, 'TokenVerified')
            .withArgs(vars.erc20s[0].address, true);
        });
      });
    });

    describe('set to false', () => {
      describe('when sender is not lossless admin', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.guardianAdmin)
              .verifyToken(vars.erc20s[0].address, false),
          ).to.be.revertedWith('LOSSLESS: Not lossless admin');
        });
      });

      describe('when sender is lossless admin', () => {
        before(async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address, true);
        });

        it('should succedd', async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[0].address, false);
          expect(
            await protection.guardian.verifiedTokens(vars.erc20s[0].address),
          ).to.be.equal(false);
        });

        it('should emit TokenVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyToken(vars.erc20s[0].address, false),
          )
            .to.emit(protection.guardian, 'TokenVerified')
            .withArgs(vars.erc20s[0].address, false);
        });
      });
    });
  });

  describe('verifyAddress', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
    });

    describe('when sender is not lossless admin', async () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            ),
        ).to.be.revertedWith('LOSSLESS: Not lossless admin');
      });
    });

    describe('when sender is lossless admin', async () => {
      describe('when address is not verifed yet', () => {
        it('should set to true', async () => {
          expect(
            await protection.guardian.isAddressVerified(
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

          expect(
            await protection.guardian.isAddressVerified(
              vars.erc20s[0].address,
              vars.initialHolder.address,
            ),
          ).to.be.equal(true);
        });

        it('should emit AddressVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyAddress(
                vars.erc20s[0].address,
                vars.initialHolder.address,
                true,
              ),
          )
            .to.emit(protection.guardian, 'AddressVerified')
            .withArgs(vars.erc20s[0].address, vars.initialHolder.address, true);
        });
      });

      describe('when address already verified', () => {
        beforeEach(async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );
        });

        it('should set to false', async () => {
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );

          expect(
            await protection.guardian.isAddressVerified(
              vars.erc20s[0].address,
              vars.initialHolder.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit AddressVerified event', async () => {
          await expect(
            protection.guardian
              .connect(vars.lssAdmin)
              .verifyAddress(
                vars.erc20s[0].address,
                vars.initialHolder.address,
                false,
              ),
          )
            .to.emit(protection.guardian, 'AddressVerified')
            .withArgs(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              false,
            );
        });
      });
    });

    describe('when sender is lossless admin', async () => {
      it('should set to true', async () => {
        expect(
          await protection.guardian.isAddressVerified(
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

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
      });

      it('should not set to true on other tokens', async () => {
        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[2].address,
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

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.guardian.isAddressVerified(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
      });
    });
  });

  describe('setProtectedAddress', () => {
    describe('when sender is not verified strategy', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy not verified');
      });
    });

    describe('when sender is verified strategy', () => {
      beforeEach(async () => {
        await vars.losslessController
          .connect(vars.lssAdmin)
          .setGuardian(protection.guardian.address);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyStrategies([vars.anotherAccount.address], true);
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[0].address, true);
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
            true,
          );
      });

      describe('when address is not verified', () => {
        it('should revert', async () => {
          await expect(
            protection.guardian
              .connect(vars.anotherAccount)
              .setProtectedAddress(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
              ),
          ).to.be.revertedWith('LOSSLESS: Address not verified');
        });
      });

      describe('when address is verified', () => {
        it('should suceed', async () => {
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          await protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(true);
        });

        it('should not affect other tokens', async () => {
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[2].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyToken(vars.erc20s[1].address, true);
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.anotherAccount.address,
              true,
            );
          await protection.guardian
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[1].address,
              vars.anotherAccount.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[2].address,
              vars.anotherAccount.address,
            ),
          ).to.be.equal(false);
        });
      });
    });
  });

  describe('removeProtectedAddresses', () => {
    beforeEach(async () => {
      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies([vars.anotherAccount.address], true);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);

      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.admin.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.anotherAccount.address,
          true,
        );

      await protection.guardian
        .connect(vars.anotherAccount)
        .setProtectedAddress(
          vars.erc20s[0].address,
          vars.anotherAccount.address,
        );
    });

    describe('when sender is not verified strategy', () => {
      it('should revert', async () => {
        await expect(
          protection.guardian
            .connect(vars.oneMoreAccount)
            .removeProtectedAddresses(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Unauthorized access');
      });
    });

    describe('when sender is verified strategy', () => {
      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        await protection.guardian
          .connect(vars.anotherAccount)
          .removeProtectedAddresses(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(false);
      });

      it('should not affect other tokens', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[2].address, true);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
            true,
          );

        await protection.guardian
          .connect(vars.anotherAccount)
          .setProtectedAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);
      });
    });

    describe('when sender is protection admin', () => {
      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        await protection.guardian
          .connect(vars.anotherAccount)
          .removeProtectedAddresses(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(false);
      });

      it('should not affect other tokens', async () => {
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[2].address, true);
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
            true,
          );

        await protection.guardian
          .connect(vars.anotherAccount)
          .setProtectedAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyToken(vars.erc20s[1].address, true);
        await protection.guardian
          .connect(vars.admin)
          .setProtectionAdmin(vars.erc20s[1].address, vars.admin.address);
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
            true,
          );

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(true);
      });
    });
  });
});
