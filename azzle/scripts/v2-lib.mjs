import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hexToBytes, keccak256, selector } from "./lib/keccak256.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZERO = `0x${"0".repeat(40)}`;
const EIP1967_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ZOS_IMPLEMENTATION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc379824e8c22bf84e22330c5aa3ef8ab17";

function asBytes32(value) {
  return `0x${String(value).replace(/^0x/i, "").padStart(64, "0")}`;
}
const TASK_STATES = ["NONE", "POSTED", "CLAIMED", "ACTIVE", "DISPUTED", "COMPLETED", "CANCELLED", "RESOLVED"];
const RPC_URL = process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";
const API_URL = (process.env.AZZLE_API_URL || "https://azzle.org").replace(/\/$/, "");
const VALIDATE_GRAPH_TARGETS = [
  "taskRegistry",
  "escrowVault",
  "depositVault",
  "stakingVault",
  "arbitrationModule",
  "treasuryRouter",
  "reputationRegistry",
];

export function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadAllowlist() {
  return readJson(join(ROOT, "references", "signing-allowlist.json"));
}

export function loadSdkPin() {
  return readJson(join(ROOT, "references", "sdk-pin.json"));
}

export function loadPin(market) {
  const id = normalizeMarket(market);
  const pin = readJson(join(ROOT, "references", `base-8453-${id}-v2-pinned.json`));
  if (pin.version !== "2.0.0" || String(pin.chainId) !== "8453" || pin.market !== id) {
    fail(`${id} pin is not AZZLE V2 on Base`);
  }
  if (!pin.deploymentBlock || !pin.deployer || !pin.bundleHash || !pin.finalizedTx || !pin.factory) {
    fail(`${id} pin is missing deploymentBlock, deployer, bundleHash, factory, or finalizedTx`);
  }
  return pin;
}

export function loadIdentities(market) {
  const id = normalizeMarket(market);
  return readJson(join(ROOT, "references", `base-8453-${id}-v2-identities.json`));
}

export function normalizeMarket(value) {
  const market = String(value ?? "").trim().toLowerCase();
  if (market === "micro") return "micro";
  if (!market || market === "standard") return "standard";
  fail(`Unknown market '${value}'. Use standard or micro.`);
}

export function parseTaskId(raw) {
  const value = String(raw ?? "");
  if (value !== value.trim()) fail("Task id must not contain surrounding whitespace.");
  const namespaced = value.match(/^v2:(standard|micro):([1-9]\d*)$/);
  if (namespaced) {
    return { market: namespaced[1], localId: namespaced[2], id: `v2:${namespaced[1]}:${namespaced[2]}` };
  }
  if (/^v2:\d+$/.test(value)) fail("Unscoped task id v2:N is illegal. Use v2:standard:N or v2:micro:N.");
  if (/^\d+$/.test(value)) fail("Bare numeric task ids are illegal. Use v2:standard:N or v2:micro:N.");
  fail("Invalid task id. Use v2:standard:N or v2:micro:N.");
}

export function eqAddr(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function asAddr(value) {
  const hex = String(value || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hex) || hex === ZERO) fail(`invalid contract address ${value}`);
  return hex;
}

function pad32(value) {
  const hex = (typeof value === "bigint" ? value : BigInt(value)).toString(16);
  return hex.padStart(64, "0");
}

function word(data, index) {
  return data.slice(2 + index * 64, 2 + (index + 1) * 64);
}

function wordAddr(data, index) {
  return `0x${word(data, index).slice(24)}`;
}

function wordUint(data, index) {
  return BigInt(`0x${word(data, index) || "0"}`);
}

export async function rpc(method, params = []) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`Base RPC HTTP ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      continue;
    }
    if (!response.ok) fail(`Base RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) fail(`Base RPC ${method}: ${body.error.message || JSON.stringify(body.error)}`);
    return body.result;
  }
  fail(lastError?.message || "Base RPC unavailable");
}

