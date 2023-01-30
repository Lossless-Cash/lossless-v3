/* eslint-disable no-console */
/* eslint-disable no-undef */

const { ethers } = require('hardhat');

const CONTROLLER_PROXY = '0x6bBbEAe8d07A521b0Ed61B279132a93F3Cb64e04';
const GOVERNANCE_PROXY = '0x6bBbEAe8d07A521b0Ed61B279132a93F3Cb64e04';
const STAKING_PROXY = '0x6bBbEAe8d07A521b0Ed61B279132a93F3Cb64e04';
const REPORTING_PROXY = '0x6bBbEAe8d07A521b0Ed61B279132a93F3Cb64e04';

/* eslint-disable global-require */
async function main() {
  const ControllerProxy = await ethers.getContractFactory(
    'LosslessControllerV3',
  );
  const controllerV3 = await ControllerProxy.attach(CONTROLLER_PROXY);

  const GovernanceProxy = await ethers.getContractFactory('LosslessGovernance');
  const lssGovernance = await GovernanceProxy.attach(GOVERNANCE_PROXY);

  const StakingProxy = await ethers.getContractFactory('LosslessStaking');
  const lssStaking = await StakingProxy.attach(STAKING_PROXY);

  const ReportingProxy = await ethers.getContractFactory('LosslessReporting');
  const lssReporting = await ReportingProxy.attach(REPORTING_PROXY);

  console.log('   Setting Compensation amount...');
  await lssGovernance.setCompensationAmount(2);
  console.log('   Setting Settlement Timelock...');
  await controllerV3.setSettlementTimeLock(12 * 3600);

  console.log('Setting up Lossless Staking...');

  console.log('   Setting Staking token...');
  await lssStaking.setStakingToken(
    '0x7df4d2a96823f5907dec3b07a2f23eca055de9a3',
  );
  console.log('   Setting Governance contract address...');
  await lssStaking.setLosslessGovernance(lssGovernance.address);

  console.log('Setting up Lossless Reporting...');

  console.log('   Setting Report lifetime...');
  await lssReporting.setReportLifetime(24 * 60);

  console.log('   Setting Reporting amount...');
  await lssReporting.setReportingAmount(100);

  console.log('   Setting Staking token...');
  await lssReporting.setStakingToken(
    '0x7df4d2a96823f5907dec3b07a2f23eca055de9a3',
  );
  console.log('   Setting Governance contract address...');
  await lssReporting.setLosslessGovernance(lssGovernance.address);

  console.log('   Setting Reporter Reward percentage...');
  await lssReporting.setReporterReward(2);
  console.log('   Setting Lossless Reward percentage...');
  await lssReporting.setLosslessReward(10);
  console.log('   Setting Staker Reward percentage...');
  await lssReporting.setStakersReward(2);
  console.log('   Setting Committee Reward percentage...');
  await lssReporting.setCommitteeReward(2);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
