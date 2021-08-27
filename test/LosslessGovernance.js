const { time, constants } = require('@openzeppelin/test-helpers');
const { expect, assert } = require('chai');

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
let erc20;
let dex;
let governance;
let member1;
let member2;
let member3;
let member4;
let member5;
let member6;
let member7;
let member8;
let member9;
let member10;

const name = 'My Token';
const symbol = 'MTKN';

const supply = 100;
const initialSupply = 1000000;
const stakeAmount = 5000;
const reportLifetime = time.duration.days(1);

const { ZERO_ADDRESS } = constants;

describe.only('Lossless Governance', () => {
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
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      member7,
      member8,
      member9,
      member10,
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

    erc20 = await LERC20Mock.deploy(
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

    await controller.connect(lssAdmin).setStakeAmount(stakeAmount);
    await controller
      .connect(lssAdmin)
      .setReportLifetime(Number(reportLifetime));
    await controller.connect(lssAdmin).setLosslessToken(erc20.address);
  });

  describe('contructor', () => {
    it('should set lossless controller correctly', async () => {
      expect(await governance.controller()).to.be.equal(controller.address);
    });
  });

  describe('addCommitteeMembers', () => {
    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          governance
            .connect(initialHolder)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            ),
        ).to.be.revertedWith('LOSSLESS: must be admin');
      });
    });

    describe('when sender is admin', () => {
      describe('when no committee members are added yet', () => {
        it('should add members', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member2.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member3.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member4.address),
          ).to.be.equal(true);
        });

        it('should set quorum size', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );

          expect(await governance.quorumSize()).to.be.equal(3);
        });

        it('should revert when adding duplicate members', async () => {
          await expect(
            governance
              .connect(lssAdmin)
              .addCommitteeMembers(
                [
                  member1.address,
                  member1.address,
                  member1.address,
                  member1.address,
                ]
              ),
          ).to.be.revertedWith('LOSSLESS: duplicate members');
        });
      });

      describe('when some members added before', () => {
        beforeEach(async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );
        });

        it('should add new members', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member5.address,
                member6.address,
                member7.address,
                member8.address,
              ]
            );

          expect(
            await governance.isCommitteeMember(member5.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member6.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member7.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member8.address),
          ).to.be.equal(true);
        });

        it('should update quorum size', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member5.address,
                member6.address,
                member7.address,
                member8.address,
              ]
            );

          expect(await governance.quorumSize()).to.be.equal(5);
        });

        it('should revert when adding duplicate members', async () => {
          await expect(
            governance
              .connect(lssAdmin)
              .addCommitteeMembers(
                [
                  member1.address,
                  member2.address,
                  member3.address,
                  member4.address,
                ]
              ),
          ).to.be.revertedWith('LOSSLESS: duplicate members');
        });
      });
    });
  });

  describe('removeCommitteeMembers', () => {
    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          governance
            .connect(initialHolder)
            .removeCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            ),
        ).to.be.revertedWith('LOSSLESS: must be admin');
      });
    });

    describe('when sender is admin', () => {
      describe('when there is no existing members', () => {
        it('should revert', async () => {
          await expect(
            governance
              .connect(lssAdmin)
              .removeCommitteeMembers(
                [
                  member1.address,
                  member2.address,
                  member3.address,
                  member4.address,
                ]
              ),
          ).to.be.revertedWith('LOSSLESS: committee has no members');
        });
      });

      describe('when sending empty array', () => {
        it('should succeed', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );
          await governance.connect(lssAdmin).removeCommitteeMembers([]);
        });
      });

      describe('when removing one existing member', () => {
        it('should succeed', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(true);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers([member1.address]);

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(false);
        });

        it('should change quorum size', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
              ]
            );

          expect(await governance.quorumSize()).to.be.equal(3);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers([member1.address]);

          expect(await governance.quorumSize()).to.be.equal(2);
        });
      });

      describe('when removing three existing members', () => {
        it('should succeed', async () => {
          await governance
            .connect(lssAdmin)
            .addCommitteeMembers(
              [
                member1.address,
                member2.address,
                member3.address,
                member4.address,
                member5.address,
                member6.address,
              ]
            );

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member3.address),
          ).to.be.equal(true);

          expect(
            await governance.isCommitteeMember(member5.address),
          ).to.be.equal(true);

          expect(await governance.quorumSize()).to.be.equal(4);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers(
              [member1.address, member3.address, member5.address]
            );

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(false);

          expect(
            await governance.isCommitteeMember(member3.address),
          ).to.be.equal(false);

          expect(
            await governance.isCommitteeMember(member5.address),
          ).to.be.equal(false);

          expect(await governance.quorumSize()).to.be.equal(2);
        });
      });
    
      /*describe('Test new quorum size function', () => {
        it('should return quorum size', async () => {
          expect(
            await governance._updateQuorum(10));
          expect(
            await governance.quorumSize()).to.be.equal();
        });
      });*/
    });
  });

  describe('losslessVote', () => {
    describe('when sender is not admin', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(anotherAccount).losslessVote(1, true),
        ).to.be.revertedWith('LOSSLESS: must be admin');
      });
    });

    describe('when report is not valid', () => {
      describe('when report does not exist', () => {
        it('should revert', async () => {
          await expect(
            governance.connect(lssAdmin).losslessVote(1, true),
          ).to.be.revertedWith('LOSSLESS: report is not valid');
        });
      });

      describe('when report is expired', () => {
        it('should revert', async () => {
          await erc20
            .connect(initialHolder)
            .transfer(oneMoreAccount.address, stakeAmount);

          await erc20
            .connect(initialHolder)
            .approve(controller.address, stakeAmount);

          await controller
            .connect(initialHolder)
            .report(erc20.address, anotherAccount.address);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(reportLifetime)) + 1,
          ]);

          await expect(
            governance.connect(lssAdmin).losslessVote(1, true),
          ).to.be.revertedWith('LOSSLESS: report is not valid');
        });
      });

      describe('when report is valid', () => {
        beforeEach(async () => {
          await erc20
            .connect(initialHolder)
            .approve(controller.address, stakeAmount);

          await controller
            .connect(initialHolder)
            .report(erc20.address, anotherAccount.address);
        });

        describe('when voting for the first time', () => {
          it('should mark as voted', async () => {
            const lssTeamVoteIndex = await governance.lssTeamVoteIndex();
            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(lssAdmin).losslessVote(1, true);

            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should save positive vote correctly', async () => {
            const lssTeamVoteIndex = await governance.lssTeamVoteIndex();
            await governance.connect(lssAdmin).losslessVote(1, true);

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(
              true,
            );
          });

          it('should save negative vote correctly', async () => {
            const lssTeamVoteIndex = await governance.lssTeamVoteIndex();
            await governance.connect(lssAdmin).losslessVote(1, false);

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(
              false,
            );
          });
        });

        describe('when voting second time for the same report', () => {
          it('should revert', async () => {
            const lssTeamVoteIndex = await governance.lssTeamVoteIndex();
            
            expect(await governance.connect(lssAdmin).losslessVote(1, false));

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(false,);

            await expect(
              governance.connect(lssAdmin).losslessVote(1, true),
            ).to.be.revertedWith("LOSSLESS: LSS already voted.");
          });
        });

        describe('when voting for two different reports', () => {
          it('should mark as voted', async () => {
            await erc20
              .connect(initialHolder)
              .approve(controller.address, stakeAmount);

            await controller
              .connect(initialHolder)
              .report(erc20.address, oneMoreAccount.address);

            const lssTeamVoteIndex = await governance.lssTeamVoteIndex();
            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(lssAdmin).losslessVote(1, false);

            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(true);

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(
              false,
            );

            await governance.connect(lssAdmin).losslessVote(2, true);

            expect(
              await governance.getIsVoted(2, lssTeamVoteIndex),
            ).to.be.equal(true);

            expect(await governance.getVote(2, lssTeamVoteIndex)).to.be.equal(
              true,
            );
          });
        });
      });
    });
  });

  describe('projectTeamVote', () => {
    beforeEach(async () => {
      await erc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await erc20
        .connect(initialHolder)
        .approve(controller.address, stakeAmount);

      await controller
        .connect(initialHolder)
        .report(erc20.address, anotherAccount.address);
    });

    describe('when sender is not project team', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(anotherAccount).projectTeamVote(1, true),
        ).to.be.revertedWith('LOSSLESS: must be project team');
      });
    });

    describe('when report is not valid', () => {
      describe('when report does not exist', () => {
        it('should revert', async () => {
          await expect(
            governance.connect(admin).projectTeamVote(10, true),
          ).to.be.revertedWith('LOSSLESS: report is not valid');
        });
      });

      describe('when report is expired', () => {
        it('should revert', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(reportLifetime)) + 1,
          ]);

          await expect(
            governance.connect(admin).projectTeamVote(1, true),
          ).to.be.revertedWith('LOSSLESS: report is not valid');
        });
      });

      describe('when report is valid', () => {
        describe('when voting for the first time', () => {
          it('should mark as voted', async () => {
            const projectTeamVoteIndex = await governance.projectTeamVoteIndex();
            expect(
              await governance.getIsVoted(1, projectTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).projectTeamVote(1, true);

            expect(
              await governance.getIsVoted(1, projectTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should save positive vote correctly', async () => {
            const projectTeamVoteIndex = await governance.projectTeamVoteIndex();
            await governance.connect(admin).projectTeamVote(1, true);

            expect(
              await governance.getVote(1, projectTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should save negative vote correctly', async () => {
            const projectTeamVoteIndex = await governance.projectTeamVoteIndex();
            await governance.connect(admin).projectTeamVote(1, false);

            expect(
              await governance.getVote(1, projectTeamVoteIndex),
            ).to.be.equal(false);
          });
        });

        describe('when voting second time for the same report', () => {
          it('should revert', async () => {
            await governance.connect(admin).projectTeamVote(1, false);

            await expect(
              governance.connect(admin).projectTeamVote(1, true),
            ).to.be.revertedWith('LOSSLESS: team already voted');
          });
        });

        describe('when voting for two different reports', () => {
          it('should mark as voted', async () => {
            await erc20
              .connect(initialHolder)
              .approve(controller.address, stakeAmount);

            await controller
              .connect(initialHolder)
              .report(erc20.address, oneMoreAccount.address);

            const projectTeamVoteIndex = await governance.projectTeamVoteIndex();
            expect(
              await governance.getIsVoted(1, projectTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).projectTeamVote(1, false);

            expect(
              await governance.getIsVoted(1, projectTeamVoteIndex),
            ).to.be.equal(true);

            expect(
              await governance.getVote(1, projectTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).projectTeamVote(2, true);

            expect(
              await governance.getIsVoted(2, projectTeamVoteIndex),
            ).to.be.equal(true);

            expect(
              await governance.getVote(2, projectTeamVoteIndex),
            ).to.be.equal(true);
          });
        });
      });
    });
  });

  describe('committeeMemberVote', () => {
    beforeEach(async () => {
      await governance
        .connect(lssAdmin)
        .addCommitteeMembers(
          [
            member1.address,
            member2.address,
            member3.address,
            member4.address,
            member5.address,
            member6.address,
            member7.address,
            member8.address,
            member9.address,
          ],
          4,
        );

      await erc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await erc20
        .connect(initialHolder)
        .approve(controller.address, stakeAmount);

      await controller
        .connect(initialHolder)
        .report(erc20.address, anotherAccount.address);
    });

    describe('when sender is not part of the committee', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(recipient).committeeMemberVote(1, true),
        ).to.be.revertedWith('LOSSLESS: Caller is not committee member');
      });
    });

    describe('when report does not exist', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(member1).committeeMemberVote(2, true),
        ).to.be.revertedWith('LOSSLESS: report is not valid');
      });
    });

    describe('when report is expired', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await expect(
          governance.connect(member1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LOSSLESS: report is not valid');
      });
    });

    describe('when report is valid', () => {
      beforeEach(async () => {
        await erc20
          .connect(initialHolder)
          .approve(controller.address, stakeAmount);

        await controller
          .connect(initialHolder)
          .report(erc20.address, oneMoreAccount.address);
      });

      describe('when voting for the first time', () => {
        it('should mark as voted', async () => {
          await governance.connect(member1).committeeMemberVote(1, true);
          expect(
            await governance.getIsCommitteeMemberVoted(1, member1.address),
          ).to.be.equal(true);

          await governance.connect(member2).committeeMemberVote(1, true);
          expect(
            await governance.getIsCommitteeMemberVoted(1, member2.address),
          ).to.be.equal(true);

          await governance.connect(member3).committeeMemberVote(1, true);
          expect(
            await governance.getIsCommitteeMemberVoted(1, member3.address),
          ).to.be.equal(true);

          expect(
            await governance.getIsCommitteeMemberVoted(1, member4.address),
          ).to.be.equal(false);
        });

        it('should count votes', async () => {
          await governance.connect(member1).committeeMemberVote(1, true);
          await governance.connect(member2).committeeMemberVote(1, true);
          await governance.connect(member3).committeeMemberVote(1, true);
          expect(await governance.getCommitteeVotesCount(1)).to.be.equal(3);
        });

        it('should set committee decision when majority is reached', async () => {
          const committeeVoteIndex = await governance.committeeVoteIndex();
          await governance.connect(member1).committeeMemberVote(1, true);
          await governance.connect(member2).committeeMemberVote(1, true);
          await governance.connect(member3).committeeMemberVote(1, true);
          await governance.connect(member4).committeeMemberVote(1, true);

          expect(
            await governance.getIsVoted(1, committeeVoteIndex),
          ).to.be.equal(false);
          expect(await governance.getVote(1, committeeVoteIndex)).to.be.equal(
            false,
          );

          await governance.connect(member5).committeeMemberVote(1, true);
          expect(
            await governance.getIsVoted(1, committeeVoteIndex),
          ).to.be.equal(true);
          expect(await governance.getVote(1, committeeVoteIndex)).to.be.equal(
            true,
          );
        });
      });
    });
  });
});
