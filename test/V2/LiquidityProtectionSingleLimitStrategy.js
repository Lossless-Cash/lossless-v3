const { expect } = require('chai');
const { time } = require('@openzeppelin/test-helpers');
const {
  setupControllerAndTokens,
  deployProtection,
  mineBlocks,
} = require('./utils');

let vars;
let protection;

describe('LiquidityProtectionSingleLimitStrategy', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setGuardian', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.anotherAccount)
            .setGuardian(vars.anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: Not lossless admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should succeed', async () => {
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.lssAdmin)
          .setGuardian(vars.anotherAccount.address);

        expect(
          await protection.liquidityProtectionSingleLimitStrategy.guardian(),
        ).to.be.equal(vars.anotherAccount.address);
      });

      it('should emit GuardianSet event', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.lssAdmin)
            .setGuardian(vars.anotherAccount.address),
        )
          .to.emit(
            protection.liquidityProtectionSingleLimitStrategy,
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        const timeNumBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.anotherAccount)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        const timeNumBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.oneMoreAccount)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is guard admin', () => {
      beforeEach(async () => {
        const timeNumBefore = await ethers.provider.getBlock();

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
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimitBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            300,
            10,
            timeNumBefore.timestamp,
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
      });

      it('should emit NewProtectedAddress events', async () => {
        const timeNumBefore = await ethers.provider.getBlock();
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.guardianAdmin)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            protection.liquidityProtectionSingleLimitStrategy.address,
          );

        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.guardianAdmin)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            protection.liquidityProtectionSingleLimitStrategy.address,
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );
    });

    describe('when sender is not guard admin', () => {
      it('should revert', async () => {
        const timeNumBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.anotherAccount)
            .setLimit(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              300,
              10,
              timeNumBefore.timestamp,
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        const timeNumBefore = await ethers.provider.getBlock();

        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.oneMoreAccount)
            .setLimit(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              300,
              10,
              timeNumBefore.timestamp,
            ),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is guard admin', () => {
      beforeEach(async () => {
        const timeNumBefore = await ethers.provider.getBlock();

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
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimit(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            300,
            10,
            timeNumBefore.timestamp,
          );
      });

      it('should succeed', async () => {
        expect(
          await vars.losslessController.isAddressProtected(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
          ),
        ).to.be.equal(true);
      });

      it('should emit NewProtectedAddress events', async () => {
        const timeNumBefore = await ethers.provider.getBlock();
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.guardianAdmin)
            .setLimit(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              300,
              10,
              timeNumBefore.timestamp,
            ),
        )
          .to.emit(vars.losslessController, 'NewProtectedAddress')
          .withArgs(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            protection.liquidityProtectionSingleLimitStrategy.address,
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );

      const timeNumBefore = await ethers.provider.getBlock();
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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.guardianAdmin)
        .setLimitBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          300,
          10,
          timeNumBefore.timestamp,
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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.oneMoreAccount)
        .setLimitBatched(
          vars.erc20s[1].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          300,
          10,
          timeNumBefore.timestamp,
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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.guardianAdmin)
        .setLimitBatched(
          vars.erc20s[2].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          300,
          10,
          timeNumBefore.timestamp,
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
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
          protection.liquidityProtectionSingleLimitStrategy
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
        await protection.liquidityProtectionSingleLimitStrategy
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
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimit(
            vars.erc20s[0].address,
            vars.oneMoreAccount.address,
            30,
            10,
            timestampBefore.timestamp,
          );

        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimit(
            vars.erc20s[0].address,
            vars.initialHolder.address,
            30,
            10,
            timestampBefore.timestamp,
          );

        await expect(
          await protection.liquidityProtectionSingleLimitStrategy
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );
    });

    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.anotherAccount)
            .pause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is protection admin of another token', () => {
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.oneMoreAccount)
            .pause(vars.erc20s[0].address, vars.initialHolder.address),
        ).to.be.revertedWith('LOSSLESS: Not protection admin');
      });
    });

    describe('when sender is admin', () => {
      describe('when address is not protected', () => {
        it('should revert', async () => {
          await expect(
            protection.liquidityProtectionSingleLimitStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address),
          ).to.be.revertedWith('LOSSLESS: Address not protected');
        });
      });

      describe('when address is protected', () => {
        beforeEach(async () => {
          const timeNumBefore = await ethers.provider.getBlock();
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
          await protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.guardianAdmin)
            .setLimitBatched(
              vars.erc20s[0].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
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
          await protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.oneMoreAccount)
            .setLimitBatched(
              vars.erc20s[1].address,
              [vars.oneMoreAccount.address, vars.initialHolder.address],
              300,
              10,
              timeNumBefore.timestamp,
            );
        });

        describe('when address is not already paused', () => {
          beforeEach(async () => {
            await protection.liquidityProtectionSingleLimitStrategy
              .connect(vars.guardianAdmin)
              .pause(vars.erc20s[0].address, vars.initialHolder.address);
          });

          it('should succeed', async () => {
            await expect(
              vars.erc20s[0]
                .connect(vars.initialHolder)
                .transfer(vars.recipient.address, 1),
            ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
          });

          it('should emit Paused event', async () => {
            await expect(
              protection.liquidityProtectionSingleLimitStrategy
                .connect(vars.guardianAdmin)
                .pause(vars.erc20s[0].address, vars.oneMoreAccount.address),
            )
              .to.emit(
                protection.liquidityProtectionSingleLimitStrategy,
                'Paused',
              )
              .withArgs(vars.erc20s[0].address, vars.oneMoreAccount.address);
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );

      const timeNumBefore = await ethers.provider.getBlock();
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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.guardianAdmin)
        .setLimitBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          300,
          10,
          timeNumBefore.timestamp + 2,
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
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
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
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reset after some time', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(305)),
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
          Number(time.duration.seconds(300)),
        ]);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 9),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reset two times', async () => {
      it('should suceed', async () => {
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
        ]);
        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
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
        const timeNumBefore = await ethers.provider.getBlock();

        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimitBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            300,
            100000,
            timeNumBefore.timestamp,
          );

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(300)),
        ]);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(300)),
        ]);

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 99999);

        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.recipient.address, 1),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reached', async () => {
      it('should be reset after some time', async () => {
        const timeNumBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimitBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            300,
            10,
            timeNumBefore.timestamp + 2,
          );

        await vars.erc20s[0]
          .connect(vars.initialHolder)
          .transfer(vars.recipient.address, 9);
        await expect(
          vars.erc20s[0]
            .connect(vars.initialHolder)
            .transfer(vars.anotherAccount.address, 2),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );

      const timeNumBefore = await ethers.provider.getBlock();
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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.guardianAdmin)
        .setLimitBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          300,
          10,
          timeNumBefore.timestamp + 2,
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
        expect(
          await vars.erc20s[0].balanceOf(vars.recipient.address),
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
              20,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
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
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reset after some time', async () => {
      it('should not freeze', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
        ]);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await vars.erc20s[0]
          .connect(vars.recipient)
          .approve(vars.anotherAccount.address, 1);
        await vars.erc20s[0]
          .connect(vars.anotherAccount)
          .transferFrom(vars.recipient.address, vars.lssAdmin.address, 1);
        expect(
          await vars.erc20s[0].balanceOf(vars.lssAdmin.address),
        ).to.be.equal(1);
      });
    });

    describe('when limit is reset after some time and reached again', async () => {
      it('should revert', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(300)),
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
              20,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reset two times', async () => {
      it('should suceed', async () => {
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
        ]);
        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 9);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
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
        const timeNumBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimitBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            300,
            10,
            timeNumBefore.timestamp + 2,
          );

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 1);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(300)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.recipient.address, 2);
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(300)),
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
              11,
            ),
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
      });
    });

    describe('when limit is reached', async () => {
      it('should be reset after some time', async () => {
        const timeNumBefore = await ethers.provider.getBlock();
        await protection.liquidityProtectionSingleLimitStrategy
          .connect(vars.guardianAdmin)
          .setLimitBatched(
            vars.erc20s[0].address,
            [vars.oneMoreAccount.address, vars.initialHolder.address],
            300,
            10,
            timeNumBefore.timestamp + 2,
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
        ).to.be.revertedWith('LOSSLESS: Strategy Limit reached');
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.seconds(301)),
        ]);

        await vars.erc20s[0]
          .connect(vars.oneMoreAccount)
          .transferFrom(vars.initialHolder.address, vars.lssAdmin.address, 2);
        expect(
          await vars.erc20s[0].balanceOf(vars.lssAdmin.address),
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
          [protection.liquidityProtectionSingleLimitStrategy.address],
          true,
        );

      const timeNumBefore = await ethers.provider.getBlock();

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
      await protection.liquidityProtectionSingleLimitStrategy
        .connect(vars.guardianAdmin)
        .setLimitBatched(
          vars.erc20s[0].address,
          [vars.oneMoreAccount.address, vars.initialHolder.address],
          100,
          10,
          timeNumBefore.timestamp,
        );

      await vars.erc20s[0]
        .connect(vars.initialHolder)
        .transfer(vars.anotherAccount.address, 2);
    });

    it('should return limit data', async () => {
      const timeNumBefore = await ethers.provider.getBlock();
      const firstAddressLimit1 = await protection.liquidityProtectionSingleLimitStrategy.getLimit(
        vars.erc20s[0].address,
        vars.oneMoreAccount.address,
      );

      expect(firstAddressLimit1[0].toString()).to.be.equal('100');
      expect(firstAddressLimit1[1].toString()).to.be.equal(
        (timeNumBefore.timestamp - 4).toString(),
      );
      expect(firstAddressLimit1[2].toString()).to.be.equal('10');
      expect(firstAddressLimit1[3].toString()).to.be.equal('10');

      const secondAddressLimit1 = await protection.liquidityProtectionSingleLimitStrategy.getLimit(
        vars.erc20s[0].address,
        vars.initialHolder.address,
      );

      expect(secondAddressLimit1[0].toString()).to.be.equal('100');
      expect(secondAddressLimit1[1].toString()).to.be.equal(
        (timeNumBefore.timestamp - 4).toString(),
      );
      expect(secondAddressLimit1[2].toString()).to.be.equal('10');
      expect(secondAddressLimit1[3].toString()).to.be.equal('8');
    });
  });

  describe('isTransferAllowed', () => {
    describe('when sender is not controller', () => [
      it('should revert', async () => {
        await expect(
          protection.liquidityProtectionSingleLimitStrategy
            .connect(vars.anotherAccount)
            .isTransferAllowed(
              vars.erc20s[0].address,
              vars.initialHolder.address,
              vars.recipient.address,
              1,
            ),
        ).to.be.revertedWith('LOSSLESS: LSS Controller only');
      }),
    ]);
  });
});
