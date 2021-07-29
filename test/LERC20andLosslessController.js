// const { expect } = require('chai');
// const { constants, time } = require('@openzeppelin/test-helpers');

// let initialHolder;
// let recipient;
// let anotherAccount;
// let admin;
// let adminBackup;
// let lssAdmin;
// let lssRecoveryAdmin;
// let oneMoreAccount;
// let pauseAdmin;
// let whitelisted1;
// let whitelisted2;
// let selectedAdmin;

// let losslessController;
// let losslessControllerV1;
// let erc20;

// const name = 'My Token';
// const symbol = 'MTKN';

// const initialSupply = 100;

// beforeEach(async () => {
//   [
//     initialHolder,
//     recipient,
//     anotherAccount,
//     admin,
//     adminBackup,
//     lssAdmin,
//     lssRecoveryAdmin,
//     oneMoreAccount,
//     pauseAdmin,
//     whitelisted1,
//     whitelisted2,
//     selectedAdmin,
//   ] = await ethers.getSigners();

//   const LosslessController = await ethers.getContractFactory(
//     'LosslessControllerV1',
//   );

//   const LosslessControllerV2 = await ethers.getContractFactory(
//     'LosslessControllerV2',
//   );

//   losslessControllerV1 = await upgrades.deployProxy(LosslessController, [
//     lssAdmin.address,
//     lssRecoveryAdmin.address,
//     pauseAdmin.address,
//   ]);
//   losslessController = await upgrades.upgradeProxy(
//     losslessControllerV1.address,
//     LosslessControllerV2,
//   );

//   await losslessController.connect(lssAdmin).initialize();

//   const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
//   erc20 = await LERC20Mock.deploy(
//     0,
//     name,
//     symbol,
//     initialHolder.address,
//     initialSupply,
//     losslessController.address,
//     admin.address,
//     adminBackup.address,
//     Number(time.duration.days(1)),
//   );
// });

// function successfullyTransferAndTransferFrom() {
//   describe('transfer after transfer', () => {
//     it('should allow recipient to transfer instantly after receiving funds', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 5);
//       expect(await erc20.balanceOf(initialHolder.address)).to.equal(95);
//       expect(await erc20.balanceOf(recipient.address)).to.equal(5);
//       await erc20.connect(recipient).transfer(initialHolder.address, 5);
//       expect(await erc20.balanceOf(initialHolder.address)).to.equal(100);
//     });
//   });

//   describe('transferFrom after transfer', () => {
//     it('should allow recipient to transfer instantly after receiving funds', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 10);
//       await erc20.connect(recipient).approve(anotherAccount.address, 10);
//       expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//       expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//       await erc20
//         .connect(anotherAccount)
//         .transferFrom(recipient.address, oneMoreAccount.address, 10);
//       expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(10);
//     });
//   });

//   describe('transfer after tranferFrom', () => {
//     it('should allow recipient to transfer instantly after receiving funds', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 10);
//       await erc20.connect(recipient).approve(anotherAccount.address, 10);
//       expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//       expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//       await erc20
//         .connect(anotherAccount)
//         .transferFrom(recipient.address, oneMoreAccount.address, 10);
//       expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(10);
//       await erc20.connect(oneMoreAccount).transfer(recipient.address, 10);
//       expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//     });
//   });

//   describe('transferFrom after tranferFrom', () => {
//     it('should allow recipient to transfer instantly after receiving funds', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 10);
//       await erc20.connect(recipient).approve(anotherAccount.address, 10);
//       expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//       expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//       await erc20
//         .connect(anotherAccount)
//         .transferFrom(recipient.address, oneMoreAccount.address, 10);
//       expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(10);
//       await erc20.connect(oneMoreAccount).approve(recipient.address, 10);
//       await erc20
//         .connect(recipient)
//         .transferFrom(oneMoreAccount.address, recipient.address, 10);
//       expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//     });
//   });
// }

// describe('LERC20 and LosslessController', () => {
//   describe('ido mode', () => {
//     describe(
//       'when ido mode is not active',
//       successfullyTransferAndTransferFrom,
//     );

