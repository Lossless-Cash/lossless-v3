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
let losslessController;
let losslessControllerV1;
let token;
let dex;

const name = 'My Token';
const symbol = 'MTKN';

const supply = 100;
const initialBalance = 100;
const totalSupply = supply + initialBalance;

const { ZERO_ADDRESS } = constants;

function regularERC20() {
  it('has a name', async () => {
    expect(await token.name()).to.equal(name);
  });

  it('has a symbol', async () => {
    expect(await token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async () => {
    expect(await token.decimals()).to.be.equal(18);
  });

  describe('shouldBehaveLikeERC20', () => {
    describe('total supply', () => {
      it('returns the total amount of tokens', async () => {
        expect(await token.totalSupply()).to.be.equal(totalSupply);
      });
    });

    describe('balanceOf', () => {
      describe('when the requested account has no tokens', () => {
        it('returns zero', async () => {
          expect(await token.balanceOf(anotherAccount.address)).to.be.equal(0);
        });
      });

      describe('when the requested account has some tokens', () => {
        it('returns the total amount of tokens', async () => {
          expect(await token.balanceOf(initialHolder.address)).to.be.equal(
            initialBalance,
          );
        });
      });
    });

    describe('transfer', () => {
      describe('when the recipient is not the zero address', () => {
        describe('when the sender does not have enough balance', () => {
          it('reverts', async () => {
            await expect(
              token
                .connect(initialHolder)
                .transfer(recipient.address, initialBalance + 1),
            ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
          });
        });
      });

      describe('when the sender transfers all balance', () => {
        it('transfers the requested amount', async () => {
          await token
            .connect(initialHolder)
            .transfer(recipient.address, initialBalance);
          expect(await token.balanceOf(initialHolder.address)).to.be.equal(0);

          expect(await token.balanceOf(recipient.address)).to.be.equal(
            initialBalance,
          );
        });

        it('emits a transfer event', async () => {
          await expect(
            token
              .connect(initialHolder)
              .transfer(recipient.address, initialBalance),
          )
            .to.emit(token, 'Transfer')
            .withArgs(initialHolder.address, recipient.address, initialBalance);
        });
      });

      describe('when the sender transfers zero tokens', () => {
        it('transfers the requested amount', async () => {
          token.connect(initialHolder).transfer(recipient.address, 0);
          expect(await token.balanceOf(initialHolder.address)).to.be.equal(
            initialBalance,
          );

          expect(await token.balanceOf(recipient.address)).to.be.equal(0);
        });

        it('emits a transfer event', async () => {
          await expect(
            token.connect(initialHolder).transfer(recipient.address, 0),
          )
            .to.emit(token, 'Transfer')
            .withArgs(initialHolder.address, recipient.address, 0);
        });
      });

      describe('when the recipient is the zero address', () => {
        it('reverts', async () => {
          await expect(
            token.connect(initialHolder).transfer(ZERO_ADDRESS, initialBalance),
          ).to.be.revertedWith('LERC20: transfer to the zero address');
        });
      });
    });

    describe('transfer from', () => {
      describe('when the token initialHolder is not the zero address', () => {
        describe('when the recipient is not the zero address', () => {
          describe('when the recipient.address has enough approved balance', () => {
            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance);
            });

            describe('when the token initialHolder has enough balance', () => {
              it('transfers the requested amount', async () => {
                await token
                  .connect(recipient)
                  .transferFrom(
                    initialHolder.address,
                    anotherAccount.address,
                    initialBalance,
                  );

                expect(
                  await token.balanceOf(initialHolder.address),
                ).to.be.equal(0);
                expect(
                  await token.balanceOf(anotherAccount.address),
                ).to.be.equal(initialBalance);
              });

              it('decreases the recipient allowance', async () => {
                await token
                  .connect(recipient)
                  .transferFrom(
                    initialHolder.address,
                    anotherAccount.address,
                    initialBalance,
                  );

                expect(
                  await token.allowance(
                    initialHolder.address,
                    recipient.address,
                  ),
                ).to.be.equal(0);
              });

              it('emits a transfer event', async () => {
                await expect(
                  token
                    .connect(recipient)
                    .transferFrom(
                      initialHolder.address,
                      anotherAccount.address,
                      initialBalance,
                    ),
                )
                  .to.emit(token, 'Transfer')
                  .withArgs(
                    initialHolder.address,
                    anotherAccount.address,
                    initialBalance,
                  );
              });

              it('emits an approval event', async () => {
                await expect(
                  token
                    .connect(recipient)
                    .transferFrom(
                      initialHolder.address,
                      anotherAccount.address,
                      initialBalance,
                    ),
                )
                  .to.emit(token, 'Approval')
                  .withArgs(
                    initialHolder.address,
                    recipient.address,
                    await token.allowance(
                      initialHolder.address,
                      recipient.address,
                    ),
                  );
              });
            });

            describe('when the token initialHolder does not have enough balance', () => {
              it('reverts', async () => {
                await expect(
                  token
                    .connect(recipient)
                    .transferFrom(
                      initialHolder.address,
                      anotherAccount.address,
                      initialBalance + 1,
                    ),
                ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
              });
            });
          });

          describe('when the recipient does not have enough approved balance', () => {
            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance - 1);
            });

            describe('when the token initialHolder has enough balance', () => {
              it('reverts', async () => {
                await expect(
                  token
                    .connect(recipient)
                    .transferFrom(
                      initialHolder.address,
                      anotherAccount.address,
                      initialBalance,
                    ),
                ).to.be.revertedWith(
                  'LERC20: transfer amount exceeds allowance',
                );
              });
            });

            describe('when the token initialHolder does not have enough balance', () => {
              it('reverts', async () => {
                await expect(
                  token
                    .connect(recipient)
                    .transferFrom(
                      initialHolder.address,
                      anotherAccount.address,
                      initialBalance + 1,
                    ),
                ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
              });
            });
          });
        });

        describe('when the recipient is the zero address', () => {
          beforeEach(async () => {
            await token
              .connect(initialHolder)
              .approve(recipient.address, initialBalance);
          });

          it('reverts', async () => {
            await expect(
              token
                .connect(recipient)
                .transferFrom(
                  initialHolder.address,
                  ZERO_ADDRESS,
                  initialBalance,
                ),
            ).to.be.revertedWith('LERC20: transfer to the zero address');
          });
        });
      });

      describe('when the token initialHolder is the zero address', () => {
        it('reverts', async () => {
          await expect(
            token
              .connect(recipient)
              .transferFrom(ZERO_ADDRESS, recipient.address, initialBalance),
          ).to.be.revertedWith('LERC20: transfer from the zero address');
        });
      });
    });

    describe('approve', () => {
      describe('when the recipient is not the zero address', () => {
        describe('when the sender has enough balance', () => {
          it('emits an approval event', async () => {
            await expect(
              token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance),
            )
              .to.emit(token, 'Approval')
              .withArgs(
                initialHolder.address,
                recipient.address,
                initialBalance,
              );
          });

          describe('when there was no approved amount before', () => {
            it('approves the requested amount', async () => {
              await token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance);

              expect(
                await token.allowance(initialHolder.address, recipient.address),
              ).to.be.equal(initialBalance);
            });
          });

          describe('when the recipient had an approved amount', () => {
            describe('when the previous approved amount is not a zero', () => {
              it('reverts', async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 1);
                await expect(
                  token
                    .connect(initialHolder)
                    .approve(recipient.address, initialBalance),
                ).to.be.revertedWith(
                  'LERC20: Cannot change non zero allowance',
                );
              });
            });

            describe('when the previous approved amount is zero', () => {
              it('approves the requested amount and replaces the previous one', async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 1);
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 0);
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, initialBalance);

                expect(
                  await token.allowance(
                    initialHolder.address,
                    recipient.address,
                  ),
                ).to.be.equal(initialBalance);
              });
            });
          });

          describe('when the sender does not have enough balance', () => {
            it('emits an approval event', async () => {
              await expect(
                token
                  .connect(initialHolder)
                  .approve(recipient.address, initialBalance + 1),
              )
                .to.emit(token, 'Approval')
                .withArgs(
                  initialHolder.address,
                  recipient.address,
                  initialBalance + 1,
                );
            });

            describe('when there was no approved amount before', () => {
              it('approves the requested amount', async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, initialBalance + 1);

                expect(
                  await token.allowance(
                    initialHolder.address,
                    recipient.address,
                  ),
                ).to.be.equal(initialBalance + 1);
              });
            });

            describe('when the recipient had an approved amount', () => {
              describe('when the previous approved amount is not a zero', () => {
                it('reverts', async () => {
                  await token
                    .connect(initialHolder)
                    .approve(recipient.address, 1);
                  await expect(
                    token
                      .connect(initialHolder)
                      .approve(recipient.address, initialBalance),
                  ).to.be.revertedWith(
                    'LERC20: Cannot change non zero allowance',
                  );
                });
              });

              describe('when the previous approved amount is zero', () => {
                it('approves the requested amount and replaces the previous one', async () => {
                  await token
                    .connect(initialHolder)
                    .approve(recipient.address, 1);
                  await token
                    .connect(initialHolder)
                    .approve(recipient.address, 0);
                  await token
                    .connect(initialHolder)
                    .approve(recipient.address, initialBalance);

                  expect(
                    await token.allowance(
                      initialHolder.address,
                      recipient.address,
                    ),
                  ).to.be.equal(initialBalance);
                });
              });
            });
          });
        });
      });

      describe('when the recipient is the zero address', () => {
        it('reverts', async () => {
          await expect(
            token.connect(initialHolder).approve(ZERO_ADDRESS, initialBalance),
          ).to.be.revertedWith('LERC20: approve to the zero address');
        });
      });
    });
  });

  describe('decrease allowance', () => {
    describe('when the recipient.address is not the zero address', () => {
      function shouldDecreaseApproval(amount) {
        describe('when there was no approved amount before', () => {
          it('reverts', async () => {
            await expect(
              token
                .connect(initialHolder)
                .decreaseAllowance(recipient.address, amount),
            ).to.be.revertedWith('LERC20: decreased allowance below zero');
          });
        });

        describe('when the recipient.address had an approved amount', () => {
          const approvedAmount = amount;

          beforeEach(async () => {
            ({ logs: this.logs } = await token
              .connect(initialHolder)
              .approve(recipient.address, approvedAmount));
          });

          it('emits an approval event', async () => {
            await expect(
              token
                .connect(initialHolder)
                .decreaseAllowance(recipient.address, approvedAmount),
            )
              .to.emit(token, 'Approval')
              .withArgs(initialHolder.address, recipient.address, 0);
          });

          it('decreases the recipient.address allowance subtracting the requested amount', async () => {
            await token
              .connect(initialHolder)
              .decreaseAllowance(recipient.address, approvedAmount - 1);

            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(1);
          });

          it('sets the allowance to zero when all allowance is removed', async () => {
            await token
              .connect(initialHolder)
              .decreaseAllowance(recipient.address, approvedAmount);
            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(0);
          });

          it('reverts when more than the full allowance is removed', async () => {
            await expect(
              token
                .connect(initialHolder)
                .decreaseAllowance(recipient.address, approvedAmount + 1),
            ).to.be.revertedWith('LERC20: decreased allowance below zero');
          });
        });
      }

      describe('when the sender has enough balance', () => {
        const amount = initialBalance;

        shouldDecreaseApproval(amount);
      });

      describe('when the sender does not have enough balance', () => {
        const amount = initialBalance + 1;

        shouldDecreaseApproval(amount);
      });
    });

    describe('when the recipient.address is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token
            .connect(initialHolder)
            .decreaseAllowance(ZERO_ADDRESS, initialBalance),
        ).to.be.revertedWith('LERC20: decreased allowance below zero');
      });
    });
  });

  describe('increase allowance', () => {
    describe('when the recipient.address is not the zero address', () => {
      describe('when the sender has enough balance', () => {
        it('emits an approval event', async () => {
          await expect(
            token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance),
          )
            .to.emit(token, 'Approval')
            .withArgs(initialHolder.address, recipient.address, initialBalance);
        });

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance);
            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(initialBalance);
          });
        });

        describe('when the recipient.address had an approved amount', () => {
          beforeEach(async () => {
            await token.connect(initialHolder).approve(recipient.address, 1);
          });

          it('increases the recipient.address allowance adding the requested amount', async () => {
            await token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance);

            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(initialBalance + 1);
          });
        });
      });

      describe('when the sender does not have enough balance', () => {
        it('emits an approval event', async () => {
          await expect(
            token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance + 1),
          )
            .to.emit(token, 'Approval')
            .withArgs(
              initialHolder.address,
              recipient.address,
              initialBalance + 1,
            );
        });

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance + 1);

            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(initialBalance + 1);
          });
        });

        describe('when the recipient.address had an approved amount', () => {
          beforeEach(async () => {
            await token.connect(initialHolder).approve(recipient.address, 1);
          });

          it('increases the recipient.address allowance adding the requested amount', async () => {
            await token
              .connect(initialHolder)
              .increaseAllowance(recipient.address, initialBalance + 1);

            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(initialBalance + 2);
          });
        });
      });
    });

    describe('when the recipient.address is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token
            .connect(initialHolder)
            .increaseAllowance(ZERO_ADDRESS, initialBalance),
        ).to.be.revertedWith('LERC20: approve to the zero address');
      });
    });
  });

  describe('_mint', () => {
    it('rejects a null account', async () => {
      await expect(token.mint(ZERO_ADDRESS, 50)).to.be.revertedWith(
        'LERC20: mint to the zero address',
      );
    });

    describe('for a non zero account', () => {
      beforeEach('minting', async () => {
        await token.mint(recipient.address, 50);
      });

      it('increments totalSupply', async () => {
        const expectedSupply = totalSupply + 50;
        expect(await token.totalSupply()).to.be.equal(expectedSupply);
      });

      it('increments recipient balance', async () => {
        expect(await token.balanceOf(recipient.address)).to.be.equal(50);
      });

      it('emits Transfer event', async () => {
        await expect(token.mint(recipient.address, 50))
          .to.emit(token, 'Transfer')
          .withArgs(ZERO_ADDRESS, recipient.address, 50);
      });
    });
  });

  describe('_transfer', () => {
    describe('when the recipient is not the zero address', () => {
      describe('when the sender does not have enough balance', () => {
        it('reverts', async () => {
          await expect(
            token.transferInternal(
              initialHolder.address,
              recipient.address,
              initialBalance + 1,
            ),
          ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
        });
      });
    });

    describe('when the sender transfers all balance', () => {
      it('transfers the requested amount', async () => {
        await token.transferInternal(
          initialHolder.address,
          recipient.address,
          initialBalance,
        );
        expect(await token.balanceOf(initialHolder.address)).to.be.equal(0);

        expect(await token.balanceOf(recipient.address)).to.be.equal(
          initialBalance,
        );
      });

      it('emits a transfer event', async () => {
        await expect(
          token.transferInternal(
            initialHolder.address,
            recipient.address,
            initialBalance,
          ),
        )
          .to.emit(token, 'Transfer')
          .withArgs(initialHolder.address, recipient.address, initialBalance);
      });
    });

    describe('when the sender transfers zero tokens', () => {
      it('transfers the requested amount', async () => {
        token.transferInternal(initialHolder.address, recipient.address, 0);
        expect(await token.balanceOf(initialHolder.address)).to.be.equal(
          initialBalance,
        );

        expect(await token.balanceOf(recipient.address)).to.be.equal(0);
      });

      it('emits a transfer event', async () => {
        await expect(
          token.transferInternal(initialHolder.address, recipient.address, 0),
        )
          .to.emit(token, 'Transfer')
          .withArgs(initialHolder.address, recipient.address, 0);
      });
    });

    describe('when the recipient is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token.transferInternal(
            initialHolder.address,
            ZERO_ADDRESS,
            initialBalance,
          ),
        ).to.be.revertedWith('LERC20: transfer to the zero address');
      });
    });

    describe('when the sender is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token.transferInternal(
            ZERO_ADDRESS,
            recipient.address,
            initialBalance,
          ),
        ).to.be.revertedWith('LERC20: transfer from the zero address');
      });
    });
  });

  describe('_approve', () => {
    describe('when the recipient is not the zero address', () => {
      describe('when the sender has enough balance', () => {
        it('emits an approval event', async () => {
          await expect(
            token.approveInternal(
              initialHolder.address,
              recipient.address,
              initialBalance,
            ),
          )
            .to.emit(token, 'Approval')
            .withArgs(initialHolder.address, recipient.address, initialBalance);
        });

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await token.approveInternal(
              initialHolder.address,
              recipient.address,
              initialBalance,
            );

            expect(
              await token.allowance(initialHolder.address, recipient.address),
            ).to.be.equal(initialBalance);
          });
        });

        describe('when the recipient had an approved amount', () => {
          describe('when the previous approved amount is not a zero', () => {
            it('reverts', async () => {
              await token.connect(initialHolder).approve(recipient.address, 1);
              await expect(
                token
                  .connect(initialHolder)
                  .approve(recipient.address, initialBalance),
              ).to.be.revertedWith('LERC20: Cannot change non zero allowance');
            });
          });

          describe('when the previous approved amount is zero', () => {
            it('approves the requested amount and replaces the previous one', async () => {
              await token.connect(initialHolder).approve(recipient.address, 1);
              await token.connect(initialHolder).approve(recipient.address, 0);
              await token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance);

              expect(
                await token.allowance(initialHolder.address, recipient.address),
              ).to.be.equal(initialBalance);
            });
          });
        });

        describe('when the sender does not have enough balance', () => {
          it('emits an approval event', async () => {
            await expect(
              token.approveInternal(
                initialHolder.address,
                recipient.address,
                initialBalance + 1,
              ),
            )
              .to.emit(token, 'Approval')
              .withArgs(
                initialHolder.address,
                recipient.address,
                initialBalance + 1,
              );
          });

          describe('when there was no approved amount before', () => {
            it('approves the requested amount', async () => {
              await token.approveInternal(
                initialHolder.address,
                recipient.address,
                initialBalance + 1,
              );

              expect(
                await token.allowance(initialHolder.address, recipient.address),
              ).to.be.equal(initialBalance + 1);
            });
          });

          describe('when the recipient had an approved amount', () => {
            describe('when the previous approved amount is not a zero', () => {
              it('reverts', async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 1);
                await expect(
                  token
                    .connect(initialHolder)
                    .approve(recipient.address, initialBalance),
                ).to.be.revertedWith(
                  'LERC20: Cannot change non zero allowance',
                );
              });
            });

            describe('when the previous approved amount is zero', () => {
              it('approves the requested amount and replaces the previous one', async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 1);
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 0);
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, initialBalance);

                expect(
                  await token.allowance(
                    initialHolder.address,
                    recipient.address,
                  ),
                ).to.be.equal(initialBalance);
              });
            });
          });
        });
      });
    });

    describe('when the recipient is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token.approveInternal(
            initialHolder.address,
            ZERO_ADDRESS,
            initialBalance,
          ),
        ).to.be.revertedWith('LERC20: approve to the zero address');
      });
    });

    describe('when the initialHolder is the zero address', () => {
      it('reverts', async () => {
        await expect(
          token.approveInternal(
            ZERO_ADDRESS,
            recipient.address,
            initialBalance,
          ),
        ).to.be.revertedWith('LERC20: approve from the zero address');
      });
    });
  });
}

