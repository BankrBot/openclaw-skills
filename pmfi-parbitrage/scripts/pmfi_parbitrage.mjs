#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";
import { ethers } from "ethers";

const BANKR_API = "https://api.bankr.bot";

const UNSAFE_DEV_MODE = process.env.PMFI_UNSAFE_DEV_MODE === "1";
const BASE_RPC_URL =
  UNSAFE_DEV_MODE && process.env.BASE_RPC_URL
    ? process.env.BASE_RPC_URL
    : "https://mainnet.base.org";

const CHAIN_ID = 8453;
const VAULT = ethers.getAddress("0xd1ccbc2aa6e2f41817b62448089d4125e62df4fb");
const USDC = ethers.getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

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
  "function performanceFeesEnabled() view returns (bool)",
  "function MIN_DEPOSIT_USDC() view returns (uint256)",
  "function maxTotalDeposits() view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
  "function usdc() view returns (address)"
];

const USDC_ABI = [
  "function approve(address spender,uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)"
];

const iface = new ethers.Interface(ABI);
const usdcIface = new ethers.Interface(USDC_ABI);
const provider = new ethers.JsonRpcProvider(
  BASE_RPC_URL,
  CHAIN_ID,
  { staticNetwork: true }
);
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

const ALLOWED_BANKR_ENDPOINTS = new Set([
  "/wallet/me",
  "/wallet/submit"
]);

