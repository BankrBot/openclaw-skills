// hood-stock-lp: zero-dependency chain access for Robinhood Chain (4663).
// Raw JSON-RPC over fetch (node >= 18), Multicall3 batching for plain reads.
// The free public RPC rate-limits under multi-market read load (2026-08-09:
// an MSFT entry starved on it) — so every call retries across endpoints with
// backoff on 429s.

import { RPCS, MULTICALL3, GECKO_NETWORK, CHAIN_ID } from "./markets.mjs";

// ---------- hex/word helpers ----------

export function strip0x(h) {
  return h.startsWith("0x") ? h.slice(2) : h;
}

export function padWord(hexNo0x) {
  return hexNo0x.padStart(64, "0");
}

export function addrWord(addr) {
  return padWord(strip0x(addr).toLowerCase());
}

export function uintWord(v) {
  return padWord(BigInt(v).toString(16));
}

// int24 (or any int) as a 256-bit two's-complement word
export function intWord(v) {
  let b = BigInt(v);
  if (b < 0n) b += 1n << 256n;
  return padWord(b.toString(16));
}

// bytes32 (e.g. a v4 poolId) as a word
export function b32Word(hex) {
  return padWord(strip0x(hex).toLowerCase());
}

export function wordAt(dataNo0x, i) {
  return dataNo0x.slice(i * 64, (i + 1) * 64);
}

export function toBigInt(word) {
  return word ? BigInt("0x" + word) : 0n;
}

// sign-extended int from a 256-bit word
export function toInt(word) {
  let v = toBigInt(word);
  if (v >= 1n << 255n) v -= 1n << 256n;
  return v;
}

export function toAddr(word) {
  return "0x" + word.slice(24);
}

// ---------- dynamic ABI encoding (the v4 shapes) ----------
// bytes: length word + right-padded content
export function encBytes(hexNo0x) {
  const len = hexNo0x.length / 2;
  const padded = len === 0 ? "" : hexNo0x.padEnd(Math.ceil(len / 32) * 64, "0");
  return uintWord(len) + padded;
}

// bytes[]: length + per-element offsets (relative to after the length word)
export function encBytesArray(items) {
  const encoded = items.map(encBytes);
  let head = uintWord(items.length);
  let running = items.length * 32;
  for (const e of encoded) {
    head += uintWord(running);
    running += e.length / 2;
  }
  return head + encoded.join("");
}

// abi.encode(bytes actions, bytes[] params) — the (actions, params) pair
// used by both the UR V4_SWAP input and POSM modifyLiquidities unlockData
export function encActionsParams(actionsHexNo0x, paramsHexArr) {
  const a = encBytes(actionsHexNo0x);
  return (
    uintWord(0x40) +
    uintWord(0x40 + a.length / 2) +
    a +
    encBytesArray(paramsHexArr)
  );
}

// ---------- JSON-RPC with failover + 429 backoff ----------

let rpcIndex = 0;

export async function rpc(method, params) {
  let lastErr;
  for (let attempt = 0; attempt < RPCS.length * 2; attempt++) {
    const url = RPCS[(rpcIndex + attempt) % RPCS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 429) {
        lastErr = new Error(`${url} HTTP 429`);
        await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(`${url} RPC error: ${JSON.stringify(body.error)}`);
      rpcIndex = (rpcIndex + attempt) % RPCS.length; // stick with what worked
      return body.result;
    } catch (e) {
      lastErr = e;
      if (/429|Too Many/.test(String(e))) {
        await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
      }
    }
  }
  throw new Error(`all RPCs failed for ${method}: ${lastErr}`);
}

export async function ethCall(to, dataNo0xOrHex, from) {
  const data = dataNo0xOrHex.startsWith("0x") ? dataNo0xOrHex : "0x" + dataNo0xOrHex;
  const obj = { to, data };
  if (from) obj.from = from;
  const out = await rpc("eth_call", [obj, "latest"]);
  return strip0x(out || "");
}

