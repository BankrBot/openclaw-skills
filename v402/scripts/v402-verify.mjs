#!/usr/bin/env node

import { Connection, PublicKey } from "@solana/web3.js";
import { fileURLToPath } from "url";

function getConnection() {
  const url = process.env.V402_RPC_URL || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

// ---------------------------------------------------------------------------
// Parse receipt — accepts JSON string or base64-encoded JSON
// ---------------------------------------------------------------------------

function tryParseReceipt(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

// ---------------------------------------------------------------------------
// Exported — verify receipt on-chain
// ---------------------------------------------------------------------------

export async function verifyReceipt(receiptStr) {
  let receipt;
  try {
    receipt = tryParseReceipt(receiptStr);
  } catch {
    return { valid: false, error: "Cannot parse receipt — must be JSON or base64" };
  }

  const sig = receipt.tx_signature || receipt.txSignature || receipt.txSig;
  if (!sig) {
    return { valid: false, error: "Receipt missing tx_signature" };
  }

  const connection = getConnection();

  let txInfo;
  try {
    txInfo = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    return { valid: false, error: `RPC error: ${err.message}`, on_chain: false };
  }

  if (!txInfo) {
    return { valid: false, error: "Transaction not found on-chain", on_chain: false };
  }

  const txPayer =
    txInfo.transaction.message.staticAccountKeys?.[0]?.toBase58?.() ??
    txInfo.transaction.message.accountKeys?.[0]?.toBase58?.() ??
    null;

  const receiptPayer = receipt.payer;
  const payerMatch = receiptPayer ? txPayer === receiptPayer : true;
  const txSuccess = txInfo.meta?.err === null;

  const accountKeys = txInfo.transaction.message.staticAccountKeys?.map(k => k.toBase58?.()) ??
    txInfo.transaction.message.accountKeys?.map(k => k.toBase58?.()) ?? [];
  const merchantMatch = receipt.merchant ? accountKeys.includes(receipt.merchant) : true;

  const valid = txSuccess && payerMatch && merchantMatch;

  return {
    valid,
    on_chain: true,
    tx_success: txSuccess,
    payer_match: payerMatch,
    merchant_match: merchantMatch,
    tx_payer: txPayer,
    receipt_payer: receiptPayer,
    slot: txInfo.slot,
    block_time: txInfo.blockTime
      ? new Date(txInfo.blockTime * 1000).toISOString()
      : null,
    receipt: {
      intent_id: receipt.intent_id ?? receipt.intentId,
      amount: receipt.amount,
      currency: receipt.currency,
      payer: receipt.payer,
      merchant: receipt.merchant,
      tool_id: receipt.tool_id ?? receipt.toolId,
      tx_signature: sig,
    },
  };
}

export async function inspectTransaction(signature) {
  const connection = getConnection();
  const txInfo = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!txInfo) {
    return { error: "Transaction not found" };
  }

  const cluster = (process.env.V402_RPC_URL || "").includes("mainnet")
    ? "mainnet-beta"
    : "devnet";

  return {
    signature,
    slot: txInfo.slot,
    block_time: txInfo.blockTime
      ? new Date(txInfo.blockTime * 1000).toISOString()
      : null,
    fee: txInfo.meta?.fee,
    status: txInfo.meta?.err ? "failed" : "success",
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const map = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      map[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return map;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  try {
    switch (command) {
      case "verify": {
        const result = await verifyReceipt(args.receipt);
        console.log(JSON.stringify(result));
        break;
      }
      case "inspect": {
        const result = await inspectTransaction(args.tx);
        console.log(JSON.stringify(result));
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use verify|inspect` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
