const { constants, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const { ZERO_ADDRESS } = constants;
let initialHolder;
let recipient;
let admin;
let recoveryAdmin;
let lssAdmin;
let lssRecoveryAdmin;
let pauseAdmin;
let anotherAccount;
let token;
let losslessController;
let losslessControllerV2;
let deployer;
const name = 'My Token';
const symbol = 'MTKN';
const supply = 100;
const initialBalance = 100;
const totalSupply = supply + initialBalance;

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
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
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
          ).to.be.revertedWith('ERC20: transfer to the zero address');
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
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
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
                  'ERC20: transfer amount exceeds allowance',
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
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
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
            ).to.be.revertedWith('ERC20: transfer to the zero address');
          });
        });
      });

      describe('when the token initialHolder is the zero address', () => {
        it('reverts', async () => {
          await expect(
            token
              .connect(recipient)
              .transferFrom(ZERO_ADDRESS, recipient.address, initialBalance),
          ).to.be.revertedWith('ERC20: transfer from the zero address');
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
            it('approves the requested amount and replaces the previous one', async () => {
              await token.connect(initialHolder).approve(recipient.address, 1);

              await token
                .connect(initialHolder)
                .approve(recipient.address, initialBalance);

              expect(
                await token.allowance(initialHolder.address, recipient.address),
              ).to.be.equal(initialBalance);
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
              beforeEach(async () => {
                await token
                  .connect(initialHolder)
                  .approve(recipient.address, 1);
              });

              it('approves the requested amount and replaces the previous one', async () => {
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
          });
        });
      });

      describe('when the recipient is the zero address', () => {
        it('reverts', async () => {
          await expect(
            token.connect(initialHolder).approve(ZERO_ADDRESS, initialBalance),
          ).to.be.revertedWith('ERC20: approve to the zero address');
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
            ).to.be.revertedWith('ERC20: decreased allowance below zero');
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
            ).to.be.revertedWith('ERC20: decreased allowance below zero');
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
        ).to.be.revertedWith('ERC20: decreased allowance below zero');
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
        ).to.be.revertedWith('ERC20: approve to the zero address');
      });
    });
  });

  describe('_mint', () => {
    it('rejects a null account', async () => {
      await expect(token.mint(ZERO_ADDRESS, 50)).to.be.revertedWith(
        'ERC20: mint to the zero address',
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

  describe('_burn', () => {
    it('rejects a null account', async () => {
      await expect(token.burn(ZERO_ADDRESS, 1)).to.be.revertedWith(
        'ERC20: burn from the zero address',
      );
    });

    describe('for a non zero account', () => {
      it('rejects burning more than balance', async () => {
        await expect(
          token.burn(initialHolder.address, initialBalance + 1),
        ).to.be.revertedWith('ERC20: burn amount exceeds balance');
      });

      const describeBurn = function (description, amount) {
        describe(description, () => {
          it('decrements totalSupply', async () => {
            await token.burn(initialHolder.address, amount);
            expect(await token.totalSupply()).to.be.equal(totalSupply - amount);
          });

          it('decrements initialHolder balance', async () => {
            await token.burn(initialHolder.address, amount);
            expect(await token.balanceOf(initialHolder.address)).to.be.equal(
              initialBalance - amount,
            );
          });

          it('emits Transfer event', async () => {
            await expect(token.burn(initialHolder.address, amount))
              .to.emit(token, 'Transfer')
              .withArgs(initialHolder.address, ZERO_ADDRESS, amount);
          });
        });
      };

      describeBurn('for entire balance', initialBalance);
      describeBurn('for less amount than balance', initialBalance - 1);
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
          ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
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
        ).to.be.revertedWith('ERC20: transfer to the zero address');
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
        ).to.be.revertedWith('ERC20: transfer from the zero address');
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
          it('approves the requested amount and replaces the previous one', async () => {
            await token.connect(initialHolder).approve(recipient.address, 1);

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
            beforeEach(async () => {
              await token.approveInternal(
                initialHolder.address,
                recipient.address,
                1,
              );
            });

            it('approves the requested amount and replaces the previous one', async () => {
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
        ).to.be.revertedWith('ERC20: approve to the zero address');
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
        ).to.be.revertedWith('ERC20: approve from the zero address');
      });
    });
  });
}

describe.skip('ERC20 WITH LOSSLESS V1', () => {
  beforeEach(async () => {
    [
      deployer,
      initialHolder,
      recipient,
      admin,
      recoveryAdmin,
      anotherAccount,
      pauseAdmin,
      lssAdmin,
      lssRecoveryAdmin,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    losslessController = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    token = await LERC20Mock.deploy(
      supply,
      name,
      symbol,
      initialHolder.address,
      initialBalance,
      losslessController.address,
      admin.address,
      recoveryAdmin.address,
      Number(time.duration.days(1)),
    );
  });

  regularERC20();
});

describe.skip('ERC20 WITH LOSSLESS V2', () => {
  beforeEach(async () => {
    [
      deployer,
      initialHolder,
      recipient,
      admin,
      recoveryAdmin,
      anotherAccount,
      pauseAdmin,
      lssAdmin,
      lssRecoveryAdmin,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    const LosslessControllerV2 = await ethers.getContractFactory(
      'LosslessControllerV2',
    );

    losslessController = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);
    losslessControllerV2 = await upgrades.upgradeProxy(
      losslessController.address,
      LosslessControllerV2,
    );

    await losslessControllerV2.connect(lssAdmin).initialize();

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    token = await LERC20Mock.deploy(
      supply,
      name,
      symbol,
      initialHolder.address,
      initialBalance,
      losslessControllerV2.address,
      admin.address,
      recoveryAdmin.address,
      Number(time.duration.days(1)),
    );
  });

  regularERC20();
});

describe.skip('ERC20 WITH LOSSLESS TURNED OFF', () => {
  beforeEach(async () => {
    [
      deployer,
      initialHolder,
      recipient,
      admin,
      recoveryAdmin,
      anotherAccount,
      pauseAdmin,
      lssAdmin,
      lssRecoveryAdmin,
    ] = await ethers.getSigners();

    const LosslessController = await ethers.getContractFactory(
      'LosslessControllerV1',
    );

    losslessController = await upgrades.deployProxy(LosslessController, [
      lssAdmin.address,
      lssRecoveryAdmin.address,
      pauseAdmin.address,
    ]);

    const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
    token = await LERC20Mock.deploy(
      supply,
      name,
      symbol,
      initialHolder.address,
      initialBalance,
      losslessController.address,
      admin.address,
      recoveryAdmin.address,
      Number(time.duration.days(1)),
    );

    await token.connect(recoveryAdmin).proposeLosslessTurnOff();
    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.hours(24)) + 1,
    ]);
    await token.connect(recoveryAdmin).executeLosslessTurnOn();
  });

  regularERC20();
});
