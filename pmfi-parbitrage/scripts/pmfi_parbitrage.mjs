#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";
import { ethers } from "ethers";

const BANKR_API = (process.env.BANKR_API_URL || "https://api.bankr.bot").replace(/\/$/, "");
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const CHAIN_ID = 8453;
const VAULT = (process.env.PMFI_PARBITRAGE_VAULT || "0xd1ccbc2aa6e2f41817b62448089d4125e62df4fb").toLowerCase();
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const MIN_DEPOSIT_USDC = Number(process.env.PMFI_MIN_DEPOSIT_USDC || "10");

const ABI = [
  "function requestDeposit(uint256 assets,address receiver) returns (uint256 requestId)",
  "function claimDeposit(uint256 requestId,address receiver) returns (uint256 shares)",
  "function requestRedeem(uint256 shares,address receiver) returns (uint256 requestId)",
  "function claimRedeem(uint256 requestId,address receiver) returns (uint256 assets)",
  "function getUserDepositRequests(address user) view returns (uint256[])",
  "function getUserRedeemRequests(address user) view returns (uint256[])",
  "function getDepositRequest(uint256 requestId) view returns (address owner,address receiver,uint256 assets,uint256 submittedAt,uint8 status,uint256 processedPPS,uint256 estimatedShares)",
  "function getRedeemRequest(uint256 requestId) view returns (address owner,address receiver,uint256 shares,uint256 submittedAt,uint8 status,uint256 claimableAssets,uint256 estimatedAssets)",
  "function depositRequestCount() view returns (uint256)",
  "function redeemRequestCount() view returns (uint256)",
  "function getVaultState() view returns (uint256 officialPPS,uint256 circulatingSupply,uint256 idleBal,uint256 lastReportedBacking,uint256 highWaterMarkAssets,uint256 pendingDepositAssets,uint256 claimableRedeemAssets,uint256 pendingRedeemShares,uint256 lastReportTimestamp,uint256 lastReportNonce,bool paused,bool shutdown)",
  "function balanceOf(address account) view returns (uint256)",
  "function effectiveDepositPPS() view returns (uint256)",
  "function performanceFeesEnabled() view returns (bool)"
];

const USDC_ABI = [
  "function approve(address spender,uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)"
];

const iface = new ethers.Interface(ABI);
const usdcIface = new ethers.Interface(USDC_ABI);
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
const vault = new ethers.Contract(VAULT, ABI, provider);
const usdc = new ethers.Contract(USDC, USDC_ABI, provider);

const STATUS = ["PENDING", "CLAIMABLE", "CLAIMED", "CANCELLED"];

function die(msg) {
  console.error("ERROR:", msg);
  process.exit(1);
}

function findDeep(obj, predicate) {
  if (predicate(obj)) return obj;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const r = findDeep(v, predicate);
      if (r) return r;
    }
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) {
      const r = findDeep(v, predicate);
      if (r) return r;
    }
  }
  return null;
}

function loadBankrKey() {
  if (process.env.BANKR_API_KEY) return process.env.BANKR_API_KEY;

  const p = process.env.BANKR_CONFIG || path.join(os.homedir(), ".bankr", "config.json");
  if (!fs.existsSync(p)) {
    die(`Bankr config not found at ${p}. Run: bankr login email YOUR_EMAIL`);
  }

  const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
  const key = findDeep(cfg, x => typeof x === "string" && (x.startsWith("bk_") || x.startsWith("bankr_")));
  if (!key) die(`Could not find Bankr API key in ${p}`);
  return key;
}