describe('LosslessStaking', () => {
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

    const LosslessStaking = await ethers.getContractFactory(
      'LosslessStaking',
    );

    losslessControllerV1 = await upgrades.deployProxy(
      LosslessController,
      [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
      { initializer: 'initialize' },
    );

    losslessController = await upgrades.upgradeProxy(
      losslessControllerV1.address,
      LosslessStaking,
      { initializer: 'initialize' },
    );

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    token = await LERC20Mock.deploy(
      supply,
      name,
      symbol,
      initialHolder.address,
      initialBalance,
      losslessController.address,
      admin.address,
      adminBackup.address,
      Number(time.duration.days(1)),
    );
  });

  describe('getVersion', () => {
    it('should get version', async () => {
      expect(
        await losslessController.connect(oneMoreAccount).getVersion(),
      ).to.be.equal(3);
    });
  });

  describe('getLockedAmount', () => {
    it('should get locked amounts correctly after one transfer', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 100);

      expect(
        await losslessController.getLockedAmount(
          token.address,
          recipient.address,
        ),
      ).to.be.equal(100);
    });

    it('should get locked amounts correctly after a few transfers', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);

      expect(
        await losslessController.getLockedAmount(
          token.address,
          recipient.address,
        ),
      ).to.be.equal(3);
    });

    it('should get locked amounts correctly after a few transfers', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);

      await ethers.provider.send('evm_increaseTime', [
        Number(duration.minutes(5)),
      ]);

      await token.connect(initialHolder).transfer(recipient.address, 5);
      await token.connect(initialHolder).transfer(recipient.address, 6);

      expect(
        await losslessController.getLockedAmount(
          token.address,
          recipient.address,
        ),
      ).to.be.equal(11);
    });
  });

  describe('getAvailableAmount', () => {
    it('should get available amount correctly', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);

      await ethers.provider.send('evm_increaseTime', [
        Number(duration.minutes(5)),
      ]);

      await token.connect(initialHolder).transfer(recipient.address, 5);
      await token.connect(initialHolder).transfer(recipient.address, 6);

      expect(
        await losslessController.getAvailableAmount(
          token.address,
          recipient.address,
        ),
      ).to.be.equal(30);
    });
  });

  describe('getAvailableAmount', () => {
    it('should get available amount correctly', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);
      await token.connect(initialHolder).transfer(recipient.address, 10);

      await ethers.provider.send('evm_increaseTime', [
        Number(duration.minutes(5)),
      ]);

      await token.connect(initialHolder).transfer(recipient.address, 5);
      await token.connect(initialHolder).transfer(recipient.address, 6);

      expect(
        await losslessController.getAvailableAmount(
          token.address,
          recipient.address,
        ),
      ).to.be.equal(30);
    });
  });

  describe('transfer instantly after recieving', () => {
    describe('recipient is in dexlist', () => {
      beforeEach(async () => {
        await losslessController.connect(lssAdmin).addToDexList(dex.address);
      });

      it('should revert in case cooldown is not done', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await expect(
          token.connect(recipient).transfer(dex.address, 10),
        ).to.be.revertedWith('LERC20: transfer amount exceeds balance');
      });

      it('should succeed in case amount is below threshold', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(recipient).transfer(dex.address, 1);

        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(0);

        expect(await token.balanceOf(recipient.address)).to.be.equal(9);

        await ethers.provider.send('evm_increaseTime', [
          Number(duration.hours(1)),
        ]);
        await network.provider.send('evm_mine');

        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(9);
      });

      it('should succeed if cooldown is finished', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(initialHolder).transfer(recipient.address, 10);

        await ethers.provider.send('evm_increaseTime', [
          Number(duration.minutes(5)),
        ]);

        await token.connect(recipient).transfer(dex.address, 10);
        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(10);
      });

      it('should revert if more than one transfer in a row', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(initialHolder).transfer(recipient.address, 10);

        await token.connect(recipient).transfer(dex.address, 1);
        await expect(
          token.connect(recipient).transfer(dex.address, 1),
        ).to.be.revertedWith('LERC20: transfers limit reached');
      });

      it('should allow transfering if cooldown is finished, but more than one transfer in a row', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(initialHolder).transfer(recipient.address, 10);

        await ethers.provider.send('evm_increaseTime', [
          Number(duration.minutes(5)),
        ]);
        await network.provider.send('evm_mine');

        await token.connect(recipient).transfer(dex.address, 1);
        await token.connect(recipient).transfer(dex.address, 1);

        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(18);
      });
    });

    describe('recipient is not in dexlist', () => {
      it('should succeed if cooldown is not finished', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);
        await token.connect(initialHolder).transfer(recipient.address, 10);

        await token.connect(recipient).transfer(initialHolder.address, 10);
        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(0);

        expect(
          await losslessController.getLockedAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(10);
      });

      it('should succeed if cooldown is finished', async () => {
        await token.connect(initialHolder).transfer(recipient.address, 10);

        await ethers.provider.send('evm_increaseTime', [
          Number(duration.minutes(5)),
        ]);

        await token.connect(recipient).transfer(initialHolder.address, 10);
        expect(
          await losslessController.getAvailableAmount(
            token.address,
            recipient.address,
          ),
        ).to.be.equal(0);
      });
    });
  });

  describe('prevent DoSing a wallet', () => {
    it('should not increase queue when transfering in the same block', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 1);

      await network.provider.send('evm_setAutomine', [false]);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await network.provider.send('evm_setAutomine', [true]);
      await token.connect(initialHolder).transfer(recipient.address, 1);

      await network.provider.send('evm_setAutomine', [false]);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await network.provider.send('evm_setAutomine', [true]);

      expect(
        await losslessController.getQueueTail(token.address, recipient.address),
      ).to.be.equal(2);
    });

    // it('should calculate available amount correctly', async () => {
    //   await token.connect(initialHolder).transfer(recipient.address, 1);

    //   await network.provider.send('evm_setAutomine', [false]);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await network.provider.send('evm_setAutomine', [true]);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);

    //   await ethers.provider.send('evm_increaseTime', [
    //     Number(duration.minutes(5)) + 1,
    //   ]);

    //   await network.provider.send('evm_setAutomine', [false]);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);
    //   await network.provider.send('evm_setAutomine', [true]);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);

    //   await network.provider.send('evm_setAutomine', [false]);
    //   await token.connect(initialHolder).transfer(recipient.address, 1);

    //   expect(
    //     await losslessController.getQueueTail(token.address, recipient.address),
    //   ).to.be.equal(3);

    //   expect(
    //     await losslessController.getAvailableAmount(
    //       token.address,
    //       recipient.address,
    //     ),
    //   ).to.be.equal(4);
    // });

    it('should calculate available amount correctly', async () => {
      await token.connect(initialHolder).transfer(recipient.address, 1);

      await ethers.provider.send('evm_increaseTime', [
        Number(duration.minutes(5)) + 1,
      ]);

      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);
      await token.connect(initialHolder).transfer(recipient.address, 1);

      await token.connect(initialHolder).transfer(recipient.address, 1);

      await token.connect(initialHolder).transfer(recipient.address, 1);

      await token.connect(recipient).transfer(initialHolder.address, 1);
    });
  });

  // regularERC20();
});
