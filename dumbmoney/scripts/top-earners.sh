#!/bin/bash
# Find top earning DumbMoney tokens ranked by total reflections paid
# Returns: top 10 tokens by reflection pool size
curl -s "https://dumbmoney.win/api/top-earners" | jq '.[] | {name, symbol, mint, reflectionRate: "\(.reflectionBps / 100)%", totalPaid: "\(.reflectionPoolSol) SOL ($\(.reflectionPoolUsd | tostring | .[0:10]))"}'