//     describe('when ido mode is proposed but not confirmed', () => {
//       beforeEach(async () => {
//         await losslessController
//           .connect(admin)
//           .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//             whitelisted1.address,
//             whitelisted2.address,
//           ]);
//       });

//       successfullyTransferAndTransferFrom();
//     });

//     describe('when ido mode is confirmed but not started', () => {
//       beforeEach(async () => {
//         await losslessController
//           .connect(admin)
//           .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//             whitelisted1.address,
//             whitelisted2.address,
//           ]);

//         await losslessController
//           .connect(lssAdmin)
//           .setIdoConfigConfirm(erc20.address, true);
//       });

//       successfullyTransferAndTransferFrom();
//     });

//     describe('when ido mode is finished', () => {
//       beforeEach(async () => {
//         await losslessController
//           .connect(admin)
//           .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//             whitelisted1.address,
//             whitelisted2.address,
//           ]);

//         await losslessController
//           .connect(lssAdmin)
//           .setIdoConfigConfirm(erc20.address, true);

//         await losslessController.connect(admin).startIdo(erc20.address);

//         await ethers.provider.send('evm_increaseTime', [
//           Number(time.duration.minutes(16)),
//         ]);
//       });

//       successfullyTransferAndTransferFrom();
//     });

//     describe('when ido mode is active and addresses whitelisted', () => {
//       beforeEach(async () => {
//         await losslessController
//           .connect(admin)
//           .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//             whitelisted1.address,
//             whitelisted2.address,
//           ]);

//         await losslessController
//           .connect(lssAdmin)
//           .setIdoConfigConfirm(erc20.address, true);

//         await losslessController.connect(admin).startIdo(erc20.address);
//       });

//       describe('transfer after transfer', () => {
//         it('should allow whitelisted1 to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).transfer(whitelisted1.address, 5);
//           expect(await erc20.balanceOf(initialHolder.address)).to.equal(95);
//           expect(await erc20.balanceOf(whitelisted1.address)).to.equal(5);
//           await erc20.connect(whitelisted1).transfer(initialHolder.address, 5);
//           expect(await erc20.balanceOf(initialHolder.address)).to.equal(100);
//         });
//       });

//       describe('transferFrom after transfer', () => {
//         it('should allow recipient to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).transfer(whitelisted1.address, 10);
//           await erc20.connect(whitelisted1).approve(anotherAccount.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//           expect(await erc20.balanceOf(whitelisted1.address)).to.be.equal(10);
//           await erc20
//             .connect(anotherAccount)
//             .transferFrom(whitelisted1.address, oneMoreAccount.address, 10);
//           expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(10);
//         });
//       });

//       describe('tranfer after transferFrom', () => {
//         it('should allow recipient to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).transfer(whitelisted1.address, 10);
//           await erc20.connect(whitelisted1).approve(anotherAccount.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//           expect(await erc20.balanceOf(whitelisted1.address)).to.be.equal(10);
//           await erc20
//             .connect(anotherAccount)
//             .transferFrom(whitelisted1.address, whitelisted2.address, 10);
//           expect(await erc20.balanceOf(whitelisted2.address)).to.be.equal(10);
//           await erc20
//             .connect(whitelisted2)
//             .transfer(anotherAccount.address, 10);
//           expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);
//         });
//       });
//     });

//     describe('when ido mode is active', () => {
//       beforeEach(async () => {
//         await losslessController
//           .connect(admin)
//           .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//             whitelisted1.address,
//             whitelisted2.address,
//           ]);

//         await losslessController
//           .connect(lssAdmin)
//           .setIdoConfigConfirm(erc20.address, true);

//         await losslessController.connect(admin).startIdo(erc20.address);
//       });

//       describe('transfer after transfer', () => {
//         it('should not allow to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).transfer(recipient.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.equal(90);
//           expect(await erc20.balanceOf(recipient.address)).to.equal(10);
//           await expect(
//             erc20.connect(recipient).transfer(anotherAccount.address, 5),
//           ).revertedWith('LOSSLESS: Operation not allowed');
//         });
//       });