export function addressOf(pin, key) {
  if (key === "azl") return pin.external.azl;
  if (key === "usdc") return pin.external.usdc;
  if (key.includes(".")) {
    return key.split(".").reduce((current, part) => current?.[part], pin);
  }
  return pin[key];
}

export function identityKeys(allowlist) {
  return ["factory", ...allowlist.graphKeys, "azl", "usdc"];
}

export function allowedSelectors(allowlist, target) {
  const signatures = allowlist.targets[target];
  if (!signatures) fail(`no allowed selectors for ${target}`);
  return Object.fromEntries(signatures.map((signature) => [selector(signature), signature]));
}

export function requireAllowedCall(allowlist, target, data) {
  const hex = String(data || "").toLowerCase();
  if (!hex.startsWith("0x") || hex.length < 10) fail(`calldata for ${target} is not a function call`);
  const sel = hex.slice(0, 10);
  const allowed = allowedSelectors(allowlist, target);
  if (!allowed[sel]) fail(`selector ${sel} is not allowed for ${target}`);
  return allowed[sel];
}

export async function getCodeHash(address) {
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") fail(`no runtime code at ${address}`);
  return keccak256(code);
}

async function getImplementationHash(address) {
  for (const slot of [EIP1967_SLOT, ZOS_IMPLEMENTATION_SLOT]) {
    const stored = await rpc("eth_getStorageAt", [address, asBytes32(slot), "latest"]);
    const impl = `0x${String(stored || "").replace(/^0x/, "").slice(-40)}`;
    if (impl !== ZERO) return getCodeHash(impl);
  }
  try {
    const result = await rpc("eth_call", [{ to: address, data: selector("implementation()") }, "latest"]);
    const impl = result && result !== "0x" ? `0x${result.slice(-40)}` : ZERO;
    if (impl !== ZERO) return getCodeHash(impl);
  } catch {
    /* not a proxy with implementation() */
  }
  return null;
}

function decodeTasks(data) {
  if (!data || data === "0x" || data.length < 2 + 9 * 64) fail("task record call failed");
  const poster = wordAddr(data, 0);
  const worker = wordAddr(data, 1);
  return {
    poster,
    worker: eqAddr(worker, ZERO) ? null : worker,
    totalAmountAzlWei: wordUint(data, 2).toString(),
    fundedAzlWei: wordUint(data, 3).toString(),
    releasedAzlWei: wordUint(data, 4).toString(),
    deadline: Number(wordUint(data, 5)),
    fundingDeadline: Number(wordUint(data, 6)),
    deliveredAt: Number(wordUint(data, 7)),
    state: TASK_STATES[Number(wordUint(data, 8))] ?? "UNKNOWN",
  };
}

function decodeString(data) {
  if (!data || data === "0x") return "";
  const offset = Number(wordUint(data, 0));
  const length = Number(wordUint(data, offset / 32));
  if (!length) return "";
  const start = 2 + (offset + 32) * 2;
  return Buffer.from(hexToBytes(`0x${data.slice(start, start + length * 2)}`)).toString("utf8");
}

async function ethCall(address, signature, arg) {
  const data = arg == null ? selector(signature) : `${selector(signature)}${pad32(arg)}`;
  const result = await rpc("eth_call", [{ to: address, data }, "latest"]);
  if (!result || result === "0x") fail(`${signature} reverted or returned empty at ${address}`);
  return result;
}

export async function readOnchainTask(pin, localId) {
  const id = BigInt(localId);
  const [taskData, scopeData] = await Promise.all([
    ethCall(pin.taskRegistry, "tasks(uint256)", id),
    ethCall(pin.taskScopeRegistry, "scopeOf(uint256)", id),
  ]);
  const task = decodeTasks(taskData);
  if (eqAddr(task.poster, ZERO)) fail(`task ${localId} does not exist on the selected pin`);
  const scope = decodeString(scopeData);
  return {
    id: `v2:${pin.market}:${localId}`,
    protocolVersion: "v2",
    market: pin.market,
    chainId: Number(pin.chainId),
    asset: "AZL",
    registryAddress: pin.taskRegistry,
    escrowAddress: pin.escrowVault,
    scopeRegistryAddress: pin.taskScopeRegistry,
    source: "pinned-base-contracts",
    scope,
    discovery: scope ? "open" : "private",
    ...task,
  };
}

