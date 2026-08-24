// aero-stock-lp: zero-dependency chain access.
// Raw JSON-RPC over fetch (node >= 18), Multicall3 batching for plain reads,
// individual eth_call with a spoofed `from` for owner-only simulations.

import { RPCS, MULTICALL3 } from "./markets.mjs";

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

// ---------- JSON-RPC with fallback ----------

let rpcIndex = 0;

export async function rpc(method, params) {
  let lastErr;
  for (let attempt = 0; attempt < RPCS.length; attempt++) {
    const url = RPCS[(rpcIndex + attempt) % RPCS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
      const body = await res.json();
      if (body.error) throw new Error(`${url} RPC error: ${JSON.stringify(body.error)}`);
      rpcIndex = (rpcIndex + attempt) % RPCS.length; // stick with what worked
      return body.result;
    } catch (e) {
      lastErr = e;
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
// Chunks automatically: public RPCs reject oversized payloads (HTTP 413).

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
    const CONCURRENCY = 4;
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
    results.push({ ok, data: dataHex });
  }
  return results;
}

// decode a uint256[] return (e.g. stakedValues)
export function decodeUintArray(dataNo0x) {
  if (!dataNo0x) return [];
  const off = Number(toBigInt(wordAt(dataNo0x, 0))) / 32;
  const n = Number(toBigInt(wordAt(dataNo0x, off)));
  const out = [];
  for (let i = 0; i < n; i++) out.push(toBigInt(wordAt(dataNo0x, off + 1 + i)));
  return out;
}

// ---------- receipts / txs ----------

export async function getReceipt(txHash) {
  return rpc("eth_getTransactionReceipt", [txHash]);
}

export async function getTransaction(txHash) {
  return rpc("eth_getTransactionByHash", [txHash]);
}

// ---------- keyless HTTP data sources ----------

export async function httpJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

export async function geckoPool(poolAddr) {
  const j = await httpJson(
    `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddr}`
  );
  const a = j?.data?.attributes || {};
  return {
    tvlUsd: Number(a.reserve_in_usd ?? 0),
    vol24hUsd: Number(a?.volume_usd?.h24 ?? 0),
    change24hPct: Number(a?.price_change_percentage?.h24 ?? 0),
    createdAt: a.pool_created_at || null,
  };
}

export async function aeroSpot() {
  const j = await httpJson("https://api.exchange.coinbase.com/products/AERO-USD/ticker");
  const p = Number(j?.price);
  if (!(p > 0)) throw new Error("Coinbase AERO-USD ticker unusable");
  return p;
}

export async function aeroHourlyCandles() {
  // [ time, low, high, open, close, volume ] newest first
  return httpJson(
    "https://api.exchange.coinbase.com/products/AERO-USD/candles?granularity=3600"
  );
}

// ---------- unsigned tx helper ----------

export function tx(to, dataNo0x, label) {
  return { label, to, data: "0x" + dataNo0x, value: "0", chainId: 8453 };
}