//       describe('transferFrom after transfer', () => {
//         it('should not allow recipient to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).transfer(recipient.address, 10);
//           await erc20.connect(recipient).approve(anotherAccount.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//           expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//           await expect(
//             erc20
//               .connect(anotherAccount)
//               .transferFrom(recipient.address, oneMoreAccount.address, 10),
//           ).revertedWith('LOSSLESS: Operation not allowed');
//         });
//       });

//       describe('transfer after transferFrom', () => {
//         it('should not allow recipient to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).approve(recipient.address, 10);
//           await erc20
//             .connect(recipient)
//             .transferFrom(initialHolder.address, anotherAccount.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//           expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);
//           await expect(
//             erc20.connect(anotherAccount).transfer(recipient.address, 10),
//           ).revertedWith('LOSSLESS: Operation not allowed');
//         });
//       });

//       describe('transferFrom after transferFrom', () => {
//         it('should not allow recipient to transfer instantly after receiving funds', async () => {
//           await erc20.connect(initialHolder).approve(recipient.address, 10);
//           await erc20
//             .connect(recipient)
//             .transferFrom(initialHolder.address, anotherAccount.address, 10);
//           expect(await erc20.balanceOf(initialHolder.address)).to.be.equal(90);
//           expect(await erc20.balanceOf(anotherAccount.address)).to.be.equal(10);

//           await erc20.connect(anotherAccount).approve(recipient.address, 10);
//           await expect(
//             erc20
//               .connect(recipient)
//               .transferFrom(anotherAccount.address, oneMoreAccount.address, 10),
//           ).revertedWith('LOSSLESS: Operation not allowed');
//         });
//       });
//     });
//   });
// });

// describe('blacklist', () => {
//   beforeEach(async () => {
//     await losslessController
//       .connect(admin)
//       .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//         whitelisted1.address,
//         whitelisted2.address,
//       ]);

//     await losslessController
//       .connect(lssAdmin)
//       .setIdoConfigConfirm(erc20.address, true);

//     await losslessController.connect(admin).startIdo(erc20.address);

//     await losslessController
//       .connect(admin)
//       .blacklistAddresses(erc20.address, [recipient.address]);

//     await ethers.provider.send('evm_increaseTime', [
//       Number(time.duration.minutes(16)),
//     ]);
//   });

//   describe('transfer', () => {
//     it('should not allow transfer from blacklisted address', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 10);
//       await erc20.connect(initialHolder).transfer(anotherAccount.address, 5);
//       await erc20.connect(anotherAccount).transfer(oneMoreAccount.address, 1);

//       await expect(
//         erc20.connect(recipient).transfer(anotherAccount.address, 1),
//       ).revertedWith('LOSSLESS: Operation not allowed');
//     });
//   });

//   describe('transferFrom', () => {
//     it('should not allow transfer from blacklisted address', async () => {
//       await erc20.connect(initialHolder).transfer(recipient.address, 10);
//       await erc20.connect(initialHolder).transfer(anotherAccount.address, 5);

//       await erc20.connect(recipient).approve(oneMoreAccount.address, 1);
//       await erc20.connect(anotherAccount).approve(oneMoreAccount.address, 1);

//       await erc20
//         .connect(oneMoreAccount)
//         .transferFrom(anotherAccount.address, oneMoreAccount.address, 1);
//       await expect(
//         erc20
//           .connect(oneMoreAccount)
//           .transferFrom(recipient.address, oneMoreAccount.address, 1),
//       ).revertedWith('LOSSLESS: Operation not allowed');
//     });
//   });
// });

// describe('transferOutBlacklistedTokens', () => {
//   beforeEach(async () => {
//     await erc20.connect(initialHolder).transfer(recipient.address, 10);
//     await erc20.connect(initialHolder).transfer(anotherAccount.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted1.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted2.address, 10);

//     await losslessController
//       .connect(admin)
//       .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//         whitelisted1.address,
//         whitelisted2.address,
//       ]);

