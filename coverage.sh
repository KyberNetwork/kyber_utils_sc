#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096

yarn hardhat clean
yarn hardhat compile

yarn hardhat coverage --solcoverjs ".solcover.js"
