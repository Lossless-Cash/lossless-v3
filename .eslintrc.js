module.exports = {
  extends: 'airbnb',
  env: { mocha: true },
  rules: {
    'func-names': ['error', 'never'],
    'no-underscore-dangle': 0,
  },
  globals: {
    contract: 'writable',
    artifacts: 'writable',
    ethers: 'writable',
    upgrades: 'writable',
    network: 'writable',
  },
};
