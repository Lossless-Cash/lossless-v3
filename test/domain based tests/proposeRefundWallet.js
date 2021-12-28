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

    await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
      adr.member1.address,
      adr.member2.address,
      adr.member3.address,
      adr.member4.address,
      adr.member5.address]);
  });

  describe('when proposing a refund wallet on report close', () => {
    describe('when the report resolved negatively', () => {
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

      it('should revert', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.regularUser5.address),
        ).to.be.revertedWith('LSS: Report solved negatively');
      });
    });
    describe('when the report resolved positively', () => {
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

      it('should revert if wallet is zero address', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).proposeWallet(1, adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Wallet cannot ber zero adr');
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
});