//     await losslessController
//       .connect(lssAdmin)
//       .setIdoConfigConfirm(erc20.address, true);

//     await losslessController.connect(admin).startIdo(erc20.address);

//     await losslessController
//       .connect(admin)
//       .blacklistAddresses(erc20.address, [
//         recipient.address,
//         anotherAccount.address,
//       ]);

//     await ethers.provider.send('evm_increaseTime', [
//       Number(time.duration.minutes(16)),
//     ]);
//   });

//   describe('when sender is not admin', () => {
//     it('revert', async () => {
//       await expect(
//         losslessController
//           .connect(initialHolder)
//           .transferOutBlacklistedFunds(erc20.address, [
//             recipient.address,
//             anotherAccount.address,
//           ]),
//       ).to.be.revertedWith('LOSSLESS: Sender is not admin');
//     });
//   });

//   function testTokensTransferOutWithAdmin() {
//     describe('when dispute period is not over', () => {
//       it('revert', async () => {
//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, [
//               recipient.address,
//               anotherAccount.address,
//             ]),
//         ).to.be.revertedWith('LOSSLESS: some addresses still can be disputed');
//       });
//     });

//     describe('when dispute period is halfway', () => {
//       it('revert', async () => {
//         await ethers.provider.send('evm_increaseTime', [
//           Number(time.duration.days(4)),
//         ]);

//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, [
//               recipient.address,
//               anotherAccount.address,
//             ]),
//         ).to.be.revertedWith('LOSSLESS: some addresses still can be disputed');
//       });
//     });

//     describe('when some address is not blacklisted', () => {
//       it('revert', async () => {
//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, [
//               oneMoreAccount.address,
//               recipient.address,
//               anotherAccount.address,
//             ]),
//         ).to.be.revertedWith('LOSSLESS: some addresses are not blacklisted');
//       });
//     });

//     describe('when addresses array is empty', () => {
//       it('revert', async () => {
//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, []),
//         ).to.be.revertedWith(
//           'LOSSLESS: blacklisted addresses must not be empty',
//         );
//       });
//     });

//     describe('when addresses array is empty', () => {
//       it('revert', async () => {
//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, []),
//         ).to.be.revertedWith(
//           'LOSSLESS: blacklisted addresses must not be empty',
//         );
//       });
//     });

//     describe('when dispute period is over', () => {
//       it('should transfer all tokens to lossless controller address', async () => {
//         await ethers.provider.send('evm_increaseTime', [
//           Number(time.duration.days(7) + 1),
//         ]);

//         expect(await erc20.balanceOf(losslessController.address)).to.be.equal(
//           0,
//         );
//         expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);
//         expect(await erc20.balanceOf(recipient.address)).to.be.equal(10);

//         await losslessController
//           .connect(admin)
//           .transferOutBlacklistedFunds(erc20.address, [
//             recipient.address,
//             anotherAccount.address,
//           ]);

//         expect(await erc20.balanceOf(losslessController.address)).to.be.equal(
//           20,
//         );
//         expect(await erc20.balanceOf(recipient.address)).to.be.equal(0);
//         expect(await erc20.balanceOf(recipient.address)).to.be.equal(0);
//       });

//       it('should emit BlacklistedFundsTransferedOut event', async () => {
//         await ethers.provider.send('evm_increaseTime', [
//           Number(time.duration.days(7) + 1),
//         ]);
//         await expect(
//           losslessController
//             .connect(selectedAdmin)
//             .transferOutBlacklistedFunds(erc20.address, [
//               recipient.address,
//               anotherAccount.address,
//             ]),
//         )
//           .to.emit(losslessController, 'BlacklistedFundsTransferedOut')
//           .withArgs(erc20.address, selectedAdmin.address, [
//             recipient.address,
//             anotherAccount.address,
//           ]);
//       });
//     });
//   }

//   describe('when sender is token admin', () => {
//     beforeEach(() => {
//       selectedAdmin = admin;
//     });
//     testTokensTransferOutWithAdmin();
//   });

