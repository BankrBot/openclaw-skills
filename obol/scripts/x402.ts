// @ts-nocheck — runs under bun.
// x402.ts — Obol Stack x402 buy-side protocol library: chain/asset resolution,
// EIP-712 voucher construction, and on-chain reads. Used by obol-x402-call.ts.
// Verified against the obol-stack reference buyer (buy.py `_presign_auths`).
// Functions throw Error on failure; the CLI converts to a friendly exit.

export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";    // canonical Permit2
export const X402_PROXY = "0x402085c248EeA27D92E8b30b2C58ed07f9E20001"; // x402 exact-Permit2 proxy (witness spender)
export const UA = "obol-x402-call/1.0 (+https://github.com/ObolNetwork/obol-stack)";

// chainId → { name, rpc, usdc, usdcDomain:[name,version] }. usdcDomain is the
// EIP-712 signing domain, which differs from the contract's name() getter.
export const CHAINS = {
  1:     { name: "mainnet",      rpc: "https://ethereum-rpc.publicnode.com",     usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", usdcDomain: ["USD Coin", "2"] },
  8453:  { name: "base",         rpc: "https://base-rpc.publicnode.com",         usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", usdcDomain: ["USD Coin", "2"] },
  84532: { name: "base-sepolia", rpc: "https://base-sepolia-rpc.publicnode.com", usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", usdcDomain: ["USDC", "2"] },
};
const NET_ALIAS = { ethereum: 1, mainnet: 1, eth: 1, base: 8453, "base-sepolia": 84532 };
const OBOL = "1:0x0b010000b7624eb9b3dfbc279673c76e9d29d5f7"; // only token needing non-USDC display meta

export const resolveChain = (net) => {
  const id = net?.startsWith("eip155:") ? Number(net.slice(7)) : NET_ALIAS[String(net).toLowerCase()];
  if (!Number.isFinite(id) || id <= 0) throw new Error(`unknown x402 network: ${net}`);
  return id;
};
export const chainCfg = (id) => CHAINS[id] ?? { name: `eip155:${id}` };
export const tokenMeta = (id, a) => {
  const lc = String(a).toLowerCase();
  if (`${id}:${lc}` === OBOL) return { symbol: "OBOL", decimals: 18 };
  if (CHAINS[id]?.usdc === lc) return { symbol: "USDC", decimals: 6 };
};
export const fmt = (raw, dec, sym) => {
  if (dec == null) return `${raw} ${sym}`;
  const d = 10n ** BigInt(dec), w = raw / d, f = raw % d;
  return f === 0n ? `${w} ${sym}` : `${w}.${f.toString().padStart(dec, "0").replace(/0+$/, "")} ${sym}`;
};
const rand32 = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
const pad = (a) => a.replace(/^0x/, "").toLowerCase().padStart(64, "0");

export async function ethCall(rpc, to, data) {
  if (!rpc) throw new Error(`no RPC for on-chain read — pass --rpc-url`);
  const r = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
  const j = await r.json();
  if (!j?.result) throw new Error(`eth_call to ${to} failed: ${JSON.stringify(j)}`);
  return j.result;
}
// decimals(): registry first, then on-chain, then assume 18 with a warning.
export async function assetMeta(chainId, asset, rpc, extraName) {
  const known = tokenMeta(chainId, asset);
  if (known) return known;
  let decimals = 18;
  try { decimals = Number(BigInt(await ethCall(rpc, asset, "0x313ce567"))); }
  catch { console.error(`(warning: decimals() read failed — assuming 18)`); }
  return { symbol: extraName ?? "TOKEN", decimals };
}

// EIP-712 type sets, expanded from "field:type,…" shorthand. DOM(true) adds `version`.
const T = (s) => s.split(",").map((p) => { const [name, type] = p.split(":"); return { name, type }; });
const DOM = (v) => T(v ? "name:string,version:string,chainId:uint256,verifyingContract:address" : "name:string,chainId:uint256,verifyingContract:address");
const TY = {
  TransferWithAuthorization: T("from:address,to:address,value:uint256,validAfter:uint256,validBefore:uint256,nonce:bytes32"),
  Permit: T("owner:address,spender:address,value:uint256,nonce:uint256,deadline:uint256"),
  TokenPermissions: T("token:address,amount:uint256"),
  Witness: T("to:address,validAfter:uint256"),
  PermitWitnessTransferFrom: T("permitted:TokenPermissions,spender:address,nonce:uint256,deadline:uint256,witness:Witness"),
};
const typed = (primaryType, types, domain, message) => ({ types: { EIP712Domain: DOM("version" in domain), ...types }, primaryType, domain, message });

/**
 * Sign one x402 voucher and return the base64 X-PAYMENT envelope.
 *   q        parsed quote: { scheme, network, chainId, asset, payTo, amount, method, symbol, sponsored }
 *   accept   the raw accepts[] entry (echoed verbatim in `accepted`)
 *   extra    accept.extra; extensions = top-level 402 extensions
 *   from     buyer address
 *   sign     async (typedData) => "0x..signature"  (caller injects the wallet)
 *   rpc      RPC URL for the EIP-2612 nonce read (permit2 sponsoring only)
 */
export async function buildEnvelope({ q, accept, extra, extensions, from, sign, rpc, deadline }) {
  const { chainId, asset, payTo, amount, method, symbol, sponsored } = q;
  let payload, extOut = {};
  // Echo each server extension's `info` — x402 v2 requires the client to echo what it received.
  for (const [k, v] of Object.entries(extensions)) if (v && typeof v === "object" && "info" in v) extOut[k] = { info: v.info };

  if (method === "permit2") {
    const wit = { permitted: { token: asset, amount }, spender: X402_PROXY, nonce: BigInt(rand32()).toString(), deadline, witness: { to: payTo, validAfter: "0" } };
    const sig = await sign(typed("PermitWitnessTransferFrom",
      { TokenPermissions: TY.TokenPermissions, Witness: TY.Witness, PermitWitnessTransferFrom: TY.PermitWitnessTransferFrom },
      { name: "Permit2", chainId, verifyingContract: PERMIT2 }, wit));
    payload = { signature: sig, permit2Authorization: { ...wit, from } };
    if (sponsored) { // EIP-2612 permit approving Permit2 for `amount`; the Obol facilitator submits it gaslessly.
      const nonce = BigInt(await ethCall(rpc, asset, `0x7ecebe00${pad(from)}`)).toString(); // nonces(owner)
      const psig = await sign(typed("Permit", { Permit: TY.Permit },
        { name: extra.name ?? symbol, version: extra.version ?? "1", chainId, verifyingContract: asset },
        { owner: from, spender: PERMIT2, value: amount, nonce, deadline }));
      extOut.eip2612GasSponsoring = { info: { from, asset, spender: PERMIT2, amount, nonce, deadline, signature: psig, version: "1" } };
    } else if (extra.assetTransferMethod === "permit2")
      console.error(`(note: permit2 without gas sponsoring — your wallet must already have approve(Permit2, …) on ${symbol}.)`);
  } else { // EIP-3009: domain from extra.eip712Domain, else per-chain USDC table, else USDC/2.
    const adv = extra.eip712Domain ?? {}, c = CHAINS[chainId];
    const [dn, dv] = adv.name && adv.version ? [adv.name, adv.version]
      : c?.usdc && c.usdc === String(asset).toLowerCase() ? c.usdcDomain : ["USDC", "2"];
    const authz = { from, to: payTo, value: amount, validAfter: "0", validBefore: deadline, nonce: rand32() };
    const sig = await sign(typed("TransferWithAuthorization", { TransferWithAuthorization: TY.TransferWithAuthorization },
      { name: dn, version: dv, chainId, verifyingContract: asset }, authz));
    payload = { signature: sig, authorization: authz };
  }

  const env = { x402Version: 2, accepted: { scheme: q.scheme, network: q.network, amount, asset, payTo, maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 60, extra }, payload };
  if (Object.keys(extOut).length) env.extensions = extOut;
  return { env, b64: Buffer.from(JSON.stringify(env), "utf8").toString("base64") };
}
