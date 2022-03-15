require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');
require('solidity-coverage');
require('@nomiclabs/hardhat-etherscan');
// require('hardhat-abi-exporter');
// require('@openzeppelin/hardhat-defender');
// require('hardhat-gas-reporter');

const {
  PRIVATE_KEY,
  MORALIS_KEY,
  ETHERSCAN_KEY,
} = require('./config');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    artifacts: './src/artifacts',
  },

  networks: {
    // --- TESTNETS ---
    ropsten: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/eth/ropsten/archive`,
      accounts: [PRIVATE_KEY],
    },
    rinkeby: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/eth/rinkeby/archive`,
      accounts: [PRIVATE_KEY],
    },
    bsc_test: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/bsc/testnet/archive`,
      accounts: [PRIVATE_KEY],
    },
    matic_test: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/polygon/mumbai/archive`,
      accounts: [PRIVATE_KEY],
    },
    avax_test: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/testnet`,
      accounts: [PRIVATE_KEY],
    },
    fantom_test: {
      url: `https://rpc.testnet.fantom.network/`,
      accounts: [PRIVATE_KEY],
    },
    harmony_test: {
      url: `https://api.s0.b.hmny.io/`,
      accounts: [PRIVATE_KEY],
    },

    // --- MAINNETS ---
    
    eth: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/eth/mainnet/archive`,
      accounts: [PRIVATE_KEY],
    },
    bsc: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/bsc/mainnet/archive`,
      accounts: [PRIVATE_KEY],
    },
    matic: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/polygon/mainnet/archive`,
      accounts: [PRIVATE_KEY],
    },
    avax: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/mainnet`,
      accounts: [PRIVATE_KEY],
    },
    fantom: {
      url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/fantom/mainnet`,
      accounts: [PRIVATE_KEY],
    },
    harmony: {
      url: `https://api.harmony.one/`,
      accounts: [PRIVATE_KEY],
    },
  },
  // gasReporter: {
  //   currency: 'USD',
  //   gasPrice: 70,
  //   coinmarketcap: COINMARKETCAP,
  // },
  // abiExporter: {
  //   path: './abi',
  //   clear: true,
  //   flat: true,
  //   spacing: 2,
  // },
  // etherscan: {
  //   apiKey: ETHERSCAN_KEY,
  // },
};