//   describe('when sender is lossless admin', () => {
//     beforeEach(() => {
//       selectedAdmin = lssAdmin;
//     });
//     testTokensTransferOutWithAdmin();
//   });
// });

// describe('transferTokensByTokenAdmin', () => {
//   beforeEach(async () => {
//     await erc20.connect(initialHolder).transfer(recipient.address, 10);
//     await erc20.connect(initialHolder).transfer(anotherAccount.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted1.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted2.address, 10);

//     await losslessController
//       .connect(admin)
//       .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//         whitelisted1.address,
//         whitelisted2.address,
//       ]);

//     await losslessController
//       .connect(lssAdmin)
//       .setIdoConfigConfirm(erc20.address, true);

//     await losslessController.connect(admin).startIdo(erc20.address);

//     await losslessController
//       .connect(admin)
//       .blacklistAddresses(erc20.address, [
//         recipient.address,
//         anotherAccount.address,
//       ]);

//     await ethers.provider.send('evm_increaseTime', [
//       Number(time.duration.days(8)),
//     ]);

//     await losslessController
//       .connect(admin)
//       .transferOutBlacklistedFunds(erc20.address, [
//         recipient.address,
//         anotherAccount.address,
//       ]);
//   });

//   describe('when sender is not token admin', () => {
//     it('revert', async () => {
//       await expect(
//         losslessController
//           .connect(initialHolder)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
//     });
//   });

//   describe('when sender is lossless admin', () => {
//     it('revert', async () => {
//       await expect(
//         losslessController
//           .connect(lssAdmin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('LOSSLESS: Sender must be token admin');
//     });
//   });

//   describe('when contract is paused', () => {
//     it('revert', async () => {
//       await losslessController.connect(pauseAdmin).pause();
//       await expect(
//         losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('Pausable: paused');
//     });
//   });

//   describe('when sender is token admin', () => {
//     describe('when lossless admin has not yet confirmed proposal', () => {
//       it('should set proposal address and flag', async () => {
//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(true);
//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(oneMoreAccount.address);
//       });

//       it('should emit TransferProposedByTokenAdmin event', async () => {
//         await expect(
//           losslessController
//             .connect(admin)
//             .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//         )
//           .to.emit(losslessController, 'TransferProposedByTokenAdmin')
//           .withArgs(erc20.address, admin.address, oneMoreAccount.address);
//       });
//     });

//     describe('when lossless proposed different address', () => {
//       it('should overwrite lossless proposal', async () => {
//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, initialHolder.address);

//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(true);

//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(oneMoreAccount.address);
//       });

//       it('should emit TransferProposedByTokenAdmin event', async () => {
//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, initialHolder.address);

//         await expect(
//           losslessController
//             .connect(admin)
//             .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//         )
//           .to.emit(losslessController, 'TransferProposedByTokenAdmin')
//           .withArgs(erc20.address, admin.address, oneMoreAccount.address);
//       });
//     });

//     describe('when lossless proposed same address', () => {
//       it('should transfer out funds', async () => {
//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address);

//         expect(await erc20.balanceOf(losslessController.address)).to.be.equal(
//           20,
//         );

//         expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(0);

//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(20);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(constants.ZERO_ADDRESS);
//       });

//       it('should emit FundsTransfered event', async () => {
//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address);

//         await expect(
//           losslessController
//             .connect(admin)
//             .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address),
//         )
//           .to.emit(losslessController, 'FundsTransfered')
//           .withArgs(erc20.address, admin.address, oneMoreAccount.address, 20);
//       });
//     });
//   });
// });

// describe('transferTokensByLosslessAdmin', () => {
//   beforeEach(async () => {
//     await erc20.connect(initialHolder).transfer(recipient.address, 10);
//     await erc20.connect(initialHolder).transfer(anotherAccount.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted1.address, 10);
//     await erc20.connect(initialHolder).transfer(whitelisted2.address, 10);

//     await losslessController
//       .connect(admin)
//       .proposeIdoConfig(erc20.address, Number(time.duration.minutes(15)), [
//         whitelisted1.address,
//         whitelisted2.address,
//       ]);

