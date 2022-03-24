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

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, 1000);

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter2.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor2.address, 1000);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);
    await env.lssToken.connect(adr.reporter2).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);

    await env.lssReporting.connect(adr.reporter2)
      .report(lerc20Token.address, adr.maliciousActor2.address);
  });

  describe('when working over report 1', () => {
    describe('when solving a report', () => {
      beforeEach(async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address]);
      });

      describe('when solving a report twice', () => {
        it('should revert', async () => {
          await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
          await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

          await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

          await expect(
            env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
          ).to.be.revertedWith('LSS: Report already solved');
        });
      });

      describe('when only 2/3 parts vote', () => {
        describe('when only Lossless Team and Token Owners vote', () => {
          describe('when both vote positively', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
            });

            it('should resolve positvely', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

              expect(
                await env.lssGovernance.isReportSolved(1),
              ).to.be.equal(true);

              expect(
                await env.lssGovernance.reportResolution(1),
              ).to.be.equal(true);
            });
          });

          describe('when both vote negatively', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
            });

            it('should resolve negatively', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

              expect(
                await env.lssGovernance.isReportSolved(1),
              ).to.be.equal(true);

              expect(
                await env.lssGovernance.reportResolution(1),
              ).to.be.equal(false);
            });

            it('should remove the reported address from blacklist', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);
              expect(
                await env.lssController.blacklist(adr.maliciousActor1.address),
              ).to.be.equal(false);
            });
          });

          describe('when Lossless Team votes negative and Token Owners positive', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
            });

            it('should revert needing committee member to vote', async () => {
              await expect(
                env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
              ).to.be.revertedWith('LSS: Need another vote to untie');
            });
          });

          describe('when only Lossless Team and Committee vote', () => {
            describe('when both vote positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve positvely', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(true);
              });
            });

            describe('when both vote negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when Lossless Team votes negative and Token Owners positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should revert needing Lossless Team to vote', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
                ).to.be.revertedWith('LSS: Need another vote to untie');
              });
            });

            describe('when only Token Owners and Committee vote', () => {
              describe('when both vote positively', () => {
                beforeEach(async () => {
                  await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
                  await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                  await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                  await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                  await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
                });

                it('should resolve positvely', async () => {
                  await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                  expect(
                    await env.lssGovernance.isReportSolved(1),
                  ).to.be.equal(true);

                  expect(
                    await env.lssGovernance.reportResolution(1),
                  ).to.be.equal(true);
                });
              });
            });

            describe('when both vote negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when Token Owners votes negative and Committee positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should revert needing Lossless Team to vote', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
                ).to.be.revertedWith('LSS: Need another vote to untie');
              });
            });

            describe('when only Lossless Team votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when only Token Owner votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when only the Committee votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when committee mayority votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when committee mayority votes negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });

            describe('when everyone votes positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);
              });

              it('should resolve positively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(true);
              });
            });

            describe('when everyone votes negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(false);
              });
            });
          });
        });
      });
    });
  });

  describe('when working over report 2', () => {
    describe('when solving a report', () => {
      beforeEach(async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address]);
      });

      describe('when solving a report twice', () => {
        it('should revert', async () => {
          await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, true);
          await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);

          await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

          await expect(
            env.lssGovernance.connect(adr.lssAdmin).resolveReport(2),
          ).to.be.revertedWith('LSS: Report already solved');
        });
      });

      describe('when only 2/3 parts vote', () => {
        describe('when only Lossless Team and Token Owners vote', () => {
          describe('when both vote positively', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, true);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);
            });

            it('should resolve positvely', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

              expect(
                await env.lssGovernance.isReportSolved(2),
              ).to.be.equal(true);

              expect(
                await env.lssGovernance.reportResolution(2),
              ).to.be.equal(true);
            });
          });

          describe('when both vote negatively', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
            });

            it('should resolve negatively', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

              expect(
                await env.lssGovernance.isReportSolved(2),
              ).to.be.equal(true);

              expect(
                await env.lssGovernance.reportResolution(2),
              ).to.be.equal(false);
            });
          });

          describe('when Lossless Team votes negative and Token Owners positive', () => {
            beforeEach(async () => {
              await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
              await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);
            });

            it('should revert needing committee member to vote', async () => {
              await expect(
                env.lssGovernance.connect(adr.lssAdmin).resolveReport(2),
              ).to.be.revertedWith('LSS: Need another vote to untie');
            });
          });

          describe('when only Lossless Team and Committee vote', () => {
            describe('when both vote positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve positvely', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(true);
              });
            });

            describe('when both vote negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when Lossless Team votes negative and Token Owners positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should revert needing Lossless Team to vote', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(2),
                ).to.be.revertedWith('LSS: Need another vote to untie');
              });
            });

            describe('when only Token Owners and Committee vote', () => {
              describe('when both vote positively', () => {
                beforeEach(async () => {
                  await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);
                  await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                  await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                  await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                  await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
                });

                it('should resolve positvely', async () => {
                  await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                  expect(
                    await env.lssGovernance.isReportSolved(2),
                  ).to.be.equal(true);

                  expect(
                    await env.lssGovernance.reportResolution(2),
                  ).to.be.equal(true);
                });
              });
            });

            describe('when both vote negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when Token Owners votes negative and Committee positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should revert needing Lossless Team to vote', async () => {
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(2),
                ).to.be.revertedWith('LSS: Need another vote to untie');
              });
            });

            describe('when only Lossless Team votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, true);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when only Token Owner votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when only the Committee votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, true);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when committee mayority votes positively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, true);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when committee mayority votes negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });

            describe('when everyone votes positive', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, true);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, true);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, true);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, true);
              });

              it('should resolve positively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(true);
              });
            });

            describe('when everyone votes negatively', () => {
              beforeEach(async () => {
                await env.lssGovernance.connect(adr.lssAdmin).losslessVote(2, false);
                await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(2, false);
                await env.lssGovernance.connect(adr.member1).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member2).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member3).committeeMemberVote(2, false);
                await env.lssGovernance.connect(adr.member4).committeeMemberVote(2, false);
              });

              it('should resolve negatively', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(2);

                expect(
                  await env.lssGovernance.isReportSolved(2),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(2),
                ).to.be.equal(false);
              });
            });
          });
        });
      });
    });
  });
});
