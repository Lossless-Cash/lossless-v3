const { time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

let initialHolder;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let oneMoreAccount;
let pauseAdmin;

let losslessController;
let erc20;

const name = 'My Token';
const symbol = 'MTKN';

const initialSupply = 100;

describe('LosslessControllerV1', () => {
  beforeEach(async () => {
    [
      initialHolder,
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

    losslessController = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);

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
      ).to.be.equal(1);
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
});
