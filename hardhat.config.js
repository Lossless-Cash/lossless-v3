require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');
require('solidity-coverage');
// require('hardhat-abi-exporter');
// require('@nomiclabs/hardhat-etherscan');
// require('@openzeppelin/hardhat-defender');
require('hardhat-gas-reporter');

const {
  ROPSTEN_PRIVATE_KEY,
  INFURA_KEY,
  ETHERSCAN_KEY,
  DEFENDER_KEY,
  DEFENDER_SECRET,
} = require('./config');

module.exports = {
  solidity: '0.8.0',
  paths: {
    artifacts: './src/artifacts',
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_KEY}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    currency: 'EUR',
    gasPrice: 21,
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
    spacing: 2,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_KEY,
  },
  defender: {
    apiKey: DEFENDER_KEY,
    apiSecret: DEFENDER_SECRET,
  },
};
