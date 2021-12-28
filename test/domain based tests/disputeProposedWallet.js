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
      adr.dexAddress.address,
      adr.lerc20BackupAdmin.address,
      Number(time.duration.days(1)),
      env.lssController.address);

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, 1000);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);

    await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
      adr.member1.address,
      adr.member2.address,
      adr.member3.address,
      adr.member4.address,
      adr.member5.address]);

    await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
    await env.lssGovernance.connect(adr.dexAddress).tokenOwnersVote(1, true);
    await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

    await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(1)),
    ]);
  });

  describe('when proposing a refund wallet on report close', () => {
    it('should accept a proposed wallet by Lossless Team', async () => {
      await expect(
        env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
      ).to.not.be.reverted;
    });

    it('should accept a proposed wallet by Token Owner', async () => {
      await expect(
        env.lssGovernance.connect(adr.dexAddress).proposeWallet(1, adr.regularUser5.address),
      ).to.not.be.reverted;
    });

    it('should revert if proposed by other than LssTeam or TokenOwner', async () => {
      await expect(
        env.lssGovernance.connect(adr.regularUser5).proposeWallet(1, adr.regularUser5.address),
      ).to.be.revertedWith('LSS: Role cannot propose');
    });

    it('should revert when trying to propose another', async () => {
      await expect(
        env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
      ).to.not.be.reverted;

      await expect(
        env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
      ).to.be.revertedWith('LSS: Wallet already proposed');
    });

    describe('when rejecting a wallet', () => {
      beforeEach(async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
        ).to.not.be.reverted;
      });
      describe('when dispute period is open', () => {
        it('should  not revert when lossless votes one time', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
          ).to.not.be.reverted;
        });

        it('should revert when lossless votes two times', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
          ).to.not.be.reverted;

          await expect(
            env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
          ).to.be.revertedWith('LSS: Already Voted');
        });
        it('should revert when token admin votes one time', async () => {
          await expect(
            env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
          ).to.not.be.reverted;
        });
        it('should revert when token admin votes two times', async () => {
          await expect(
            env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
          ).to.not.be.reverted;

          await expect(
            env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
          ).to.be.revertedWith('LSS: Already Voted');
        });

        it('should not revert when committee member votes one time', async () => {
          await expect(
            env.lssGovernance.connect(adr.member1).rejectWallet(1),
          ).to.not.be.reverted;

          await expect(
            env.lssGovernance.connect(adr.member1).rejectWallet(1),
          ).to.be.revertedWith('LSS: Already Voted');
        });
        it('should revert when committee member votes two times', async () => {
          await expect(
            env.lssGovernance.connect(adr.member1).rejectWallet(1),
          ).to.not.be.reverted;

          await expect(
            env.lssGovernance.connect(adr.member1).rejectWallet(1),
          ).to.be.revertedWith('LSS: Already Voted');
        });

        it('should revert if other than the three pilars tries to reject', async () => {
          await expect(
            env.lssGovernance.connect(adr.regularUser1).rejectWallet(1),
          ).to.be.revertedWith('LSS: Role cannot reject');
        });
      });

      describe('when dispute period has closed', () => {
        beforeEach(async () => {
          await env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1);
          await env.lssGovernance.connect(adr.member1).rejectWallet(1);
          await env.lssGovernance.connect(adr.member2).rejectWallet(1);
          await env.lssGovernance.connect(adr.member3).rejectWallet(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.days(8)),
          ]);
        });

        it('should revert', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
          ).to.be.revertedWith('LSS: Dispute period closed');
        });

        it('should revert when trying to retrieve', async () => {
          await expect(
            env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
          ).to.be.revertedWith('LSS: Wallet rejected');
        });

        describe('should allow proposing another wallet', () => {
          it('should not revert', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser4.address),
            ).to.not.be.reverted;
          });

          describe('when a second wallet is proposed', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser4.address);
            });

            describe('when dispute period is open', () => {
              it('should  not revert when lossless votes one time', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
                ).to.not.be.reverted;
              });

              it('should revert when lossless votes two times', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
                ).to.not.be.reverted;

                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
                ).to.be.revertedWith('LSS: Already Voted');
              });
              it('should revert when token admin votes one time', async () => {
                await expect(
                  env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
                ).to.not.be.reverted;
              });
              it('should revert when token admin votes two times', async () => {
                await expect(
                  env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
                ).to.not.be.reverted;

                await expect(
                  env.lssGovernance.connect(adr.dexAddress).rejectWallet(1),
                ).to.be.revertedWith('LSS: Already Voted');
              });

              it('should not revert when committee member votes one time', async () => {
                await expect(
                  env.lssGovernance.connect(adr.member1).rejectWallet(1),
                ).to.not.be.reverted;
              });
              it('should revert when committee member votes two times', async () => {
                await expect(
                  env.lssGovernance.connect(adr.member1).rejectWallet(1),
                ).to.not.be.reverted;

                await expect(
                  env.lssGovernance.connect(adr.member1).rejectWallet(1),
                ).to.be.revertedWith('LSS: Already Voted');
              });

              it('should revert if other than the three pilars tries to reject', async () => {
                await expect(
                  env.lssGovernance.connect(adr.regularUser1).rejectWallet(1),
                ).to.be.revertedWith('LSS: Role cannot reject');
              });
            });

            describe('when dispute period has closed', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1);
                await env.lssGovernance.connect(adr.member1).rejectWallet(1);
                await env.lssGovernance.connect(adr.member2).rejectWallet(1);
                await env.lssGovernance.connect(adr.member3).rejectWallet(1);

                await ethers.provider.send('evm_increaseTime', [
                  Number(time.duration.days(8)),
                ]);
              });

              it('should revert', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).rejectWallet(1),
                ).to.be.revertedWith('LSS: Dispute period closed');
              });

              it('should revert when trying to retrieve', async () => {
                await expect(
                  env.lssGovernance.connect(adr.regularUser4).retrieveFunds(1),
                ).to.be.revertedWith('LSS: Wallet rejected');
              });
            });
          });
        });
      });
    });
  });
});