function topicAddr(topic) {
  return `0x${String(topic).slice(-40)}`;
}

function decodeSuiteDeployed(receipt, pin, allowlist, expectedSuiteHash) {
  const expectedTopic = keccak256(new TextEncoder().encode(allowlist.suiteDeployedEvent));
  const log = (receipt.logs || []).find((entry) => String(entry.topics?.[0]).toLowerCase() === expectedTopic.toLowerCase());
  if (!log) fail("finalization receipt is missing SuiteDeployed");
  const suiteHash = String(log.topics[1]).toLowerCase();
  if (expectedSuiteHash && suiteHash !== String(expectedSuiteHash).toLowerCase()) {
    fail("SuiteDeployed hash does not match the reviewed identity pin");
  }
  if (!eqAddr(topicAddr(log.topics[2]), pin.governance)) {
    fail("SuiteDeployed governance does not match the selected pin");
  }
  const data = log.data;
  const graph = {};
  allowlist.graphKeys.forEach((key, index) => {
    graph[key] = wordAddr(data, index);
    if (!eqAddr(graph[key], pin[key])) fail(`SuiteDeployed ${key} does not match the selected pin`);
  });
  if (!eqAddr(log.address, pin.factory)) fail("SuiteDeployed was not emitted by the pinned factory");
  return { graph, suiteDeployedHash: suiteHash };
}

export async function verifyFinalization(pin, allowlist, expectedSuiteHash) {
  const [receipt, tx] = await Promise.all([
    rpc("eth_getTransactionReceipt", [pin.finalizedTx]),
    rpc("eth_getTransactionByHash", [pin.finalizedTx]),
  ]);
  if (!receipt || receipt.status !== "0x1") fail("finalization receipt is missing or not successful");
  if (!eqAddr(receipt.from, pin.deployer) || !eqAddr(tx?.from, pin.deployer)) {
    fail("finalization receipt deployer does not match the selected pin");
  }
  if (!eqAddr(receipt.to, pin.factory) || !eqAddr(tx?.to, pin.factory)) {
    fail("finalization receipt factory does not match the selected pin");
  }
  if (Number(receipt.blockNumber) !== Number(pin.deploymentBlock)) {
    fail("finalization receipt block does not match pin.deploymentBlock");
  }
  return decodeSuiteDeployed(receipt, pin, allowlist, expectedSuiteHash);
}

export async function snapshotIdentities(pin, allowlist) {
  const identities = {};
  for (const key of identityKeys(allowlist)) {
    const address = asAddr(addressOf(pin, key));
    identities[key] = {
      address,
      runtimeCodeHash: await getCodeHash(address),
      implementationCodeHash: await getImplementationHash(address),
    };
  }
  const { suiteDeployedHash } = await verifyFinalization(pin, allowlist);
  return {
    market: pin.market,
    version: pin.version,
    chainId: pin.chainId,
    deploymentBlock: pin.deploymentBlock,
    deployer: pin.deployer,
    factory: pin.factory,
    governance: pin.governance,
    bundleHash: pin.bundleHash,
    finalizedTx: pin.finalizedTx,
    suiteDeployedTopic: keccak256(new TextEncoder().encode(allowlist.suiteDeployedEvent)),
    suiteDeployedHash,
    identities,
  };
}