async function bankr(method, endpoint, body = undefined) {
  const res = await fetch(`${BANKR_API}${endpoint}`, {
    method,
    headers: {
      "X-API-Key": loadBankrKey(),
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    die(`Bankr API error ${res.status}: ${JSON.stringify(data).slice(0, 800)}`);
  }

  return data;
}

function findAddress(obj) {
  return findDeep(obj, x => typeof x === "string" && ethers.isAddress(x));
}

async function bankrWallet() {
  const me = await bankr("GET", "/wallet/me");
  const a = findAddress(me);
  if (!a) die(`Could not find EVM wallet in /wallet/me response: ${JSON.stringify(me).slice(0, 800)}`);
  return ethers.getAddress(a);
}

async function submit(to, data, description) {
  const result = await bankr("POST", "/wallet/submit", {
    transaction: {
      to,
      chainId: CHAIN_ID,
      value: "0",
      data
    },
    description,
    waitForConfirmation: true
  });

  const hash = result.transactionHash || result.txHash || result.hash;
  if (!hash) die(`No tx hash returned: ${JSON.stringify(result).slice(0, 800)}`);

  console.log(description);
  console.log(`tx: https://basescan.org/tx/${hash}`);
  console.log(`status: ${result.status || "unknown"}`);

  return hash;
}

function fmtUSDC(x) {
  return ethers.formatUnits(x, 6);
}

function fmtPARB(x) {
  return ethers.formatUnits(x, 18);
}

async function inspect() {
  console.log("PMFI pARBITRAGE Bankr skill");
  console.log(`vault: ${VAULT}`);
  console.log(`chain: Base ${CHAIN_ID}`);
  console.log("flow: async request/claim");
  console.log("");
  for (const fn of ["requestDeposit", "claimDeposit", "requestRedeem", "claimRedeem", "getUserDepositRequests", "getUserRedeemRequests", "getVaultState", "effectiveDepositPPS"]) {
    const f = iface.getFunction(fn);
    console.log(`${fn}: ${f.selector}`);
  }
}

async function status() {
  const w = await bankrWallet();
  const s = await vault.getVaultState();
  let effPps = null;
  try { effPps = await vault.effectiveDepositPPS(); } catch {}

  console.log(`wallet: ${w}`);
  console.log(`vault: ${VAULT}`);
  console.log("");
  console.log(`officialPPS: $${fmtUSDC(s.officialPPS)}`);
  if (effPps !== null) console.log(`effectiveDepositPPS: $${fmtUSDC(effPps)}`);
  console.log(`circulating pARB: ${fmtPARB(s.circulatingSupply)}`);
  console.log(`idle USDC: $${fmtUSDC(s.idleBal)}`);
  console.log(`pending deposit USDC: $${fmtUSDC(s.pendingDepositAssets)}`);
  console.log(`claimable redeem USDC: $${fmtUSDC(s.claimableRedeemAssets)}`);
  console.log(`pending redeem pARB: ${fmtPARB(s.pendingRedeemShares)}`);
  console.log(`last report nonce: ${s.lastReportNonce.toString()}`);
  console.log(`paused: ${s.paused}`);
  console.log(`shutdown: ${s.shutdown}`);
}

async function balance() {
  const w = await bankrWallet();
  const b = await vault.balanceOf(w);
  const s = await vault.getVaultState();
  const est = (b * s.officialPPS) / ethers.parseUnits("1", 18);

  console.log(`wallet: ${w}`);
  console.log(`pARB balance: ${fmtPARB(b)}`);
  console.log(`estimated USDC value: $${fmtUSDC(est)}`);
}

async function requests() {
  const w = await bankrWallet();
  console.log(`wallet: ${w}`);

  async function getDepositIdsSafe() {
    try {
      return await vault.getUserDepositRequests(w);
    } catch (e) {
      console.log("getUserDepositRequests failed, scanning recent deposit requests...");
      try {
        const count = await vault.depositRequestCount();
        const n = Number(count);
        const from = Math.max(0, n - 500);
        const ids = [];
        for (let i = from; i < n; i++) {
          try {
            const r = await vault.getDepositRequest(BigInt(i));
            if (String(r.owner).toLowerCase() === String(w).toLowerCase()) ids.push(BigInt(i));
          } catch {}
        }
        return ids;
      } catch (e2) {
        console.log(`deposit request scan unavailable: ${e2.message}`);
        return [];
      }
    }
  }

  async function getRedeemIdsSafe() {
    try {
      return await vault.getUserRedeemRequests(w);
    } catch (e) {
      console.log("getUserRedeemRequests failed, scanning recent redeem requests...");
      try {
        const count = await vault.redeemRequestCount();
        const n = Number(count);
        const from = Math.max(0, n - 500);
        const ids = [];
        for (let i = from; i < n; i++) {
          try {
            const r = await vault.getRedeemRequest(BigInt(i));
            if (String(r.owner).toLowerCase() === String(w).toLowerCase()) ids.push(BigInt(i));
          } catch {}
        }
        return ids;
      } catch (e2) {
        console.log(`redeem request scan unavailable: ${e2.message}`);
        return [];
      }
    }
  }

  console.log("");
  console.log("deposit requests:");
  const depIds = await getDepositIdsSafe();
  let depShown = 0;
  for (const id of depIds) {
    try {
      const r = await vault.getDepositRequest(id);
      const st = Number(r.status);
      if (st === 0 || st === 1) {
        depShown++;
        console.log(`  #${id.toString()} ${STATUS[st]}: $${fmtUSDC(r.assets)} USDC -> ~${fmtPARB(r.estimatedShares)} pARB`);
      }
    } catch (e) {
      console.log(`  #${id.toString()} read failed: ${e.message}`);
    }
  }
  if (!depShown) console.log("  none active");

  console.log("");
  console.log("withdraw/redeem requests:");
  const redIds = await getRedeemIdsSafe();
  let redShown = 0;
  for (const id of redIds) {
    try {
      const r = await vault.getRedeemRequest(id);
      const st = Number(r.status);
      if (st === 0 || st === 1) {
        redShown++;
        console.log(`  #${id.toString()} ${STATUS[st]}: ${fmtPARB(r.shares)} pARB -> ~$${fmtUSDC(r.estimatedAssets)} USDC`);
      }
    } catch (e) {
      console.log(`  #${id.toString()} read failed: ${e.message}`);
    }
  }
  if (!redShown) console.log("  none active");
}

async function deposit(args) {
  const dry = args.includes("--dry-run");
  args = args.filter(x => x !== "--dry-run");
  if (args.length !== 1) die("usage: deposit <USDC_amount> [--dry-run]");

  const amountNum = Number(args[0]);
  if (!Number.isFinite(amountNum) || amountNum <= 0) die("invalid USDC amount");
  if (amountNum < MIN_DEPOSIT_USDC) die(`minimum deposit is ${MIN_DEPOSIT_USDC} USDC`);

  const w = await bankrWallet();
  const raw = ethers.parseUnits(args[0], 6);

  let usdcBalance = null;
  try {
    usdcBalance = await usdc.balanceOf(w);
  } catch (e) {
    console.log(`warning: could not read USDC balance: ${e.message}`);
  }

  const approveData = usdcIface.encodeFunctionData("approve", [VAULT, raw]);
  const requestData = iface.encodeFunctionData("requestDeposit", [raw, w]);

  console.log(`Deposit request: ${args[0]} USDC -> PMFI pARBITRAGE`);
  console.log(`wallet: ${w}`);
  if (usdcBalance !== null) console.log(`Base USDC balance: ${fmtUSDC(usdcBalance)}`);
  console.log("PMFI will process this deposit after the next vault report. The user receives pARB after PMFI processing.");

  if (dry) {
    if (usdcBalance !== null && usdcBalance < raw) {
      console.log(`warning: wallet does not currently have enough Base USDC for this deposit`);
    }
    console.log(JSON.stringify({
      approve: { to: USDC, chainId: CHAIN_ID, value: "0", data: approveData },
      requestDeposit: { to: VAULT, chainId: CHAIN_ID, value: "0", data: requestData }
    }, null, 2));
    return;
  }

  if (usdcBalance !== null && usdcBalance < raw) {
    die(`insufficient Base USDC. Wallet has ${fmtUSDC(usdcBalance)} USDC, needs ${args[0]} USDC. Send Base USDC to ${w}`);
  }

  const allowance = await usdc.allowance(w, VAULT);
  if (allowance < raw) {
    await submit(USDC, approveData, `Approve ${args[0]} USDC for PMFI pARBITRAGE`);
  } else {
    console.log("USDC allowance already sufficient.");
  }

  await submit(VAULT, requestData, `Request deposit of ${args[0]} USDC into PMFI pARBITRAGE`);
  console.log("Run later: node scripts/pmfi_parbitrage.mjs requests");
}

async function withdraw(args) {
  const dry = args.includes("--dry-run");
  args = args.filter(x => x !== "--dry-run");
  if (args.length !== 1) die("usage: withdraw <pARB_amount> [--dry-run]");

  const amountNum = Number(args[0]);
  if (!Number.isFinite(amountNum) || amountNum <= 0) die("invalid pARB amount");

  const w = await bankrWallet();
  const raw = ethers.parseUnits(args[0], 18);
  const requestData = iface.encodeFunctionData("requestRedeem", [raw, w]);

  console.log(`Withdraw request: ${args[0]} pARB -> USDC`);
  console.log(`wallet: ${w}`);
  console.log("PMFI will process this withdrawal after the next vault report and available liquidity. The user receives USDC after PMFI processing.");

  if (dry) {
    console.log(JSON.stringify({
      requestRedeem: { to: VAULT, chainId: CHAIN_ID, value: "0", data: requestData }
    }, null, 2));
    return;
  }

  let bal;
  try {
    bal = await vault.balanceOf(w);
  } catch (e) {
    die(`could not read pARB balance. Retry or use a stronger BASE_RPC_URL. ${e.message}`);
  }

  if (bal < raw) die(`insufficient pARB. balance: ${fmtPARB(bal)}`);

  await submit(VAULT, requestData, `Request redeem of ${args[0]} pARB from PMFI pARBITRAGE`);
  console.log("Run later: node scripts/pmfi_parbitrage.mjs requests");
}

async function claimDeposit(args) {
  const dry = args.includes("--dry-run");
  args = args.filter(x => x !== "--dry-run");
  if (args.length !== 1) die("usage: claim-deposit <request_id> [--dry-run]");

  const w = await bankrWallet();
  const id = BigInt(args[0]);
  const data = iface.encodeFunctionData("claimDeposit", [id, w]);

  if (dry) {
    console.log(JSON.stringify({
      claimDeposit: { to: VAULT, chainId: CHAIN_ID, value: "0", data }
    }, null, 2));
    return;
  }

  await submit(VAULT, data, `Claim PMFI deposit request #${id.toString()}`);
}

async function claimWithdraw(args) {
  const dry = args.includes("--dry-run");
  args = args.filter(x => x !== "--dry-run");
  if (args.length !== 1) die("usage: claim-withdraw <request_id> [--dry-run]");

  const w = await bankrWallet();
  const id = BigInt(args[0]);
  const data = iface.encodeFunctionData("claimRedeem", [id, w]);

  if (dry) {
    console.log(JSON.stringify({
      claimRedeem: { to: VAULT, chainId: CHAIN_ID, value: "0", data }
    }, null, 2));
    return;
  }

  await submit(VAULT, data, `Claim PMFI withdraw request #${id.toString()}`);
}

const cmd = process.argv[2];
const args = process.argv.slice(3);

try {
  if (!cmd) {
    console.log("commands: deposit <USDC> | withdraw <pARB>");
  } else if (cmd === "deposit") {
    await deposit(args);
  } else if (cmd === "withdraw" || cmd === "redeem") {
    await withdraw(args);
  } else if (process.env.PMFI_DEV_COMMANDS === "1" && cmd === "inspect") {
    await inspect();
  } else if (process.env.PMFI_DEV_COMMANDS === "1" && cmd === "requests") {
    await requests();
  } else if (process.env.PMFI_DEV_COMMANDS === "1" && cmd === "balance") {
    await balance();
  } else {
    die(`unknown command: ${cmd}. Use: deposit <USDC> or withdraw <pARB>`);
  }
} catch (e) {
  die(e?.message || String(e));
}
