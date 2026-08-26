#!/usr/bin/env node
// hood-stock-lp exit: two phases, because the sell amounts aren't knowable
// until the withdraw mines. Scripts never sign; the agent submits each tx via
// Bankr and checks its receipt before the next.
//
//   exit.mjs begin  --market TSLA --token-id 123 --wallet 0x…
//     v3 -> ONE NPM multicall tx: decreaseLiquidity(full) + collect(max) + burn
//     v4 -> ONE modifyLiquidities tx: BURN_POSITION + TAKE_PAIR (fees included)
//     Either way principal + fees land in the wallet in a single transaction.
//   exit.mjs finish --market TSLA --token-id 123 --wallet 0x… [--keep-stock] [--state-path p]
//     -> sell residual stock -> USDG (minOut 2% floor), remove from state.
//        --keep-stock skips the sell (recenters absorb the stock instead of
//        round-tripping it through a swap) and only cleans up state.

import {
  getMarket,
  USDG,
  NPM_V3,
  ROUTER_V3,
  POSM,
  UNIVERSAL_ROUTER,
  SEL,
  MAX_UINT256,
  MAX_UINT128,
} from "./lib/markets.mjs";
import {
  addrWord,
  uintWord,
  strip0x,
  encBytesArray,
  multicall,
  wordAt,
  toBigInt,
  toAddr,
  tx,
} from "./lib/chain.mjs";
import { priceFromSqrtX96 } from "./lib/math.mjs";
import {
  poolKeyFor,
  sellStockZeroForOne,
  swapData,
  burnData,
  quoteSwap,
  approvalTxs,
  v4PoolState,
} from "./lib/v4.mjs";
import { loadState, saveState } from "./lib/positions.mjs";

const [, , phase, ...rest] = process.argv;
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else args[key] = true;
  }
}
function out(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}
function need(name) {
  const v = args[name];
  if (v === undefined || v === true) out({ ok: false, gate: "args", detail: `--${name} required` }, 1);
  return v;
}
const deadline = () => Math.floor(Date.now() / 1000) + 1200;

async function begin() {
  const market = need("market");
  const M = getMarket(market);
  const tokenId = need("token-id");
  const wallet = need("wallet");
  const idW = uintWord(tokenId);
  const nft = M.venue === "v3" ? NPM_V3 : POSM;

  const calls = [{ to: nft, data: SEL.ownerOf + idW }];
  if (M.venue === "v3") calls.push({ to: nft, data: SEL.positions + idW });
  else calls.push({ to: nft, data: SEL.getPositionLiquidity + idW });
  const [ownerRes, liqRes] = await multicall(calls);
  if (!ownerRes.ok) out({ ok: false, gate: "owner", detail: `#${tokenId} unreadable — burned already, or transient RPC failure; check with manage.mjs before retrying` }, 1);
  const holder = toAddr(wordAt(ownerRes.data, 0));
  if (holder.toLowerCase() !== wallet.toLowerCase()) {
    out({ ok: false, gate: "owner", detail: `#${tokenId} is held by ${holder}, not this wallet` }, 1);
  }
  const liquidity = liqRes.ok
    ? toBigInt(wordAt(liqRes.data, M.venue === "v3" ? 7 : 0))
    : 0n;

  let txs;
  if (M.venue === "v3") {
    // one atomic tx: the NPM's own multicall. Collect(max) after a full
    // decrease sweeps principal AND fees, so the burn cannot revert on dust.
    // inner calldatas ride inside multicall(bytes[]) — strip the 0x prefixes
    const inner = [];
    if (liquidity > 0n) {
      inner.push(
        strip0x(SEL.decreaseLiquidity) + idW + uintWord(liquidity) + uintWord(0) + uintWord(0) + uintWord(deadline())
      );
    }
    inner.push(strip0x(SEL.collect) + idW + addrWord(wallet) + uintWord(MAX_UINT128) + uintWord(MAX_UINT128));
    inner.push(strip0x(SEL.burnV3) + idW);
    txs = [
      tx(
        NPM_V3,
        SEL.npmMulticall + uintWord(0x20) + encBytesArray(inner),
        `#${tokenId} withdraw all + collect + burn (one atomic v3 multicall)`
      ),
    ];
  } else {
    txs = [
      tx(
        POSM,
        burnData(poolKeyFor(M), BigInt(tokenId), wallet, deadline()),
        `#${tokenId} burn v4 position — principal + fees land in the wallet`
      ),
    ];
  }

  out({
    ok: true,
    phase: "begin",
    market: M.symbol,
    venue: M.venue,
    tokenId: String(tokenId),
    txs,
    report: `Exit ${M.symbol} #${tokenId}: one tx; principal + fees land in the wallet.`,
    next: `submit via Bankr, then run: exit.mjs finish --market ${M.symbol} --token-id ${tokenId} --wallet ${wallet}` +
      (args["keep-stock"] ? " --keep-stock" : ""),
  });
}

