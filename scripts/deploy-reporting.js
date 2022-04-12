const { controllerProxy } = require('./configuration');

/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable global-require */
async function main() {
    console.log('Deploying Reporting Contract...');
  
    const LosslessReporting = await ethers.getContractFactory(
      'LosslessReporting',
    );
  
    const lssReporting = await upgrades.deployProxy(
      LosslessReporting,
      [controllerProxy],
      { initializer: 'initialize' },
    );
  
    console.log(`Deployed at: ${lssReporting.address}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  