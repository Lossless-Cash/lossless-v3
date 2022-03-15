/* eslint-disable max-len */
/* eslint-disable no-undef */
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

  describe('when setting up the Committee', () => {
    describe('when adding Committe members', () => {
      it('should revert when not admin', async () => {
        await expect(
          env.lssGovernance.connect(adr.regularUser1).addCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member3.address]),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert when duplicate members', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member2.address]),
        ).to.be.revertedWith('LSS: duplicate members');
      });

      it('should add members', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address]);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member1.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member2.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member3.address),
        ).to.be.equal(true);
      });

      it('should not revert if changing admin', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address]);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member1.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member2.address),
        ).to.be.equal(true);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member3.address),
        ).to.be.equal(true);

        await env.lssController.connect(adr.lssRecoveryAdmin).setAdmin(adr.regularUser4.address);

        await expect(
          env.lssGovernance.connect(adr.regularUser4).removeCommitteeMembers([adr.member1.address]),
        ).to.not.be.reverted;
      });
    });

    describe('when removing Committee members', () => {
      it('should revert when not admin', async () => {
        await expect(
          env.lssGovernance.connect(adr.regularUser1).removeCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member3.address,
            adr.member4.address,
            adr.member5.address]),
        ).to.be.revertedWith('LSS: Must be admin');
      });

      it('should revert if there are no members', async () => {
        await expect(
          env.lssGovernance.connect(adr.lssAdmin).removeCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member3.address,
            adr.member4.address,
            adr.member5.address]),
        ).to.be.revertedWith('LSS: Not enough members to remove');
      });

      it('should revert if an address is not member', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address]);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).removeCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member3.address,
            adr.member5.address]),
        ).to.be.revertedWith('LSS: An address is not member');
      });

      it('should revert if a duplicate address exists in the array', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address]);

        await expect(
          env.lssGovernance.connect(adr.lssAdmin).removeCommitteeMembers([
            adr.member1.address,
            adr.member2.address,
            adr.member3.address,
            adr.member3.address]),
        ).to.be.revertedWith('LSS: An address is not member');
      });

      it('should remove members', async () => {
        await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
          adr.member1.address,
          adr.member2.address,
          adr.member3.address,
          adr.member4.address,
          adr.member5.address]);

        await env.lssGovernance.connect(adr.lssAdmin)
          .removeCommitteeMembers([adr.member2.address, adr.member4.address]);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member2.address),
        ).to.be.equal(false);

        expect(
          await env.lssGovernance.isCommitteeMember(adr.member4.address),
        ).to.be.equal(false);
      });
    });
  });
});
