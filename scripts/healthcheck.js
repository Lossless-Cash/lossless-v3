/* eslint-disable no-console */
/* eslint-disable no-undef */

const { ethers } = require('hardhat');

const CONTROLLER_PROXY = ethers.utils.getAddress(
  '0xea60391a25b6bb9f0b7d07f68068bcf7c0741ccc',
);
const GOVERNANCE_PROXY = ethers.utils.getAddress(
  '0x56d908c713c5387e9dda216da1b83855ce03d4ca',
);
const STAKING_PROXY = ethers.utils.getAddress(
  '0xa72388FbB41B7f9035F6D82832088e75946e2c01',
);
const REPORTING_PROXY = ethers.utils.getAddress(
  '0x17970FE5613C322917F9Ac9d62D3AF2D97cA8CaA',
);

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

  console.log('Governance Contract');
  console.log(
    '   Compensation amount:',
    await lssGovernance.compensationPercentage(),
  );

  console.log('Lossless Staking:');

  console.log('   Staking token address:', await lssStaking.stakingToken());

  console.log(
    '   Governance contract address:',
    await lssStaking.losslessGovernance(),
  );

  console.log('Lossless Reporting:');

  console.log('   Report lifetime:', await lssReporting.reportLifetime());

  console.log('   Reporting amount:', await lssReporting.reportingAmount());

  console.log('   Staking token:', await lssReporting.stakingToken());

  console.log(
    '   Governance contract address:',
    await lssReporting.losslessGovernance(),
  );

  console.log(
    '   Reporter Reward percentage:',
    await lssReporting.reporterReward(),
  );
  console.log(
    '   Lossless Reward percentage:',
    await lssReporting.losslessReward(),
  );
  console.log(
    '   Staker Reward percentage:',
    await lssReporting.stakersReward(),
  );
  console.log(
    '   Committee Reward percentage:',
    await lssReporting.committeeReward(),
  );

  console.log('ControllerV3:');

  const controllerStakingContract = await controllerV3.losslessStaking();
  console.log(
    '   Lossless Staking Contract address:',
    controllerStakingContract,
  );
  console.log(
    '   Lossless Reporting Contract address:',
    await controllerV3.losslessReporting(),
  );
  console.log(
    '   Lossless Governance Contract address:',
    await controllerV3.losslessGovernance(),
  );
  console.log('   Lossless whitelist:', await controllerV3.whitelist());

  console.log(
    '   Settlement Timelock: ',
    await controllerV3.settlementTimeLock(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