// ---------- Multicall3.aggregate3 ----------
// calls: [{to, data}] (data without 0x is fine). Returns [{ok, data(no 0x)}].
// Chunks automatically: public RPCs reject oversized payloads.

const MULTICALL_CHUNK = 50;

export async function multicall(calls) {
  if (calls.length === 0) return [];
  if (calls.length > MULTICALL_CHUNK) {
    const chunks = [];
    for (let i = 0; i < calls.length; i += MULTICALL_CHUNK) {
      chunks.push(calls.slice(i, i + MULTICALL_CHUNK));
    }
    const results = new Array(chunks.length);
    let next = 0;
    const CONCURRENCY = 3;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
        while (next < chunks.length) {
          const i = next++;
          results[i] = await multicall(chunks[i]);
        }
      })
    );
    return results.flat();
  }
  const tuples = calls.map((c) => {
    const cd = strip0x(c.data);
    const padded = cd.padEnd(Math.ceil(cd.length / 64) * 64, "0");
    return (
      addrWord(c.to) +
      uintWord(1) + // allowFailure = true
      uintWord(0x60) + // offset of bytes within the tuple
      uintWord(cd.length / 2) +
      padded
    );
  });
  let offsets = "";
  let running = calls.length * 32; // after the per-element offset words
  for (const t of tuples) {
    offsets += uintWord(running);
    running += t.length / 2;
  }
  const data =
    "0x82ad56cb" + uintWord(0x20) + uintWord(calls.length) + offsets + tuples.join("");

  const outNo0x = await ethCall(MULTICALL3, data);

  // decode Result[] = (bool success, bytes returnData)[]
  const arrOff = Number(toBigInt(wordAt(outNo0x, 0))) / 32;
  const n = Number(toBigInt(wordAt(outNo0x, arrOff)));
  const base = arrOff + 1;
  const results = [];
  for (let i = 0; i < n; i++) {
    const elOff = base + Number(toBigInt(wordAt(outNo0x, base + i))) / 32;
    const ok = toBigInt(wordAt(outNo0x, elOff)) === 1n;
    const bytesOff = elOff + Number(toBigInt(wordAt(outNo0x, elOff + 1))) / 32;
    const len = Number(toBigInt(wordAt(outNo0x, bytesOff)));
    const dataHex = outNo0x.slice((bytesOff + 1) * 64, (bytesOff + 1) * 64 + len * 2);
    results.push({ ok: ok && len > 0, data: dataHex });
  }
  return results;
}

// ---------- receipts / logs ----------

export async function getReceipt(txHash) {
  return rpc("eth_getTransactionReceipt", [txHash]);
}

// Transfer logs to discover v4 position NFTs (POSM is NOT enumerable).
// Best-effort: some public RPCs cap ranges; caller must treat a throw as
// "scan unavailable", not "no positions".
export async function getLogs(address, topics, fromBlock = "0x0", toBlock = "latest") {
  return rpc("eth_getLogs", [{ address, topics, fromBlock, toBlock }]);
}

// ---------- keyless HTTP data ----------

export async function httpJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// Works for BOTH venues: v3 pools by address, v4 pools by poolId.
export async function geckoPool(poolAddrOrId) {
  const j = await httpJson(
    `https://api.geckoterminal.com/api/v2/networks/${GECKO_NETWORK}/pools/${poolAddrOrId}`
  );
  const a = j?.data?.attributes || {};
  return {
    tvlUsd: Number(a.reserve_in_usd ?? 0),
    vol24hUsd: Number(a?.volume_usd?.h24 ?? 0),
    change24hPct: Number(a?.price_change_percentage?.h24 ?? 0),
    createdAt: a.pool_created_at || null,
  };
}

// ---------- unsigned tx helper ----------

export function tx(to, dataNo0xOrHex, label) {
  const data = dataNo0xOrHex.startsWith("0x") ? dataNo0xOrHex : "0x" + dataNo0xOrHex;
  return { label, to, data, value: "0", chainId: CHAIN_ID };
}
