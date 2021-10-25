/* eslint-disable arrow-body-style */
/* eslint-disable no-await-in-loop */
const { time, constants } = require('@openzeppelin/test-helpers');

const setupAddresses = async () => {
  const [
    lssInitialHolder,
    lssAdmin,
    lssPauseAdmin,
    lssRecoveryAdmin,
    lssBackupAdmin,
    staker1,
    staker2,
    staker3,
    staker4,
    staker5,
    member1,
    member2,
    member3,
    member4,
    member5,
    maliciousActor1,
    maliciousActor2,
    maliciousActor3,
    reporter1,
    reporter2,
  ] = await ethers.getSigners();

  const [
    lerc20InitialHolder,
    lerc20Admin,
    lerc20PauseAdmin,
    lerc20RecoveryAdmin,
    lerc20BackupAdmin,
    regularUser1,
    regularUser2,
    regularUser3,
    regularUser4,
    regularUser5,
  ] = await ethers.getSigners();

  return {
    lssInitialHolder,
    lssAdmin,
    lssPauseAdmin,
    lssRecoveryAdmin,
    lssBackupAdmin,
    staker1,
    staker2,
    staker3,
    staker4,
    staker5,
    member1,
    member2,
    member3,
    member4,
    member5,
    maliciousActor1,
    maliciousActor2,
    maliciousActor3,
    reporter1,
    reporter2,
    lerc20InitialHolder,
    lerc20Admin,
    lerc20PauseAdmin,
    lerc20RecoveryAdmin,
    lerc20BackupAdmin,
    regularUser1,
    regularUser2,
    regularUser3,
    regularUser4,
    regularUser5,
  };
};

const setupEnvironment = async (lssAdmin, lssRecoveryAdmin, lssPauseAdmin, lssInitialHolder, lssBackupAdmin) => {
    
    const lssTeamVoteIndex = 0;
    const tokenOwnersVoteIndex = 1;
    const committeeVoteIndex = 2;

    const stakeAmount = 2500;
    const reportLifetime = time.duration.days(1);

    //LosslessToken
    const lssName           = 'Lossless';
    const lssSymbol         = 'LSS';
    const lssInitialSupply  = 1000000;

    const LosslessControllerV1 = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    console.log("Loaded V1")
  
    const LosslessControllerV2 = await ethers.getContractFactory(
      'LosslessControllerV2',
    );

    console.log("Loaded V2")

    const LosslessControllerV3 = await ethers.getContractFactory(
      'LosslessControllerV3',
    );

    console.log("Loaded V3")
  
    const losslessControllerV1 = await upgrades.deployProxy(LosslessControllerV1, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      lssPauseAdmin.address,
    ]);

    console.log("Deployed V1")
  
    const losslessControllerV2 = await upgrades.upgradeProxy(
      losslessControllerV1.address,
      LosslessControllerV2,
    );

    console.log("Upgraded V2")

    const lssController = await upgrades.upgradeProxy(
      losslessControllerV2.address,
      LosslessControllerV3,
    );

    console.log("Upgraded V3")

    const LosslessStaking = await ethers.getContractFactory(
    'LosslessStaking',
    );

    console.log("Loaded Staking")

    const LosslessGovernance = await ethers.getContractFactory(
    'LosslessGovernance',
    );

    console.log("Loaded Governance")

    const LosslessReporting = await ethers.getContractFactory(
    'LosslessReporting',
    );

    console.log("Loaded Reporting")

    lssReporting = await upgrades.deployProxy(
    LosslessReporting,
    [lssController.address],
    { initializer: 'initialize' },
    );

    console.log("Deployed Reporting")

    lssGovernance = await upgrades.deployProxy(
    LosslessGovernance,
    [lssReporting.address, lssController.address],
    { initializer: 'initialize' },
    );

    console.log("Deployed Governance")

    lssStaking = await upgrades.deployProxy(
    LosslessStaking,
    [lssReporting.address, lssController.address, lssGovernance.address],
    { initializer: 'initialize' },
    );

    console.log("Deployed Staking")

    const LosslessToken = await ethers.getContractFactory('LERC20');

    lssToken = await LosslessToken.deploy(
    lssInitialSupply,
    lssName,
    lssSymbol,
    lssInitialHolder.address,
    lssAdmin.address,
    lssBackupAdmin.address,
    Number(time.duration.days(1)),
    lssController.address,
    );
    
    await lssController.connect(lssAdmin).setStakeAmount(stakeAmount);
    await lssController.connect(lssAdmin).setReportLifetime(Number(reportLifetime));
    await lssController.connect(lssAdmin).setLosslessToken(lssToken.address);
    await lssController.connect(lssAdmin).setStakingContractAddress(lssStaking.address);
    await lssController.connect(lssAdmin).setReportingContractAddress(lssReporting.address);
    await lssController.connect(lssAdmin).setGovernanceContractAddress(lssGovernance.address);
    await lssController.connect(lssAdmin).setControllerV3Defaults();

    await lssStaking.connect(lssAdmin).setLosslessToken(lssToken.address);

    await lssReporting.connect(lssAdmin).setLosslessToken(lssToken.address);
    await lssReporting.connect(lssAdmin).setControllerContractAddress(lssController.address);
    await lssReporting.connect(lssAdmin).setStakingContractAddress(lssStaking.address);
    await lssReporting.connect(lssAdmin).setReporterReward(2);
    await lssReporting.connect(lssAdmin).setLosslessFee(10);

  return {
    lssController,
    lssStaking,
    lssReporting,
    lssGovernance,
    lssTeamVoteIndex,
    tokenOwnersVoteIndex,
    committeeVoteIndex,
    stakeAmount,
    reportLifetime,
    lssToken,
  };
};

const setupToken = async (supply, name, symbol, initialHolder, admin, backupAdmin, lockPeriod, controller) => {

    const token = await ethers.getContractFactory('LERC20');

    let deployedToken = await token.deploy(
        supply,
        name,
        symbol,
        initialHolder,
        admin,
        backupAdmin,
        lockPeriod,
        controller,
        );

     return deployedToken;
};

module.exports = {
    setupAddresses,
    setupEnvironment,
    setupToken,
};