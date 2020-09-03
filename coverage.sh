#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096

yarn buidler clean
yarn buidler compile --config ./buidlerConfigSol4.js
yarn buidler compile --config ./buidlerConfigSol5.js
yarn buidler compile --config ./buidlerConfigSol6.js

if [ -n "$FILE" ]
then
    yarn buidler coverage --config ./buidlerConfigSol6.js --testfiles $FILE --solcoverjs ".solcover.js" --temp ""
else
    yarn buidler coverage --config ./buidlerConfigSol4.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
    yarn buidler coverage --config ./buidlerConfigSol5.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
    yarn buidler coverage --config ./buidlerConfigSol6.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
fi
