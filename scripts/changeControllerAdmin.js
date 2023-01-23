/* eslint-disable no-console */
/* eslint-disable no-undef */

const { ethers } = require('hardhat');

const CONTROLLER_PROXY = '0x6bBbEAe8d07A521b0Ed61B279132a93F3Cb64e04';

/* eslint-disable global-require */
async function main() {
  const ControllerProxy = await ethers.getContractFactory(
    'LosslessControllerV3',
  );
  const controllerProxy = await ControllerProxy.attach(CONTROLLER_PROXY);

  await controllerProxy.setAdmin(NEW_ADMIN);

  console.log('Current admin', await controllerProxy.admin());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
