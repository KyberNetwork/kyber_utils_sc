#!/bin/sh
while getopts "f:" arg; do
  case $arg in
    f) FILE=$OPTARG;;
  esac
done

if [ -n "$FILE" ]; then
  yarn hardhat test $FILE
else
  yarn hardhat test --config ./hardhat.config.ts
fi
