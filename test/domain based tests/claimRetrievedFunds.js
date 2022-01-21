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
const losslessReward = 0.1;
const committeeReward = 0.02;
const reporterReward = 0.02;
const stakerReward = 0.02;

const toRetrieve = reportedAmount * (1 - (losslessReward + committeeReward + reporterReward + stakerReward));

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

    await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
      adr.member1.address,
      adr.member2.address,
      adr.member3.address,
      adr.member4.address,
      adr.member5.address]);

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, reportedAmount);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);

    await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
    await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
    await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

    await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);
  });

  describe('when retrieving funds to proposed wallet', () => {
    it('should transfer funds', async () => {
      await env.lssGovernance.connect(adr.lssAdmin)
        .proposeWallet(1, adr.regularUser5.address);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.days(25)),
      ]);

      await expect(
        env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
      ).to.not.be.reverted;

      expect(
        await lerc20Token.balanceOf(adr.regularUser5.address),
      ).to.be.equal(toRetrieve);
    });

    describe('when trying to retrieve two times', () => {
      it('should revert', async () => {
        await env.lssGovernance.connect(adr.lssAdmin)
          .proposeWallet(1, adr.regularUser5.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.days(8)),
        ]);

        await expect(
          env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
        ).to.not.be.reverted;

        await expect(
          env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
        ).to.be.revertedWith('LSS: Funds already claimed');
      });
    });

    describe('when non proposed wallet tries to claim', () => {
      it('should revert', async () => {
        await env.lssGovernance.connect(adr.lssAdmin)
          .proposeWallet(1, adr.regularUser5.address);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.days(8)),
        ]);

        await expect(
          env.lssGovernance.connect(adr.regularUser1).retrieveFunds(1),
        ).to.be.revertedWith('LSS: Only proposed adr can claim');
      });
    });
  });

  describe('when dispute period is not over', () => {
    it('should revert', async () => {
      await env.lssGovernance.connect(adr.lssAdmin)
        .proposeWallet(1, adr.regularUser5.address);

      await expect(
        env.lssGovernance.connect(adr.regularUser5).retrieveFunds(1),
      ).to.be.revertedWith('LSS: Dispute period not closed');
    });
  });

  describe('when the report does not exist', () => {
    it('should revert', async () => {
      await env.lssGovernance.connect(adr.lssAdmin)
        .proposeWallet(1, adr.regularUser5.address);

      await expect(
        env.lssGovernance.connect(adr.regularUser5).retrieveFunds(11),
      ).to.be.revertedWith('LSS: Report does not exist');
    });
  });
});
