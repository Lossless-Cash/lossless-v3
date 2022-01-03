/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable global-require */
async function main() {
  const { time } = require('@openzeppelin/test-helpers');
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const ADMIN_ADDRESS = '0x06F2075587fa961E4Bf7e9c01c5c8EFf69C52837';

  console.log('Deploying controllerV1...');

  const LosslessControllerV1 = await ethers.getContractFactory(
    'LosslessControllerV1',
  );

  const controllerV1 = await upgrades.deployProxy(LosslessControllerV1, [
    ADMIN_ADDRESS,
    ADMIN_ADDRESS,
    ADMIN_ADDRESS,
  ]);

  await controllerV1.deployed();

  console.log('Deploying controllerV2...');

  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );

  const controllerV2 = await upgrades.upgradeProxy(
    controllerV1.address,
    LosslessControllerV2,
  );

  console.log('Deploying controllerV3...');

  const LosslessControllerV3 = await ethers.getContractFactory(
    'LosslessControllerV3',
  );

  const controllerV3 = await upgrades.upgradeProxy(
    controllerV2.address,
    LosslessControllerV3,
  );

  // console.log('Transfering Admin to Proxy...');
  //
  // await upgrades.admin.transferProxyAdminOwnership(
  //  ADMIN_ADDRESS,
  // );
  //
  // console.log('transfered!');

  console.log('Deploying Staking Token...');

  const StakingToken = await ethers.getContractFactory('LERC20');

  const lssToken = await StakingToken.deploy(
    1000000,
    'Lossless',
    'LSS',
    ADMIN_ADDRESS,
    ADMIN_ADDRESS,
    Number(time.duration.days(1)),
    controllerV3.address,
  );

  console.log('Deploying Reporting Contract...');

  const LosslessReporting = await ethers.getContractFactory(
    'LosslessReporting',
  );

  const lssReporting = await upgrades.deployProxy(
    LosslessReporting,
    [controllerV3.address],
    { initializer: 'initialize' },
  );

  console.log('Deploying Staking Contract...');

  const LosslessStaking = await ethers.getContractFactory('LosslessStaking');

  const lssStaking = await upgrades.deployProxy(
    LosslessStaking,
    [lssReporting.address, controllerV3.address],
    { initializer: 'initialize' },
  );

  console.log('Deploying Governance Contract...');

  const LosslessGovernance = await ethers.getContractFactory(
    'LosslessGovernance',
  );

  const lssGovernance = await upgrades.deployProxy(
    LosslessGovernance,
    [
      lssReporting.address,
      controllerV3.address,
      lssStaking.address,
    ],
    { initializer: 'initialize' },
  );
  
  console.log('Setting up Lossless ControllerV3...');

  console.log('   Setting Staking Contract address...');
  await controllerV3.setStakingContractAddress(lssStaking.address);
  console.log('   Setting Reporting Contract address...');
  await controllerV3.setReportingContractAddress(lssReporting.address);
  console.log('   Setting Governance Contract address...');
  await controllerV3.setGovernanceContractAddress(lssGovernance.address);
  console.log('   Setting whitelist...');
  await controllerV3.setWhitelist([
    lssReporting.address,
    lssGovernance.address,
    lssStaking.address,
    ADMIN_ADDRESS],
  true);

  console.log('   Setting Dex Transfer Threshold...');
  await controllerV3.setDexTrasnferThreshold(20);
  console.log('   Setting Compensation amount...');
  await controllerV3.setCompensationAmount(2);
  console.log('   Setting Settlement Timelock...');
  await controllerV3.setSettlementTimeLock(12 * 3600);
  console.log('   Setting Liftup expiration...');
  await controllerV3.setLocksLiftUpExpiration(300);

  console.log('Setting up Lossless Staking...');

  console.log('   Setting Staking amount...');
  await lssStaking.setStakingAmount(stakingAmount);
  console.log('   Setting Staking token...');
  await lssStaking.setStakingToken(lssToken.address);
  console.log('   Setting Governance contract address...');
  await lssStaking.setLosslessGovernance(lssGovernance.address);

  console.log('Setting up Lossless Reporting...');

  console.log('   Setting Report lifetime...');
  await lssReporting.setReportLifetime(Number(reportLifetime));

  console.log('   Setting Reporting amount...');
  await lssReporting.setReportingAmount(reportingAmount);

  console.log('   Setting Staking token...');
  await lssReporting.setStakingToken(lssToken.address);
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

  console.log('All done!');

  /// Verify contracts
  console.log('Waiting 5 minutes to verify contracts...');
  await delay(5 * 60 * 1000);

  console.log('Verifiying controllerV2...');
  await hre.run('verify:verify', {
    address: controllerV2.address,
    constructorArguments: [],
  });

  console.log('Verifiying controllerV3...');
  await hre.run('verify:verify', {
    address: controllerV3.address,
    constructorArguments: [],
  });

  console.log('Verifiying lssToken...');
  await hre.run('verify:verify', {
    address: lssToken.address,
    constructorArguments: [1000000,
      'Lossless',
      'LSS',
      ADMIN_ADDRESS,
      ADMIN_ADDRESS,
      Number(time.duration.days(1)),
      controllerV3.address],
  });

  console.log('Verifiying Lossless Reporting...');
  await hre.run('verify:verify', {
    address: lssReporting.address,
    constructorArguments: [controllerV3.address],
  });

  console.log('Verifiying Lossless Staking...');
  await hre.run('verify:verify', {
    address: lssStaking.address,
    constructorArguments: [lssReporting.address, controllerV3.address],
  });

  console.log('Verifiying Lossless Governance...');
  await hre.run('verify:verify', {
    address: lssGovernance.address,
    constructorArguments: [lssReporting.address,
      controllerV3.address,
      lssStaking.address],
  });

  console.log('ControllerV1:           %s', controllerV1.address);
  console.log('ControllerV2:           %s', controllerV2.address);
  console.log('ControllerV3:           %s', controllerV3.address);
  console.log('Staking Token:          %s', lssToken.address);
  console.log('Lossless Reporting:     %s', lssReporting.address);
  console.log('Lossless Staking:       %s', lssStaking.address);
  console.log('Lossless Governance:    %s', lssGovernance.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
