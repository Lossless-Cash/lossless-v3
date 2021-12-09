/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

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
    });

    describe('when the Lossless Controller contract has been set up', () => {
      it('should set the report Lossless Token address correctly', async () => {
        expect(
          await env.lssController.stakingToken(),
        ).to.be.equal(env.lssToken.address);
      });

      it('should set the report Lossless Staking address correctly', async () => {
        expect(
          await env.lssController.losslessStaking(),
        ).to.be.equal(env.lssStaking.address);
      });

      it('should set the report Lossless Reporting address correctly', async () => {
        expect(
          await env.lssController.losslessReporting(),
        ).to.be.equal(env.lssReporting.address);
      });

      it('should set the report Lossless Governance address correctly', async () => {
        expect(
          await env.lssController.losslessGovernance(),
        ).to.be.equal(env.lssGovernance.address);
      });
    });

    describe('when the Lossless Staking Contract has been set up', () => {
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

      it('should set the Lossless fee correctly', async () => {
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
