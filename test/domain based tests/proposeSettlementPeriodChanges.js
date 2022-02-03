/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
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
    lerc20Token = await setupToken(2000000,
      'Random Token',
      'RAND',
      adr.lerc20InitialHolder,
      adr.lerc20Admin.address,
      adr.lerc20BackupAdmin.address,
      Number(time.duration.days(1)),
      env.lssController.address);

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);
  });

  describe('when the token admin sets the settlement period', () => {
    describe('when proposing a new settlement period', () => {
      it('should not revert', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.not.be.reverted;
      });

      it('should set new proposed values', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.not.be.reverted;
      });

      it('should emit event', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.emit(env.lssController, 'NewSettlementPeriodProposal').withArgs(lerc20Token.address, 5 * 60);
      });

      it('should revert if it\'s not token admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.be.revertedWith('LSS: Must be Token Admin');
      });

      it('should revert on new proposal before timelock expiration', async () => {
        await env.lssController.connect(adr.lerc20Admin)
          .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60),
        ).to.be.revertedWith('LSS: Time lock in progress');
      });

      it('should revert on executing proposal if there\'s no proposal', async () => {
        await expect(
          env.lssController.connect(adr.lerc20Admin)
            .executeNewSettlementPeriod(lerc20Token.address),
        ).to.be.revertedWith('LSS: New Settlement not proposed');
      });
    });

    describe('when the settlement period is active', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lerc20Admin)
          .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(13)),
        ]);

        await env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address);
      });

      describe('when transfering to a dex', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(6)),
          ]);

          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
        });

        it('should revert when transfering unsettled over the dex threshold', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 145),
          ).to.be.revertedWith('LSS: Cannot transfer over the dex threshold');
        });

        it('should not revert when transfering unsettled below the dex threshold', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 119),
          ).to.not.be.reverted;
        });

        it('should not revert when transfering settled tokens', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 99),
          ).to.not.be.reverted;
        });
      });

      describe('when transfering between users', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);
        });

        it.skip('should get locked amount correctly', async () => {
          expect(
            await env.lssController.getLockedAmount(lerc20Token.address, adr.regularUser1.address),
          ).to.be.equal(50);

          expect(
            await env.lssController.getLockedAmount(lerc20Token.address, adr.regularUser2.address),
          ).to.be.equal(100);
        });

        it.skip('should get available amount correctly', async () => {
          expect(
            await env.lssController.getAvailableAmount(lerc20Token.address, adr.regularUser1.address),
          ).to.be.equal(50);

          expect(
            await env.lssController.getAvailableAmount(lerc20Token.address, adr.regularUser2.address),
          ).to.be.equal(100);
        });

        it('should revert if 5 minutes haven\'t passed and it\'s a second transfer over the unsettled amount', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 101),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });

        it('should not revert if 5 minutes haven\'t passed but its the first transfer over the unsettled amount', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 55),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes haven\'t passed but its the first transfer over the unsettled amount with large locks queue', async () => {
          // push 150 checkpoints to a locks queue
          for(let i=0; i<150; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser5.address, 1);
          }

          await expect(
            lerc20Token.connect(adr.regularUser5).transfer(adr.regularUser4.address, 55),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes have passed on first transfer', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(5);
        });

        it('should not revert if 5 minutes have passed on first transfer with large locks queue', async () => {
          // push 150 checkpoints to a locks queue
          for(let i=0; i<150; i++) {
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser5.address, 1);
          }
          
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(5);
        });

        it('should not revert if 5 minutes have passed on second transfer', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(10);
        });

        it('should not revert when sending two transactions at the same time', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(10);
        });

        describe('when transfering at the same timestamp', () => {
          beforeEach(async () => {
            const MockTransfer = await ethers.getContractFactory(
              'MockTransfer',
            );

            mockTransfer = await upgrades.deployProxy(
              MockTransfer,
              [
                lerc20Token.address,
              ],
              { initializer: 'initialize' },
            );
          });

          it('should not revert', async () => {
            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser2.address, 200);

            await lerc20Token.connect(adr.regularUser2).approve(mockTransfer.address, 200);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(30)),
            ]);

            await expect(
              mockTransfer.testSameTimestamp(adr.regularUser2.address, adr.regularUser3.address, 25),
            ).to.not.be.reverted;
          });
        });
      });

      describe('when transfering between users with transferFrom', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);

          await lerc20Token.connect(adr.regularUser1).approve(adr.regularUser3.address, 50);
          await lerc20Token.connect(adr.regularUser2).approve(adr.regularUser3.address, 50);
        });

        it('should revert if 5 minutes haven\'t passed and and it\'s a second transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.be.revertedWith('LSS: Transfers limit reached');
        });

        it('should not revert if 5 minutes haven\'t passed but its the first transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes have passed', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser1.address, adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(5);
        });
      });

      describe('when emergency mode is active', () => {
        beforeEach(async () => {
          await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
          await env.lssToken.connect(adr.lssInitialHolder)
            .transfer(adr.reporter1.address, env.stakingAmount);
          await lerc20Token.connect(adr.lerc20InitialHolder)
            .transfer(adr.regularUser1.address, env.stakingAmount + 200);
          await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);
          await env.lssToken.connect(adr.regularUser1).approve(env.lssStaking.address, env.stakingAmount);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await env.lssReporting.connect(adr.reporter1)
            .report(lerc20Token.address, adr.maliciousActor1.address);
        });

        describe('when a settlement period passes', () => {
          it('should not revert', async () => {
            await expect(
              lerc20Token.connect(adr.regularUser1)
                .transfer(adr.regularUser1.address, env.stakingAmount + 5),
            ).to.not.be.reverted;
          });
        });

        describe('when transfering settled tokens', () => {
          it('should not revert', async () => {
            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(1)),
            ]);

            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser1.address, env.stakingAmount);

            await expect(
              lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, env.stakingAmount),
            ).to.not.be.reverted;
          });
        });

        describe('when transfering unsettled tokens for the first time in a period', () => {
          it('should not revert', async () => {
            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser1.address, env.stakingAmount);

            await expect(
              lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, env.stakingAmount),
            ).to.not.be.reverted;
          });
        });

        describe('when transfering settled tokens multiple times', () => {
          it('should not revert', async () => {
            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser2.address, env.stakingAmount);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(16)),
            ]);

            await expect(
              lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
            ).to.not.be.reverted;

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(16)),
            ]);

            await expect(
              lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
            ).to.not.be.reverted;

            await expect(
              lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
            ).to.not.be.reverted;

            await expect(
              lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, 1),
            ).to.not.be.reverted;
          });
        });

        describe('when transfering all unsettled tokens once', () => {
          it('should not revert', async () => {
            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser2.address, env.stakingAmount);

            await expect(
              lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser3.address, env.stakingAmount),
            ).to.be.revertedWith('LSS: Emergency mode active, cannot transfer unsettled tokens');
          });
        });
      });
    });

    describe('when settlement period is inactive', () => {
      beforeEach(async () => {
        await env.lssController.connect(adr.lerc20Admin)
          .proposeNewSettlementPeriod(lerc20Token.address, 1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(13)),
        ]);

        await env.lssController.connect(adr.lerc20Admin)
          .executeNewSettlementPeriod(lerc20Token.address);
      });

      describe('when transfering to a dex', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(6)),
          ]);

          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 50);
        });

        it('should not revert when transfering unsettled over the dex threshold', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 145),
          ).to.not.be.reverted;
        });

        it('should not revert when transfering unsettled below the dex threshold', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 115),
          ).to.not.be.reverted;
        });

        it('should not revert when transfering settled tokens', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.dexAddress.address, 99),
          ).to.not.be.reverted;
        });
      });

      describe('when transfering between users', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);
        });

        it('should not revert if 5 minutes haven\'t passed and and it\'s a second transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes haven\'t passed but its the first transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes have passed on first transfer', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(5);
        });

        it('should not revert if 5 minutes have passed on second transfer', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(10);
        });

        it('should not revert when sending two transactions at the same time', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
            lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(10);
        });

        describe('when transfering at the same timestamp', () => {
          beforeEach(async () => {
            const MockTransfer = await ethers.getContractFactory(
              'MockTransfer',
            );

            mockTransfer = await upgrades.deployProxy(
              MockTransfer,
              [
                lerc20Token.address,
              ],
              { initializer: 'initialize' },
            );
          });

          it('should not revert', async () => {
            await lerc20Token.connect(adr.lerc20InitialHolder)
              .transfer(adr.regularUser2.address, 200);

            await lerc20Token.connect(adr.regularUser2).approve(mockTransfer.address, 200);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(30)),
            ]);

            await expect(
              mockTransfer.testSameTimestamp(adr.regularUser2.address, adr.regularUser3.address, 25),
            ).to.not.be.reverted;
          });
        });
      });

      describe('when transfering between users with transferFrom', () => {
        beforeEach(async () => {
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);
          await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);

          await lerc20Token.connect(adr.regularUser1).approve(adr.regularUser3.address, 50);
          await lerc20Token.connect(adr.regularUser2).approve(adr.regularUser3.address, 50);
        });

        it('should not revert if 5 minutes haven\'t passed and and it\'s a second transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.not.be.reverted;

          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes haven\'t passed but its the first transfer', async () => {
          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser2.address, adr.regularUser4.address, 5),
          ).to.not.be.reverted;
        });

        it('should not revert if 5 minutes have passed', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(5)),
          ]);

          await expect(
            lerc20Token.connect(adr.regularUser3).transferFrom(adr.regularUser1.address, adr.regularUser3.address, 5),
          ).to.not.be.reverted;

          expect(
            await lerc20Token.balanceOf(adr.regularUser3.address),
          ).to.be.equal(5);
        });
      });
    });
  });
});
