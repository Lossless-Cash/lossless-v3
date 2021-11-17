/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('./utilsV3');

let adr;
let env;
let lerc20Token;

describe('Lossless Staking', () => {
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

    await env.lssController.connect(adr.lerc20Admin)
      .proposeNewSettlementPeriod(lerc20Token.address, 5 * 60);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.hours(13)),
    ]);

    await env.lssController.connect(adr.lerc20Admin)
      .executeNewSettlementPeriod(lerc20Token.address);

    await env.lssController.connect(adr.lerc20Admin).setTokenEvaluation(lerc20Token.address, true);
  });

  describe('when paused', () => {
    beforeEach(async () => {
      await env.lssStaking.connect(adr.lssPauseAdmin).pause();
    });

    it('should prevent staking', async () => {
      await expect(
        env.lssStaking.connect(adr.staker1).stake(1),
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should prevent staker claiming', async () => {
      await expect(
        env.lssStaking.connect(adr.staker1).stakerClaim(1),
      ).to.be.revertedWith('Pausable: paused');
    });
  });

  describe('when the staking period is active', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakeAmount);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker1.address, env.stakeAmount);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker2.address, env.stakeAmount);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker3.address, env.stakeAmount);

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker4.address, env.stakeAmount);

      await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakeAmount);
      await env.lssToken.connect(adr.staker1).approve(env.lssStaking.address, env.stakeAmount);
      await env.lssToken.connect(adr.staker2).approve(env.lssStaking.address, env.stakeAmount);
      await env.lssToken.connect(adr.staker3).approve(env.lssStaking.address, env.stakeAmount);
      await env.lssToken.connect(adr.staker4).approve(env.lssStaking.address, env.stakeAmount);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssReporting.connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);
    });

    describe('when staking successfully', () => {
      it('should not revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker1.address),
        ).to.be.equal(true);
      });
    });

    describe('when staking successfully with multiple addresses', () => {
      it('should not revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker1.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker2).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker2.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker3).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker3.address),
        ).to.be.equal(true);

        await env.lssStaking.connect(adr.staker4).stake(1);

        expect(
          await env.lssStaking.getIsAccountStaked(1, adr.staker4.address),
        ).to.be.equal(true);
      });
    });

    describe('when staking on a non existant report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.staker1).stake(5),
        ).to.be.revertedWith('LSS: report does not exists');
      });
    });

    describe('when staker has insufficient balance', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.staker5).stake(1),
        ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
      });
    });

    describe('when staking twice on the same report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await env.lssStaking.connect(adr.staker1).stake(1);

        await expect(
          env.lssStaking.connect(adr.staker1).stake(1),
        ).to.be.revertedWith('LSS: already staked');
      });
    });

    describe('when the reporter tries to stake on their report', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(10)),
        ]);

        await expect(
          env.lssStaking.connect(adr.reporter1).stake(1),
        ).to.be.revertedWith('LSS: reporter can not stake');
      });
    });
  });
  describe('when the staking period is inactive', () => {
    beforeEach(async () => {
      await env.lssController.connect(adr.lssAdmin).setWhitelist(
        [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
      );

      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.reporter1.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker1.address, env.stakeAmount + env.stakeAmount);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker2.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker3.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.lssInitialHolder)
        .transfer(adr.staker4.address, env.stakeAmount * 2);

      await env.lssToken.connect(adr.reporter1)
        .approve(env.lssReporting.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.staker1).approve(env.lssStaking.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.staker2).approve(env.lssStaking.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.staker3).approve(env.lssStaking.address, env.stakeAmount * 2);
      await env.lssToken.connect(adr.staker4).approve(env.lssStaking.address, env.stakeAmount * 2);

      await lerc20Token.connect(adr.lerc20InitialHolder)
        .transfer(adr.maliciousActor1.address, 1000);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssReporting.connect(adr.reporter1)
        .report(lerc20Token.address, adr.maliciousActor1.address);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);

      await env.lssStaking.connect(adr.staker1).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(45)),
      ]);

      await env.lssStaking.connect(adr.staker2).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(8)),
      ]);

      await env.lssStaking.connect(adr.staker3).stake(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.hours(10)),
      ]);

      await env.lssStaking.connect(adr.staker4).stake(1);

      await env.lssGovernance.connect(adr.lssAdmin)
        .addCommitteeMembers([adr.member1.address, adr.member2.address, adr.member3.address], 2);

      await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
      await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
      await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
      await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);

      await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

      await ethers.provider.send('evm_increaseTime', [
        Number(time.duration.minutes(5)),
      ]);
    });

    describe('when trying to stake', () => {
      it('should revert', async () => {
        await expect(
          env.lssStaking.connect(adr.staker1).stake(1),
        ).to.be.revertedWith('LSS: Report already resolved');
      });
    });

    describe('when claiming', () => {
      describe('when verifying reporter claimable amount by the reporter', () => {
        it('should return amount', async () => {
          expect(
            await env.lssStaking.connect(adr.reporter1).reporterClaimableAmount(1),
          ).to.not.be.empty;
        });
      });

      describe('when verifying staker claimable amount by a staker', () => {
        it('should return amount', async () => {
          expect(
            await env.lssStaking.connect(adr.staker1).stakerClaimableAmount(1),
          ).to.not.be.empty;
        });
      });

      describe('when stakers claims', () => {
        it('should not revert', async () => {
          let balance;
          expect(
            balance = await lerc20Token.balanceOf(adr.staker1.address),
          ).to.be.equal(0);

          expect(
            balance = await env.lssToken.balanceOf(adr.staker1.address),
          ).to.be.equal(2500);

          await env.lssStaking.connect(adr.staker1).stakerClaim(1);

          expect(
            await lerc20Token.balanceOf(adr.staker1.address),
          ).to.be.equal(0);

          expect(
            balance = await env.lssToken.balanceOf(adr.staker1.address),
          ).to.be.equal(env.stakeAmount * 2);
        });
      });

      describe('when stakers claims two times', () => {
        it('should revert', async () => {
          await env.lssStaking.connect(adr.staker1).stakerClaim(1);

          await expect(
            env.lssStaking.connect(adr.staker1).stakerClaim(1),
          ).to.be.revertedWith('LSS: You already claimed');
        });
      });

      describe('when all stakers claims', () => {
        it('should not revert', async () => {
          await expect(
            env.lssStaking.connect(adr.staker1).stakerClaim(1),
            env.lssStaking.connect(adr.staker2).stakerClaim(1),
            env.lssStaking.connect(adr.staker3).stakerClaim(1),
            env.lssStaking.connect(adr.staker4).stakerClaim(1),
          ).to.not.be.reverted;
        });
      });

      describe('when reporter claims', () => {
        it('should not revert', async () => {
          let balance;
          expect(
            balance = await lerc20Token.balanceOf(adr.reporter1.address),
          ).to.be.equal(0);

          expect(
            balance = await env.lssToken.balanceOf(adr.reporter1.address),
          ).to.be.equal(2500);

          await env.lssReporting.connect(adr.reporter1).reporterClaim(1);

          expect(
            await lerc20Token.balanceOf(adr.reporter1.address),
          ).to.be.equal(20);

          expect(
            balance = await env.lssToken.balanceOf(adr.reporter1.address),
          ).to.be.equal(env.stakeAmount * 2);
        });
      });

      describe('when reporter claims two times', () => {
        it('should revert', async () => {
          await env.lssReporting.connect(adr.reporter1).reporterClaim(1);

          await expect(
            env.lssReporting.connect(adr.reporter1).reporterClaim(1),
          ).to.be.revertedWith('LSS: You already claimed');
        });
      });
    });
  });
});
