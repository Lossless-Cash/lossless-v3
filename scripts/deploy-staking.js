const { controllerProxy, reportingProxy } = require('./address-book');

/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable global-require */
async function main() {
    console.log('Deploying Staking Contract...');
  
    const LosslessStaking = await ethers.getContractFactory('LosslessStaking');
  
    const lssStaking = await upgrades.deployProxy(
      LosslessStaking,
      [reportingProxy, controllerProxy],
      { initializer: 'initialize' },
    );
  
    console.log(`Deployed at: ${lssStaking.address}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  