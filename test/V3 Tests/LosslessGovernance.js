/* eslint-disable no-mixed-operators */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('./utilsV3');

let adr;
let env;

describe.only('Lossless Governance', () => {
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

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakeAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, 1000);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakeAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);
  });

  describe('when setting up the Committee', () => {
    describe('when adding Committe members', () => {
      it('should add members and update quorum', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address],
        2);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member1.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member2.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member3.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.quorumSize(),
        ).to.be.equal(2);
      });
    });

    describe('when removing Committee members', () => {
      it('should remove members and update quorum', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address],
        3);

        await env.lssGovernance.connect(adr.lssAdmin)
          .removeCommitteeMembers([adr.member2.address, adr.member4.address], 2);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member2.address),
        ).to.be.equal(false);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member4.address),
        ).to.be.equal(false);

        expect(
          await env.lssGovernance.quorumSize(),
        ).to.be.equal(2);
      });
    });
  });

  describe('when voting takes place', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
        adr.member1.address,
        adr.member2.address,
        adr.member3.address,
        adr.member4.address,
        adr.member5.address],
      3);
    });

    describe('when the Lossless Team is voting', () => {
      it('should register Lossless Vote', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        expect(
          await env.lssGovernance.getIsVoted(1, env.lssTeamVoteIndex),
        ).to.be.equal(true);
      });

      it('should revert at a second attempt', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true),
        ).to.be.revertedWith('LSS: LSS already voted.');
      });

      it('should revert when trying to resolve if no other party voted', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
        ).to.be.revertedWith('LSS: Not enough votes');
      });
    });

    describe('when the Token Owner is voting', () => {
      it('should register Token Owner vote', async () => {
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

        expect(
          await env.lssGovernance.getIsVoted(1, env.tokenOwnersVoteIndex),
        ).to.be.equal(true);
      });

      it('should revert at a second attemtp', async () => {
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: owners already voted');
      });
    });

    describe('when the Committee is voting', () => {
      it('should register all members vote', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        expect(
          await env.lssGovernance.getCommitteeVotesCount(1),
        ).to.be.equal(3);
      });

      it('should revert at a second attempt', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: Member already voted.');
      });
    });
  });

  describe('when non members try to vote', () => {
    describe('when impersonating the Lossless Team', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).losslessVote(1, true),
        ).to.be.revertedWith('LSS: must be admin');
      });
    });
    describe('when impersonating the Token Owners', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: must be token owner');
      });
    });
    describe('when impersonating a committee member', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: must be a committee member');
      });
    });
  });

  describe('when solving a report', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
        adr.member1.address,
        adr.member2.address,
        adr.member3.address,
        adr.member4.address,
        adr.member5.address],
      3);
    });

    describe('when only 2/3 parts vote', () => {
      describe('when only Lossless Team and Token Owners vote', () => {
        describe('when both vote positively', () => {
          beforeEach(async () => {
            await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
            await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
          });

          it('should save vote as positive', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(true);

            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(true);
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

          it('should save vote as negative', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(false);
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
            await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
          });

          it('should save each individual vote', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(true);
          });

          it('should revert needing committee member to vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
            ).to.be.revertedWith('LSS: Need anothe vote to untie');
          });
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

          it('should save vote as positive', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(true);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(true);
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

          it('should save vote as negative', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(false);
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

          it('should save each individual vote', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(true);
          });

          it('should revert needing Lossless Team to vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
            ).to.be.revertedWith('LSS: Need anothe vote to untie');
          });
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

          it('should save vote as positive', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(true);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(true);
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
            await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
            await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
            await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
            await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
            await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, false);
          });

          it('should save vote as negative', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(false);
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

          it('should save each individual vote', async () => {
            expect(
              await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
            ).to.be.equal(false);

            expect(
              await env.lssGovernance.getVote(1, env.committeeVoteIndex),
            ).to.be.equal(true);
          });

          it('should revert needing Lossless Team to vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
            ).to.be.revertedWith('LSS: Need anothe vote to untie');
          });
        });
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

      it('should save vote as positive', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
        ).to.be.equal(true);
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

      it('should save vote as positive', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
        ).to.be.equal(true);
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

      it('should save vote as positive', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.committeeVoteIndex),
        ).to.be.equal(true);
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

      it('should save committee resolution as positive', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.committeeVoteIndex),
        ).to.be.equal(true);
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
      it('should save committee resolution as negative', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.committeeVoteIndex),
        ).to.be.equal(false);
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

      it('should save all vote as positive', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.committeeVoteIndex),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
        ).to.be.equal(true);
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

      describe('when proposing a refund wallet on report close', () => {
        beforeEach(async () => {
          await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.minutes(1)),
          ]);
        });

        it('should accept a proposed wallet by Lossless Team', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
          ).to.not.be.reverted;
        });

        it('should accept a proposed wallet by Token Owner', async () => {
          await expect(
            env.lssGovernance.connect(adr.lerc20Admin).proposeWallet(1, adr.regularUser5.address),
          ).to.not.be.reverted;
        });

        it('should revert if proposed by other than LssTeam or TokenOwner', async () => {
          await expect(
            env.lssGovernance.connect(adr.regularUser5).proposeWallet(1, adr.regularUser5.address),
          ).to.be.revertedWith('LSS: Role cannot propose.');
        });

        it('should revert when trying to propose another', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
          ).to.not.be.reverted;

          await expect(
            env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
          ).to.be.revertedWith('LSS: Wallet already proposed.');
        });

        describe('when retrieving funds to proposed wallet', () => {
          it('should transfer funds', async () => {
            await env.lssGovernance.connect(adr.lssAdmin)
              .proposeWallet(1, adr.regularUser5.address);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.days(8)),
            ]);

            await expect(
              env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
            ).to.not.be.reverted;
          });
        });
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

      it('should save vote as negative', async () => {
        expect(
          await env.lssGovernance.getVote(1, env.committeeVoteIndex),
        ).to.be.equal(false);

        expect(
          await env.lssGovernance.getVote(1, env.tokenOwnersVoteIndex),
        ).to.be.equal(false);

        expect(
          await env.lssGovernance.getVote(1, env.lssTeamVoteIndex),
        ).to.be.equal(false);
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

      it('should let reported address retrieve compensation', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker1.address, env.stakeAmount + env.stakeAmount);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker2.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker3.address, env.stakeAmount * 2);

        await env.lssToken.connect(adr.staker1)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker2)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker3)
          .approve(env.lssStaking.address, env.stakeAmount * 2);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);
        await env.lssStaking.connect(adr.staker2).stake(1);
        await env.lssStaking.connect(adr.staker3).stake(1);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        expect(
          await env.lssGovernance.isReportSolved(1),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.reportResolution(1),
        ).to.be.equal(false);

        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).retrieveCompensation(),
        ).to.not.be.reverted;

        const compensationPercentage = await env.lssController.getCompensationPercentage();

        expect(
          await env.lssToken.balanceOf(adr.maliciousActor1.address),
        ).to.be.equal(env.stakeAmount * compensationPercentage / 100);
      });

      it('should revert if tries to retrieve twice', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker1.address, env.stakeAmount + env.stakeAmount);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker2.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker3.address, env.stakeAmount * 2);

        await env.lssToken.connect(adr.staker1)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker2)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker3)
          .approve(env.lssStaking.address, env.stakeAmount * 2);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);
        await env.lssStaking.connect(adr.staker2).stake(1);
        await env.lssStaking.connect(adr.staker3).stake(1);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        expect(
          await env.lssGovernance.isReportSolved(1),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.reportResolution(1),
        ).to.be.equal(false);

        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).retrieveCompensation(),
        ).to.not.be.reverted;

        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).retrieveCompensation(),
        ).to.be.revertedWith('LSS: Already retrieved');
      });

      it('should revert if other than the afflicted tries to retrieve', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker1.address, env.stakeAmount + env.stakeAmount);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker2.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.lssInitialHolder)
          .transfer(adr.staker3.address, env.stakeAmount * 2);

        await env.lssToken.connect(adr.staker1)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker2)
          .approve(env.lssStaking.address, env.stakeAmount * 2);
        await env.lssToken.connect(adr.staker3)
          .approve(env.lssStaking.address, env.stakeAmount * 2);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);
        await env.lssStaking.connect(adr.staker2).stake(1);
        await env.lssStaking.connect(adr.staker3).stake(1);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        expect(
          await env.lssGovernance.isReportSolved(1),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.reportResolution(1),
        ).to.be.equal(false);

        await expect(
          env.lssGovernance.connect(adr.regularUser1).retrieveCompensation(),
        ).to.be.revertedWith('LSS: No retribution assigned');
      });
    });
  });
});
