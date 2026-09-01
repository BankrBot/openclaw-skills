#!/bin/bash
# List all DumbMoney reflection tokens on Solana
# Returns: name, symbol, mint address, reflection rate, reserves, earnings data
curl -s "https://dumbmoney.win/api/tokens" | jq '.[] | {name, symbol, mint, reflectionRate: "\(.reflectionBps / 100)%", status, solReserves: "\(.solReserves) SOL", reflectionPoolSol: "\(.reflectionPoolSol) SOL", reflectionPoolUsd: "\(.reflectionPoolUsd | tostring | .[0:10]) USD"}'
