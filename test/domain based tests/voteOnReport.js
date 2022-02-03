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

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);
  });

  describe('when voting takes place', () => {
    beforeEach(async () => {
      await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
        adr.member1.address,
        adr.member2.address,
        adr.member3.address,
        adr.member4.address,
        adr.member5.address]);
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
        ).to.be.revertedWith('LSS: LSS already voted');
      });

      it('should revert when trying to resolve if no other party voted', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).resolveReport(1),
        ).to.be.revertedWith('LSS: Not enough votes');
      });

      it('should revert if report is not valid', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessVote(10, true),
        ).to.be.revertedWith('LSS: report is not valid');
      });

      it('should revert if report already closed', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true),
        ).to.be.revertedWith('LSS: Report already solved');
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

      it('should revert if report already closed', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await expect(
          env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: Report already solved');
      });

      it('should revert if report is not valid', async () => {
        await expect(
          env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(10, true),
        ).to.be.revertedWith('LSS: report is not valid');
      });
    });

    describe('when the Committee is voting', () => {
      it('should revert at a second attempt', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: Member already voted');
      });

      it('should revert if report is not valid', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).committeeMemberVote(10, true),
        ).to.be.revertedWith('LSS: report is not valid');
      });

      it('should emit event when majority has been reached', async () => {
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await expect(
          env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true),
        ).to.emit(env.lssGovernance, 'CommitteeMajorityReach').withArgs(
          1,
          true,
        );
      });
    });
  });

  describe('when non members try to vote', () => {
    describe('when impersonating the Lossless Team', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).losslessVote(1, true),
        ).to.be.revertedWith('LSS: Must be admin');
      });
    });
    describe('when impersonating the Token Owners', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: Must be token owner');
      });
    });
    describe('when impersonating a committee member', () => {
      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.maliciousActor1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: Must be a committee member');
      });
    });
    describe('when the report has alredy been solved', () => {
      it('should revert if report is already closed', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address]);

        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true),
        ).to.be.revertedWith('LSS: Report already solved');

        await expect(
          env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: Report already solved');

        await expect(
          env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: Report already solved');
      });
    });
  });
});
