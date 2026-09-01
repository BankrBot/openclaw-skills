---
name: solidity-contract-verification
description: |
  Verify Solidity smart contracts on Etherscan, Basescan, and other block explorers using the
  Etherscan V2 Multichain API. Use when: (1) contract deployed but shows unverified on explorer,
  (2) "verify contract" or "verify on basescan/etherscan" requested, (3) verification failing with
  compilation errors, (4) need to flatten source files for verification. Covers single-file and
  standard-json-input formats, constructor argument encoding, and common verification failures.
author: Claude Code
version: 1.1.0
date: 2026-01-27
---

# Solidity Contract Verification on Block Explorers

## Problem
After deploying a smart contract, it needs to be verified on block explorers (Etherscan, Basescan,
Polygonscan, etc.) so users can read the source code and interact with it directly.

## Context / Trigger Conditions
- Contract deployed successfully but shows "unverified" on block explorer
- User requests "verify the contract" or "verify on Basescan"
- Verification failing with cryptic compilation errors
- Need to verify contracts with complex inheritance or many dependencies

## Solution

### Step 1: Choose Verification Method

**Option A: Hardhat Verify Plugin (Recommended for simple contracts)**
```bash
npx hardhat verify --network <network> <contractAddress> "constructorArg1" "constructorArg2"
```

**Option B: Etherscan V2 API (For complex contracts or when hardhat verify fails)**
Use the multichain API at `https://api.etherscan.io/v2/api`

### Step 2: Flatten Source Code (if using API)

```bash
npx hardhat flatten contracts/MyContract.sol > MyContract_flat.sol
```

**CRITICAL: Clean the flattened file!** Hardhat may include warnings/errors in the output:
```
WARNING: You are using Node.js X.X.X which is not supported...
```

These MUST be removed or verification will fail with:
```
Error: Expected identifier but got ':'
```

The verify script should remove:
- Node.js warnings at the top
- Duplicate SPDX license identifiers (keep only the first)
- Duplicate pragma statements (keep only the first)

### Step 3: Encode Constructor Arguments

Constructor arguments must be ABI-encoded (no 0x prefix). For example:
```javascript
// For constructor(address _signer, address royaltyReceiver)
const constructorArgs =
  "00000000000000000000000096f02f313528ca8e8308634b9e95f12780daf4aa" +  // _signer
  "0000000000000000000000006209517a9496987c2aadd03157d1858927e303ed";   // royaltyReceiver
```

Use ethers.js to encode:
```javascript
const { AbiCoder } = require('ethers');
const abiCoder = new AbiCoder();
const encoded = abiCoder.encode(
  ['address', 'address'],
  [signerAddress, royaltyReceiver]
).slice(2); // Remove 0x prefix
```

### Step 4: Etherscan V2 API Request

**CRITICAL: chainid must be in URL query params, NOT in POST body!**

```javascript
// Build URL with chainid and apikey in query string
const baseUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}`;

// POST body params (NO chainid here!)
const bodyParams = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  contractaddress: contractAddress,
  sourceCode: sourceCode,
  codeformat: "solidity-single-file",
  contractname: "MyContractName",
  compilerversion: "v0.8.20+commit.a1b79de6",
  optimizationUsed: "1",
  runs: "200",
  constructorArguements: constructorArgs,  // Note: typo is intentional (Etherscan API quirk)
  evmversion: "shanghai",
  licenseType: "2"  // MIT = 2
});

const response = await fetch(baseUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: bodyParams.toString()
});
```

### Step 5: Poll for Verification Status

```javascript
const checkUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}&module=contract&action=checkverifystatus&guid=${guid}`;

// Poll every 5 seconds, up to 60 seconds
while (attempts < 12) {
  await new Promise(r => setTimeout(r, 5000));
  const result = await fetch(checkUrl).then(r => r.json());

  if (result.result === "Pass - Verified") {
    console.log("Verified!");
    break;
  } else if (result.result?.includes?.("Fail")) {
    console.log("Failed:", result.result);
    break;
  }
  attempts++;
}
```

### Common Chain IDs

> **Note**: A single Etherscan API key works for all 60+ supported chains. Just specify the chain ID.

| Network | Chain ID |
|---------|----------|
| Ethereum Mainnet | 1 |
| Sepolia | 11155111 |
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |
| Polygon | 137 |
| Polygon Amoy | 80002 |
| Arbitrum One | 42161 |
| Optimism | 10 |

