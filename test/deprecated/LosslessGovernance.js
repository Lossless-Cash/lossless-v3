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
let lerc20;
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
let balance;

const lssTeamVoteIndex = 0;
const tokenOwnersVoteIndex = 1;
const committeeVoteIndex = 2;


const name = 'My Token';
const symbol = 'MTKN';

const supply = 100;
const initialSupply = 1000000;
const stakeAmount = 2500;
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

    controller = await upgrades.deployProxy(
      LosslessController,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
      { initializer: 'initialize' },
    );

    reporting = await upgrades.deployProxy(
      LosslessReporting,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
      { initializer: 'initialize' },
    );
    
    governance = await upgrades.deployProxy(
      LosslessGovernance,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address, reporting.address, controller.address],
      { initializer: 'initialize' },
    );

    losslessStaking = await upgrades.deployProxy(
      LosslessStaking,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address, reporting.address, controller.address, governance.address],
      { initializer: 'initialize' },
    );


  //governance = await LosslessGovernance.deploy(reporting.address, controller.address);

    const Lerc20Deploy = await ethers.getContractFactory('LERC20');

    lerc20 = await Lerc20Deploy.deploy(
      initialSupply,
      name,
      symbol,
      initialHolder.address,
      admin.address,
      adminBackup.address,
      Number(time.duration.days(1)),
      controller.address,
    );

    await controller.connect(lssAdmin).setStakeAmount(stakeAmount);
    await controller
      .connect(lssAdmin)
      .setReportLifetime(Number(reportLifetime));

    await controller.connect(lssAdmin).setLosslessToken(lerc20.address);
    await losslessStaking.connect(lssAdmin).setLosslessToken(lerc20.address);
    await reporting.connect(lssAdmin).setLosslessToken(lerc20.address);

    await reporting.connect(lssAdmin).setControllerContractAddress(controller.address);
    await reporting.connect(lssAdmin).setStakingContractAddress(losslessStaking.address);
    await controller.connect(lssAdmin).setStakingContractAddress(losslessStaking.address);
    await controller.connect(lssAdmin).setReportingContractAddress(reporting.address);
    await controller.connect(lssAdmin).setGovernanceContractAddress(governance.address);

    await reporting.connect(lssAdmin).setReporterReward(2);
    await reporting.connect(lssAdmin).setLosslessFee(10);

  });
  
  
  describe('contructor', () => {
    it('should set lossless controller correctly', async () => {
      expect(await governance.losslessReporting()).to.be.equal(reporting.address);
    });

    it('should return initial Controller balance', async () => {
      initialControllerBalance = await lerc20.balanceOf(controller.address);
    });

  });

  describe('reporting', () =>{
    beforeEach(async () => {
      await lerc20
            .connect(initialHolder)
            .approve(reporting.address, initialSupply);
    });

    describe('when reporting', () => {
      it('should generate report', async () => {
        await reporting
            .connect(initialHolder)
            .report(lerc20.address, anotherAccount.address);

        expect(
            await reporting.getReportTimestamps(1),
        ).to.not.be.empty;
        
      });

      it('should report another', async () => {
        await reporting
        .connect(initialHolder)
        .report(lerc20.address, anotherAccount.address);

        await reporting
            .connect(initialHolder)
            .reportAnother(1, lerc20.address, member3.address);

        expect(
            await controller.isBlacklisted(member3.address),
        ).to.be.equal(true);
        
      });
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
              ],
              2
            ),
        ).to.be.revertedWith('LSS: must be admin');
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
              ],
              2
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
              ],
              2
            );

          expect(await governance.quorumSize()).to.be.equal(2);
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
                ],
                2
              ),
          ).to.be.revertedWith('LSS: duplicate members');
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
              ],
              2
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
              ],
              4
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
              ],
              4
            );

          expect(await governance.quorumSize()).to.be.equal(4);
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
                ],
                2
              ),
          ).to.be.revertedWith('LSS: duplicate members');
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
              ],
              0
            ),
        ).to.be.revertedWith('LSS: must be admin');
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
                ],
                0
              ),
          ).to.be.revertedWith('LSS: committee has no members');
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
              ],
              2
            );
          await governance.connect(lssAdmin).removeCommitteeMembers([], 1);
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
              ],
              4
            );

          expect(
            await governance.isCommitteeMember(member1.address),
          ).to.be.equal(true);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers([member1.address], 2);

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
              ],
              2
            );

          expect(await governance.quorumSize()).to.be.equal(2);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers([member1.address], 2);

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
              ],
              3
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

          expect(await governance.quorumSize()).to.be.equal(3);

          await governance
            .connect(lssAdmin)
            .removeCommitteeMembers(
              [member1.address, member3.address, member5.address], 2
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
        ).to.be.revertedWith('LSS: must be admin');
      });
    });

    describe('when report is not valid', () => {
      describe('when report does not exist', () => {
        it('should revert', async () => {
          await expect(
            governance.connect(lssAdmin).losslessVote(1, true),
          ).to.be.revertedWith('LSS: report is not valid');
        });
      });

      describe('when report is expired', () => {
        it('should revert', async () => {

          await lerc20
          .connect(initialHolder)
          .approve(initialHolder.address, stakeAmount);

          await lerc20
            .connect(initialHolder)
            .transfer(oneMoreAccount.address, stakeAmount);

          await lerc20
          .connect(initialHolder)
          .approve(reporting.address, stakeAmount);

          await reporting
            .connect(initialHolder)
            .report(lerc20.address, anotherAccount.address);

          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(reportLifetime)) + 1,
          ]);

          await expect(
            governance.connect(lssAdmin).losslessVote(1, true),
          ).to.be.revertedWith('LSS: report is not valid');
        });
      });

      describe('when report is valid', () => {
        beforeEach(async () => {
          await lerc20
            .connect(initialHolder)
            .approve(reporting.address, stakeAmount);

          await reporting
            .connect(initialHolder)
            .report(lerc20.address, anotherAccount.address);
        });

        describe('when voting for the first time', () => {
          it('should mark as voted', async () => {
            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(false);

            await governance.connect(lssAdmin).losslessVote(1, true);

            expect(
              await governance.getIsVoted(1, lssTeamVoteIndex),
            ).to.be.equal(true);
          });

          it('should save positive vote correctly', async () => {
            await governance.connect(lssAdmin).losslessVote(1, true);

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(
              true,
            );
          });

          it('should save negative vote correctly', async () => {
            await governance.connect(lssAdmin).losslessVote(1, false);

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(
              false,
            );
          });
        });

        describe('when voting second time for the same report', () => {
          it('should revert', async () => {
            expect(await governance.connect(lssAdmin).losslessVote(1, false));

            expect(await governance.getVote(1, lssTeamVoteIndex)).to.be.equal(false,);

            await expect(
              governance.connect(lssAdmin).losslessVote(1, true),
            ).to.be.revertedWith('LSS: LSS already voted.');
          });
        });

        describe('when voting for two different reports', () => {
          it('should mark as voted', async () => {
            await lerc20
              .connect(initialHolder)
              .approve(reporting.address, stakeAmount);

            await reporting
              .connect(initialHolder)
              .report(lerc20.address, oneMoreAccount.address);

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

  describe('tokenOwnersVote', () => {
    beforeEach(async () => {
      await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await lerc20
        .connect(initialHolder)
        .approve(reporting.address, stakeAmount);

      await reporting
        .connect(initialHolder)
        .report(lerc20.address, anotherAccount.address);
    });

    describe('when sender is not project team', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(anotherAccount).tokenOwnersVote(1, true),
        ).to.be.revertedWith('LSS: must be project team');
      });
    });

    describe('when report is not valid', () => {
      describe('when report does not exist', () => {
        it('should revert', async () => {
          await expect(
            governance.connect(admin).tokenOwnersVote(10, true),
          ).to.be.revertedWith('LSS: report is not valid');
        });
      });

      describe('when report is expired', () => {
        it('should revert', async () => {
          await ethers.provider.send('evm_increaseTime', [
            Number(time.duration.hours(reportLifetime)) + 1,
          ]);

          await expect(
            governance.connect(admin).tokenOwnersVote(1, true),
          ).to.be.revertedWith('LSS: report is not valid');
        });
      });

      describe('when report is valid', () => {
        describe('when voting for the first time', () => {
          it('should mark as voted', async () => {
            expect(
              await governance.getIsVoted(1, tokenOwnersVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).tokenOwnersVote(1, true);

            expect(
              await governance.getIsVoted(1, tokenOwnersVoteIndex),
            ).to.be.equal(true);
          });

          it('should save positive vote correctly', async () => {
            await governance.connect(admin).tokenOwnersVote(1, true);

            expect(
              await governance.getVote(1, tokenOwnersVoteIndex),
            ).to.be.equal(true);
          });

          it('should save negative vote correctly', async () => {
            await governance.connect(admin).tokenOwnersVote(1, false);

            expect(
              await governance.getVote(1, tokenOwnersVoteIndex),
            ).to.be.equal(false);
          });
        });

        describe('when voting second time for the same report', () => {
          it('should revert', async () => {
            await governance.connect(admin).tokenOwnersVote(1, false);

            await expect(
              governance.connect(admin).tokenOwnersVote(1, true),
            ).to.be.revertedWith('LSS: team already voted');
          });
        });

        describe('when voting for two different reports', () => {
          it('should mark as voted', async () => {
            await lerc20
              .connect(initialHolder)
              .approve(reporting.address, stakeAmount);

            await reporting
              .connect(initialHolder)
              .report(lerc20.address, oneMoreAccount.address);

            expect(
              await governance.getIsVoted(1, tokenOwnersVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).tokenOwnersVote(1, false);

            expect(
              await governance.getIsVoted(1, tokenOwnersVoteIndex),
            ).to.be.equal(true);

            expect(
              await governance.getVote(1, tokenOwnersVoteIndex),
            ).to.be.equal(false);

            await governance.connect(admin).tokenOwnersVote(2, true);

            expect(
              await governance.getIsVoted(2, tokenOwnersVoteIndex),
            ).to.be.equal(true);

            expect(
              await governance.getVote(2, tokenOwnersVoteIndex),
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
          5
        );

      await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await lerc20
        .connect(initialHolder)
        .approve(reporting.address, stakeAmount);

      await reporting
        .connect(initialHolder)
        .report(lerc20.address, anotherAccount.address);
    });

    describe('when sender is not part of the committee', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(recipient).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: Caller is not member');
      });
    });

    describe('when report does not exist', () => {
      it('should revert', async () => {
        await expect(
          governance.connect(member1).committeeMemberVote(2, true),
        ).to.be.revertedWith('LSS: report is not valid');
      });
    });

    describe('when report is expired', () => {
      it('should revert', async () => {
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(reportLifetime)) + 1,
        ]);

        await expect(
          governance.connect(member1).committeeMemberVote(1, true),
        ).to.be.revertedWith('LSS: report is not valid');
      });
    });

    describe('when report is valid', () => {
      beforeEach(async () => {
        await lerc20
          .connect(initialHolder)
          .approve(reporting.address, stakeAmount);

        await reporting
          .connect(initialHolder)
          .report(lerc20.address, oneMoreAccount.address);
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
      
      describe('when voting second time for the same report', () => {
        it('should revert', async () => {
          await governance.connect(member1).committeeMemberVote(1, false);

          await expect(
            governance.connect(member1).committeeMemberVote(1, false),
          ).to.be.revertedWith('LSS: Member already voted.');
        });
      });

      describe('when voting for two different reports', () => {
        it('should register both votes', async () => {
          await governance.connect(member1).committeeMemberVote(1, false);

          expect(
            await governance.getIsCommitteeMemberVoted(1, member1.address),
          ).to.be.equal(true);

          await governance.connect(member1).committeeMemberVote(2, true);

          expect(
            await governance.getIsCommitteeMemberVoted(2, member1.address),
          ).to.be.equal(true);
        });

        it('should count votes for each report', async () => {
          await governance.connect(member1).committeeMemberVote(1, false);
          await governance.connect(member1).committeeMemberVote(2, true);

          expect(await governance.getCommitteeVotesCount(1)).to.be.equal(1);
          expect(await governance.getCommitteeVotesCount(2)).to.be.equal(1);
        });
      
      });
    });
  });

  describe('reportResolution', () => {
    beforeEach(async () => {
      await governance
        .connect(lssAdmin)
        .addCommitteeMembers(
          [
            member1.address,
            member2.address,
            member3.address,
          ],
          2
        );

      await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

      await lerc20
        .connect(initialHolder)
        .approve(reporting.address, stakeAmount);

      await reporting
        .connect(initialHolder)
        .report(lerc20.address, anotherAccount.address);
    });
    
    describe('when report is not resolved', () => {
      it('should not be resolved', async () => {
        expect(
          await governance.isReportSolved(1),
        ).to.be.equal(false);
      });
   
    //Comitee Members Votes
      it('should save committee vote', async () => {
        await governance.connect(member1).committeeMemberVote(1, true);

        expect(
          await governance.getIsCommitteeMemberVoted(1, member1.address),
        ).to.be.equal(true);

        await governance.connect(member2).committeeMemberVote(1, true);

        expect(
          await governance.getIsCommitteeMemberVoted(1, member2.address),
        ).to.be.equal(true);
      });

      //Project Team Vote
      it('should save Team vote', async () => {
        await governance.connect(admin).tokenOwnersVote(1, true);

        expect(
          await governance.getVote(1, tokenOwnersVoteIndex),
        ).to.be.equal(true);
      });
      
      //LossLess Team Vote
      it('should save LSS vote', async () => {

        await governance.connect(lssAdmin).losslessVote(1, true);

        expect(
          await governance.getIsVoted(1, lssTeamVoteIndex),
        ).to.be.equal(true);
      });

      it('should resolve report with everyone agreeing', async () => {
        await governance.connect(lssAdmin).losslessVote(1, true);

        expect(
          await governance.getIsVoted(1, lssTeamVoteIndex),
        ).to.be.equal(true);

        await governance.connect(admin).tokenOwnersVote(1, true);

        expect(
          await governance.getVote(1, tokenOwnersVoteIndex),
        ).to.be.equal(true);

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

        await governance.connect(lssAdmin).resolveReport(1);

        expect(
          await governance.isReportSolved(1),
        ).to.be.equal(true);

        expect(
          await governance.reportResolution(1),
        ).to.be.equal(true);

      });

      it('should resolve report negatively if mayority doesnt agree', async () => {

        await governance.connect(lssAdmin).losslessVote(1, false);
        
        expect(
          await governance.getIsVoted(1, lssTeamVoteIndex),
          ).to.be.equal(true);

        await governance.connect(admin).tokenOwnersVote(1, false);

        expect(
          await governance.getIsVoted(1, tokenOwnersVoteIndex),
        ).to.be.equal(true);

        await governance.connect(member1).committeeMemberVote(1, true);

        expect(
          await governance.getIsCommitteeMemberVoted(1, member1.address),
        ).to.be.equal(true);

        await governance.connect(member2).committeeMemberVote(1, true);

        expect(
          await governance.getIsCommitteeMemberVoted(1, member2.address),
        ).to.be.equal(true);

        await governance.connect(lssAdmin).resolveReport(1);

        expect(
          await governance.isReportSolved(1),
        ).to.be.equal(true);
        
        expect(
          await governance.reportResolution(1),
        ).to.be.equal(false);

      });

      it('should revert with committee not voting', async () => {

        await governance.connect(lssAdmin).losslessVote(1, false);
        
        expect(
          await governance.getIsVoted(1, lssTeamVoteIndex),
          ).to.be.equal(true);

        await governance.connect(admin).tokenOwnersVote(1, true);

        expect(
          await governance.getIsVoted(1, tokenOwnersVoteIndex),
        ).to.be.equal(true);

        await expect(
           governance.connect(lssAdmin).resolveReport(1),
        ).to.be.revertedWith('LSS: Committee resolve pending');
      });
    });
  });

  describe('LosslessStaking', () => {
    it('should get staking contract version', async () => {
      expect(
         await losslessStaking.getVersion(),
      ).to.be.equal(1);
    });

    describe('Account staking', () => {
      describe('when its not staking', () => {
        it('should return false', async () => {
          expect(
             await losslessStaking.getIsAccountStaked(1, anotherAccount.address),
          ).to.be.equal(false);
        });
      });
      
      describe('when staking', () => {
        describe('if report is invalid', () => {
          it('should revert', async () => { 

            await expect(losslessStaking.connect(anotherAccount).stake(1),
            ).to.be.revertedWith("LSS: report does not exists");

          });
        });

        describe('if report is valid', () => {
          beforeEach(async () => {
            await lerc20
            .connect(initialHolder)
            .approve(reporting.address, stakeAmount* 3 + 1000);

            await lerc20
            .connect(initialHolder)
            .transfer(member5.address, 1000);
  
            await reporting
            .connect(initialHolder)
            .report(lerc20.address, member5.address);

            await reporting
            .connect(initialHolder)
            .report(lerc20.address, member6.address);
            
            await reporting
            .connect(initialHolder)
            .report(lerc20.address, member7.address);

            await lerc20
            .connect(oneMoreAccount)
            .approve(reporting.address, stakeAmount*2);

            await lerc20
            .connect(initialHolder)
            .transfer(oneMoreAccount.address, stakeAmount*2);
           
            await lerc20
            .connect(member1)
            .approve(reporting.address, stakeAmount*10);

            await lerc20
            .connect(initialHolder)
            .transfer(member1.address, stakeAmount);

            await ethers.provider.send('evm_increaseTime', [
              Number(time.duration.minutes(5)),
            ]);
    
          });
          
          describe('if sender has no balance', () => {
            it('should revert', async () => {

              await expect(
                losslessStaking.connect(member9).stake(1),
              ).to.be.revertedWith("LSS: Not enough $LSS to stake");
            });
          });

          describe('if sender has balance', () => {
            it('should stake', async () => {
            
              await lerc20
              .connect(oneMoreAccount)
              .approve(losslessStaking.address, stakeAmount);

              await losslessStaking.connect(oneMoreAccount).stake(1);
              
              expect(
                await losslessStaking.getIsAccountStaked(1, oneMoreAccount.address),
              ).to.be.equal(true);
            });
          });

          describe('if report has been staked multiple times', () => {
            it('should get all staking addresses', async () => {
            
              await lerc20
              .connect(oneMoreAccount)
              .approve(losslessStaking.address, stakeAmount);

              await losslessStaking.connect(oneMoreAccount).stake(1);

              await lerc20
              .connect(member1)
              .approve(losslessStaking.address, stakeAmount);

              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(10)),
              ]);

              await losslessStaking.connect(member1).stake(1);

              expect(
                await losslessStaking.getReportStakes(1),
              ).to.have.same.members([oneMoreAccount.address, member1.address]);
            });
          });

          describe('if account has staked multiple times', () => {
            it('should get all reports', async () => {

              await ethers.provider.send('evm_increaseTime', [
                Number(time.duration.minutes(10)),
              ]);
            
              await lerc20
              .connect(oneMoreAccount)
              .approve(losslessStaking.address, stakeAmount*2);

              await losslessStaking.connect(oneMoreAccount).stake(1);

              await losslessStaking.connect(oneMoreAccount).stake(2);

              expect(
                await losslessStaking.getPayoutStatus(oneMoreAccount.address, 1),
              ).to.be.equal(false);
           
              expect(
                await losslessStaking.getAccountStakes(oneMoreAccount.address),
              ).to.be.an('array').that.is.not.empty;
            });
          });
        });
      });
    });
  });

  describe('Lossless Controller funds lock', () =>{
    beforeEach( async () =>{
      await lerc20
      .connect(initialHolder)
      .approve(reporting.address, initialSupply);
      
      await lerc20
      .connect(oneMoreAccount)
      .approve(reporting.address, 500);
    });

    describe('when trasnfering multiple times', () =>{
      it('should lock funds', async () => {
        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 1);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 2);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 3);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 4);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        expect(
          await controller.getLockedAmount(lerc20.address, oneMoreAccount.address),
        ).to.be.equal(15);

      });

      it('should not be able to transfer funds', async () => {
        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await expect(
          lerc20.connect(oneMoreAccount).transfer(member5.address, 40),
        ).to.be.revertedWith("LSS: Amt exceeds settled balance");

      });

      it('should lock funds for five minutes only', async () => {
        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 1);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 2);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 3);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 4);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await lerc20
        .connect(oneMoreAccount)
        .transfer(initialHolder.address, 15);

        expect(
          await controller.getLockedAmount(lerc20.address, oneMoreAccount.address),
        ).to.be.equal(0);

      });

      it('should unlock every transfer after the five minute mark', async () => {
        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 1);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 2);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 3);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 4);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, 5);

        expect(
          await controller.getLockedAmount(lerc20.address, oneMoreAccount.address),
        ).to.be.equal(10);

      });

      

    });

    describe('when blacklisting addresses', () => {

      it('should blacklist address', async () =>{
        
        await controller.connect(lssAdmin).addToBlacklist(oneMoreAccount.address);

        expect(
          await controller.isBlacklisted(oneMoreAccount.address),
        ).to.be.equal(true);

      });

      it('should deblacklist address', async () =>{
        
        await controller.connect(lssAdmin).addToBlacklist(oneMoreAccount.address);

        await controller.connect(lssAdmin).removeFromBlacklist(oneMoreAccount.address);

        expect(
          await controller.isBlacklisted(oneMoreAccount.address),
        ).to.be.equal(false);

      });

      it('should prevent from blacklisting twice', async () =>{
        
        await controller.connect(lssAdmin).addToBlacklist(oneMoreAccount.address);
        
        await expect(
          controller.connect(lssAdmin).addToBlacklist(oneMoreAccount.address),
        ).to.be.revertedWith("LSS: Already blacklisted");

      });

      it('should prevent from deblacklisting a whitelisted account', async () =>{

        await expect(
          controller.connect(lssAdmin).removeFromBlacklist(oneMoreAccount.address),
        ).to.be.revertedWith("LSS: Not blacklisted");

      });
      
    });

    describe('when an address is blacklisted', () =>{
      beforeEach( async () =>{

        await lerc20
        .connect(initialHolder)
        .transfer(oneMoreAccount.address, stakeAmount);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);
        
        await controller.connect(lssAdmin).addToBlacklist(oneMoreAccount.address);

        expect(
          await controller.isBlacklisted(oneMoreAccount.address),
        ).to.be.equal(true);
      });

      it('should prevent from reporting', async () =>{
        await expect(
          reporting.connect(oneMoreAccount).report(lerc20.address, member1.address),
        ).to.be.revertedWith("LSS: You cannot operate");
      });
      
      it('should prevent from staking', async () =>{
          await reporting.connect(initialHolder).report(lerc20.address, member1.address);

          await expect(
            losslessStaking.connect(oneMoreAccount).stake(1),
          ).to.be.revertedWith("LSS: You cannot operate");
      });

      it('should prevent from receiving funds', async () =>{
        await expect(
          lerc20
         .connect(initialHolder)
         .transfer(oneMoreAccount.address, 500),
        ).to.be.revertedWith("LSS: Recipient is blacklisted");
      });

      it('should prevent from sending funds', async () =>{
        await expect(
          lerc20
         .connect(oneMoreAccount)
         .transfer(initialHolder.address, 500),
        ).to.be.revertedWith("LSS: You cannot operate");
      });
    });

  });


  describe('Lossless controller claming', () =>{
    beforeEach(async () => {
      await lerc20
      .connect(initialHolder)
      .approve(reporting.address, initialSupply);

      await lerc20
      .connect(initialHolder)
      .transfer(member5.address, 1000);

      await lerc20
      .connect(oneMoreAccount)
      .approve(reporting.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(oneMoreAccount.address, stakeAmount);
     
      await lerc20
      .connect(member1)
      .approve(losslessStaking.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(member1.address, stakeAmount);

      await lerc20
      .connect(member2)
      .approve(losslessStaking.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(member2.address, stakeAmount);

      await lerc20
      .connect(member3)
      .approve(losslessStaking.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(member3.address, stakeAmount);

      await lerc20
      .connect(member4)
      .approve(losslessStaking.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(member4.address, stakeAmount);

      await lerc20
      .connect(member6)
      .approve(losslessStaking.address, stakeAmount);

      await lerc20
      .connect(initialHolder)
      .transfer(member6.address, stakeAmount);
    });

    describe('when multiple are staking', () =>{
      it('distribute rewards properly', async () => {

        expect (
          balance = await lerc20.balanceOf(losslessStaking.address),
        );
        console.log("Initial balance: %s", balance);
        
        await reporting
            .connect(initialHolder)
            .report(lerc20.address, member5.address);

        expect (
          balance = await lerc20.balanceOf(losslessStaking.address),
        );
        console.log("Balance after reporting: %s", balance);

        await governance
        .connect(lssAdmin)
        .addCommitteeMembers(
          [
            member1.address,
            member2.address,
            member3.address,
            member4.address,
          ],
          2
        );

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(5)),
        ]);

        expect(
            await reporting.getReportTimestamps(1),
        ).to.not.be.empty;

        await losslessStaking.connect(member1).stake(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.minutes(30)),
        ]);

        await losslessStaking.connect(member2).stake(1);
        
        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(2)),
        ]);

        await losslessStaking.connect(member3).stake(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(12)),
        ]);

        await losslessStaking.connect(member4).stake(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(8)),
        ]);

        await losslessStaking.connect(member6).stake(1);

        expect (
          balance = await lerc20.balanceOf(losslessStaking.address),
        );

        console.log("Balance after staking: %s", balance);
        console.log("Staker contract address: %s", losslessStaking.address);

        await expect(
          losslessStaking.connect(member1).stakerClaim(1),
        ).to.be.revertedWith("LSS: Report still open");

        await governance.connect(lssAdmin).losslessVote(1, true);
        await governance.connect(admin).tokenOwnersVote(1, true);
        await governance.connect(member1).committeeMemberVote(1, true);
        await governance.connect(member2).committeeMemberVote(1, true);
        await governance.connect(member3).committeeMemberVote(1, true);

        await governance.connect(lssAdmin).resolveReport(1);

        await ethers.provider.send('evm_increaseTime', [
          Number(time.duration.hours(1)),
        ]);

        expect (
          balance = await lerc20.balanceOf(losslessStaking.address),
        );
        console.log("Balance after resolve: %s", balance);
  
        await losslessStaking.connect(initialHolder).reporterClaimableAmount(1);
        await losslessStaking.connect(member1).stakerClaimableAmount(1);
        await losslessStaking.connect(member2).stakerClaimableAmount(1);
        await losslessStaking.connect(member3).stakerClaimableAmount(1);
        await losslessStaking.connect(member4).stakerClaimableAmount(1);
        await losslessStaking.connect(member6).stakerClaimableAmount(1);

        await losslessStaking.connect(member1).stakerClaim(1);
        await losslessStaking.connect(initialHolder).reporterClaim(1);

        await expect(
          losslessStaking.connect(member1).stakerClaim(1),
        ).to.be.revertedWith("LSS: You already claimed");

        expect (
          balance = await lerc20.balanceOf(losslessStaking.address),
        );
        console.log("Balance after claim: %s", balance);

      });
    });
  });
});
