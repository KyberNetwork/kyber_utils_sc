#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096

yarn buidler clean
rm -r ./.coverageArtifacts

# Coverage sequence must be sol4 -> sol6 -> sol5
yarn buidler coverage --config ./buidlerConfigSol4.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
yarn buidler coverage --config ./buidlerConfigSol6.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
yarn buidler coverage --config ./buidlerConfigSol5.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
