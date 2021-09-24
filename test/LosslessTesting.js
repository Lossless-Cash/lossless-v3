const { time, constants } = require('@openzeppelin/test-helpers');
const { expect, assert } = require('chai');

let member1;
let member2;
let member3;
let member4;
let member5;

let maliciousAddress1;
let maliciousAddress2;
let maliciousAddress3;

let reporter1;
let reporter2;

let staker1;
let staker2;
let staker3;
let staker4;
let staker5;

const stakeAmount = 2500;
const reportLifetime = time.duration.days(1);

const lssTeamVoteIndex = 0;
const projectTeamVoteIndex = 1;
const committeeVoteIndex = 2;

//LosslessToken

let lssInitialHolder;
let lssAdmin;
let lssPauseAdmin;
let lssRecoveryAdmin;
let lssBackupAdmin;

const lssName = 'Lossless';
const lssSymbol = 'LSS';
const lssSupply = 1000;
const lssInitialSupply = 1000000;

//LERC20 Token

let lerc20InitialHolder;
let lerc20Admin;
let lerc20PauseAdmin;
let lerc20RecoveryAdmin;
let lerc20BackupAdmin;

const lerc20Name = 'Random Token';
const lerc20Symbol = 'RAND';
const lerc20Supply = 2000;
const lerc20InitialSupply = 2000000;

const { ZERO_ADDRESS } = constants;


/*describe('Lossless Environment', () => {
    beforeEach(async () => {
      [
        member1,
        member2,
        member3,
        member4,
        member5,
        maliciousAddress1,
        maliciousAddress2,
        maliciousAddress3,
        reporter1,
        reporter2,
        staker1,
        staker2,
        staker3,
        staker4,
        staker5,
        lssInitialHolder,
        lssAdmin,
        lssPauseAdmin,
        lssRecoveryAdmin,
        lssBackupAdmin,
        lerc20InitialHolder,
        lerc20Admin,
        lerc20PauseAdmin,
        lerc20RecoveryAdmin,
        lerc20BackupAdmin,
      ] = await ethers.getSigners();
    });

    const LosslessController = await ethers.getContractFactory(
        'LosslessController',
      );
  
      const LosslessStaking = await ethers.getContractFactory(
        'LosslessStaking',
      );
  
      const LosslessGovernance = await ethers.getContractFactory(
        'LosslessGovernance',
      );
  
      const LosslessReporting = await ethers.getContractFactory(
        'LosslessReporting',
      );
  
      lssController = await upgrades.deployProxy(
        LosslessController,
        [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
        { initializer: 'initialize' },
      );
  
  
      lssReporting = await upgrades.deployProxy(
        LosslessReporting,
        [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
        { initializer: 'initialize' },
      );
  
      lssStaking = await upgrades.deployProxy(
        LosslessStaking,
        [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address, reporting.address, controller.address],
        { initializer: 'initialize' },
      );


});*/