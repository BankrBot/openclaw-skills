#!/usr/bin/env bun
// @ts-nocheck — runs under bun.
// obol-x402-call.ts — pay an x402-protected URL via the Bankr Wallet API (buy-side).
// probe 402 → sign ONE voucher → retry with X-PAYMENT. EIP-712 lives in x402.ts;
// wire details in ../references/x402-protocol.md

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CHAINS, UA, resolveChain, chainCfg, assetMeta, fmt, buildEnvelope } from "./x402.ts";

const USAGE = `bun obol-x402-call.ts [options] URL
  -X, --method M    HTTP method (default GET)
  -d, --data BODY   request body (sent on probe + paid request)
  -H, --header H    extra "Key: value" header (repeatable)
  --probe           show the 402 challenge and exit; do NOT pay
  --max-amount N    refuse to sign if price exceeds N base units
  --network NET     abort unless the seller's chain matches NET
  --from 0x..       buyer address (default: from /wallet/me)
  --rpc-url URL     RPC for on-chain reads (decimals, permit nonce)
  -v, --verbose     log to stderr   -h, --help  this message`;

const die = (m) => { console.error(`ERROR: ${m}`); process.exit(1); };

function parseArgs(argv) {
  const a = { method: "GET", headers: {}, probe: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-X" || t === "--method") a.method = argv[++i];
    else if (t === "-d" || t === "--data") a.body = argv[++i];
    else if (t === "-H" || t === "--header") {
      const h = argv[++i], k = h.indexOf(":");
      if (k < 0) die(`bad header (need 'Key: value'): ${h}`);
      a.headers[h.slice(0, k).trim()] = h.slice(k + 1).trim();
    } else if (t === "--probe") a.probe = true;
    else if (t === "--max-amount") a.maxAmount = BigInt(argv[++i]);
    else if (t === "--network") a.network = argv[++i];
    else if (t === "--from") a.from = argv[++i];
    else if (t === "--rpc-url") a.rpcUrl = argv[++i];
    else if (t === "-v" || t === "--verbose") a.verbose = true;
    else if (t === "-h" || t === "--help") { process.stdout.write(USAGE + "\n"); process.exit(0); }
    else if (t.startsWith("-")) die(`unknown flag: ${t}`);
    else a.url = t;
  }
  if (!a.url) die("URL is required (use -h for usage).");
  return a;
}

function loadBankrConfig() {
  const path = join(process.env.CLAWDBOT_HOME ?? join(homedir(), ".clawdbot"), "skills", "bankr", "config.json");
  if (!existsSync(path)) die(`missing ${path} — set up the bankr skill first.`);
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  if (!cfg.apiKey) die(`apiKey missing in ${path}`);
  return { apiKey: cfg.apiKey, apiUrl: cfg.apiUrl ?? "https://api.bankr.bot" };
}