export async function verifyPinFromBase(market) {
  const pin = loadPin(market);
  const allowlist = loadAllowlist();
  const expected = loadIdentities(pin.market);
  if (expected.market !== pin.market || expected.version !== pin.version || String(expected.chainId) !== String(pin.chainId)) {
    fail("identity pin market/version/chainId mismatch");
  }
  for (const field of ["deploymentBlock", "deployer", "factory", "governance", "bundleHash", "finalizedTx"]) {
    if (String(expected[field]).toLowerCase() !== String(pin[field]).toLowerCase()) {
      fail(`identity pin ${field} does not match the reviewed deployment pin`);
    }
  }
  if (!expected.suiteDeployedHash) fail("identity pin is missing suiteDeployedHash");
  await verifyFinalization(pin, allowlist, expected.suiteDeployedHash);
  for (const key of identityKeys(allowlist)) {
    const address = asAddr(addressOf(pin, key));
    const pinned = expected.identities?.[key];
    if (!pinned || !eqAddr(pinned.address, address)) fail(`identity pin missing ${key}`);
    const runtimeCodeHash = await getCodeHash(address);
    if (runtimeCodeHash !== pinned.runtimeCodeHash) fail(`runtime code hash mismatch at ${key}`);
    const implementationCodeHash = await getImplementationHash(address);
    if ((implementationCodeHash || null) !== (pinned.implementationCodeHash || null)) {
      fail(`implementation code hash mismatch at ${key}`);
    }
  }
  for (const key of VALIDATE_GRAPH_TARGETS) {
    const result = await ethCall(pin[key], "validateGraph()");
    if (wordUint(result, 0) !== 1n) fail(`${key}.validateGraph() did not return true`);
  }
  return { market: pin.market, pin, allowlist };
}

function requireSame(label, actual, expected) {
  if (String(actual) !== String(expected)) fail(`${label} mismatch: ${actual} != ${expected}`);
}

function requireSameAddr(label, actual, expected) {
  if (!eqAddr(actual, expected)) fail(`${label} mismatch`);
}

export function bindApiTask(apiTask, pin, ref, onchain) {
  if (!apiTask || typeof apiTask !== "object") fail("API task payload is missing");
  requireSame("id", apiTask.id, ref.id);
  requireSame("market", apiTask.market, pin.market);
  if (apiTask.protocolVersion != null) requireSame("protocolVersion", apiTask.protocolVersion, "v2");
  if (apiTask.asset != null) requireSame("asset", apiTask.asset, "AZL");
  if (apiTask.chainId == null) fail("API task omitted chainId");
  requireSame("chainId", Number(apiTask.chainId), Number(pin.chainId));
  if (!apiTask.registryAddress) fail("API task omitted registryAddress");
  requireSameAddr("registryAddress", apiTask.registryAddress, pin.taskRegistry);
  if (!apiTask.escrowAddress) fail("API task omitted escrowAddress");
  requireSameAddr("escrowAddress", apiTask.escrowAddress, pin.escrowVault);
  requireSame("poster", String(apiTask.poster).toLowerCase(), onchain.poster.toLowerCase());
  requireSame("state", apiTask.state, onchain.state);
  if (apiTask.totalAmountAzlWei != null) requireSame("totalAmountAzlWei", apiTask.totalAmountAzlWei, onchain.totalAmountAzlWei);
  const apiScope = apiTask.scope ?? apiTask.description ?? "";
  if (String(apiScope) !== String(onchain.scope)) fail("API scope does not match the pinned scope registry");
  return true;
}

export function bindApiOpenItem(item, pin) {
  if (!item || typeof item !== "object") fail("API open item is missing");
  const ref = parseTaskId(item.id);
  if (ref.market !== pin.market) fail(`API open item ${item.id} is bound to the wrong market`);
  requireSame("market", item.market, pin.market);
  if (item.chainId != null) requireSame("chainId", Number(item.chainId), Number(pin.chainId));
  if (!item.registryAddress) fail(`API open item ${item.id} omitted registryAddress`);
  requireSameAddr("registryAddress", item.registryAddress, pin.taskRegistry);
  if (item.escrowAddress) requireSameAddr("escrowAddress", item.escrowAddress, pin.escrowVault);
  return ref;
}

async function fetchApi(path) {
  const response = await fetch(`${API_URL}${path}`);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { ok: response.ok, status: response.status, body };
}

