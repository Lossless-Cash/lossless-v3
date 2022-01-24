module.exports = {
  deepSkip: true,
  skipFiles: [
    './utils/LERC20.sol', './utils/LosslessControllerV1.sol', './vault-protection/LosslessControllerV2.sol',
    'vault-protection/LiquidityProtectionMultipleLimitsStrategy.sol', 'vault-protection/LiquidityProtectionSingleLimitStrategy.sol',
    'vault-protection/LosslessGuardian.sol', 'vault-protection/StrategyBase.sol', 'vault-protection/TreasuryProtectionStrategy.sol',
    'utils/Context.sol', 'utils/mockTransfer.sol',
  ]
}