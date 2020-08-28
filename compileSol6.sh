#!/bin/sh
yarn buidler compile &&
node contractSizeReport.js