async function bankr(cfg, path, init) {
  const r = await fetch(`${cfg.apiUrl}${path}`, init);
  const text = await r.text();
  if (!r.ok) die(`${path} returned ${r.status}: ${text}`);
  try { return JSON.parse(text); } catch { die(`${path} returned non-JSON: ${text}`); }
}
async function walletAddress(cfg, override) {
  if (override) return override;
  const b = await bankr(cfg, "/wallet/me", { headers: { "X-API-Key": cfg.apiKey } });
  for (const c of [b?.address, b?.wallet?.address, b?.evmAddress, ...(b?.addresses ?? []), ...((b?.wallets ?? []).map((w) => w?.address))])
    if (typeof c === "string" && /^0x[0-9a-fA-F]{40}$/.test(c)) return c;
  die(`no EVM address in /wallet/me — pass --from 0x...`);
}
function signer(cfg, log) {
  return async (typedData) => {
    log(`sign ${typedData.primaryType}`);
    const b = await bankr(cfg, "/wallet/sign", {
      method: "POST", headers: { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ signatureType: "eth_signTypedData_v4", typedData }),
    });
    if (typeof b?.signature !== "string") die(`no signature from /wallet/sign — key may be read-only or lack Wallet API access.`);
    return b.signature;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (m) => args.verbose && console.error(`» ${m}`);

  const headers = { "User-Agent": UA, ...args.headers };
  if (args.body && !("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  log(`unpaid ${args.method} ${args.url}`);
  const first = await fetch(args.url, { method: args.method, headers, body: args.body });
  const firstText = await first.text();
  if (first.status === 200) { process.stdout.write(firstText); return; }
  if (first.status !== 402) { process.stderr.write(firstText + "\n"); die(`expected 200 or 402, got ${first.status}`); }

  let ch; // parse the 402 challenge
  try { ch = JSON.parse(firstText); } catch { die(`402 body is not JSON:\n${firstText}`); }
  const accept = ch?.accepts?.[0];
  if (!accept) die(`no payment challenge in 402 response`);
  const extensions = ch.extensions ?? {}, extra = accept.extra ?? {};
  const network = accept.network, chainId = resolveChain(network);
  const rpc = args.rpcUrl ?? chainCfg(chainId).rpc;
  const scheme = accept.scheme ?? "exact";
  const asset = accept.asset ?? chainCfg(chainId).usdc;
  if (!asset) die(`402 has no asset and no canonical USDC for ${chainCfg(chainId).name}`);
  const payTo = accept.payTo; if (!payTo) die(`402 missing payTo`);
  const amount = String(accept.amount ?? accept.maxAmountRequired ?? die(`402 has no amount`));
  const method = extra.assetTransferMethod ?? "eip3009";
  const { symbol, decimals } = await assetMeta(chainId, asset, rpc, extra.name);
  const amountBI = BigInt(amount), human = fmt(amountBI, decimals, symbol);
  const sponsored = "eip2612GasSponsoring" in extensions;
  const q = { scheme, network, chainId, asset, payTo, amount, method, symbol, sponsored };

  console.error(`x402 challenge:
  version: ${ch.x402Version ?? 1}   scheme: ${scheme}
  network: ${network} (chainId ${chainId})
  asset:   ${asset} (${symbol}, ${decimals} dec)
  payTo:   ${payTo}
  price:   ${human}  (= ${amount} base units)
  path:    ${method === "permit2" ? `Permit2 witness${sponsored ? " + EIP-2612 sponsoring" : ""}` : "EIP-3009"}`);
  if (args.probe) return;

  if (args.network && resolveChain(args.network) !== chainId) die(`seller is on ${chainCfg(chainId).name} but --network ${args.network} requested.`);
  if (args.maxAmount != null && amountBI > args.maxAmount) die(`price ${amount} base units (${human}) exceeds --max-amount ${args.maxAmount} — refusing.`);
  if (scheme !== "exact") die(`unsupported scheme: ${scheme} (only 'exact')`);

  // sign the voucher
  const cfg = loadBankrConfig();
  const from = await walletAddress(cfg, args.from);
  log(`buyer wallet: ${from}`);
  const deadline = String(Math.floor(Date.now() / 1000) + Math.max(3600, (accept.maxTimeoutSeconds ?? 60) + 600)); // outlive the seller's settle window
  const { env, b64 } = await buildEnvelope({ q, accept, extra, extensions, from, rpc, deadline, sign: signer(cfg, log) });
  log(`envelope: ${JSON.stringify(env)}`);

  // retry; redirect:"manual" stops a signed voucher being replayed to a redirected host.
  log(`retry with X-PAYMENT`);
  const second = await fetch(args.url, { method: args.method, headers: { ...headers, "X-PAYMENT": b64 }, body: args.body, redirect: "manual" });
  const secondText = await second.text();
  const receipt = second.headers.get("x-payment-response");
  if (receipt) try { console.error(`payment receipt: ${JSON.stringify(JSON.parse(Buffer.from(receipt, "base64").toString("utf8")))}`); } catch {}
  if (second.status !== 200) { process.stderr.write(secondText + "\n"); die(`paid request returned ${second.status}. Check chain/asset and that ${from} holds ≥ ${human}.`); }
  process.stdout.write(secondText);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
