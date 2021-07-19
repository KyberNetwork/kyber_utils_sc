import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import "solidity-coverage";
import { HardhatUserConfig } from "hardhat/types";
import { accounts } from "./test-wallets";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      accounts: accounts,
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      },
    ],
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
  },

  mocha: {
    timeout: 0,
  },

  typechain: {
    target: "ethers-v5",
  },
};

export default config;
