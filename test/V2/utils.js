/* eslint-disable arrow-body-style */
/* eslint-disable no-await-in-loop */
const { time } = require('@openzeppelin/test-helpers');

const tokens = [
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
  {
    name: 'My Token',
    symbol: 'MTKN',
    initialSupply: 1000000,
  },
];

const setupControllerAndTokens = async () => {
  const [
    initialHolder,
    anotherAccount,
    admin,
    lssAdmin,
    lssRecoveryAdmin,
    pauseAdmin,
    adminBackup,
    guardianAdmin,
    oneMoreAccount,
    recipient,
  ] = await ethers.getSigners();

  const LosslessController = await ethers.getContractFactory(
    'LosslessControllerV1',
  );

  const LosslessControllerV2 = await ethers.getContractFactory(
    'LosslessControllerV2',
  );

  const LosslessControllerV3 = await ethers.getContractFactory(
    'LosslessControllerV3',
  );

  const losslessControllerV1 = await upgrades.deployProxy(LosslessController, [
    lssAdmin.address,
    lssRecoveryAdmin.address,
    pauseAdmin.address,
  ]);

  const losslessControllerV2 = await upgrades.upgradeProxy(
    losslessControllerV1.address,
    LosslessControllerV2,
  );

  const losslessController = await upgrades.upgradeProxy(
    losslessControllerV2.address,
    LosslessControllerV3,
  );

  const LERC20 = await ethers.getContractFactory('LERC20');
  const erc20s = await Promise.all(
    tokens.map(async (token) => {
      return LERC20.connect(initialHolder).deploy(
        token.initialSupply,
        token.name,
        token.symbol,
        admin.address,
        adminBackup.address,
        Number(time.duration.days(1)),
        losslessController.address,
      );
    }),
  );

  return {
    guardianAdmin,
    initialHolder,
    anotherAccount,
    admin,
    lssAdmin,
    lssRecoveryAdmin,
    pauseAdmin,
    adminBackup,
    erc20s,
    losslessController,
    oneMoreAccount,
    recipient,
  };
};

const deployProtection = async (losslessController) => {
  const LosslessGuardian = await ethers.getContractFactory('LosslessGuardian');
  const guardian = await LosslessGuardian.deploy(losslessController.address);

  const LiquidityProtectionMultipleLimitsStrategy = await ethers.getContractFactory(
    'LiquidityProtectionMultipleLimitsStrategy',
  );

  const liquidityProtectionMultipleLimitsStrategy = await LiquidityProtectionMultipleLimitsStrategy.deploy(
    guardian.address,
    losslessController.address,
  );

  const LiquidityProtectionSingleLimitStrategy = await ethers.getContractFactory(
    'LiquidityProtectionSingleLimitStrategy',
  );
  const liquidityProtectionSingleLimitStrategy = await LiquidityProtectionSingleLimitStrategy.deploy(
    guardian.address,
    losslessController.address,
  );

  const TreasuryProtectionStrategy = await ethers.getContractFactory(
    'TreasuryProtectionStrategy',
  );
  const treasuryProtectionStrategy = await TreasuryProtectionStrategy.deploy(
    guardian.address,
    losslessController.address,
  );

  return {
    guardian,
    liquidityProtectionMultipleLimitsStrategy,
    treasuryProtectionStrategy,
    liquidityProtectionSingleLimitStrategy,
  };
};

async function mineBlocks(count) {
  for (let i = 0; i < count; i += 1) {
    await ethers.provider.send('evm_mine');
  }
}

module.exports = {
  setupControllerAndTokens,
  deployProtection,
  tokens,
  mineBlocks,
};