async function bankr(method, endpoint, body = undefined) {
  if (!ALLOWED_BANKR_ENDPOINTS.has(endpoint)) {
    die(`Blocked unexpected Bankr API endpoint: ${endpoint}`);
  }

  const requestUrl = new URL(endpoint, `${BANKR_API}/`);

  if (
    requestUrl.protocol !== "https:" ||
    requestUrl.origin !== BANKR_API ||
    requestUrl.pathname !== endpoint
  ) {
    die(`Blocked untrusted Bankr API URL: ${requestUrl.toString()}`);
  }

  const res = await fetch(requestUrl, {
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
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

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

function assertAllowedTransaction(to, data) {
  const target = ethers.getAddress(to);
  const selector = String(data).slice(0, 10).toLowerCase();

  const approveSelector =
    usdcIface.getFunction("approve").selector.toLowerCase();

  const depositSelector =
    iface.getFunction("requestDeposit").selector.toLowerCase();

  const redeemSelector =
    iface.getFunction("requestRedeem").selector.toLowerCase();

  if (
    target.toLowerCase() === USDC.toLowerCase() &&
    selector === approveSelector
  ) {
    return;
  }

  if (
    target.toLowerCase() === VAULT.toLowerCase() &&
    (selector === depositSelector || selector === redeemSelector)
  ) {
    return;
  }

  die(
    `Blocked unreviewed transaction target or selector: ` +
    `target=${target}, selector=${selector}`
  );
}

async function submit(to, data, description) {
  assertAllowedTransaction(to, data);

  const result = await bankr("POST", "/wallet/submit", {
    transaction: {
      to: ethers.getAddress(to),
      chainId: CHAIN_ID,
      value: "0",
      data
    },
    description,
    waitForConfirmation: true
  });

  const hash =
    result.transactionHash ||
    result.txHash ||
    result.hash;

  if (!hash) {
    die(`No tx hash returned: ${JSON.stringify(result).slice(0, 800)}`);
  }

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

function printRiskNotice() {
  console.log("");
  console.log("Risk notice:");
  console.log("- Deposits and withdrawals are asynchronous.");
  console.log("- Withdrawal timing depends on available vault liquidity.");
  console.log("- The vault is admin-controlled and can be paused or shut down.");
  console.log("- The contract includes administrative emergency-withdrawal functionality.");
  console.log("- Smart-contract, custody, operational, and strategy risks apply.");
  console.log("- No third-party audit is included or referenced by this skill.");
  console.log("- Previewed output is an estimate and may change before processing.");
  console.log("");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rpcRead(label, read, attempts = 4) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await read();
    } catch (e) {
      lastError = e;

      if (attempt < attempts) {
        console.log(
          `warning: ${label} RPC read failed ` +
          `(attempt ${attempt}/${attempts}); retrying`
        );

        await sleep(400 * attempt);
      }
    }
  }

  const reason =
    lastError?.shortMessage ||
    lastError?.message ||
    String(lastError);

  die(
    `${label} RPC read failed after ${attempts} attempts: ` +
    reason
  );
}

async function readVaultPreflight() {
  const network = await rpcRead(
    "Base network",
    () => provider.getNetwork()
  );

  if (network.chainId !== BigInt(CHAIN_ID)) {
    die(
      `wrong network: expected Base ${CHAIN_ID}, ` +
      `received ${network.chainId.toString()}`
    );
  }

  const code = await rpcRead(
    "vault bytecode",
    () => provider.getCode(VAULT)
  );

  if (!code || code === "0x") {
    die(`reviewed vault has no contract code on Base: ${VAULT}`);
  }

  const state = await rpcRead(
    "getVaultState",
    () => vault.getVaultState()
  );

  await sleep(150);

  const onchainMinimum = await rpcRead(
    "MIN_DEPOSIT_USDC",
    () => vault.MIN_DEPOSIT_USDC()
  );

  await sleep(150);

  const cap = await rpcRead(
    "maxTotalDeposits",
    () => vault.maxTotalDeposits()
  );

  await sleep(150);

  const configuredAsset = await rpcRead(
    "vault USDC asset",
    () => vault.usdc()
  );

  if (
    ethers.getAddress(configuredAsset).toLowerCase() !==
    USDC.toLowerCase()
  ) {
    die(
      `vault asset mismatch: expected ${USDC}, ` +
      `received ${configuredAsset}`
    );
  }

  return {
    state,
    onchainMinimum,
    cap
  };
}

function getCapUsage(state) {
  return state.lastReportedBacking + state.pendingDepositAssets;
}

function printVaultState(state) {
  console.log(`reviewed vault: ${VAULT}`);
  console.log(`paused: ${state.paused}`);
  console.log(`shutdown: ${state.shutdown}`);
  console.log(`idle USDC: ${fmtUSDC(state.idleBal)}`);
  console.log(
    `pending deposit USDC: ${fmtUSDC(state.pendingDepositAssets)}`
  );
  console.log(
    `pending redeem pARB: ${fmtPARB(state.pendingRedeemShares)}`
  );
  console.log(
    `last report nonce: ${state.lastReportNonce.toString()}`
  );
}

async function simulateVaultCall(from, data, label) {
  try {
    await provider.call({
      from,
      to: VAULT,
      data
    });
  } catch (e) {
    die(
      `${label} simulation failed: ` +
      `${e.shortMessage || e.message}`
    );
  }
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
  const riskConfirmed = args.includes("--confirm-risk");

  args = args.filter(
    x => x !== "--dry-run" && x !== "--confirm-risk"
  );

  if (args.length !== 1) {
    die(
      "usage: deposit <USDC_amount> " +
      "[--dry-run] [--confirm-risk]"
    );
  }

  let raw;

  try {
    raw = ethers.parseUnits(args[0], 6);
  } catch {
    die("invalid USDC amount");
  }

  if (raw <= 0n) die("invalid USDC amount");

  const w = await bankrWallet();
  const {
    state,
    onchainMinimum,
    cap
  } = await readVaultPreflight();

  if (state.paused) {
    die("vault is paused; deposit blocked");
  }

  if (state.shutdown) {
    die("vault is shut down; deposit blocked");
  }

  if (raw < onchainMinimum) {
    die(
      `minimum deposit is ${fmtUSDC(onchainMinimum)} USDC`
    );
  }

  const capUsage = getCapUsage(state);
  const projectedCapUsage = capUsage + raw;

  if (projectedCapUsage > cap) {
    const remaining =
      cap > capUsage
        ? cap - capUsage
        : 0n;

    die(
      `deposit exceeds vault cap. ` +
      `Remaining capacity: ${fmtUSDC(remaining)} USDC`
    );
  }

  const usdcBalance = await rpcRead(
    "Base USDC balance",
    () => usdc.balanceOf(w)
  );

  await sleep(150);

  const expectedShares = await rpcRead(
    "previewDeposit",
    () => vault.previewDeposit(raw)
  );

  if (expectedShares <= 0n) {
    die("previewDeposit returned zero shares");
  }

  const approveData =
    usdcIface.encodeFunctionData("approve", [VAULT, raw]);

  const requestData =
    iface.encodeFunctionData("requestDeposit", [raw, w]);

  console.log(
    `Deposit request: ${fmtUSDC(raw)} USDC -> PMFI pARBITRAGE`
  );
  console.log(`wallet/receiver: ${w}`);
  printVaultState(state);
  console.log(
    `on-chain minimum: ${fmtUSDC(onchainMinimum)} USDC`
  );
  console.log(`vault cap: ${fmtUSDC(cap)} USDC`);
  console.log(
    `current cap usage: ${fmtUSDC(capUsage)} USDC`
  );
  console.log(`expected pARB: ${fmtPARB(expectedShares)}`);
  console.log(
    `Base USDC balance: ${fmtUSDC(usdcBalance)}`
  );

  printRiskNotice();

  if (dry) {
    if (usdcBalance < raw) {
      console.log(
        "warning: insufficient Base USDC for execution"
      );
    }

    console.log(JSON.stringify({
      approve: {
        to: USDC,
        spender: VAULT,
        chainId: CHAIN_ID,
        value: "0",
        data: approveData
      },
      requestDeposit: {
        to: VAULT,
        receiver: w,
        chainId: CHAIN_ID,
        value: "0",
        data: requestData
      },
      preview: {
        inputUSDC: fmtUSDC(raw),
        expectedPARB: fmtPARB(expectedShares),
        paused: state.paused,
        shutdown: state.shutdown,
        onchainMinimumUSDC: fmtUSDC(onchainMinimum),
        vaultCapUSDC: fmtUSDC(cap)
      }
    }, null, 2));

    return;
  }

  if (!riskConfirmed) {
    die(
      "execution requires direct user confirmation after " +
      "reviewing the preflight and risk notice. " +
      "Run the same command with --confirm-risk only after confirmation."
    );
  }

  if (usdcBalance < raw) {
    die(
      `insufficient Base USDC. ` +
      `Wallet has ${fmtUSDC(usdcBalance)} USDC, ` +
      `needs ${fmtUSDC(raw)} USDC`
    );
  }

  const allowance = await rpcRead(
    "Base USDC allowance",
    () => usdc.allowance(w, VAULT)
  );

  if (allowance < raw) {
    await submit(
      USDC,
      approveData,
      `Approve ${fmtUSDC(raw)} USDC for PMFI pARBITRAGE`
    );
  } else {
    console.log("USDC allowance already sufficient.");
  }

  // State may change while the approval confirms.
  const latest = await readVaultPreflight();

  if (latest.state.paused) {
    die("vault became paused before deposit submission");
  }

  if (latest.state.shutdown) {
    die("vault entered shutdown before deposit submission");
  }

  const latestCapUsage = getCapUsage(latest.state);

  if (latestCapUsage + raw > latest.cap) {
    die("vault cap changed before submission; deposit blocked");
  }

  await simulateVaultCall(
    w,
    requestData,
    "requestDeposit"
  );

  await submit(
    VAULT,
    requestData,
    `Request deposit of ${fmtUSDC(raw)} USDC into PMFI pARBITRAGE`
  );
}

async function withdraw(args) {
  const dry = args.includes("--dry-run");
  const riskConfirmed = args.includes("--confirm-risk");

  args = args.filter(
    x => x !== "--dry-run" && x !== "--confirm-risk"
  );

  if (args.length !== 1) {
    die(
      "usage: withdraw <pARB_amount> " +
      "[--dry-run] [--confirm-risk]"
    );
  }

  let raw;

  try {
    raw = ethers.parseUnits(args[0], 18);
  } catch {
    die("invalid pARB amount");
  }

  if (raw <= 0n) die("invalid pARB amount");

  const w = await bankrWallet();
  const { state } = await readVaultPreflight();

  if (state.paused) {
    die("vault is paused; withdrawal request blocked");
  }

  const balance = await rpcRead(
    "pARB balance",
    () => vault.balanceOf(w)
  );

  await sleep(150);

  const expectedAssets = await rpcRead(
    "previewRedeem",
    () => vault.previewRedeem(raw)
  );

  if (expectedAssets <= 0n) {
    die("previewRedeem returned zero assets");
  }

  const requestData =
    iface.encodeFunctionData("requestRedeem", [raw, w]);

  console.log(
    `Withdraw request: ${fmtPARB(raw)} pARB -> USDC`
  );
  console.log(`wallet/receiver: ${w}`);
  printVaultState(state);
  console.log(`pARB balance: ${fmtPARB(balance)}`);
  console.log(
    `expected USDC: ${fmtUSDC(expectedAssets)}`
  );
  console.log(
    "Idle USDC is informational only. Processing remains " +
    "dependent on vault reports and available liquidity."
  );

  if (state.shutdown) {
    console.log(
      "warning: vault shutdown is active; the exact withdrawal " +
      "call must pass simulation before submission."
    );
  }

  printRiskNotice();

  if (dry) {
    let simulation = "skipped: insufficient pARB";

    if (balance >= raw) {
      await simulateVaultCall(
        w,
        requestData,
        "requestRedeem"
      );
      simulation = "passed";
    }

    console.log(JSON.stringify({
      requestRedeem: {
        to: VAULT,
        receiver: w,
        chainId: CHAIN_ID,
        value: "0",
        data: requestData
      },
      preview: {
        inputPARB: fmtPARB(raw),
        expectedUSDC: fmtUSDC(expectedAssets),
        paused: state.paused,
        shutdown: state.shutdown,
        idleUSDC: fmtUSDC(state.idleBal),
        simulation
      }
    }, null, 2));

    return;
  }

  if (!riskConfirmed) {
    die(
      "execution requires direct user confirmation after " +
      "reviewing the preflight and risk notice. " +
      "Run the same command with --confirm-risk only after confirmation."
    );
  }

  if (balance < raw) {
    die(
      `insufficient pARB. Balance: ${fmtPARB(balance)}`
    );
  }

  await simulateVaultCall(
    w,
    requestData,
    "requestRedeem"
  );

  await submit(
    VAULT,
    requestData,
    `Request redeem of ${fmtPARB(raw)} pARB from PMFI pARBITRAGE`
  );
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
