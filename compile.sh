#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096
yarn buidler compile &&
yarn buidler compile --config buidlerConfigSol5.js &&
yarn buidler compile --config buidlerConfigSol4.js &&
node contractSizeReport.js
