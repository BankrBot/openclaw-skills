import { keccak256 } from "./keccak256.mjs";
import { strip0x } from "./abi.mjs";

const PUBLIC_RPCS = [
  "https://base-mainnet.public.blastapi.io",
  "https://base-rpc.publicnode.com",
  "https://mainnet.base.org",
];
const configuredRpc = process.env.PUNKTOWN_RPC_URL || process.env.BASE_RPC_URL;
// An explicit endpoint may be a local fork or private snapshot. Never fall
// through from it to public mainnet. Without an override, choose the first
// healthy public endpoint and pin it for the rest of the process so one plan
// cannot silently mix observations from different RPC views.
const RPCS = configuredRpc ? [configuredRpc] : PUBLIC_RPCS;
const configuredTimeout = Number(process.env.PUNKTOWN_RPC_TIMEOUT_MS || 30_000);
const RPC_TIMEOUT_MS = Number.isSafeInteger(configuredTimeout) && configuredTimeout >= 1_000 && configuredTimeout <= 120_000
  ? configuredTimeout
  : 30_000;
let pinnedRpcIndex = null;
let requestId = 1;
const TRANSIENT_HTTP = new Set([429, 502, 503, 504]);

export class RpcError extends Error {
  constructor(message, data = null, code = null) {
    super(message);
    this.name = "RpcError";
    this.data = data;
    this.code = code;
  }
}

function timeoutSignal(milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function retryDelay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function rpc(method, params = []) {
  let lastError = new Error("no RPC endpoint attempted");
  const candidates = pinnedRpcIndex === null ? RPCS.map((_, index) => index) : [pinnedRpcIndex];
  for (const index of candidates) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { signal, clear } = timeoutSignal(RPC_TIMEOUT_MS);
      try {
        const response = await fetch(RPCS[index], {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: requestId++, method, params }),
          signal,
        });
        if (!response.ok) {
          if (TRANSIENT_HTTP.has(response.status) && attempt < 3) {
            await retryDelay(500 * 2 ** attempt);
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        const body = await response.json();
        if (body.error) {
          throw new RpcError(
            `RPC ${body.error.code ?? "error"}: ${body.error.message ?? "unknown error"}`,
            body.error.data ?? null,
            body.error.code ?? null,
          );
        }
        pinnedRpcIndex = index;
        return body.result;
      } catch (error) {
        lastError = error;
        // A deterministic eth_call revert should not be hidden by another provider.
        if (error instanceof RpcError && error.data) throw error;
        break;
      } finally {
        clear();
      }
    }
  }
  const scope = pinnedRpcIndex === null && RPCS.length > 1 ? "all public Base RPCs" : "the pinned Base RPC";
  throw new Error(`${scope} failed for ${method}: ${lastError.message}`);
}

export async function chainId() {
  return Number(BigInt(await rpc("eth_chainId")));
}

export async function latestBlock() {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  if (!block) throw new Error("latest Base block was unavailable");
  return { number: BigInt(block.number), timestamp: BigInt(block.timestamp), hash: block.hash };
}

export async function getCode(address, block = "latest") {
  return await rpc("eth_getCode", [address, block]);
}

export async function getCodeHash(address, block = "latest") {
  const code = await getCode(address, block);
  if (!code || code === "0x") return null;
  return keccak256(code);
}

export async function ethCall(to, data, from, block = "latest") {
  const call = { to, data: data.startsWith("0x") ? data : `0x${data}` };
  if (from) call.from = from;
  return await rpc("eth_call", [call, block]);
}

export async function estimateGas(to, data, from, value = "0x0") {
  const call = { to, data: data.startsWith("0x") ? data : `0x${data}`, from, value };
  const result = await rpc("eth_estimateGas", [call]);
  return BigInt(result);
}

export async function getReceipt(transactionHash) {
  return await rpc("eth_getTransactionReceipt", [transactionHash]);
}

export async function getTransaction(transactionHash) {
  return await rpc("eth_getTransactionByHash", [transactionHash]);
}

export async function getBlockByHash(blockHash, fullTransactions = false) {
  return await rpc("eth_getBlockByHash", [blockHash, fullTransactions]);
}

export async function getTransactionCount(address, block = "latest") {
  return BigInt(await rpc("eth_getTransactionCount", [address, block]));
}

export async function getStorageAt(address, slot, block = "latest") {
  return await rpc("eth_getStorageAt", [address, slot, block]);
}

export function unsignedTx(to, data, label, extra = {}) {
  return {
    label,
    to,
    data: data.startsWith("0x") ? data : `0x${data}`,
    value: extra.value ?? "0",
    chainId: 8453,
    ...extra,
  };
}

export function revertData(error) {
  if (!(error instanceof RpcError)) return null;
  if (typeof error.data === "string" && error.data.startsWith("0x")) return error.data;
  if (error.data && typeof error.data === "object") {
    for (const value of Object.values(error.data)) {
      if (typeof value === "string" && value.startsWith("0x")) return value;
      if (value && typeof value === "object" && typeof value.return === "string") return value.return;
    }
  }
  return null;
}

export function txSelector(data) {
  const hex = strip0x(data || "");
  return hex.length >= 8 ? `0x${hex.slice(0, 8).toLowerCase()}` : null;
}
