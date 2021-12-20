/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('Lossless Environment', () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment(adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin);
  });

  describe('On deployment', () => {
    describe('when setting up Lossless Reporting Contract', () => {
      it('should set reporting amount correctly and emit the event', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReportingAmount(env.reportingAmount),
        ).to.emit(env.lssReporting, 'ReportingAmountChanged')
          .withArgs(
            env.reportingAmount,
          );
      });

      it('should not revert when setting the rewards', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setLosslessReward(50),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setStakersReward(45),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setCommitteeReward(1),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReporterReward(4),
        ).to.not.be.reverted;
      });

      it('should get the rewards correctly', async () => {
        let rewards = [50, 45, 1, 4];

        await expect(
          env.lssReporting.connect(adr.lssAdmin).setLosslessReward(50),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setStakersReward(45),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setCommitteeReward(1),
        ).to.not.be.reverted;
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReporterReward(4),
        ).to.not.be.reverted;
        await expect(
          rewards = env.lssReporting.getRewards(),
        ).to.be.equal(rewards);
      });
    });

    describe('when setting up Lossless Staking Contract', () => {
      describe('when setting up the Lossless Reporting address', () => {
        it('should revert when not admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).setLssReporting(env.lssReporting.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting up as zero address', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLssReporting(ZERO_ADDRESS),
          ).to.be.revertedWith('LERC20: Cannot be zero address');
        });

        it('should not revert when admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLssReporting(env.lssReporting.address),
          ).to.not.be.reverted;
        });
      });

      describe('when setting up the Lossless Governance address', () => {
        it('should revert when not admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).setLosslessGovernance(env.lssGovernance.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting up as zero address', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLosslessGovernance(ZERO_ADDRESS),
          ).to.be.revertedWith('LERC20: Cannot be zero address');
        });

        it('should not revert when admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLosslessGovernance(env.lssGovernance.address),
          ).to.not.be.reverted;
        });
      });

      describe('when setting up the Staking token', () => {
        it('should revert when not admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).setStakingToken(env.lssToken.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting up as zero address', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setStakingToken(ZERO_ADDRESS),
          ).to.be.revertedWith('LERC20: Cannot be zero address');
        });

        it('should not revert when not admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setStakingToken(env.lssToken.address),
          ).to.not.be.reverted;
        });
      });
    });

    describe('when setting up Lossless Controller Contract', () => {
      it('should revert when setting Staking contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setStakingContractAddress(ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });

      it('should revert when setting Report contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setReportingContractAddress(ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });

      it('should revert when setting Governance contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setGovernanceContractAddress(ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });
    });

    describe('when the Lossless Controller contract has been set up', () => {
      it('should get version', async () => {
        expect(
          await env.lssController.getVersion(),
        ).to.be.equal(3);
      });

      it('should set the Lossless Staking address correctly', async () => {
        expect(
          await env.lssController.losslessStaking(),
        ).to.be.equal(env.lssStaking.address);
      });

      it('should set the Lossless Reporting address correctly', async () => {
        expect(
          await env.lssController.losslessReporting(),
        ).to.be.equal(env.lssReporting.address);
      });

      it('should set the Lossless Governance address correctly', async () => {
        expect(
          await env.lssController.losslessGovernance(),
        ).to.be.equal(env.lssGovernance.address);
      });
    });

    describe('when the Lossless Staking Contract has been set up', () => {
      it('should get version', async () => {
        expect(
          await env.lssStaking.getVersion(),
        ).to.be.equal(1);
      });

      it('should set the report Lossless Token address correctly', async () => {
        expect(
          await env.lssStaking.stakingToken(),
        ).to.be.equal(env.lssToken.address);
      });

      it('should set the stake amount correctly', async () => {
        expect(
          await env.lssStaking.stakingAmount(),
        ).to.be.equal(env.stakingAmount);
      });

      it('should set the Governance contract correctly', async () => {
        expect(
          await env.lssStaking.losslessGovernance(),
        ).to.be.equal(env.lssGovernance.address);
      });
    });

    describe('when the Lossless Reporting Contract has been set up', () => {
      it('should get version', async () => {
        expect(
          await env.lssReporting.getVersion(),
        ).to.be.equal(1);
      });

      it('should set the reporting amount correctly', async () => {
        expect(
          await env.lssReporting.reportingAmount(),
        ).to.be.equal(env.reportingAmount);
      });

      it('should set the report lifetime correctly', async () => {
        expect(
          await env.lssReporting.reportLifetime(),
        ).to.be.equal(Number(env.reportLifetime));
      });

      it('should set the report Lossless Token address correctly', async () => {
        expect(
          await env.lssReporting.stakingToken(),
        ).to.be.equal(env.lssToken.address);
      });

      it('should set the report Lossless Staking address correctly', async () => {
        expect(
          await env.lssReporting.losslessController(),
        ).to.be.equal(env.lssController.address);
      });

      it('should set the reporter reward correctly', async () => {
        expect(
          await env.lssReporting.reporterReward(),
        ).to.be.equal(2);
      });

      it('should set the Lossless reward correctly', async () => {
        expect(
          await env.lssReporting.losslessReward(),
        ).to.be.equal(10);
      });

      it('should set the Governance contract correctly', async () => {
        expect(
          await env.lssReporting.losslessGovernance(),
        ).to.be.equal(env.lssGovernance.address);
      });

      it('should set reporter reward correctly', async () => {
        expect(
          await env.lssReporting.reporterReward(),
        ).to.be.equal(2);
      });

      it('should set lossless reward correctly', async () => {
        expect(
          await env.lssReporting.losslessReward(),
        ).to.be.equal(10);
      });

      it('should set staker reward correctly', async () => {
        expect(
          await env.lssReporting.stakersReward(),
        ).to.be.equal(2);
      });

      it('should set committee reward correctly', async () => {
        expect(
          await env.lssReporting.committeeReward(),
        ).to.be.equal(2);
      });
    });

    describe('when the Lossless Governance Contract has been set up', () => {
      it('should get version', async () => {
        expect(
          await env.lssGovernance.getVersion(),
        ).to.be.equal(1);
      });

      it('should set the Reporting address correctly', async () => {
        expect(
          await env.lssGovernance.losslessReporting(),
        ).to.be.equal(env.lssReporting.address);
      });

      it('should set the Controller address correctly', async () => {
        expect(
          await env.lssGovernance.losslessController(),
        ).to.be.equal(env.lssController.address);
      });

      it('should set the Staking address correctly', async () => {
        expect(
          await env.lssGovernance.losslessStaking(),
        ).to.be.equal(env.lssStaking.address);
      });

      it('should set the staking token address correctly', async () => {
        expect(
          await env.lssGovernance.stakingToken(),
        ).to.be.equal(env.lssToken.address);
      });
    });
  });
});
