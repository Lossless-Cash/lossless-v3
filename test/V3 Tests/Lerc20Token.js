/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { setupAddresses, setupEnvironment, setupToken } = require('../utils');

let adr;
let env;

describe('Random LERC20 Token', () => {
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

    describe('when transfering between users', ()=>{
        beforeEach(async ()=>{
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser1.address, 100);
            await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.regularUser2.address, 100);
        });

        it('should revert if 5 minutes haven\'t passed', async () => {
            await expect(
                lerc20Token.connect(adr.regularUser2).transfer(adr.regularUser4.address, 5),
            ).to.be.revertedWith("LSS: Amt exceeds settled balance");
        });
        
        it('should not revert', async () => {
            await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(5)),
            ]);

            await expect(
                lerc20Token.connect(adr.regularUser1).transfer(adr.regularUser3.address, 5),
            ).to.not.be.reverted;

            expect(
                await lerc20Token.balanceOf(adr.regularUser3.address),
            ).to.be.equal(5);
        });
    });
});