require('dotenv').config();
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');
require('solidity-coverage');

module.exports = {
  defaultNetwork: 'hardhat',

  networks: {
    hardhat: {
      accounts: [
        // 5 accounts with 10^14 ETH each
        {
          privateKey: `${process.env.ACCOUNT1}`,
          balance: '100000000000000000000000000000000',
        },
        {
          privateKey: `${process.env.ACCOUNT2}`,
          balance: '100000000000000000000000000000000',
        },
        {
          privateKey: `${process.env.ACCOUNT3}`,
          balance: '100000000000000000000000000000000',
        },
        {
          privateKey: `${process.env.ACCOUNT4}`,
          balance: '100000000000000000000000000000000',
        },
        {
          privateKey: `${process.env.ACCOUNT5}`,
          balance: '100000000000000000000000000000000',
        },
      ],
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
