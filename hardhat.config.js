require('dotenv').config()
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');
require('solidity-coverage');

const { testAccounts } = require('./test/wallets');

module.exports = {
  defaultNetwork: 'hardhat',

  networks: {
    hardhat: {
      accounts: testAccounts
    },
  },

  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
    },
  },

  paths: {
    sources: './contracts',
    tests: './test',
  },

  mocha: {
    enableTimeouts: false,
  },
};