//     await losslessController
//       .connect(lssAdmin)
//       .setIdoConfigConfirm(erc20.address, true);

//     await losslessController.connect(admin).startIdo(erc20.address);

//     await losslessController
//       .connect(admin)
//       .blacklistAddresses(erc20.address, [
//         recipient.address,
//         anotherAccount.address,
//       ]);

//     await ethers.provider.send('evm_increaseTime', [
//       Number(time.duration.days(8)),
//     ]);

//     await losslessController
//       .connect(admin)
//       .transferOutBlacklistedFunds(erc20.address, [
//         recipient.address,
//         anotherAccount.address,
//       ]);
//   });

//   describe('when sender is not lossless admin', () => {
//     it('revert', async () => {
//       await expect(
//         losslessController
//           .connect(initialHolder)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('LOSSLESS: Must be admin');
//     });
//   });

//   describe('when sender is token admin', () => {
//     it('revert', async () => {
//       await expect(
//         losslessController
//           .connect(admin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('LOSSLESS: Must be admin');
//     });
//   });

//   describe('when contract is paused', () => {
//     it('revert', async () => {
//       await losslessController.connect(pauseAdmin).pause();
//       await expect(
//         losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address),
//       ).to.be.revertedWith('Pausable: paused');
//     });
//   });

//   describe('when sender is lossless admin', () => {
//     describe('when lossless admin has not yet confirmed proposal', () => {
//       it('should set proposal address and flag', async () => {
//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);
//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(true);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(oneMoreAccount.address);
//       });

//       it('should emit TransferProposedByLosslessAdmin event', async () => {
//         await expect(
//           losslessController
//             .connect(lssAdmin)
//             .transferTokensByLosslessAdmin(
//               erc20.address,
//               oneMoreAccount.address,
//             ),
//         )
//           .to.emit(losslessController, 'TransferProposedByLosslessAdmin')
//           .withArgs(erc20.address, lssAdmin.address, oneMoreAccount.address);
//       });
//     });

//     describe('when token admin proposed different address', () => {
//       it('should overwrite lossless proposal', async () => {
//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, initialHolder.address);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(true);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(initialHolder.address);
//       });

//       it('should emit TransferProposedByLosslessAdmin event', async () => {
//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         await expect(
//           losslessController
//             .connect(lssAdmin)
//             .transferTokensByLosslessAdmin(
//               erc20.address,
//               initialHolder.address,
//             ),
//         )
//           .to.emit(losslessController, 'TransferProposedByLosslessAdmin')
//           .withArgs(erc20.address, lssAdmin.address, initialHolder.address);
//       });
//     });

//     describe('when token admin proposed same address', () => {
//       it('should transfer out funds', async () => {
//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         expect(await erc20.balanceOf(losslessController.address)).to.be.equal(
//           20,
//         );
//         expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(0);

//         await losslessController
//           .connect(lssAdmin)
//           .transferTokensByLosslessAdmin(erc20.address, oneMoreAccount.address);

//         expect(await erc20.balanceOf(oneMoreAccount.address)).to.be.equal(20);

//         expect(
//           await losslessController.getTransferProposedByTokenAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedByLosslessAdmin(
//             erc20.address,
//           ),
//         ).to.be.equal(false);

//         expect(
//           await losslessController.getTransferProposedAddress(erc20.address),
//         ).to.be.equal(constants.ZERO_ADDRESS);
//       });

//       it('should emit FundsTransfered event', async () => {
//         await losslessController
//           .connect(admin)
//           .transferTokensByTokenAdmin(erc20.address, oneMoreAccount.address);

//         await expect(
//           losslessController
//             .connect(lssAdmin)
//             .transferTokensByLosslessAdmin(
//               erc20.address,
//               oneMoreAccount.address,
//             ),
//         )
//           .to.emit(losslessController, 'FundsTransfered')
//           .withArgs(
//             erc20.address,
//             lssAdmin.address,
//             oneMoreAccount.address,
//             20,
//           );
//       });
//     });
//   });
// });
