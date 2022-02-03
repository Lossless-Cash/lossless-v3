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

const reportedAmount = 1000000;
const committeeReward = 0.02;

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
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, reportedAmount);

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
  });

  describe('when members claim their rewards', () => {
    describe('when the report is still open', () => {
      it('should revert when member claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.be.revertedWith('LSS: Report solved negatively');
      });
    });

    describe('when resolved negatively', () => {
      beforeEach(async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, false);
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, false);
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, false);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, false);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, false);
        await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(1)),
        ]);
      });
      it('should revert when member claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.be.revertedWith('LSS: Report solved negatively');
      });
    });

    describe('when resolved positively', () => {
      beforeEach(async () => {
        await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
        await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
        await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
        await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

        await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(1)),
        ]);
      });
      it('should revert if member didnt vote', async () => {
        await expect(
          env.lssGovernance.connect(adr.member5).claimCommitteeReward(1),
        ).to.be.revertedWith('LSS: Did not vote on report');
      });

      it('should revert if its not a committee member', async () => {
        await expect(
          env.lssGovernance.connect(adr.regularUser1).claimCommitteeReward(1),
        ).to.be.revertedWith('LSS: Did not vote on report');
      });

      it('should not revert when member 1 claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.not.be.reverted;

        expect(
          await lerc20Token.balanceOf(adr.member1.address),
        ).to.be.equal((reportedAmount * committeeReward) / 4);
      });

      it('should emit event when member claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.emit(env.lssGovernance, 'CommitteeMemberClaim').withArgs(
          1,
          adr.member1.address,
          (reportedAmount * committeeReward) / 4,
        );
      });

      it('should revert when member 1 claims two times', async () => {
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.not.be.reverted;
        await expect(
          env.lssGovernance.connect(adr.member1).claimCommitteeReward(1),
        ).to.be.revertedWith('LSS: Already claimed');
      });

      it('should not revert when member 2 claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member2).claimCommitteeReward(1),
        ).to.not.be.reverted;

        expect(
          await lerc20Token.balanceOf(adr.member2.address),
        ).to.be.equal((reportedAmount * committeeReward) / 4);
      });
      it('should not revert when member 3 claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member3).claimCommitteeReward(1),
        ).to.not.be.reverted;

        expect(
          await lerc20Token.balanceOf(adr.member3.address),
        ).to.be.equal((reportedAmount * committeeReward) / 4);
      });
      it('should not revert when member 4 claims', async () => {
        await expect(
          env.lssGovernance.connect(adr.member4).claimCommitteeReward(1),
        ).to.not.be.reverted;

        expect(
          await lerc20Token.balanceOf(adr.member4.address),
        ).to.be.equal((reportedAmount * committeeReward) / 4);
      });
    });
  });
});
