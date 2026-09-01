#!/usr/bin/env node

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import { fileURLToPath } from "url";
import { recordPayment } from "./v402-policy.mjs";

// Devnet USDC mint
const DEFAULT_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

function loadWallet() {
  const key = process.env.V402_WALLET_PRIVATE_KEY;
  if (!key) throw new Error("V402_WALLET_PRIVATE_KEY is not set");
  return Keypair.fromSecretKey(bs58.decode(key));
}

function getConnection() {
  const url = process.env.V402_RPC_URL || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

function getUsdcMint() {
  return new PublicKey(process.env.V402_USDC_MINT || DEFAULT_USDC_MINT);
}

// ---------------------------------------------------------------------------
// Exported — submit USDC transfer
// ---------------------------------------------------------------------------

export async function submitPayment({ amount, merchant, intentId, toolId }) {
  const start = Date.now();
  const wallet = loadWallet();
  const connection = getConnection();
  const usdcMint = getUsdcMint();
  const merchantPubkey = new PublicKey(merchant);

  const lamports = Math.round(amount * 10 ** USDC_DECIMALS);

  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection, wallet, usdcMint, wallet.publicKey,
  );

  const balance = Number(payerAta.amount);
  if (balance < lamports) {
    return {
      success: false,
      error: `Insufficient USDC balance: have ${balance / 10 ** USDC_DECIMALS}, need ${amount}`,
    };
  }

  const merchantAta = await getOrCreateAssociatedTokenAccount(
    connection, wallet, usdcMint, merchantPubkey,
  );

  const ix = createTransferInstruction(
    payerAta.address,
    merchantAta.address,
    wallet.publicKey,
    lamports,
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);

  const confirmedMs = Date.now() - start;

  recordPayment({
    amount,
    toolId: toolId || "",
    merchant,
    txSignature: sig,
    intentId: intentId || "",
  });

  return {
    success: true,
    tx_signature: sig,
    confirmed_ms: confirmedMs,
    amount,
    merchant,
    payer: wallet.publicKey.toBase58(),
  };
}

export async function getWalletInfo() {
  const wallet = loadWallet();
  const connection = getConnection();
  const usdcMint = getUsdcMint();

  const solBalance = await connection.getBalance(wallet.publicKey);
  let usdcBalance = 0;

  try {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, wallet, usdcMint, wallet.publicKey,
    );
    usdcBalance = Number(ata.amount) / 10 ** USDC_DECIMALS;
  } catch {
    // token account may not exist
  }

  return {
    address: wallet.publicKey.toBase58(),
    sol_balance: solBalance / 1e9,
    usdc_balance: usdcBalance,
    rpc_url: process.env.V402_RPC_URL || "https://api.devnet.solana.com",
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
      case "pay": {
        const result = await submitPayment({
          amount: parseFloat(args.amount || "0"),
          merchant: args.merchant,
          intentId: args.intent_id,
          toolId: args.tool_id,
        });
        console.log(JSON.stringify(result));
        break;
      }
      case "wallet": {
        const info = await getWalletInfo();
        console.log(JSON.stringify(info));
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use pay|wallet` }));
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
