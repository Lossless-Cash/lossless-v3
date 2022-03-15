const { controllerProxy, reportingProxy, stakingProxy } = require('./address-book');

/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable global-require */
async function main() {
    console.log('Deploying Governance Contract...');
  
    const LosslessGovernance = await ethers.getContractFactory(
      'LosslessGovernance',
    );
  
    const lssGovernance = await upgrades.deployProxy(
      LosslessGovernance,
      [
        reportingProxy,
        controllerProxy,
        stakingProxy,
      ],
      { initializer: 'initialize' },
    );
    
    console.log(`Deployed at ${lssGovernance.address}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  