export async function inspectTask(rawId, { compareApi = true } = {}) {
  const ref = parseTaskId(rawId);
  const { pin } = await verifyPinFromBase(ref.market);
  const onchain = await readOnchainTask(pin, ref.localId);
  let api = "not-requested";
  if (compareApi) {
    const payload = await fetchApi(`/api/get-task?id=${encodeURIComponent(ref.id)}`);
    if (payload.ok) {
      bindApiTask(payload.body?.task, pin, ref, onchain);
      api = "verified";
    } else if (payload.status === 404) {
      fail("API 404 for a task that exists on the selected pinned contracts");
    } else {
      api = `unavailable:${payload.status}`;
    }
  }
  return { ...onchain, api };
}

export async function inspectOpen(market, limit = 25, { compareApi = true } = {}) {
  const selected = normalizeMarket(market);
  if (selected === "micro" && String(market ?? "").trim() === "") {
    fail("micro must be explicitly selected");
  }
  const bounded = Number(limit);
  if (!Number.isInteger(bounded) || bounded < 1 || bounded > 100) fail("limit must be an integer from 1 to 100");
  const { pin } = await verifyPinFromBase(selected);
  const count = Number(wordUint(await ethCall(pin.taskRegistry, "taskCount()"), 0));
  const tasks = [];
  for (let localId = count; localId >= 1 && tasks.length < bounded; localId--) {
    try {
      tasks.push(await readOnchainTask(pin, String(localId)));
    } catch (error) {
      if (!String(error.message).includes("does not exist")) throw error;
    }
  }
  let api = "not-requested";
  if (compareApi) {
    const payload = await fetchApi(`/api/market/open?market=${selected}&limit=${bounded}`);
    if (!payload.ok) {
      api = `unavailable:${payload.status}`;
    } else {
      const items = payload.body?.tasks;
      if (!Array.isArray(items)) fail("API open payload is missing tasks[]");
      if (payload.body.meta?.market && payload.body.meta.market !== selected) {
        fail("API open meta.market does not match the selected pin");
      }
      for (const item of items) {
        const ref = bindApiOpenItem(item, pin);
        const onchain = tasks.find((task) => task.id === ref.id) || await readOnchainTask(pin, ref.localId);
        if (item.state && item.state !== onchain.state) fail(`API open item ${ref.id} state does not match Base`);
        if (item.poster && !eqAddr(item.poster, onchain.poster)) fail(`API open item ${ref.id} poster does not match Base`);
        const apiScope = item.scope ?? item.description ?? "";
        if (String(apiScope) !== String(onchain.scope)) fail(`API open item ${ref.id} scope does not match Base`);
      }
      api = "verified";
    }
  }
  return {
    market: selected,
    chainId: Number(pin.chainId),
    registryAddress: pin.taskRegistry,
    escrowAddress: pin.escrowVault,
    source: "pinned-base-contracts",
    api,
    tasks,
  };
}

export function compareManifestToPin(loaded, pin) {
  if (!loaded || typeof loaded !== "object") fail("loaded SDK manifest is missing");
  requireSame("version", loaded.version, pin.version);
  requireSame("chainId", String(loaded.chainId), String(pin.chainId));
  requireSame("market", loaded.market, pin.market);
  requireSame("deploymentBlock", Number(loaded.deploymentBlock), Number(pin.deploymentBlock));
  requireSameAddr("deployer", loaded.deployer, pin.deployer);
  requireSameAddr("factory", loaded.factory, pin.factory);
  requireSame("bundleHash", String(loaded.bundleHash).toLowerCase(), String(pin.bundleHash).toLowerCase());
  requireSame("finalizedTx", String(loaded.finalizedTx).toLowerCase(), String(pin.finalizedTx).toLowerCase());
  const allowlist = loadAllowlist();
  for (const key of allowlist.graphKeys) requireSameAddr(key, loaded[key], pin[key]);
  for (const key of ["usdc", "azl"]) requireSameAddr(`external.${key}`, loaded.external?.[key], pin.external[key]);
  return true;
}

export { keccak256, selector };
