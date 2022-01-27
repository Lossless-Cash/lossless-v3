/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupControllerAndTokens, deployProtection } = require('./utils');

let vars;
let protection;

describe('ControllerProtection', () => {
  beforeEach(async () => {
    vars = await setupControllerAndTokens();
    protection = await deployProtection(vars.losslessController);
  });

  describe('setGuardian', () => {
    describe('when sender is not admin', async () => {
      it('should revert', async () => {
        await expect(
          vars.losslessController
            .connect(vars.anotherAccount)
            .setGuardian(protection.guardian.address),
        ).to.be.revertedWith('LSS: Must be admin');
      });
    });

    describe('when sender is admin', async () => {
      describe('whenNotPaused', () => {
        it('should succeed', async () => {
          await vars.losslessController
            .connect(vars.lssAdmin)
            .setGuardian(protection.guardian.address);

          expect(await vars.losslessController.guardian()).to.be.equal(
            protection.guardian.address,
          );
        });

        it('should emit event', async () => {
          await expect(
            vars.losslessController
              .connect(vars.lssAdmin)
              .setGuardian(protection.guardian.address),
          )
            .to.emit(vars.losslessController, 'GuardianSet')
            .withArgs(constants.ZERO_ADDRESS, protection.guardian.address);
        });
        it('should succeed', async () => {
          await vars.losslessController
            .connect(vars.lssAdmin)
            .setGuardian(protection.guardian.address);

          expect(await vars.losslessController.guardian()).to.be.equal(
            protection.guardian.address,
          );
        });

        it('should emit event', async () => {
          await expect(
            vars.losslessController
              .connect(vars.lssAdmin)
              .setGuardian(protection.guardian.address),
          )
            .to.emit(vars.losslessController, 'GuardianSet')
            .withArgs(constants.ZERO_ADDRESS, protection.guardian.address);
        });
      });

      describe('whenPaused', () => {
        beforeEach(async () => {
          await vars.losslessController.connect(vars.pauseAdmin).pause();
        });

        it('should revert', async () => {
          await expect(
            vars.losslessController
              .connect(vars.lssAdmin)
              .setGuardian(protection.guardian.address),
          ).to.be.revertedWith('Pausable: paused');
        });
      });
    });
  });

  describe('setProtectedAddress', () => {
    describe('when sender is not guardian', async () => {
      it('should revert', async () => {
        await expect(
          vars.losslessController
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
              protection.treasuryProtectionStrategy.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Must be Guardian');
      });
    });

    describe('when sender is guardian', async () => {
      beforeEach(async () => {
        await vars.losslessController
          .connect(vars.lssAdmin)
          .setGuardian(vars.anotherAccount.address);
      });

      describe('whenNotPaused', () => {
        it('should succeed', async () => {
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(false);

          await vars.losslessController
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              protection.treasuryProtectionStrategy.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(true);

          expect(
            await vars.losslessController.getProtectedAddressStrategy(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(protection.treasuryProtectionStrategy.address);

          await expect(
            vars.losslessController.getProtectedAddressStrategy(
              vars.erc20s[0].address,
              vars.recipient.address,
            ),
          ).to.be.revertedWith('LSS: Address not protected');
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
              vars.erc20s[2].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(false);

          await vars.losslessController
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              protection.treasuryProtectionStrategy.address,
            );

          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[1].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(false);
          expect(
            await vars.losslessController.isAddressProtected(
              vars.erc20s[2].address,
              vars.oneMoreAccount.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit NewProtectedAddress event', async () => {
          await expect(
            vars.losslessController
              .connect(vars.anotherAccount)
              .setProtectedAddress(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
                protection.treasuryProtectionStrategy.address,
              ),
          )
            .to.emit(vars.losslessController, 'NewProtectedAddress')
            .withArgs(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              protection.treasuryProtectionStrategy.address,
            );
        });
      });

      describe('whenPaused', () => {
        beforeEach(async () => {
          await vars.losslessController.connect(vars.pauseAdmin).pause();
        });

        it('should revert', async () => {
          await expect(
            vars.losslessController
              .connect(vars.anotherAccount)
              .setProtectedAddress(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
                protection.treasuryProtectionStrategy.address,
              ),
          ).to.be.revertedWith('Pausable: paused');
        });
      });
    });
  });

  describe('removeProtectedAddress', () => {
    describe('when sender is not guardian', async () => {
      it('should revert', async () => {
        await expect(
          vars.losslessController
            .connect(vars.anotherAccount)
            .removeProtectedAddress(
              vars.erc20s[0].address,
              vars.anotherAccount.address,
            ),
        ).to.be.revertedWith('LOSSLESS: Must be Guardian');
      });

      describe('when sender is guardian', async () => {
        beforeEach(async () => {
          await vars.losslessController
            .connect(vars.lssAdmin)
            .setGuardian(vars.anotherAccount.address);

          await vars.losslessController
            .connect(vars.anotherAccount)
            .setProtectedAddress(
              vars.erc20s[0].address,
              vars.oneMoreAccount.address,
              protection.treasuryProtectionStrategy.address,
            );
        });

        describe('whenNotPaused', () => {
          it('should succeed', async () => {
            expect(
              await vars.losslessController.isAddressProtected(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
              ),
            ).to.be.equal(true);

            await vars.losslessController
              .connect(vars.anotherAccount)
              .removeProtectedAddress(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
              );

            expect(
              await vars.losslessController.isAddressProtected(
                vars.erc20s[0].address,
                vars.oneMoreAccount.address,
              ),
            ).to.be.equal(false);
          });

          it('should emit RemovedProtectedAddress event', async () => {
            await expect(
              vars.losslessController
                .connect(vars.anotherAccount)
                .removeProtectedAddress(
                  vars.erc20s[0].address,
                  vars.oneMoreAccount.address,
                ),
            )
              .to.emit(vars.losslessController, 'RemovedProtectedAddress')
              .withArgs(vars.erc20s[0].address, vars.oneMoreAccount.address);
          });
        });

        describe('whenPaused', () => {
          beforeEach(async () => {
            await vars.losslessController.connect(vars.pauseAdmin).pause();
          });

          it('should revert', async () => {
            await expect(
              vars.losslessController
                .connect(vars.anotherAccount)
                .removeProtectedAddress(
                  vars.erc20s[0].address,
                  vars.oneMoreAccount.address,
                ),
            ).to.be.revertedWith('Pausable: paused');
          });
        });
      });
    });
  });
});
