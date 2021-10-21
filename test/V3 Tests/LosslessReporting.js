/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utils');

let adr;
let env;

describe('Lossless Reporting', ()=>{
    beforeEach(async () => {
        adr = await setupAddresses();
        env = await setupEnvironment(adr.lssAdmin,
                                     adr.lssRecoveryAdmin,
                                     adr.lssPauseAdmin,
                                     adr.lssInitialHolder,
                                     adr.lssBackupAdmin,
                                    );
        lerc20Token = await setupToken( 2000000,
                                        "Random Token",
                                        "RAND",
                                        adr.lerc20InitialHolder.address,
                                        adr.lerc20Admin.address,
                                        adr.lerc20BackupAdmin.address,
                                        Number(time.duration.days(1)),
                                        env.lssController.address,
                                        );
    });

    describe('when generating a report', ()=>{
        beforeEach(async ()=>{
            await env.lssController.connect(adr.lssAdmin).addToWhitelist(env.lssReporting.address);
            
            await lssToken.connect(adr.lssInitialHolder).transfer(adr.reporter1.address, env.stakeAmount);
            await lssToken.connect(adr.lssInitialHolder).transfer(adr.reporter2.address, env.stakeAmount);

            await lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakeAmount);

            await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(5)),
            ]);
        });

        describe('when reporting a whitelisted account', ()=>{
            it('should revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, env.lssReporting.address),
                ).to.be.revertedWith("LSS: Cannot report LSS protocol");
            });
        });

        describe('when succesfully generating a report', ()=>{
            it('should not revert', async ()=>{
                await env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, adr.maliciousActor1.address);

                expect(
                await env.lssReporting.getReportTimestamps(1)
                ).to.not.be.empty;
            });

            it('should blacklist address', async ()=>{

                await env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, adr.maliciousActor1.address);

                expect(
                await env.lssController.isBlacklisted(adr.maliciousActor1.address),
                ).to.be.equal(true);
            });
        });

        describe('when reporting the same token and address twice', ()=>{
            it('should revert', async ()=>{

                await env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, adr.maliciousActor1.address);

                await expect(
                    env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, adr.maliciousActor1.address),
                ).to.be.revertedWith("LSS: Report already exists");
            });
        });
    });

    describe('when generating another report', ()=>{
        beforeEach(async () => {
            await env.lssController.connect(adr.lssAdmin).addToWhitelist(env.lssReporting.address);
            
            await lssToken.connect(adr.lssInitialHolder).transfer(adr.reporter1.address, env.stakeAmount*2);
            await lssToken.connect(adr.lssInitialHolder).transfer(adr.reporter2.address, env.stakeAmount);

            await lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakeAmount*2);

            await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(5)),
            ]);

            await env.lssReporting.connect(adr.reporter1).report(lerc20Token.address, adr.maliciousActor1.address);
        });

        describe('when generating another report successfully', ()=>{
            it('should not revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter1).secondReport(1, lerc20Token.address, adr.maliciousActor2.address),
                ).to.not.be.reverted;
            });
        });

        describe('when reporting another on a whitelisted account', ()=>{
            it('should revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter1).secondReport(1, lerc20Token.address, env.lssReporting.address),
                ).to.be.revertedWith("LSS: Cannot report LSS protocol");
            });
        });

        describe('when reporting another on a non existant report', ()=>{
            it('should revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter1).secondReport(5, lerc20Token.address, adr.maliciousActor1.address),
                ).to.be.revertedWith("LSS: report does not exists");
            });
        });

        describe('when reporting another by other than the original reporter', ()=>{
            it('should revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter2).secondReport(1, lerc20Token.address, adr.maliciousActor1.address),
                ).to.be.revertedWith("LSS: invalid reporter");
            });
        });

        describe('when reporting another multiple times', ()=>{
            it('should revert', async ()=>{
                await expect(
                env.lssReporting.connect(adr.reporter2).secondReport(1, lerc20Token.address, adr.maliciousActor1.address),
                ).to.be.revertedWith("LSS: invalid reporter");
            });
        });
    });
});