#!/bin/sh
ALL=true

while getopts "f:" arg; do
  case $arg in
    f) FILE=$OPTARG;;
  esac
done

if [ -n "$FILE" ]; then
  yarn buidler test $FILE
else
  echo "Running all tests..."
  yarn buidler test
  yarn buidler test --config ./buidlerConfigSol5.js
  yarn buidler test --config ./buidlerConfigSol4.js
fi
