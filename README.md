## Introduction
This repository contains Kyber utils smart contracts.
For more details, please visit our [developer portal](https://developer.kyber.network/)

## Package Manager
We use `yarn` as the package manager. You may use `npm` and `npx` instead, but commands in bash scripts may have to be changed accordingly.

## Setup
1. Clone this repo
2. `yarn`

## Compilation
`yarn compile` to compile contracts.

## Testing
1. If contracts have not been compiled, run `yarn compile`. This step can be skipped subsequently.
2. Run full regression `yarn test`
3. Use `./test.sh -f` for running a specific test file.

### Example Commands
- `yarn test` (Runs all tests)
- `yarn buidler test --no-compile ./test/utils.js` (Test only utils.js)
or
- `./test.sh -f ./test/utils.js` (Test only utils.js)

## Running coverage
- `yarn coverage` (Runs coverage for all applicable files)
