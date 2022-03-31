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
let lerc20Token;

const scriptName = path.basename(__filename, '.js');

describe(scriptName, () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment(adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin);

    const token = await ethers.getContractFactory('BridgeMintableTokenV2');

    lerc20Token = await token.connect(adr.lerc20Admin).deploy();
    await lerc20Token.connect(adr.lerc20Admin).initialize('Chainport LERC20',
      'CLERC',
      18,
      adr.regularUser1.address);

    await lerc20Token.connect(adr.lerc20Admin).setLosslessController(env.lssController.address);
    await lerc20Token.connect(adr.lerc20Admin).setLosslessAdmin(adr.lerc20Admin.address);
    await lerc20Token.connect(adr.lerc20Admin).mint(adr.lerc20InitialHolder.address, 1000000000000);

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

    await lerc20Token.connect(adr.regularUser1).setBlacklist([adr.maliciousActor1.address, adr.maliciousActor2.address], true);
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
            it('should resolve positvely if blacklist is confirmed', async () => {
              await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

              expect(
                await env.lssGovernance.isReportSolved(1),
              ).to.be.equal(true);

              expect(
                await env.lssGovernance.reportResolution(1),
              ).to.be.equal(true);
            });

            it('should revert when blacklist is not confirmed', async () => {
              await lerc20Token.connect(adr.regularUser1).setBlacklist([adr.maliciousActor1.address, adr.maliciousActor2.address], false);
              await expect(
                env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
              ).to.be.revertedWith('LERC20: Blacklist not confirmed');
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

              it('should resolve positvely if blacklist is confirmed', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(true);
              });

              it('should revert when blacklist is not confirmed', async () => {
                await lerc20Token.connect(adr.regularUser1).setBlacklist([adr.maliciousActor1.address, adr.maliciousActor2.address], false);
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
                ).to.be.revertedWith('LERC20: Blacklist not confirmed');
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

                it('should resolve positvely when blacklist is confirmed', async () => {
                  await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                  expect(
                    await env.lssGovernance.isReportSolved(1),
                  ).to.be.equal(true);

                  expect(
                    await env.lssGovernance.reportResolution(1),
                  ).to.be.equal(true);
                });

                it('should revert when blacklist is not confirmed', async () => {
                  await lerc20Token.connect(adr.regularUser1).setBlacklist([adr.maliciousActor1.address, adr.maliciousActor2.address], false);
                  await expect(
                    env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
                  ).to.be.revertedWith('LERC20: Blacklist not confirmed');
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

              it('should resolve positively if blacklist is confirmed', async () => {
                await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

                expect(
                  await env.lssGovernance.isReportSolved(1),
                ).to.be.equal(true);

                expect(
                  await env.lssGovernance.reportResolution(1),
                ).to.be.equal(true);
              });

              it('should revert when blacklist is not confirmed', async () => {
                await lerc20Token.connect(adr.regularUser1).setBlacklist([adr.maliciousActor1.address, adr.maliciousActor2.address], false);
                await expect(
                  env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
                ).to.be.revertedWith('LERC20: Blacklist not confirmed');
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
});
