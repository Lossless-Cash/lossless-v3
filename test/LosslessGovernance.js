const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { duration } = require('@openzeppelin/test-helpers/src/time');

let initialHolder;
let recipient;
let anotherAccount;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let oneMoreAccount;
let pauseAdmin;
let deployer;
let controller;
let losslessControllerV1;
let token;
let dex;
let governance;

const name = 'My Token';
const symbol = 'MTKN';

const supply = 100;
const initialBalance = 100;
const totalSupply = supply + initialBalance;

const { ZERO_ADDRESS } = constants;

const initialSupply = 100;

describe('Lossless Governance', () => {
  beforeEach(async () => {
    [
      deployer,
      initialHolder,
      recipient,
      anotherAccount,
      admin,
      lssAdmin,
      lssRecoveryAdmin,
      oneMoreAccount,
      pauseAdmin,
      adminBackup,
      dex,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    const LosslessControllerV2 = await ethers.getContractFactory(
      'LosslessControllerV2',
    );

    losslessControllerV1 = await upgrades.deployProxy(
      LosslessController,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
      { initializer: 'initialize' },
    );

    controller = await upgrades.upgradeProxy(
      losslessControllerV1.address,
      LosslessControllerV2,
      { initializer: 'initialize' },
    );

    const LosslessGovernance = await ethers.getContractFactory(
      'LosslessGovernance',
    );

    governance = await LosslessGovernance.deploy(controller.address);

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    token = await LERC20Mock.deploy(
      0,
      name,
      symbol,
      initialHolder.address,
      initialSupply,
      controller.address,
      admin.address,
      adminBackup.address,
      Number(time.duration.days(1)),
    );
  });

  describe('contructor', () => {
    it('should set lossless controller correctly', async () => {
      expect(await governance.controller()).to.be.equal(controller.address);
    });
  });

  describe.skip('setProjectOwners', () => {});
});