async function finish() {
  const market = need("market");
  const M = getMarket(market);
  const tokenId = need("token-id");
  const wallet = need("wallet");
  const keepStock = Boolean(args["keep-stock"]);

  const txs = [];
  if (!keepStock) {
    const [stockBalRes] = await multicall([
      { to: M.token, data: SEL.balanceOf + addrWord(wallet) },
    ]);
    const stockRaw = stockBalRes.ok ? toBigInt(wordAt(stockBalRes.data, 0)) : 0n;
    if (stockRaw > 0n) {
      let price;
      if (M.venue === "v3") {
        const [slot0Res, allowRes] = await multicall([
          { to: M.pool, data: SEL.slot0 },
          { to: M.token, data: SEL.allowance + addrWord(wallet) + addrWord(ROUTER_V3) },
        ]);
        price = slot0Res.ok ? priceFromSqrtX96(toBigInt(wordAt(slot0Res.data, 0)), M.usdgIs0) : 0;
        const stockUsd = (Number(stockRaw) / 1e18) * price;
        if (stockUsd >= 1) {
          const allow = allowRes.ok ? toBigInt(wordAt(allowRes.data, 0)) : 0n;
          if (allow < stockRaw) {
            txs.push(tx(M.token, SEL.approve + addrWord(ROUTER_V3) + uintWord(MAX_UINT256), `approve ${M.symbol} -> v3 router`));
          }
          txs.push(
            tx(
              ROUTER_V3,
              SEL.exactInputSingle +
                addrWord(M.token) +
                addrWord(USDG) +
                uintWord(M.fee) +
                addrWord(wallet) +
                uintWord(stockRaw) +
                uintWord(BigInt(Math.round(stockUsd * (1 - M.fee / 1e6) * 0.98 * 1e6))) +
                uintWord(0),
              `sell ${(Number(stockRaw) / 1e18).toFixed(4)} ${M.symbol} -> USDG (minOut 2% floor)`
            )
          );
        }
      } else {
        const ps = await v4PoolState(M.pool, M.usdgIs0);
        price = ps.price;
        if ((Number(stockRaw) / 1e18) * price >= 1) {
          const key = poolKeyFor(M);
          const zf1 = sellStockZeroForOne(M);
          const { amountOut } = await quoteSwap(key, zf1, stockRaw);
          txs.push(
            ...(await approvalTxs(wallet, M.token, stockRaw, UNIVERSAL_ROUTER, M.symbol)),
            tx(UNIVERSAL_ROUTER, swapData(key, zf1, stockRaw, (amountOut * 98n) / 100n, deadline()), `sell ${(Number(stockRaw) / 1e18).toFixed(4)} ${M.symbol} -> USDG (quoted, minOut 2% floor)`)
          );
        }
      }
    }
  }

  // remove from state; report basis for the final P&L decomposition
  const statePathArg = args["state-path"];
  const state = loadState(statePathArg);
  const rec = (state.positions || []).find((p) => p.tokenId === String(tokenId));
  state.positions = (state.positions || []).filter((p) => p.tokenId !== String(tokenId));
  saveState(state, statePathArg);

  out({
    ok: true,
    phase: "finish",
    market: M.symbol,
    tokenId: String(tokenId),
    keepStock,
    txs,
    closedBasis: rec ? { entryUsd: rec.entryUsd, enteredAt: rec.enteredAt } : null,
    report: keepStock
      ? `${M.symbol} #${tokenId} closed, stock kept in the wallet for the re-entry (it will be absorbed, not round-tripped).`
      : `Finishing exit of ${M.symbol} #${tokenId}: ${txs.length} txs; user lands in USDG. Report the full life-of-position P&L vs basis${rec?.entryUsd != null ? ` ($${rec.entryUsd})` : " (basis unknown — say so)"}.`,
    next: txs.length ? "submit txs in order via Bankr, then report final cash + P&L" : "report to the user",
  });
}

const phases = { begin, finish };
if (!phases[phase]) out({ ok: false, gate: "args", detail: "usage: exit.mjs <begin|finish> --market … --token-id … --wallet …" }, 1);
phases[phase]().catch((e) => out({ ok: false, gate: "error", detail: String(e?.message || e) }, 1));
