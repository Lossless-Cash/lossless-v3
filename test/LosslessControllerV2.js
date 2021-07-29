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
let anotherErc20;

const name = 'My Token';
const symbol = 'MTKN';
const initialSupply = 1000000;
const stakeAmount = 5000;
const reportLifetime = time.duration.days(1);

describe.only('LosslessControllerV2', () => {
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
      //   [stakeAmount, reportLifetime, erc20.address],
    );

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

    anotherErc20 = await LERC20Mock.deploy(
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

    await losslessController.connect(lssAdmin).setStakeAmount(stakeAmount);
    await losslessController
      .connect(lssAdmin)
      .setReportLifetime(Number(reportLifetime));
    await losslessController.connect(lssAdmin).setLosslessToken(erc20.address);
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

  describe('setReportLifetime', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .setReportLifetime(Number(time.duration.days(10))),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when sender is admin', () => {
      it('should change report lifetime', async () => {
        await losslessController
          .connect(lssAdmin)
          .setReportLifetime(Number(time.duration.days(10)));

        expect(await losslessController.reportLifetime()).to.equal(
          Number(time.duration.days(10)),
        );
      });
    });
  });

  describe('setLosslessToken', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(oneMoreAccount)
            .setLosslessToken(erc20.address),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when sender is admin', () => {
      it('should change report lifetime', async () => {
        await losslessController
          .connect(lssAdmin)
          .setLosslessToken(erc20.address);

        expect(await losslessController.losslessToken()).to.equal(
          erc20.address,
        );
      });
    });
  });

  describe('setStakeAmount', () => {
    describe('when sender is not lossless admin', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(oneMoreAccount).setStakeAmount(1000000),
        ).to.be.revertedWith('LOSSLESS: Must be admin');
      });
    });

    describe('when sender is admin', () => {
      it('should change report lifetime', async () => {
        await losslessController.connect(lssAdmin).setStakeAmount(1000000);

        expect(await losslessController.stakeAmount()).to.equal(1000000);
      });
    });
  });

  describe('report', () => {
    describe('when sender did not approve lossless token transfer', () => {
      it('should revert', async () => {
        await expect(
          losslessController
            .connect(initialHolder)
            .report(anotherErc20.address, anotherAccount.address),
        ).to.be.revertedWith('LERC20: transfer amount exceeds allowance');
      });
    });

    describe('when sender approve lossless token transfer', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);
      });

      it('should report', async () => {
        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);
      });

      it('should charge for the report', async () => {
        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(
          initialSupply - stakeAmount,
        );
      });

      it('should revert in case of duplicate', async () => {
        await expect(
          losslessController
            .connect(initialHolder)
            .report(anotherErc20.address, anotherAccount.address),
        )
          .to.emit(losslessController, 'ReportSubmitted')
          .withArgs(anotherErc20.address, anotherAccount.address, 1);

        expect(
          Number(await losslessController.reportTimestamps(1)),
        ).to.be.greaterThan(0);

        await expect(
          losslessController
            .connect(initialHolder)
            .report(anotherErc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: report already exists');
      });

      it('should allow reporting different wallets for same token', async () => {
        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);

        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, oneMoreAccount.address);
      });

      it('should transfer tokens when reporting', async () => {
        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        expect(await erc20.balanceOf(losslessController.address)).to.be.equal(
          stakeAmount,
        );
      });

      it('should not allow to transfer for reported wallet', async () => {
        await anotherErc20
          .connect(initialHolder)
          .transfer(anotherAccount.address, 100);

        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        await expect(
          anotherErc20
            .connect(anotherAccount)
            .transfer(oneMoreAccount.address, 50),
        ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
      });

      it('should not allow to transferFrom reported wallet', async () => {
        await anotherErc20
          .connect(initialHolder)
          .transfer(anotherAccount.address, 100);

        await anotherErc20
          .connect(anotherAccount)
          .approve(oneMoreAccount.address, 100);

        await anotherErc20
          .connect(oneMoreAccount)
          .transferFrom(anotherAccount.address, initialHolder.address, 50);

        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        await expect(
          anotherErc20
            .connect(oneMoreAccount)
            .transferFrom(anotherAccount.address, initialHolder.address, 50),
        ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
      });

      it('should allow to transfer for reported wallet when report time finished', async () => {
        await anotherErc20
          .connect(initialHolder)
          .transfer(anotherAccount.address, 100);

        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await anotherErc20
          .connect(anotherAccount)
          .transfer(oneMoreAccount.address, 50);

        expect(
          await anotherErc20.balanceOf(oneMoreAccount.address),
        ).to.be.equal(50);
      });

      it('should allow to transferFrom reported wallet when report time finished', async () => {
        await anotherErc20
          .connect(initialHolder)
          .transfer(anotherAccount.address, 100);

        await anotherErc20
          .connect(anotherAccount)
          .approve(oneMoreAccount.address, 100);

        await anotherErc20
          .connect(oneMoreAccount)
          .transferFrom(anotherAccount.address, initialHolder.address, 50);

        await losslessController
          .connect(initialHolder)
          .report(anotherErc20.address, anotherAccount.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await anotherErc20
          .connect(oneMoreAccount)
          .transferFrom(anotherAccount.address, oneMoreAccount.address, 50);

        expect(
          await anotherErc20.balanceOf(oneMoreAccount.address),
        ).to.be.equal(50);
      });

      it('should not allow to approve for reported wallet', async () => {});

      it('should allow to approve for reported wallet when report time finished', async () => {});
    });
  });

  describe('reportAnother', () => {
    describe('when first report is submitted ', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);

        await losslessController
          .connect(initialHolder)
          .report(erc20.address, anotherAccount.address);
      });

      it('should submit another report', async () => {
        await expect(
          losslessController
            .connect(initialHolder)
            .reportAnother(1, erc20.address, anotherAccount.address),
        )
          .to.be.emit(losslessController, 'AnotherReportSubmitted')
          .withArgs(erc20.address, anotherAccount.address, 1);
      });

      it('should fail when submitting a third report', async () => {
        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await expect(
          losslessController
            .connect(initialHolder)
            .reportAnother(1, erc20.address, oneMoreAccount.address),
        ).to.be.revertedWith('LOSSLESS: another report already submitted');
      });

      it('should not allow to transfer for reported wallet', async () => {
        await erc20
          .connect(initialHolder)
          .transfer(oneMoreAccount.address, 100);

        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await expect(
          erc20.connect(oneMoreAccount).transfer(initialHolder.address, 50),
        ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
      });

      it('should not allow to transferFrom reported wallet', async () => {
        await erc20
          .connect(initialHolder)
          .transfer(oneMoreAccount.address, 100);

        await erc20.connect(oneMoreAccount).approve(initialHolder.address, 50);

        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await expect(
          erc20
            .connect(initialHolder)
            .transferFrom(oneMoreAccount.address, initialHolder.address, 50),
        ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
      });

      it('should not allow to transferFrom for msg.sender reported wallet', async () => {
        await erc20.connect(initialHolder).approve(oneMoreAccount.address, 100);

        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await expect(
          erc20
            .connect(oneMoreAccount)
            .transferFrom(initialHolder.address, initialHolder.address, 50),
        ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
      });

      it('should allow to transfer for reported wallet when report time finished', async () => {
        await erc20
          .connect(initialHolder)
          .transfer(oneMoreAccount.address, 100);

        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await erc20
          .connect(oneMoreAccount)
          .transfer(anotherAccount.address, 50);

        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(50);
      });

      it('should allow to transferFrom reported wallet when report time finished', async () => {
        await erc20
          .connect(initialHolder)
          .transfer(oneMoreAccount.address, 100);

        await erc20.connect(oneMoreAccount).approve(initialHolder.address, 50);

        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, oneMoreAccount.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await erc20
          .connect(initialHolder)
          .transferFrom(oneMoreAccount.address, anotherAccount.address, 50);

        expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(50);
      });

      it('should not charge for the second report', async () => {
        await losslessController
          .connect(initialHolder)
          .reportAnother(1, erc20.address, anotherAccount.address);

        expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(
          initialSupply - stakeAmount,
        );
      });
    });

    describe('when first report is not submitted', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);
      });

      it('should fail to submit another report', async () => {
        await expect(
          losslessController
            .connect(initialHolder)
            .reportAnother(1, erc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: report does not exists');
      });
    });

    describe('when first report is expired', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);

        await losslessController
          .connect(initialHolder)
          .report(erc20.address, anotherAccount.address);
      });

      it('should fail to submit another report', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)),
        ]);

        await expect(
          losslessController
            .connect(initialHolder)
            .reportAnother(1, erc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: report does not exists');
      });
    });

    describe('when another report is being reported by different account', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(losslessController.address, stakeAmount);

        await erc20
          .connect(initialHolder)
          .transfer(recipient.address, stakeAmount);

        await erc20
          .connect(recipient)
          .approve(losslessController.address, stakeAmount);

        await losslessController
          .connect(initialHolder)
          .report(erc20.address, anotherAccount.address);
      });

      it('should fail to submit another report', async () => {
        await expect(
          losslessController
            .connect(recipient)
            .reportAnother(1, erc20.address, anotherAccount.address),
        ).to.be.revertedWith('LOSSLESS: invalid reporter');
      });
    });
  });

  describe.only('stake', () => {
    beforeEach(async () => {
      await erc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await erc20
        .connect(initialHolder)
        .transfer(anotherAccount.address, stakeAmount);

      await erc20
        .connect(initialHolder)
        .approve(losslessController.address, stakeAmount);

      await erc20
        .connect(oneMoreAccount)
        .approve(losslessController.address, stakeAmount);

      await erc20
        .connect(anotherAccount)
        .approve(losslessController.address, stakeAmount);

      await losslessController
        .connect(initialHolder)
        .report(erc20.address, anotherAccount.address);
    });

    describe('when report is valid', () => {
      it('should allow to stake', async () => {
        await expect(losslessController.connect(oneMoreAccount).stake(1))
          .to.emit(losslessController, 'Staked')
          .withArgs(erc20.address, oneMoreAccount.address, 1);
      });

      describe('when first stake', () => {
        it('should save user stake', async () => {
          await losslessController.connect(oneMoreAccount).stake(1);

          expect(
            (
              await losslessController.getAccountStakes(oneMoreAccount.address)
            )[0][0].toNumber(),
          ).to.be.eq(1);
        });

        it('should save to all report stakers', async () => {
          await losslessController.connect(oneMoreAccount).stake(1);
          expect((await losslessController.getReportStakes(1))[0]).to.be.eq(
            oneMoreAccount.address,
          );
        });

        it('should charge for the stake', async () => {
          expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.eq(
            stakeAmount,
          );
          await losslessController.connect(oneMoreAccount).stake(1);
          expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.eq(0);
        });
      });

      describe('when duplicate stake', () => {
        it('should revert', async () => {
          await losslessController.connect(oneMoreAccount).stake(1);

          await erc20
            .connect(initialHolder)
            .transfer(oneMoreAccount.address, stakeAmount);

          await erc20
            .connect(oneMoreAccount)
            .approve(losslessController.address, stakeAmount);

          await expect(
            losslessController.connect(oneMoreAccount).stake(1),
          ).to.be.revertedWith('LOSSLESS: already staked');
        });
      });

      describe('when staker is reporter', () => {
        it('should revert', async () => {
          await erc20
            .connect(initialHolder)
            .approve(losslessController.address, stakeAmount);

          await expect(
            losslessController.connect(initialHolder).stake(1),
          ).to.be.revertedWith('LOSSLESS: reporter can not stake');
        });
      });

      describe('when reported account tries to stake', () => {
        it('should revert', async () => {
          await erc20
            .connect(initialHolder)
            .approve(losslessController.address, stakeAmount);

          await expect(
            losslessController.connect(anotherAccount).stake(1),
          ).to.be.revertedWith('LOSSLESS: address is temporarily flagged');
        });
      });
    });

    describe('when report is expired', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);
        await expect(
          losslessController.connect(oneMoreAccount).stake(1),
        ).to.be.revertedWith('LOSSLESS: report does not exists');
      });
    });

    describe('when report is non existant', () => {
      it('should revert', async () => {
        await expect(
          losslessController.connect(oneMoreAccount).stake(10),
        ).to.be.revertedWith('LOSSLESS: report does not exists');
      });
    });
  });
});
