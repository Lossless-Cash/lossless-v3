const { ethers, upgrades } = require('hardhat');

async function main() {
  const existingProxyAddress = '0xF10235f15807Bd5b668224F58AEaeC0FEf0C8179'; // Address of the existing proxy contract
  const newImplementationArtifact = 'LosslessReporting'; // Name of the new implementation contract

  // Get the contract factory for the new implementation
  const NewImplementation = await ethers.getContractFactory(
    newImplementationArtifact,
  );

  // Prepare the upgrade and deploy the new implementation if necessary
  console.log('Preparing the upgrade...');
  await upgrades.prepareUpgrade(existingProxyAddress, NewImplementation);

  // Upgrade the existing proxy to the new implementation
  console.log('Upgrading the existing proxy...');
  await upgrades.upgradeProxy(existingProxyAddress, NewImplementation);
  console.log('Proxy upgraded to the new implementation.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
