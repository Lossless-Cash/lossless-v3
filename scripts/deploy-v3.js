/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable global-require */
async function main() {
    const LosslessControllerV3 = await ethers.getContractFactory(
      'LosslessControllerV3',
    );
    
    const controllerV3 = await LosslessControllerV3.deploy();

    console.log(`Deployed at: ${controllerV3.address}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  