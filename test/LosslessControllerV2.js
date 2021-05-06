const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

let initialHolder;
let recipient;
let anotherAccount;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let oneMoreAccount;
let pauseAdmin;

let losslessController;
let losslessControllerV1;
let erc20;

const name = 'My Token';
const symbol = 'MTKN';

const initialSupply = 100;

describe('LosslessControllerV2', () => {
  beforeEach(async () => {
    [
      initialHolder,
      recipient,
      anotherAccount,
      admin,
      lssAdmin,
      lssRecoveryAdmin,
      oneMoreAccount,
      pauseAdmin,
      adminBackup,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    const LosslessControllerV2 = await ethers.getContractFactory(
      'LosslessControllerV2',
    );

    losslessControllerV1 = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);
    losslessController = await upgrades.upgradeProxy(
      losslessControllerV1.address,
      LosslessControllerV2,
    );

    await losslessController.connect(lssAdmin).initialize();

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    erc20 = await LERC20Mock.deploy(
      0,
      name,
      symbol,
      initialHolder.address,
      initialSupply,
      losslessController.address,
      admin.address,
      adminBackup.address,
      Number(time.duration.days(1)),
    );
  });

  describe('getVersion', () => {
    it('should get version', async () => {
      expect(
        await losslessController.connect(oneMoreAccount).getVersion(),
      ).to.be.equal(2);
    });
  });

  describe('pause', () => {
    describe('when sender is not pause admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(oneMoreAccount).pause(),
        ).to.be.revertedWith('LOSSLESS: Must be pauseAdmin');
      });
    });

    describe('when sender is pause admin', () => {
      it('should change admin', async () => {
        await losslessController.connect(pauseAdmin).pause();
        expect(await losslessController.paused()).to.eq(true);
      });

      it('should emit Paused event', async () => {
        await expect(losslessController.connect(pauseAdmin).pause())
          .to.emit(losslessController, 'Paused')
          .withArgs(pauseAdmin.address);
      });
    });
  });

  describe('unpause', () => {
    describe('when is not paused', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(pauseAdmin).unpause(),
        ).to.be.revertedWith('Pausable: not paused');
      });
    });

    describe('when sender is not pause admin', () => {
      it('should revert', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await expect(
          losslessController.connect(oneMoreAccount).unpause(),
        ).to.be.revertedWith('LOSSLESS: Must be pauseAdmin');
      });
    });

    describe('when sender is pause admin', () => {
      it('should change admin', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await losslessController.connect(pauseAdmin).unpause();
        expect(await losslessController.paused()).to.eq(false);
      });

      it('should emit Unpaused event', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await expect(losslessController.connect(pauseAdmin).unpause())
          .to.emit(losslessController, 'Unpaused')
          .withArgs(pauseAdmin.address);
      });
    });
  });

  describe('setAdmin', () => {
    describe('when sender is not recovery admin', () => {
      it('should revert', async () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(oneMoreAccount)
              .setAdmin(oneMoreAccount.address),
          ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
        });
      });
    });

    describe('when contract is paused', () => {
      it('should change admin', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await losslessController
          .connect(lssRecoveryAdmin)
          .setAdmin(oneMoreAccount.address);

        const newAdmin = await losslessController.admin();
        expect(newAdmin).to.eq(oneMoreAccount.address);
      });
    });

    describe('when sender is recovery admin', () => {
      it('should change admin', async () => {
        await losslessController
          .connect(lssRecoveryAdmin)
          .setAdmin(oneMoreAccount.address);

        const newAdmin = await losslessController.admin();
        expect(newAdmin).to.eq(oneMoreAccount.address);
      });

      it('should emit AdminChanged event', async () => {
        await expect(
          losslessController
            .connect(lssRecoveryAdmin)
            .setAdmin(oneMoreAccount.address),
        )
          .to.emit(losslessController, 'AdminChanged')
          .withArgs(lssAdmin.address, oneMoreAccount.address);
      });
    });

    describe('when sender is regular admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(lssAdmin).setAdmin(oneMoreAccount.address),
        ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
      });
    });
  });

  describe('setRecoveryAdmin', () => {
    describe('when sender is not recovery admin', () => {
      it('should revert', async () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(oneMoreAccount)
              .setRecoveryAdmin(oneMoreAccount.address),
          ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
        });
      });
    });

    describe('when contract is paused', () => {
      it('should change admin', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await losslessController
          .connect(lssRecoveryAdmin)
          .setRecoveryAdmin(oneMoreAccount.address);

        expect(await losslessController.recoveryAdmin()).to.equal(
          oneMoreAccount.address,
        );
      });
    });

    describe('when sender is regular admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(lssAdmin)
            .setRecoveryAdmin(oneMoreAccount.address),
        ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
      });
    });

    describe('when sender is recovery admin', () => {
      it('should change admin', async () => {
        await losslessController
          .connect(lssRecoveryAdmin)
          .setRecoveryAdmin(oneMoreAccount.address);

        expect(await losslessController.recoveryAdmin()).to.equal(
          oneMoreAccount.address,
        );
      });

      it('should emit RecoveryAdminChanged event', async () => {
        await expect(
          losslessController
            .connect(lssRecoveryAdmin)
            .setRecoveryAdmin(oneMoreAccount.address),
        )
          .to.emit(losslessController, 'RecoveryAdminChanged')
          .withArgs(lssRecoveryAdmin.address, oneMoreAccount.address);
      });
    });
  });

  describe('setPauseAdmin', () => {
    describe('when sender is not recovery admin', () => {
      it('should revert', async () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(oneMoreAccount)
              .setPauseAdmin(oneMoreAccount.address),
          ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
        });
      });
    });

    describe('when contract is paused', () => {
      it('should change admin', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await losslessController
          .connect(lssRecoveryAdmin)
          .setPauseAdmin(oneMoreAccount.address);

        expect(await losslessController.pauseAdmin()).to.equal(
          oneMoreAccount.address,
        );
      });
    });

    describe('when sender is regular admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(lssAdmin)
            .setPauseAdmin(oneMoreAccount.address),
        ).to.be.revertedWith('LOSSLESS: Must be recoveryAdmin');
      });
    });

    describe('when sender is recovery admin', () => {
      it('should change admin', async () => {
        await losslessController
          .connect(lssRecoveryAdmin)
          .setPauseAdmin(oneMoreAccount.address);

        expect(await losslessController.pauseAdmin()).to.equal(
          oneMoreAccount.address,
        );
      });

      it('should emit RecoveryAdminChanged event', async () => {
        await expect(
          losslessController
            .connect(lssRecoveryAdmin)
            .setPauseAdmin(oneMoreAccount.address),
        )
          .to.emit(losslessController, 'PauseAdminChanged')
          .withArgs(pauseAdmin.address, oneMoreAccount.address);
      });
    });
  });

  describe('proposeIdoConfig', () => {
    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            ),
        ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(lssAdmin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            ),
        ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
      });
    });

    describe('when sender is token admin', () => {
      describe('when duration is zero', () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(erc20.address, 0, [
                anotherAccount.address,
                recipient.address,
              ]),
          ).to.be.revertedWith('LOSSLESS: Duration cannot be 0');
        });
      });

      describe('when duration is more than one hour', () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(erc20.address, Number(time.duration.hours(2)), [
                anotherAccount.address,
                recipient.address,
              ]),
          ).to.be.revertedWith(
            'LOSSLESS: Duration cannot be more than one hour',
          );
        });
      });

      describe('when whitelist is empty', () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(
                erc20.address,
                Number(time.duration.minutes(15)),
                [],
              ),
          ).to.be.revertedWith('LOSSLESS: Whitelist cannot be empty');
        });
      });

      describe('when contract is paused', () => {
        it('should revert', async () => {
          await losslessController.connect(pauseAdmin).pause();
          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(
                erc20.address,
                Number(time.duration.minutes(15)),
                [anotherAccount.address, recipient.address],
              ),
          ).to.be.revertedWith('Pausable: paused');
        });
      });

      describe('when config is ok', () => {
        it('should set config values', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          expect(
            await losslessController.getIsIdoConfirmed(erc20.address),
          ).to.equal(false);
          expect(
            await losslessController.getIdoStartTime(erc20.address),
          ).to.equal(0);
          expect(
            await losslessController.getIdoDuration(erc20.address),
          ).to.equal(Number(time.duration.minutes(15)));
          const whitelist = await losslessController.getIdoWhitelist(
            erc20.address,
          );
          expect(whitelist[0]).to.equal(anotherAccount.address);
          expect(whitelist[1]).to.equal(recipient.address);
        });

        it('should emit IDOProposed event', async () => {
          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(
                erc20.address,
                Number(time.duration.minutes(15)),
                [anotherAccount.address, recipient.address],
              ),
          )
            .to.emit(losslessController, 'IDOProposed')
            .withArgs(erc20.address, Number(time.duration.minutes(15)));
        });
      });

      describe('when ido already started', () => {
        it('should revert', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await losslessController
            .connect(lssAdmin)
            .setIdoConfigConfirm(erc20.address, true);

          await losslessController.connect(admin).startIdo(erc20.address);

          await expect(
            losslessController
              .connect(admin)
              .proposeIdoConfig(
                erc20.address,
                Number(time.duration.minutes(15)),
                [anotherAccount.address, recipient.address],
              ),
          ).to.be.revertedWith('LOSSLESS: IDO already started');
        });
      });
    });
  });

  describe('setIdoConfigConfirm', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .setIdoConfigConfirm(erc20.address, true),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when sender is token admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(admin)
            .setIdoConfigConfirm(erc20.address, true),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when sender is lossless admin', () => {
      describe('when ido config is not proposed', () => {
        it('should revert', async () => {
          await expect(
            losslessController
              .connect(lssAdmin)
              .setIdoConfigConfirm(erc20.address, true),
          ).to.be.revertedWith('LOSSLESS: IDO config is not proposed');
        });
      });

      describe('when ido already started', () => {
        it('should revert', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await losslessController
            .connect(lssAdmin)
            .setIdoConfigConfirm(erc20.address, true);

          await losslessController.connect(admin).startIdo(erc20.address);

          await expect(
            losslessController
              .connect(lssAdmin)
              .setIdoConfigConfirm(erc20.address, false),
          ).to.be.revertedWith('LOSSLESS: IDO already started');
        });
      });

      describe('when contract is paused', () => {
        it('should revert', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );
          await losslessController.connect(pauseAdmin).pause();
          await expect(
            losslessController
              .connect(lssAdmin)
              .setIdoConfigConfirm(erc20.address, true),
          ).to.be.revertedWith('Pausable: paused');
        });
      });

      describe('when ido config is proposed', () => {
        it('should set config confirmed value', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await losslessController
            .connect(lssAdmin)
            .setIdoConfigConfirm(erc20.address, true);
          expect(
            await losslessController.getIsIdoConfirmed(erc20.address),
          ).to.equal(true);
        });

        it('should emit IDOConfirmed event', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await expect(
            losslessController
              .connect(lssAdmin)
              .setIdoConfigConfirm(erc20.address, true),
          )
            .to.emit(losslessController, 'IDOConfirmed')
            .withArgs(erc20.address);
        });
      });
    });
  });

  describe('startIdo', () => {
    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(oneMoreAccount).startIdo(erc20.address),
        ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
      });
    });

    describe('when sender is lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(lssAdmin).startIdo(erc20.address),
        ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
      });
    });

    describe('when sender is token admin', () => {
      describe('when ido config is not confirmed', () => {
        it('should revert', async () => {
          await expect(
            losslessController.connect(admin).startIdo(erc20.address),
          ).to.be.revertedWith('LOSSLESS: IDO config is not confirmed');
        });
      });

      describe('when ido config proposal does not exist', () => {
        it('should revert', async () => {
          await expect(
            losslessController.connect(admin).startIdo(erc20.address),
          ).to.be.revertedWith('LOSSLESS: IDO config is not confirmed');
        });
      });

      describe('when ido config is not confirmed', () => {
        it('should revert', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await expect(
            losslessController.connect(admin).startIdo(erc20.address),
          ).to.be.revertedWith('LOSSLESS: IDO config is not confirmed');
        });
      });

      describe('when contract is paused', () => {
        it('should revert', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await losslessController
            .connect(lssAdmin)
            .setIdoConfigConfirm(erc20.address, true);
          await losslessController.connect(pauseAdmin).pause();
          await expect(
            losslessController.connect(admin).startIdo(erc20.address),
          ).to.be.revertedWith('Pausable: paused');
        });
      });

      describe('when ido config is confirmed', () => {
        it('should set config startTime value', async () => {
          await losslessController
            .connect(admin)
            .proposeIdoConfig(
              erc20.address,
              Number(time.duration.minutes(15)),
              [anotherAccount.address, recipient.address],
            );

          await losslessController
            .connect(lssAdmin)
            .setIdoConfigConfirm(erc20.address, true);

          await losslessController.connect(admin).startIdo(erc20.address);
          const blockNum = await ethers.provider.getBlockNumber();
          const block = await ethers.provider.getBlock(blockNum);

          expect(
            await losslessController.getIdoStartTime(erc20.address),
          ).to.equal(block.timestamp);
        });
      });
    });
  });

  describe('blacklist addresses', () => {
    describe('when ido is not started', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(admin)
            .blacklistAddresses(erc20.address, [
              recipient.address,
              anotherAccount.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: IDO has not started yet');
      });
    });

    describe('when ido is ended', () => {
      it('should revert', async () => {
        await losslessController
          .connect(admin)
          .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
            anotherAccount.address,
            recipient.address,
          ]);

        await losslessController
          .connect(lssAdmin)
          .setIdoConfigConfirm(erc20.address, true);

        await losslessController.connect(admin).startIdo(erc20.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(16)),
        ]);

        await expect(
          losslessController
            .connect(admin)
            .blacklistAddresses(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: IDO has ended');
      });
    });

    describe('when contract is paused', () => {
      it('should revert', async () => {
        await losslessController
          .connect(admin)
          .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
            anotherAccount.address,
            recipient.address,
          ]);

        await losslessController
          .connect(lssAdmin)
          .setIdoConfigConfirm(erc20.address, true);

        await losslessController.connect(admin).startIdo(erc20.address);
        await losslessController.connect(pauseAdmin).pause();
        await expect(
          losslessController
            .connect(admin)
            .blacklistAddresses(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when ido is active', () => {
      beforeEach(async () => {
        await losslessController
          .connect(admin)
          .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
            anotherAccount.address,
            recipient.address,
          ]);

        await losslessController
          .connect(lssAdmin)
          .setIdoConfigConfirm(erc20.address, true);

        await losslessController.connect(admin).startIdo(erc20.address);
      });

      describe('when the sender is admin', () => {
        it('emits AddressesBlacklisted event', async () => {
          await expect(
            losslessController
              .connect(admin)
              .blacklistAddresses(erc20.address, [
                anotherAccount.address,
                recipient.address,
              ]),
          )
            .to.emit(losslessController, 'AddressesBlacklisted')
            .withArgs(erc20.address, admin.address, [
              anotherAccount.address,
              recipient.address,
            ]);
        });

        it('sets true in blacklist', async () => {
          await losslessController
            .connect(admin)
            .blacklistAddresses(erc20.address, [
              recipient.address,
              anotherAccount.address,
            ]);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(true);
        });
      });

      describe('when the sender is lossless admin', () => {
        it('emits AddressesBlacklisted event', async () => {
          await expect(
            losslessController
              .connect(lssAdmin)
              .blacklistAddresses(erc20.address, [
                recipient.address,
                anotherAccount.address,
              ]),
          )
            .to.emit(losslessController, 'AddressesBlacklisted')
            .withArgs(erc20.address, lssAdmin.address, [
              recipient.address,
              anotherAccount.address,
            ]);
        });

        it('sets true in blacklist', async () => {
          await losslessController
            .connect(lssAdmin)
            .blacklistAddresses(erc20.address, [
              recipient.address,
              anotherAccount.address,
            ]);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(true);
        });
      });

      describe('when trying to blacklist lossless contract address', () => {
        it('reverts', async () => {
          await expect(
            losslessController
              .connect(lssAdmin)
              .blacklistAddresses(erc20.address, [
                recipient.address,
                anotherAccount.address,
                losslessController.address,
              ]),
          ).to.be.revertedWith('LOSSLESS: Can not blacklist lossless contract');
        });
      });

      describe('when the sender is not admin', () => {
        it('reverts', async () => {
          await expect(
            losslessController
              .connect(anotherAccount)
              .blacklistAddresses(erc20.address, [
                recipient.address,
                anotherAccount.address,
              ]),
          ).to.be.revertedWith('LOSSLESS: Sender is not admin');
        });
      });
    });
  });

  describe('removeFromBlacklistByTokenAdmin', () => {
    beforeEach(async () => {
      await losslessController
        .connect(admin)
        .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
          anotherAccount.address,
          recipient.address,
        ]);

      await losslessController
        .connect(lssAdmin)
        .setIdoConfigConfirm(erc20.address, true);

      await losslessController.connect(admin).startIdo(erc20.address);

      await losslessController
        .connect(admin)
        .blacklistAddresses(erc20.address, [recipient.address]);

      await losslessController
        .connect(admin)
        .blacklistAddresses(erc20.address, [anotherAccount.address]);
    });

    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
      });
    });

    describe('when contract is paused', () => {
      it('should revert', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await expect(
          losslessController
            .connect(admin)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when sender is token admin', () => {
      describe('when lossless admins has not removed those addressess', () => {
        it('should set RemoveFromBlacklistProposal.confirmedByTokenAdmin to true but not unblacklist addresses', async () => {
          await losslessController
            .connect(admin)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          expect(
            await losslessController.getRemovalProposedByTokenAdmin(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.equal(true);

          expect(
            await losslessController.getRemovalProposedByTokenAdmin(
              erc20.address,
              recipient.address,
            ),
          ).to.equal(true);

          expect(
            await losslessController.getRemovalProposedByLosslessAdmin(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.equal(false);

          expect(
            await losslessController.getRemovalProposedByLosslessAdmin(
              erc20.address,
              recipient.address,
            ),
          ).to.equal(false);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(true);
        });

        it('should emit BlacklistedAddressesProposedRemovalTokenAdmin event', async () => {
          await expect(
            losslessController
              .connect(admin)
              .removeFromBlacklistByTokenAdmin(erc20.address, [
                anotherAccount.address,
                recipient.address,
              ]),
          )
            .to.emit(
              losslessController,
              'BlacklistedAddressesProposedRemovalTokenAdmin',
            )
            .withArgs(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);
        });
      });

      describe('when lossless admins has removed those addressess', () => {
        it('should set RemoveFromBlacklistProposal.confirmedByTokenAdmin to true', async () => {
          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          await losslessController
            .connect(lssAdmin)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          await losslessController
            .connect(admin)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(false);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit BlacklistedAddressesProposedRemovalTokenAdmin event', async () => {
          await losslessController
            .connect(lssAdmin)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          await expect(
            losslessController
              .connect(admin)
              .removeFromBlacklistByTokenAdmin(erc20.address, [
                anotherAccount.address,
                recipient.address,
              ]),
          )
            .to.emit(
              losslessController,
              'BlacklistedAddressesProposedRemovalTokenAdmin',
            )
            .withArgs(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);
        });
      });
    });
  });

  describe('removeFromBlacklistByTokenAdmin', () => {
    beforeEach(async () => {
      await losslessController
        .connect(admin)
        .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
          anotherAccount.address,
          recipient.address,
        ]);

      await losslessController
        .connect(lssAdmin)
        .setIdoConfigConfirm(erc20.address, true);

      await losslessController.connect(admin).startIdo(erc20.address);

      await losslessController
        .connect(admin)
        .blacklistAddresses(erc20.address, [recipient.address]);

      await losslessController
        .connect(admin)
        .blacklistAddresses(erc20.address, [anotherAccount.address]);
    });

    describe('when sender is not token admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when contract is paused', () => {
      it('should revert', async () => {
        await losslessController.connect(pauseAdmin).pause();
        await expect(
          losslessController
            .connect(lssAdmin)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when sender is token admin', () => {
      describe('when token admin has not removed those addressess', () => {
        it('should set RemoveFromBlacklistProposal.confirmedByLosslessAdmin to true but not unblacklist addresses', async () => {
          await losslessController
            .connect(lssAdmin)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          expect(
            await losslessController.getRemovalProposedByLosslessAdmin(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.equal(true);

          expect(
            await losslessController.getRemovalProposedByLosslessAdmin(
              erc20.address,
              recipient.address,
            ),
          ).to.equal(true);

          expect(
            await losslessController.getRemovalProposedByTokenAdmin(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.equal(false);

          expect(
            await losslessController.getRemovalProposedByTokenAdmin(
              erc20.address,
              recipient.address,
            ),
          ).to.equal(false);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(true);
        });

        it('should emit BlacklistedAddressesProposedRemovalTokenAdmin event', async () => {
          await expect(
            losslessController
              .connect(lssAdmin)
              .removeFromBlacklistByLosslessAdmin(erc20.address, [
                anotherAccount.address,
                recipient.address,
              ]),
          )
            .to.emit(
              losslessController,
              'BlacklistedAddressesProposedRemovalLosslessAdmin',
            )
            .withArgs(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);
        });
      });

      describe('when token admin has removed those addressess', () => {
        it('should set RemoveFromBlacklistProposal.confirmedByTokenAdmin to true', async () => {
          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(true);

          await losslessController
            .connect(admin)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          await losslessController
            .connect(lssAdmin)
            .removeFromBlacklistByLosslessAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              recipient.address,
            ),
          ).to.be.equal(false);

          expect(
            await losslessController.getIsBlacklisted(
              erc20.address,
              anotherAccount.address,
            ),
          ).to.be.equal(false);
        });

        it('should emit BlacklistedAddressesProposedRemovalTokenAdmin event', async () => {
          await losslessController
            .connect(admin)
            .removeFromBlacklistByTokenAdmin(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);

          await expect(
            losslessController
              .connect(lssAdmin)
              .removeFromBlacklistByLosslessAdmin(erc20.address, [
                anotherAccount.address,
                recipient.address,
              ]),
          )
            .to.emit(
              losslessController,
              'BlacklistedAddressesProposedRemovalLosslessAdmin',
            )
            .withArgs(erc20.address, [
              anotherAccount.address,
              recipient.address,
            ]);
        });
      });
    });
  });
});
