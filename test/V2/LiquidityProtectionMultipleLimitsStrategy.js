const { expect } = require('chai');
const { time } = require('@openzeppelin/test-helpers');
const {
  setupControllerAndTokens,
  deployProtection,
  mineBlocks,
} = require('./utils');

let vars;
let protection;

describe('LiquidityProtectionMultipleLimitsStrategy', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .setGuardian(vars.anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: Not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed', async () => {
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.lssAdmin)
          .setGuardian(vars.anotherAccount.address);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.guardian(),
        ).to.be.equal(vars.anotherAccount.address);
      });

      it('should emit GuardianSet event', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.lssAdmin)
            .setGuardian(vars.anotherAccount.address),
        )
          .to.emit(
            protection.liquidityProtectionMultipleLimitsStrategy,
            'GuardianSet',
          )
          .withArgs(vars.anotherAccount.address);
      });
    });
  });

  describe('setLimitsBatched', () => {
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
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is guard admin', () => {
      beforeEach(async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            true,
          );
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [100, 300],
            [10, 25],
            [timestampBefore.timestamp, timestampBefore.timestamp],
          );
      });

      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);
        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(2);
      });

      it('should emit NewProtectedAddress events', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            protection.liquidityProtectionMultipleLimitsStrategy.address,
          );

        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            protection.liquidityProtectionMultipleLimitsStrategy.address,
          );
      });

      it('should not affect other tokens', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(0);
        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(0);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[2].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(0);
        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(0);
      });
    });
  });

  describe('setLimits', () => {
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
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .setLimits(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .setLimits(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is guard admin', () => {
      beforeEach(async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            true,
          );
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimits(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            [100, 300],
            [10, 25],
            [timestampBefore.timestamp, timestampBefore.timestamp],
          );
      });

      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(true);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(2);
      });

      it('should emit NewProtectedAddress events', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimits(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              [100, 300],
              [10, 25],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            protection.liquidityProtectionMultipleLimitsStrategy.address,
          );
      });

      it('should not affect other tokens', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.anotherAccount.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(0);
        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(0);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[2].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(0);
        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(0);
      });
    });
  });

  describe('removeLimits', () => {
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
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );

      const timestampBefore = await ethers.provider.getBlock();
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.guardianAdmin)
        .setLimitsBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [5, 10],
          [10, 15],
          [timestampBefore.timestamp, timestampBefore.timestamp],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[1].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[1].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.oneMoreAccount)
        .setLimitsBatched(
          vars.erc20s[1].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [5, 10],
          [10, 15],
          [timestampBefore.timestamp, timestampBefore.timestamp],
        );

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[2].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[2].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.guardianAdmin)
        .setLimitsBatched(
          vars.erc20s[2].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [5, 10],
          [10, 15],
          [timestampBefore.timestamp, timestampBefore.timestamp],
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .removeLimits(vars.erc20s[0].address, [
              vars.oneMoreAccount.address,
              vars.initialHolder.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .removeLimits(vars.erc20s[0].address, [
              vars.oneMoreAccount.address,
              vars.initialHolder.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is admin', () => {
      beforeEach(async () => {
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .removeLimits(vars.erc20s[0].address, [
            vars.oneMoreAccount.address,
            vars.initialHolder.address,
          ]);
      });

      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(false);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(false);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(0);
      });

      it('should emit RemovedProtectedAddress events', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            true,
          );
        await protection.guardian
          .connect(vars.lssAdmin)
          .verifyAddress(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            true,
          );
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimits(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            [100, 300],
            [10, 25],
            [timestampBefore.timestamp, timestampBefore.timestamp],
          );

        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimits(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            [100, 300],
            [10, 25],
            [timestampBefore.timestamp, timestampBefore.timestamp],
          );

        await expect(
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .removeLimits(vars.erc20s[0].address, [
              vars.oneMoreAccount.address,
              vars.initialHolder.address,
            ]),
        )
          .to.emit(vars.losslessController, 'RemovedProtectedAddress')
          .withArgs(vars.erc20s[0].address, vars.oneMoreAccount.address);
      });

      it('should not affect other tokens', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[1].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[1].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(2);

        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(true);
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[2].address,
            vars.initialHolder.address,
          ),
        ).to.be.equal(true);

        expect(
          await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
            vars.erc20s[2].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(2);
      });
    });
  });

  describe('pause', () => {
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
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .pause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .pause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is admin', () => {
      describe('when address is not protected', () => {
        it('should revert', async () => {
          await expect(
            protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address),
          ).to.be.revertedWith('LOSSLESS: Address not protected');
        });
      });

      describe('when address is protected', () => {
        beforeEach(async () => {
          const timestampBefore = await ethers.provider.getBlock();
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [5, 10],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );

          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .setLimitsBatched(
              vars.erc20s[1].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [5, 10],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );
        });

        describe('when address is already paused', () => {
          beforeEach(async () => {
            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address);
          });

          it('should revert', async () => {
            await expect(
              protection.liquidityProtectionMultipleLimitsStrategy
                .connect(vars.guardianAdmin)
                .pause(vars.erc20s[0].address, vars.initialHolder.address),
            ).to.be.revertedWith('LOSSLESS: Already paused');
          });
        });

        describe('when address is not already paused', () => {
          beforeEach(async () => {
            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address);
          });

          it('should succeed', async () => {
            await expect(
              vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 1),
            ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[0].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(3);
          });

          it('should emit Paused event', async () => {
            await expect(
              protection.liquidityProtectionMultipleLimitsStrategy
                .connect(vars.guardianAdmin)
                .pause(vars.erc20s[0].address, vars.oneMoreAccount.address),
            )
              .to.emit(
                protection.liquidityProtectionMultipleLimitsStrategy,
                'Paused',
              )
              .withArgs(vars.erc20s[0].address, vars.oneMoreAccount.address);
          });

          it('should not affect other tokens', async () => {
            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[1].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(2);

            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[2].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(0);
          });
        });
      });
    });
  });

  describe('unpause', () => {
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
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .unpause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .unpause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is admin', () => {
      describe('when address is not protected', () => {
        it('should revert', async () => {
          await expect(
            protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .unpause(vars.erc20s[0].address, vars.initialHolder.address),
          ).to.be.revertedWith('LOSSLESS: Address not protected');
        });
      });

      describe('when address is protected', () => {
        beforeEach(async () => {
          const timestampBefore = await ethers.provider.getBlock();
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [5, 10],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[1].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.oneMoreAccount)
            .setLimitsBatched(
              vars.erc20s[1].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [5, 10],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[2].address,
              vars.initialHolder.address,
              true,
            );
          await protection.guardian
            .connect(vars.lssAdmin)
            .verifyAddress(
              vars.erc20s[2].address,
              vars.oneMoreAccount.address,
              true,
            );
          await protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.guardianAdmin)
            .setLimitsBatched(
              vars.erc20s[2].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              [5, 10],
              [10, 15],
              [timestampBefore.timestamp, timestampBefore.timestamp],
            );
        });

        describe('when address is paused', () => {
          beforeEach(async () => {
            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address);
            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.oneMoreAccount.address);
            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.oneMoreAccount)
              .pause(vars.erc20s[1].address, vars.initialHolder.address);

            await protection.liquidityProtectionMultipleLimitsStrategy
              .connect(vars.guardianAdmin)
              .unpause(vars.erc20s[0].address, vars.initialHolder.address);
          });

          it('should succeed', async () => {
            await vars.erc20s[0]
              .connect(vars.initialHolder)
              .transfer(vars.recipient.address, 1);
            expect(
              await vars.erc20s[0].balanceOf(vars.recipient.address),
            ).to.be.equal(1);
            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[0].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(2);
          });

          it('should emit Unpaused event', async () => {
            await expect(
              protection.liquidityProtectionMultipleLimitsStrategy
                .connect(vars.guardianAdmin)
                .unpause(vars.erc20s[0].address, vars.oneMoreAccount.address),
            )
              .to.emit(
                protection.liquidityProtectionMultipleLimitsStrategy,
                'Unpaused',
              )
              .withArgs(vars.erc20s[0].address, vars.oneMoreAccount.address);
          });

          it('should not affect other tokens', async () => {
            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[1].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(3);
            expect(
              await protection.liquidityProtectionMultipleLimitsStrategy.getLimitsLength(
                vars.erc20s[2].address,
                vars.initialHolder.address,
              ),
            ).to.be.equal(2);
          });
        });

        describe('when address is not paused', () => {
          it('should revert', async () => {
            await await expect(
              protection.liquidityProtectionMultipleLimitsStrategy
                .connect(vars.guardianAdmin)
                .unpause(vars.erc20s[0].address, vars.initialHolder.address),
            ).to.be.revertedWith('LOSSLESS: not paused');
          });
        });
      });
    });
  });

  describe('LERC20.transfer', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );

      const timestampBefore = await ethers.provider.getBlock();
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.guardianAdmin)
        .setLimitsBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [5, 10],
          [10, 15],
          [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
        );
    });

    describe('when transfering below limit', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.recipient)
          .transfer(vars.anotherAccount.address, 3);
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(3);
      });
    });

    describe('when transfering above first limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 4);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 4);
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 4),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering much more that the first limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 4);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 400),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering above second limit', async () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 2),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering much more than the second limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 200),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset after some time', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await vars.erc20s[0]
          .connect(vars.recipient)
          .transfer(vars.anotherAccount.address, 1);
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(1);
      });
    });

    describe('when limit is reset after some time and reached again', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(10)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 9),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset after some time and second limit is reached', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);

        await expect(vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9)).to.be.revertedWith('LOSSLESS: Strategy limit reached');

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 6);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 3);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 4);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 4),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset two times', async () => {
      it('should suceed', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);
        expect(
          await vars.erc20s[0].balanceOf(vars.recipient.address),
        ).to.be.equal(22);
      });
    });

    describe('when limit is reset two times and reached then', async () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 2);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(4)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 7),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reached', async () => {
      it('should be reset after some time', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.anotherAccount.address, 2),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(100)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.anotherAccount.address, 2);
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(2);
      });
    });
  });

  describe('LERC20.transferFrom', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);
      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );

      const timestampBefore = await ethers.provider.getBlock();
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.guardianAdmin)
        .setLimitsBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [5, 10],
          [10, 15],
          [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
        );
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

    describe('when transfering below limit', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(
            vars.initialHolder.address,
            vars.anotherAccount.address,
            3,
          );
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(3);
      });
    });

    describe('when transfering above first limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 4);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 4);
        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              4,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering much more that the first limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 4);

        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              400,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering above second limit', async () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();

        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);

        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              2,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when transfering much more than the second limit', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);

        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              200,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset after some time', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(
            vars.initialHolder.address,
            vars.anotherAccount.address,
            1,
          );
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(1);
      });
    });

    describe('when limit is reset after some time and reached again', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(10)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              9,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset after some time and second limit is reached', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(19)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);

        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              40,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reset two times', async () => {
      it('should suceed', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        expect(
          await vars.erc20s[0].balanceOf(vars.recipient.address),
        ).to.be.equal(22);
      });
    });

    describe('when limit is reset two times and reached then', async () => {
      it('should revert', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(11)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(5)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);

        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.recipient.address,
              5,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
      });
    });

    describe('when limit is reached', async () => {
      it('should be reset after some time', async () => {
        const timestampBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionMultipleLimitsStrategy
          .connect(vars.guardianAdmin)
          .setLimitsBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            [5, 10],
            [10, 15],
            [timestampBefore.timestamp + 2, timestampBefore.timestamp + 2],
          );

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.oneMoreAccount)
            .transferFrom(
              vars.initialHolder.address,
              vars.anotherAccount.address,
              2,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy limit reached');
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(100)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(
            vars.initialHolder.address,
            vars.anotherAccount.address,
            2,
          );
        expect(
          await vars.erc20s[0].balanceOf(vars.anotherAccount.address),
        ).to.be.equal(2);
      });
    });
  });

  describe('getLimit', () => {
    beforeEach(async () => {
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyToken(vars.erc20s[0].address, true);

      await protection.guardian
        .connect(vars.admin)
        .setProtectionAdmin(vars.erc20s[0].address, vars.guardianAdmin.address);

      await vars.losslessController
        .connect(vars.lssAdmin)
        .setGuardian(protection.guardian.address);

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyStrategies(
          [protection.liquidityProtectionMultipleLimitsStrategy.address],
          true,
        );

      const timestampBefore = await ethers.provider.getBlock();

      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.initialHolder.address,
          true,
        );
      await protection.guardian
        .connect(vars.lssAdmin)
        .verifyAddress(
          vars.erc20s[0].address,
          vars.oneMoreAccount.address,
          true,
        );
      await protection.liquidityProtectionMultipleLimitsStrategy
        .connect(vars.guardianAdmin)
        .setLimitsBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          [100, 300],
          [10, 25],
          [timestampBefore.timestamp, timestampBefore.timestamp],
        );

      await vars.erc20s[0]
        .connect(vars.initialHolder)
        .transfer(vars.anotherAccount.address, 2);
    });

    it('should return limit data', async () => {
      const timestampBefore = await ethers.provider.getBlock();
      const firstAddressLimit1 = await protection.liquidityProtectionMultipleLimitsStrategy.getLimit(
        vars.erc20s[0].address,
        vars.oneMoreAccount.address,
        0,
      );

      expect(firstAddressLimit1[0].toString()).to.be.equal('100');
      expect(firstAddressLimit1[1].toString()).to.be.equal(
        (timestampBefore.timestamp - 4).toString(),
      );
      expect(firstAddressLimit1[2].toString()).to.be.equal('10');
      expect(firstAddressLimit1[3].toString()).to.be.equal('10');

      const firstAddressLimit2 = await protection.liquidityProtectionMultipleLimitsStrategy.getLimit(
        vars.erc20s[0].address,
        vars.oneMoreAccount.address,
        1,
      );

      expect(firstAddressLimit2[0].toString()).to.be.equal('300');
      expect(firstAddressLimit2[1].toString()).to.be.equal(
        (timestampBefore.timestamp - 4).toString(),
      );

      expect(firstAddressLimit2[2].toString()).to.be.equal('25');
      expect(firstAddressLimit2[3].toString()).to.be.equal('25');

      const secondAddressLimit1 = await protection.liquidityProtectionMultipleLimitsStrategy.getLimit(
        vars.erc20s[0].address,
        vars.initialHolder.address,
        0,
      );

      expect(secondAddressLimit1[0].toString()).to.be.equal('100');
      expect(secondAddressLimit1[1].toString()).to.be.equal(
        (timestampBefore.timestamp - 4).toString(),
      );
      expect(secondAddressLimit1[2].toString()).to.be.equal('10');
      expect(secondAddressLimit1[3].toString()).to.be.equal('8');

      const secondAddressLimit2 = await protection.liquidityProtectionMultipleLimitsStrategy.getLimit(
        vars.erc20s[0].address,
        vars.initialHolder.address,
        1,
      );

      expect(secondAddressLimit2[0].toString()).to.be.equal('300');
      expect(secondAddressLimit2[1].toString()).to.be.equal(
        (timestampBefore.timestamp - 4).toString(),
      );
      expect(secondAddressLimit2[2].toString()).to.be.equal('25');
      expect(secondAddressLimit2[3].toString()).to.be.equal('23');
    });
  });

  describe('isTransferAllowed', () => {
    describe('when sender is not controller', () => [
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionMultipleLimitsStrategy
            .connect(vars.anotherAccount)
            .isTransferAllowed(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              vars.recipient.address,
              1,
            ),
        ).to.be.revertedWith('SLESS: LSS Controller only');
      }),
    ]);
  });
});
