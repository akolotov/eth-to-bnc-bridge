#!/bin/bash

set -e

cd $(dirname "$0")

echo "Starting side test blockchain"

docker kill ganache_side > /dev/null 2>&1 || true
docker network create blockchain_side > /dev/null 2>&1 || true
docker run -d --network blockchain_side --rm --name ganache_side trufflesuite/ganache-cli:latest -m "shrug dwarf easily blade trigger lucky reopen cage lake scatter desk boat" -i 33 -q

echo "Starting home test blockchain"

docker kill ganache_home > /dev/null 2>&1 || true
docker network create blockchain_home > /dev/null 2>&1 || true
docker run -d --network blockchain_home --rm --name ganache_home trufflesuite/ganache-cli:latest -m "shrug dwarf easily blade trigger lucky reopen cage lake scatter desk boat" -i 44 -q

sleep 4



echo "Compiling and deploying erc20"

cd ../src/deploy/deploy-test

echo "Building deploy docker image"
docker build -t deploy_test . > /dev/null 2>&1
echo "Deploying"
docker run --network blockchain_home --rm --env-file .env -v "$(pwd)/build:/build/build" deploy_test --network development --reset > /dev/null 2>&1



echo "Compiling and deploying home part"

cd ../deploy-home

echo "Building deploy docker image"
docker build -t deploy_home . > /dev/null 2>&1
echo "Deploying"
docker run --network blockchain_home --rm --env-file .env -v "$(pwd)/build:/build/build" deploy_home --network development --reset > /dev/null 2>&1



echo "Compiling and deploying side part"

cd ../deploy-side

echo "Building deploy docker image"
docker build -t deploy_side . > /dev/null 2>&1
echo "Deploying"
docker run --network blockchain_side --rm --env-file .env -v "$(pwd)/build:/build/build" deploy_side --network development --reset > /dev/null 2>&1



echo "Done"