### License Types

| Value | License |
|-------|---------|
| 1 | No License (None) |
| 2 | Unlicense |
| 3 | MIT |
| 4 | GNU GPLv2 |
| 5 | GNU GPLv3 |
| 6 | GNU LGPLv2.1 |
| 7 | GNU LGPLv3 |
| 8 | BSD-2-Clause |
| 9 | BSD-3-Clause |
| 10 | MPL-2.0 |
| 11 | OSL-3.0 |
| 12 | Apache-2.0 |
| 13 | GNU AGPLv3 |
| 14 | BSL-1.1 |

### Compiler Version Format

Get exact version from Hardhat config or solc output:
```
v0.8.20+commit.a1b79de6
```

Find versions at: https://etherscan.io/solcversions

## Verification Script Template

```javascript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const contractAddress = "0x...";
  const chainId = 8453; // Base Mainnet
  const apiKey = process.env.ETHERSCAN_API_KEY; // or BASESCAN_API_KEY

  // Read and clean flattened source
  const sourcePath = path.join(__dirname, "../MyContract_flat.sol");
  let sourceCode = fs.readFileSync(sourcePath, "utf8");

  // Remove Node.js warnings (common with newer Node versions)
  sourceCode = sourceCode.replace(/^.*WARNING:.*\n.*\n\n/m, '');

  // Remove duplicate SPDX and pragma (keep first only)
  const lines = sourceCode.split('\n');
  let firstSpdx = true, firstPragma = true;
  const cleanedLines = lines.filter(line => {
    if (line.includes('SPDX-License-Identifier')) {
      if (firstSpdx) { firstSpdx = false; return true; }
      return false;
    }
    if (line.trim().startsWith('pragma solidity')) {
      if (firstPragma) { firstPragma = false; return true; }
      return false;
    }
    return true;
  });
  sourceCode = cleanedLines.join('\n');

  // Constructor arguments (ABI-encoded, no 0x)
  const constructorArgs = "...";

  // Submit verification
  const baseUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}`;
  const bodyParams = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contractAddress,
    sourceCode: sourceCode,
    codeformat: "solidity-single-file",
    contractname: "MyContract",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: constructorArgs,
    evmversion: "shanghai",
    licenseType: "3"  // MIT
  });

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams.toString()
  });

  const result = await response.json();

  if (result.status === "1") {
    const guid = result.result;
    console.log("Submitted! Polling for status...");

    // Poll for result
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const checkUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${apiKey}&module=contract&action=checkverifystatus&guid=${guid}`;
      const checkResult = await fetch(checkUrl).then(r => r.json());

      if (checkResult.result === "Pass - Verified") {
        console.log("Verified!");
        return;
      } else if (checkResult.result?.includes?.("Fail")) {
        console.log("Failed:", checkResult.result);
        break;
      }
    }
  } else {
    console.log("Submission failed:", result);
  }
}

main().catch(console.error);
```

## Common Errors and Fixes

### "Expected identifier but got ':'"
**Cause**: Node.js warnings in flattened file
**Fix**: Remove warning lines from the start of the flattened source

### "Already Verified"
**Cause**: Contract is already verified
**Fix**: None needed - check the explorer to confirm

### "Bytecode does not match"
**Cause**: Compiler settings don't match deployment
**Fix**: Check optimizer settings, runs, EVM version, exact compiler version

### "Invalid constructor arguments"
**Cause**: Arguments not properly ABI-encoded
**Fix**: Use AbiCoder.encode() and remove 0x prefix

### "Source code not found"
**Cause**: Contract name doesn't match or source incomplete
**Fix**: Ensure contractname exactly matches the deployed contract name

### V1 API Errors
**Symptom**: `{"status":"0","message":"Result: V1 API deprecated..."}`
**Cause**: V1 API was fully deprecated on August 15, 2025
**Fix**: Use V2 API at `api.etherscan.io/v2/api` with `chainid` in URL query params. All V1 endpoints are permanently offline.

## References

- [Etherscan V2 API Docs](https://docs.etherscan.io/api-reference/endpoint/verifysourcecode)
- [Hardhat Verify Plugin](https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify)
- [Solidity Compiler Versions](https://etherscan.io/solcversions)
