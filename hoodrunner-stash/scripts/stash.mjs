#!/usr/bin/env node
// Helper for the HoodRunner Stash skill: derive a Stash's deterministic account
// address and encode calldata for each action. Read-only (no signing) — hand the
// encoded calldata to the Bankr Wallet API to submit.
//
//   npm i viem
//   node stash.mjs account   <collection> <tokenId>
//   node stash.mjs unwrap    <account> <token> <amount>
//   node stash.mjs gift      <holder> <to> <tokenId>
//
// Env: RPC_URL (default RHC testnet), ACCOUNT_IMPL, SALT (default 0x00..00).

import { createPublicClient, http, encodeFunctionData, getAddress } from "viem";

const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const SALT = process.env.SALT || `0x${"0".repeat(64)}`;
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com";
const ACCOUNT_IMPL = process.env.ACCOUNT_IMPL; // Stash account implementation

const registryAbi = [{
  type: "function", name: "account", stateMutability: "view",
  inputs: [
    { name: "implementation", type: "address" }, { name: "salt", type: "bytes32" },
    { name: "chainId", type: "uint256" }, { name: "tokenContract", type: "address" },
    { name: "tokenId", type: "uint256" },
  ],
  outputs: [{ type: "address" }],
}];
const erc20Abi = [{ type: "function", name: "transfer", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }];
const stashAbi = [{ type: "function", name: "transferFrom", stateMutability: "nonpayable",
  inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "id", type: "uint256" }], outputs: [] }];
const accountAbi = [{ type: "function", name: "execute", stateMutability: "payable",
  inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }, { name: "operation", type: "uint8" }], outputs: [{ type: "bytes" }] }];

const client = createPublicClient({ transport: http(RPC_URL) });

async function accountAddress(collection, tokenId) {
  if (!ACCOUNT_IMPL) throw new Error("set ACCOUNT_IMPL to the deployed Stash account implementation");
  return client.readContract({
    address: REGISTRY, abi: registryAbi, functionName: "account",
    args: [getAddress(ACCOUNT_IMPL), SALT, BigInt((await client.getChainId())), getAddress(collection), BigInt(tokenId)],
  });
}

const [cmd, ...a] = process.argv.slice(2);
switch (cmd) {
  case "account": {
    console.log(await accountAddress(a[0], a[1]));
    break;
  }
  case "unwrap": {
    const [account, token, amount] = a;
    const inner = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [getAddress(account), BigInt(amount)] });
    const data = encodeFunctionData({ abi: accountAbi, functionName: "execute", args: [getAddress(token), 0n, inner, 0] });
    console.log(JSON.stringify({ to: getAddress(account), value: "0", data }, null, 2));
    break;
  }
  case "gift": {
    const [holder, to, tokenId] = a;
    const data = encodeFunctionData({ abi: stashAbi, functionName: "transferFrom", args: [getAddress(holder), getAddress(to), BigInt(tokenId)] });
    console.log(JSON.stringify({ to: "<STASH_COLLECTION>", value: "0", data }, null, 2));
    break;
  }
  default:
    console.log("usage: account|unwrap|gift  (see header)");
}
