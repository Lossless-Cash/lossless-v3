/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken } = require('../utils');

let adr;
let env;

const scriptName = path.basename(__filename, '.js');

describe(scriptName, () => {
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
          env.lssReporting.connect(adr.lssAdmin).setReportingAmount(env.reportingAmount + 1),
        ).to.emit(env.lssReporting, 'NewReportingAmount')
          .withArgs(
            env.reportingAmount + 1,
          );
      });

      it('should revert when setting the reporting to the same amount', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReportingAmount(env.reportingAmount),
        ).to.be.revertedWith('LSS: Already set to that amount');
      });

      it('should set the reportLifetime', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReportLifetime(5),
        ).to.emit(env.lssReporting, 'NewReportLifetime').withArgs(5);
      });

      it('should revert when setting the reportLifetime to the same amount', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReportLifetime(Number(env.reportLifetime)),
        ).to.be.revertedWith('LSS: Already set to that amount');
      });

      it('should not revert when setting the rewards', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setLosslessReward(50),
        ).to.emit(env.lssReporting, 'NewLosslessReward').withArgs(50);
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setStakersReward(45),
        ).to.emit(env.lssReporting, 'NewStakersReward').withArgs(45);
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setCommitteeReward(1),
        ).to.emit(env.lssReporting, 'NewCommitteeReward').withArgs(1);
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReporterReward(4),
        ).to.emit(env.lssReporting, 'NewReporterReward').withArgs(4);
      });

      it('should revert when setting the rewards to the same amount', async () => {
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setLosslessReward(10),
        ).to.be.revertedWith('LSS: Already set to that amount');
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setStakersReward(2),
        ).to.be.revertedWith('LSS: Already set to that amount');
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setCommitteeReward(2),
        ).to.be.revertedWith('LSS: Already set to that amount');
        await expect(
          env.lssReporting.connect(adr.lssAdmin).setReporterReward(2),
        ).to.be.revertedWith('LSS: Already set to that amount');
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

      describe('when pausing', () => {
        describe('when not pause admin', () => {
          it('should rever', async () => {
            await expect(
              env.lssReporting.connect(adr.regularUser1).pause(),
            ).to.be.revertedWith('LSS: Must be pauseAdmin');
          });
        });
        describe('when pause admin', () => {
          beforeEach(async () => {
            await env.lssReporting.connect(adr.lssPauseAdmin).pause();
          });

          it('should prevent reporting', async () => {
            await expect(
              env.lssReporting.connect(adr.reporter1)
                .report(env.lssToken.address, adr.maliciousActor1.address),
            ).to.be.revertedWith('Pausable: paused');
          });

          it('should prevent second report', async () => {
            await expect(
              env.lssReporting.connect(adr.reporter1)
                .secondReport(1, adr.maliciousActor2.address),
            ).to.be.revertedWith('Pausable: paused');
          });

          it('should prevent reporter claiming', async () => {
            await expect(
              env.lssReporting.connect(adr.reporter1)
                .reporterClaim(1),
            ).to.be.revertedWith('Pausable: paused');
          });
        });
      });

      describe('when unpausing', () => {
        beforeEach(async () => {
          await env.lssReporting.connect(adr.lssPauseAdmin).pause();
        });

        describe('when not pause admin', () => {
          it('should revert', async () => {
            await expect(
              env.lssReporting.connect(adr.regularUser1).unpause(),
            ).to.be.revertedWith('LSS: Must be pauseAdmin');
          });
        });
        describe('when pause admin', () => {
          beforeEach(async () => {
            await env.lssReporting.connect(adr.lssPauseAdmin).unpause();
          });

          it('should not prevent reporting', async () => {
            await env.lssToken.connect(adr.lssInitialHolder)
              .transfer(adr.reporter1.address, env.stakingAmount);
            await env.lssToken.connect(adr.lssInitialHolder)
              .transfer(adr.reporter2.address, env.stakingAmount);

            await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

            await expect(
              env.lssReporting.connect(adr.reporter1)
                .report(env.lssToken.address, adr.maliciousActor1.address),
            ).to.not.be.reverted;
          });

          it('should prevent staker claiming', async () => {
            await expect(
              env.lssReporting.connect(adr.reporter1)
                .secondReport(1, adr.maliciousActor2.address),
            ).to.be.revertedWith('LSS: report does not exists');
          });
        });
      });

      describe('when setting up the Staking token', () => {
        it('should revert when not admin', async () => {
          await expect(
            env.lssReporting.connect(adr.regularUser1).setStakingToken(env.lssToken.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting up as zero address', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setStakingToken(adr.ZERO_ADDRESS),
          ).to.be.revertedWith('LSS: Cannot be zero address');
        });

        it('should revert when setting the same address', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setStakingToken(env.lssToken.address),
          ).to.be.revertedWith('LSS: Cannot be same address');
        });

        it('should not revert when admin', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setStakingToken(adr.regularUser1.address),
          ).to.emit(env.lssReporting, 'NewStakingToken').withArgs(adr.regularUser1.address);
        });
      });

      describe('when setting up the Governance address', () => {
        it('should revert when non admin', async () => {
          await expect(
            env.lssReporting.connect(adr.regularUser1).setLosslessGovernance(adr.regularUser1.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting zero address', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setLosslessGovernance(adr.ZERO_ADDRESS),
          ).to.be.revertedWith('LSS: Cannot be zero address');
        });

        it('should revert when setting the same address', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setLosslessGovernance(env.lssGovernance.address),
          ).to.be.revertedWith('LSS: Cannot be same address');
        });

        it('should not revert and emit event', async () => {
          await expect(
            env.lssReporting.connect(adr.lssAdmin).setLosslessGovernance(adr.regularUser1.address),
          ).to.emit(env.lssReporting, 'NewGovernanceContract').withArgs(adr.regularUser1.address);
        });
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
            env.lssStaking.connect(adr.lssAdmin).setLssReporting(adr.ZERO_ADDRESS),
          ).to.be.revertedWith('LERC20: Cannot be zero address');
        });

        it('should not revert when admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLssReporting(env.lssReporting.address),
          ).to.not.be.reverted;
        });
      });

      describe('when setting up the Lossless Staking address', () => {
        it('should revert when not admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).setLosslessGovernance(env.lssGovernance.address),
          ).to.be.revertedWith('LSS: Must be admin');
        });

        it('should revert when setting up as zero address', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setLosslessGovernance(adr.ZERO_ADDRESS),
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
            env.lssStaking.connect(adr.lssAdmin).setStakingToken(adr.ZERO_ADDRESS),
          ).to.be.revertedWith('LERC20: Cannot be zero address');
        });

        it('should not revert when admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssAdmin).setStakingToken(adr.regularUser1.address),
          ).to.not.be.reverted;
        });
      });

      describe('when pausing', () => {
        it('should revert when called by other than admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).pause(),
          ).to.be.revertedWith('LSS: Must be pauseAdmin');
        });

        it('should not revert when called by pause admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssPauseAdmin).pause(),
          ).to.not.be.reverted;
        });

        describe('when paused', () => {
          beforeEach(async () => {
            await env.lssStaking.connect(adr.lssPauseAdmin).pause();
          });

          it('should revert when trying to stake', async () => {
            await expect(
              env.lssStaking.connect(adr.staker1).stake(1),
            ).to.be.revertedWith('Pausable: paused');
          });

          it('should revert when trying to claim', async () => {
            await expect(
              env.lssStaking.connect(adr.staker1).stakerClaim(1),
            ).to.be.revertedWith('Pausable: paused');
          });
        });
      });

      describe('when unpausing', () => {
        beforeEach(async () => {
          await env.lssStaking.connect(adr.lssPauseAdmin).pause();
        });

        it('should revert when called by other than admin', async () => {
          await expect(
            env.lssStaking.connect(adr.regularUser1).unpause(),
          ).to.be.revertedWith('LSS: Must be pauseAdmin');
        });

        it('should not revert when called by pause admin', async () => {
          await expect(
            env.lssStaking.connect(adr.lssPauseAdmin).unpause(),
          ).to.not.be.reverted;
        });

        describe('when unpaused', () => {
          beforeEach(async () => {
            await env.lssStaking.connect(adr.lssPauseAdmin).unpause();
          });

          it('should prevent staking on normal conditions', async () => {
            await expect(
              env.lssStaking.connect(adr.staker1).stake(1),
            ).to.be.revertedWith('LSS: report does not exists');
          });

          it('should prevent staker claiming on normal conditions', async () => {
            await expect(
              env.lssStaking.connect(adr.staker1).stakerClaim(1),
            ).to.be.revertedWith('LSS: Report solved negatively');
          });
        });
      });
    });

    describe('when setting up Lossless Controller Contract', () => {
      it('should revert when setting Staking contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setStakingContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });

      it('should revert when setting Staking contract to the same address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setStakingContractAddress(env.lssStaking.address),
        ).to.be.revertedWith('LSS: Cannot set same value');
      });

      it('should revert when setting Staking contract by non admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1).setStakingContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert when setting Report contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setReportingContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });

      it('should revert when setting Report contract to the same address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setReportingContractAddress(env.lssReporting.address),
        ).to.be.revertedWith('LSS: Cannot set same value');
      });

      it('should revert when setting Report contract by non admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1).setReportingContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert when setting Governance contract as zero address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setGovernanceContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LERC20: Cannot be zero address');
      });

      it('should revert when setting Governance contract to the same address', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setGovernanceContractAddress(env.lssGovernance.address),
        ).to.be.revertedWith('LSS: Cannot set same value');
      });


      it('should revert when setting Governance contract by non admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1).setGovernanceContractAddress(adr.ZERO_ADDRESS),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert when setDexTransferThreshold by non admin', async () => {
        await expect(
          env.lssController.connect(adr.regularUser1).setDexTransferThreshold(20),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert when setting to the same amount', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).setDexTransferThreshold(5),
        ).to.emit(env.lssController, 'NewDexThreshold').withArgs(5);

        await expect(
          env.lssController.connect(adr.lssAdmin).setDexTransferThreshold(5),
        ).to.be.revertedWith('LSS: Cannot set same value');
      });

      it('should revert when trying to add to blacklist from other than Lossless Contracts', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).addToBlacklist(adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: Lss SC only');
      });

      it('should revert when trying to resolve negatively from other than Lossless Contracts', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).resolvedNegatively(adr.maliciousActor1.address),
        ).to.be.revertedWith('LSS: Lss SC only');
      });

      it('should revert when trying to activate emergency from other than Lossless Contracts', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).activateEmergency(env.lssToken.address),
        ).to.be.revertedWith('LSS: Lss SC only');
      });

      it('should revert when trying to deactivate emergency from other than Lossless Contracts', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).deactivateEmergency(env.lssToken.address),
        ).to.be.revertedWith('LSS: Lss SC only');
      });

      it('should revert when trying to retrieve blacklisted funds from other than Lossless Contracts', async () => {
        await expect(
          env.lssController.connect(adr.lssAdmin).retrieveBlacklistedFunds([adr.regularUser1.address], env.lssToken.address, 1),
        ).to.be.revertedWith('LSS: Lss SC only');
      });

      describe('when setting a new admin', () => {
        it('should revert when not recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).setAdmin(adr.regularUser2.address),
          ).to.be.revertedWith('LSS: Must be recoveryAdmin');
        });

        it('should revert when setting the same address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.lssAdmin.address),
          ).to.be.revertedWith('LERC20: Cannot set same address');
        });

        it('should not revert when setting zero address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.ZERO_ADDRESS),
          ).to.not.be.reverted;
        });

        it('should not revert when recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.regularUser1.address),
          ).to.not.be.reverted;
        });

        it('should emit event', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.regularUser1.address),
          ).to.emit(env.lssController, 'AdminChange').withArgs(
            adr.regularUser1.address,
          );
        });
      });

      describe('when setting a new pause admin', () => {
        it('should revert when not recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).setPauseAdmin(adr.regularUser2.address),
          ).to.be.revertedWith('LSS: Must be recoveryAdmin');
        });

        it('should revert when setting the same address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.lssPauseAdmin.address),
          ).to.be.revertedWith('LERC20: Cannot set same address');
        });

        it('should not revert when setting zero address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.ZERO_ADDRESS),
          ).to.not.be.reverted;
        });

        it('should not revert when recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.regularUser1.address),
          ).to.not.be.reverted;
        });

        it('should emit event', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setPauseAdmin(adr.regularUser1.address),
          ).to.emit(env.lssController, 'PauseAdminChange').withArgs(
            adr.regularUser1.address,
          );
        });
      });

      describe('when setting a new recovery admin', () => {
        it('should revert when not recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).setRecoveryAdmin(adr.regularUser2.address),
          ).to.be.revertedWith('LSS: Must be recoveryAdmin');
        });

        it('should revert when not setting the same address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.lssRecoveryAdmin.address),
          ).to.be.revertedWith('LERC20: Cannot set same address');
        });

        it('should not revert when setting zero address', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.ZERO_ADDRESS),
          ).to.not.be.reverted;
        });

        it('should not revert when recoveryAdmin', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.regularUser1.address),
          ).to.not.be.reverted;
        });

        it('should emit event', async () => {
          await expect(
            env.lssController.connect(adr.lssRecoveryAdmin).setRecoveryAdmin(adr.regularUser1.address),
          ).to.emit(env.lssController, 'RecoveryAdminChange').withArgs(
            adr.regularUser1.address,
          );
        });
      });

      describe('when pausing', () => {
        it('should revert when not pause admin', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).pause(),
          ).to.be.revertedWith('LSS: Must be pauseAdmin');
        });

        it('should not revert when pause admin', async () => {
          await expect(
            env.lssController.connect(adr.lssPauseAdmin).pause(),
          ).to.not.be.reverted;
        });

        describe('when paused', () => {
          beforeEach(async () => {
            await env.lssController.connect(adr.lssPauseAdmin).pause();
          });

          it('should prevent from executing setGuardian', async () => {
            await expect(
              env.lssController.connect(adr.lssAdmin).setGuardian(adr.regularUser1.address),
            ).to.be.revertedWith('Pausable: paused');
          });
        });
      });

      describe('when unpausing', () => {
        beforeEach(async () => {
          await expect(
            env.lssController.connect(adr.lssPauseAdmin).pause(),
          ).to.not.be.reverted;
        });
        it('should revert when not pause admin', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).unpause(),
          ).to.be.revertedWith('LSS: Must be pauseAdmin');
        });

        it('should not revert when not pause admin', async () => {
          await expect(
            env.lssController.connect(adr.lssPauseAdmin).unpause(),
          ).to.not.be.reverted;
        });

        describe('when unpaused', () => {
          beforeEach(async () => {
            await env.lssController.connect(adr.lssPauseAdmin).unpause();
          });

          it('should not revert with paused message', async () => {
            await expect(
              env.lssController.connect(adr.lssAdmin).setGuardian(adr.regularUser1.address),
            ).to.not.be.revertedWith('Pausable: paused');
          });
        });
      });

      describe('when whitelisting an address', () => {
        it('should set governance contract', async () => {
          await env.lssController.connect(adr.lssAdmin).setWhitelist(
            [env.lssGovernance.address, env.lssReporting.address, env.lssStaking.address], true,
          );
          expect(
            await env.lssController.whitelist(env.lssGovernance.address),
          ).to.be.equal(true);
          it('should set reporting contract', async () => {
            expect(
              await env.lssController.whitelist(env.lssReporting.address),
            ).to.be.equal(true);
          });
          it('should set reporting contract', async () => {
            expect(
              await env.lssController.whitelist(env.lssStaking.address),
            ).to.be.equal(true);
          });
        });
      });

      describe('when calling before and after legacy methods', () => {
        it('should not revert when calling beforeMint', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).beforeMint(adr.regularUser1.address, adr.regularUser2.address),
          ).to.not.be.reverted;
        });

        it('should not revert when calling beforeBurn', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).beforeBurn(adr.regularUser1.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling beforeIncreaseAllowance', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).beforeIncreaseAllowance(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling beforeDecreaseAllowance', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).beforeDecreaseAllowance(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterMint', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterMint(adr.regularUser1.address, adr.regularUser2.address),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterApprove', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterApprove(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterBurn', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterBurn(adr.regularUser1.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterTransfer', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterTransfer(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterTransferFrom', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterTransferFrom(adr.regularUser1.address, adr.regularUser2.address, adr.regularUser3.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterIncreaseAllowance', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterIncreaseAllowance(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });

        it('should not revert when calling afterDecreaseAllowance', async () => {
          await expect(
            env.lssController.connect(adr.regularUser1).afterDecreaseAllowance(adr.regularUser1.address, adr.regularUser2.address, 100),
          ).to.not.be.reverted;
        });
      });

      describe('when setting a new timelock period', () => {
        it('should not revert', async () => {
          await expect(
            env.lssController.connect(adr.lssAdmin).setSettlementTimeLock(10),
          ).to.emit(env.lssController, 'NewSettlementTimelock').withArgs(10);
        });

        it('should revert when setting the same amount', async () => {
          await expect(
            env.lssController.connect(adr.lssAdmin).setSettlementTimeLock(10),
          ).to.emit(env.lssController, 'NewSettlementTimelock').withArgs(10);

          await expect(
            env.lssController.connect(adr.lssAdmin).setSettlementTimeLock(10),
          ).to.be.revertedWith('LSS: Cannot set same value');
        });
      });
    });

    describe('when setting up Lossless Governance Contract', () => {
      describe('when paused', () => {
        beforeEach(async () => {
          await env.lssGovernance.connect(adr.lssPauseAdmin).pause();
        });

        it('should prevent adding committee members', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin)
              .addCommitteeMembers([adr.member1.address]),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should revert when committee tries to claim', async () => {
          await expect(
            env.lssGovernance.connect(adr.staker1).losslessClaim(1),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should revert when committee tries to claim', async () => {
          await expect(
            env.lssGovernance.connect(adr.staker1).claimCommitteeReward(1),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent removing committee members', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin)
              .removeCommitteeMembers([adr.member1.address]),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent setting the dispute period', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin)
              .setDisputePeriod(600),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent lossless team vote', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssAdmin)
              .losslessVote(1, true),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent token owners vote', async () => {
          await expect(
            env.lssGovernance.connect(adr.lerc20Admin)
              .tokenOwnersVote(1, true),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent committee member vote', async () => {
          await expect(
            env.lssGovernance.connect(adr.member1)
              .committeeMemberVote(1, true),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent solving a report', async () => {
          await expect(
            env.lssGovernance.connect(adr.member1)
              .resolveReport(1),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent proposing a wallet', async () => {
          await expect(
            env.lssGovernance.connect(adr.lerc20Admin)
              .proposeWallet(1, adr.reporter1.address),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent rejecting a wallet', async () => {
          await expect(
            env.lssGovernance.connect(adr.lerc20Admin)
              .rejectWallet(1),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent retrieving funds', async () => {
          await expect(
            env.lssGovernance.connect(adr.reporter1)
              .retrieveFunds(1),
          ).to.be.revertedWith('Pausable: paused');
        });

        it('should prevent retrieving compensation', async () => {
          await expect(
            env.lssGovernance.connect(adr.reporter1)
              .retrieveCompensation(),
          ).to.be.revertedWith('Pausable: paused');
        });
      });

      describe('when unpausing', () => {
        beforeEach(async () => {
          await env.lssGovernance.connect(adr.lssPauseAdmin).pause();
        });

        it('should unpause', async () => {
          await expect(
            env.lssGovernance.connect(adr.lssPauseAdmin).unpause(),
          ).to.not.be.reverted;
        });

        it('should revert when other than admin', async () => {
          await expect(
            env.lssGovernance.connect(adr.regularUser1).unpause(),
          ).to.be.revertedWith('LSS: Must be pauseAdmin');
        });

        describe('when unpaused', async () => {
          beforeEach(async () => {
            await env.lssGovernance.connect(adr.lssPauseAdmin).unpause();
          });
          it('should not prevent adding committee members', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin)
                .addCommitteeMembers([adr.member1.address]),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent removing committee members', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin)
                .removeCommitteeMembers([adr.member1.address]),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent setting the dispute period', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin)
                .setDisputePeriod(600),
            ).to.emit(env.lssGovernance, 'NewDisputePeriod').withArgs(600);
          });

          it('should not prevent lossless team vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.lssAdmin)
                .losslessVote(1, true),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent token owners vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.lerc20Admin)
                .tokenOwnersVote(1, true),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent committee member vote', async () => {
            await expect(
              env.lssGovernance.connect(adr.member1)
                .committeeMemberVote(1, true),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent solving a report', async () => {
            await expect(
              env.lssGovernance.connect(adr.member1)
                .resolveReport(1),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent proposing a wallet', async () => {
            await expect(
              env.lssGovernance.connect(adr.lerc20Admin)
                .proposeWallet(1, adr.reporter1.address),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent rejecting a wallet', async () => {
            await expect(
              env.lssGovernance.connect(adr.lerc20Admin)
                .rejectWallet(1),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent retrieving funds', async () => {
            await expect(
              env.lssGovernance.connect(adr.reporter1)
                .retrieveFunds(1),
            ).to.not.be.revertedWith('Pausable: paused');
          });

          it('should not prevent retrieving compensation', async () => {
            await expect(
              env.lssGovernance.connect(adr.reporter1)
                .retrieveCompensation(),
            ).to.not.be.revertedWith('Pausable: paused');
          });
        });
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

      it('should set the Dex Transfer Threshold correctly', async () => {
        expect(
          await env.lssController.dexTranferThreshold(),
        ).to.be.equal(20);
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

      it('should set the report Lossless Controller address correctly', async () => {
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
    });
  });
});
