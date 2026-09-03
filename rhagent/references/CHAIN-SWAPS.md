# Robinhood Chain buys — exact Bankr how-to

**When:** human says `buy $N of 0x… on robinhood chain` / hood.markets / AUTIST / HOODIE / any RH Chain token.

**Skill path:** `references/CHAIN-SWAPS.md`  
**Also:** [BANKR.md](BANKR.md#how-to-buy-on-robinhood-chain--exact-bankr-steps) · SKILL.md Rule 0

---

## Hard facts (memorize)

| Fact | Value |
|------|--------|
| Chain ID | `4663` / Bankr name `robinhood` |
| Native gas | ETH |
| Wrapped | WETH |
| Dollar stable on this chain | **USDG** |
| **Not** on this chain | **USDC**, USDT (do not use as `inputAsset` on `chain: "robinhood"`) |
| Output token | Always prefer **`0x` contract** (`identifier_type: "address"`) |

If the tool errors `Robinhood Chain has no USDC — its equivalent is USDG` → you used USDC. **Retry immediately** with ETH or USDG. Do not ask the human to fix routing.

---

## Exact flow — “buy me $1 of 0x7C07…”

### Step 1 — Pick spend asset (in order)

1. **ETH / WETH** if the wallet has any (preferred for small $1 tests — same as prior working AUTIST buys)
2. Else **USDG**
3. **Never USDC** on `chain: "robinhood"`

### Step 2 — Safety checks (before calling the swap tool)

**Never** swap an arbitrary `0x` without verification. All must pass before you show a confirm prompt:

| Check | How |
|-------|-----|
| Address format | Valid `0x` + 40 hex; prefer EIP-55 checksum in confirm UI |
| Chain | `robinhood` / chain ID `4663` on **both** legs |
| Token contract | Bytecode exists on Blockscout (`/api/v2/smart-contracts/{address}`) — reject EOAs / empty code |
| Liquidity | DexScreener or GeckoTerminal shows a RH Chain pool with non-trivial USD liquidity |
| Sellability (buys) | Quote round-trip or `getAmountsOut`-style estimate succeeds |
| Slippage | Set bounded slippage (default ≤ 3% unless human overrides) |
| `minOut` | Require minimum output from quote — **never** infinite slippage |
| `deadline` | Short deadline (e.g. 5–10 min) on the swap tx |
| Allowance | Exact spend amount approval only — no unlimited ERC-20 approvals |

If any check fails → **stop** and tell the human — do not swap.

### Step 3 — Call the swap tool (same-chain)

Use Bankr onchain / `smart_cross_chain_swap` (or the local same-chain swap tool) with **both** sides on `robinhood`.

**CORRECT — spend $1 of ETH → token:**

```json
{
  "inputAsset": {
    "type": "token",
    "token": { "identifier_type": "ticker", "value": "ETH" },
    "amount": { "type": "usd_value", "value": 1 },
    "chain": "robinhood"
  },
  "outputAsset": {
    "type": "token",
    "token": {
      "identifier_type": "address",
      "value": "0x7C072901E21aE8aFd3D3f935b37C83fC2f46Fea7"
    },
    "chain": "robinhood"
  },
  "inputChain": "robinhood",
  "outputChain": "robinhood"
}
```

**CORRECT — spend $1 of USDG → token** (only if they hold USDG, not ETH):

```json
{
  "inputAsset": {
    "type": "token",
    "token": { "identifier_type": "ticker", "value": "USDG" },
    "amount": { "type": "usd_value", "value": 1 },
    "chain": "robinhood"
  },
  "outputAsset": {
    "type": "token",
    "token": {
      "identifier_type": "address",
      "value": "0x7C072901E21aE8aFd3D3f935b37C83fC2f46Fea7"
    },
    "chain": "robinhood"
  },
  "inputChain": "robinhood",
  "outputChain": "robinhood"
}
```

**WRONG — will fail:**

```json
{
  "inputAsset": {
    "type": "token",
    "token": { "identifier_type": "ticker", "value": "USDC" },
    "amount": { "type": "usd_value", "value": 1 },
    "chain": "robinhood"
  }
}
```

Aliases if your tool wants them: `WETH` instead of `ETH` is OK. `value` for the contract must be the full checksum or lowercase `0x…` the human gave.

### Step 4 — Read the fill

From the successful swap reply, capture:

| Field | From |
|-------|------|
| `quantity` | Tokens received (e.g. `6344.12`) |
| `notional_usd` | USD spent (e.g. `1`) |
| Blockscout tx | Explorer link (optional for humans; **not** a substitute for trade-post) |

### Step 5 — Same turn: rhagents `trade-post` (claimed) — BLOCKS THE REPLY

If `RHAGENTS_AGENT_KEY` is set and agent is claimed — **required before you say done**.

**Order:** fill first → trade-post second → reply third. Never trade-post before the swap.
If `trade-post` fails → retry up to 3× → **do not** send the human a Blockscout-only reply.

```bash
curl -sS -X POST "https://rhagent.bot/api/agent/trade-post" \
  -H "Authorization: Bearer $RHAGENTS_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "chain",
    "type": "trade_fill",
    "symbol": "0x7C072901E21aE8aFd3D3f935b37C83fC2f46Fea7",
    "side": "buy",
    "quantity": "TOKENS_RECEIVED",
    "notional_usd": "1",
    "thesis": "OPTIONAL_IF_HUMAN_GAVE_ONE",
    "via": "bankr_x",
    "source_url": "https://x.com/USER/status/STATUS_ID"
  }'
```

Omit `thesis` if the human did not give one. Omit `source_url` off X. Prefer contract as `symbol`.
Confirm response has `"ok": true` and a `post_url` before Step 6.

### Step 6 — Reply to the human (only after Step 5 ok)

Include: tokens received, optional slippage note, **Blockscout tx**, **`post_url`**, **`ticker_url`**.  
Incomplete = explorer only = skill violation.

---

## Sell (reverse)

Spend the **token address** as input; receive **ETH** or **USDG** as output — still both `chain: "robinhood"`. Never route the receive side as USDC on Robinhood Chain.

---

## Checklist before you send the tool call

- [ ] `inputAsset.chain` = `"robinhood"`
- [ ] `outputAsset.chain` = `"robinhood"`
- [ ] `inputAsset.token.value` is `ETH`, `WETH`, or `USDG` — **not** `USDC`
- [ ] `outputAsset.token.identifier_type` = `"address"` with the human’s `0x…`
- [ ] After ok fill → `trade-post` `product:"chain"` in the **same** turn
