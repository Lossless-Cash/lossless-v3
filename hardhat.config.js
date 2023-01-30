require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');
require('solidity-coverage');
require('@nomiclabs/hardhat-etherscan');
// require('hardhat-abi-exporter');
// require('@openzeppelin/hardhat-defender');
// require('hardhat-gas-reporter');

// const { PRIVATE_KEY, MORALIS_KEY, ETHERSCAN_KEY } = require('./config');

const PRIVATE_KEY =
  'c5a87baeba1b3a2f4823d0e3251010ec8f67b93e28a66f06f218aa40f01b31e9';
const ETHERSCAN_KEY = '';

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
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.4.24',
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
    elysiumTestnet: {
      url: `https://elysium-test-rpc.vulcanforged.com/`,
      accounts: [PRIVATE_KEY],
    },
    elysiumMainnet: {
      url: `https://elysium-rpc.vulcanforged.com/`,
      chainId: 1339,
      gasPrice: 70000000000000,
      accounts: [PRIVATE_KEY],
    },
  },

  /*   networks: {
    // --- TESTNETS ---
    elysiumTestnet: {
      url: `https://elysium-test-rpc.vulcanforged.com/`,
      accounts: [PRIVATE_KEY],
    },
    ropsten: {
      url: `https://eth-goerli.g.alchemy.com/v2/xJGbk0_IOuNjsaA8_HmzMBmzIKnyx93N`,
      accounts: [PRIVATE_KEY],
    },
  },
  */
  // networks: {
  //   // --- TESTNETS ---
  //   ropsten: {
  //     url: `https://eth-ropsten.alchemyapi.io/v2/YzORPoYzWj2GrWSEmJrelCNuw5FsziK6`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   rinkeby: {
  //     url: 'https://eth-rinkeby.alchemyapi.io/v2/QmxZu6QhVDaiBxWro1HHkTJNNgE-4Ga_',
  //     accounts: [PRIVATE_KEY],
  //   },
  //   bsctest: {
  //     url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   matic_test: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/polygon/mumbai/archive`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   avax_test: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/testnet`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   fantom_test: {
  //     url: 'https://rpc.testnet.fantom.network/',
  //     accounts: [PRIVATE_KEY],
  //   },
  //   harmony_test: {
  //     url: 'https://api.s0.b.hmny.io/',
  //     accounts: [PRIVATE_KEY],
  //   },

  //   // --- MAINNETS ---

  //   eth: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/eth/mainnet/archive`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   bsc: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/bsc/mainnet/archive`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   matic: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/polygon/mainnet/archive`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   avax: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/avalanche/mainnet`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   fantom: {
  //     url: `https://speedy-nodes-nyc.moralis.io/${MORALIS_KEY}/fantom/mainnet`,
  //     accounts: [PRIVATE_KEY],
  //   },
  //   harmony: {
  //     url: 'https://api.harmony.one/',
  //     accounts: [PRIVATE_KEY],
  //   },
  // },
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
  /*   etherscan: {
    apiKey: ETHERSCAN_KEY,
  }, */
};
