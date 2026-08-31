---
name: twentypad
description: Launch, buy/sell, and claim creator fees for TwentyPad Instant Launcher B20 tokens on Base Uniswap v4. Use when the user wants a TwentyPad B20, TWENTY, factory 0x15a3f3ABb733868d193b511dd5b91f82ebF888A3, hook 0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc, FeeEscrow 0xD43586103c760Bd5e139a2De2655413dE441B150, or says b20-launcher, b20-swap, or b20-claim. Do not use Clanker, Doppler, or default Bankr DEX routing.
metadata:
  clawdbot:
    emoji: "🐱"
    homepage: "https://twentypad.com"
---

# TwentyPad

One skill for the full TwentyPad loop on Base.

Aliases (same skill): `twentypad`, `b20-launcher`, `b20-swap`, `b20-claim`.

Contracts are unaudited. Say that before the first write.

## Route the request

| User intent | Section |
| --- | --- |
| launch / deploy / create B20 / TwentyPad token | Launch |
| buy / sell / swap TWENTY or any TwentyPad B20 | Swap |
| check fees / owed / claim / withdraw FeeEscrow | Claim |

Never use `bankr launch`, Clanker, Doppler, or aggregator swaps for these.

## Shared contracts (Base, 8453)

| Name | Address |
| --- | --- |
| Factory | `0x15a3f3ABb733868d193b511dd5b91f82ebF888A3` |
| Launch hook | `0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc` |
| FeeEscrow | `0xD43586103c760Bd5e139a2De2655413dE441B150` |
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| ETH / native quote | `0x0000000000000000000000000000000000000000` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| B20 factory | `0xB20f000000000000000000000000000000000000` |

Pool always: fee `0`, tickSpacing `200`, hooks = launch hook.

Site: https://twentypad.com  
Contracts: https://github.com/twentypad/b20-instant-launcher  
X: https://x.com/twentypad

Live example (not a whitelist):

- Twenty Launchpad / TWENTY `0xb2000000000000000000001E9FA9190D91Aa5ca7`
- pair USDC, poolId `0x66a714fbc3b181dcdf3abac867a48733e45ab507340886f35c54fb7f95e6f648`
- creator `0x1edBDc668fD5A749Ca8882fCB2bDa489B68154Ce`

Read `tokenSuffix()` on-chain. Live launches end in `ca7`. Do not hardcode if the owner changed it.

Encoding, salt loop, and errors:
- Launch → references/launch.md
- Swap → references/swap.md
- Claim → references/claim.md

---

## Launch

`createLaunch` is not payable. `value` = `"0"`.

`tokenCreator[token] = msg.sender` (the Bankr wallet that submits).

1. Parse name (required), symbol (default 3–8 from name), quote ETH unless USDC, optional profile strings.
2. Read `tokenSuffix`, `lastSaltUint`, `quotes(quote)`. Refuse unregistered quotes.
3. Mine salt off-chain from `lastSaltUint+1` until `predictToken(salt)` last 12 bits == `tokenSuffix` and `usedSalt` is false. Cap 50,000. Never mine in the user tx.
4. Confirm name, symbol, pair, predicted CA, salt, ~$4k FDV, 1B supply, 1% hook fee 70% creator / 30% platform, unaudited.
5. Submit to factory:

```text
createLaunch((string name, string symbol, bytes32 salt, address quote, (string image, string description, string website, string twitter, string telegram, string discord, bool editable)))

```
6. Reply with token, tx, poolId, Basescan, suffix note (ca7 if live suffix is that).

Refuse custom supply, ticks, extra ETH into the pool, bonding curves.

```text
@bankrbot launch B20 called StreetCat ticker SCRATCH pair ETH

```

## Swap

Do not use default Bankr DEX routing.
Resolve token: address → TWENTY row → “the B20 we just launched” → factory `Launched` / `tokenCreator` / `profiles`. If `tokenCreator(token)==0` and no launch event, refuse.

PoolKey:

```text
currency0 = min(quote, token)   // ETH address(0) is always currency0
currency1 = max(quote, token)
fee = 0
tickSpacing = 200
hooks = 0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc

```

Buy with quote → `zeroForOne = (quote == currency0)`. Sell token → opposite.
Exact-input only (anti-snipe blocks exact-output while fee > 1%). Native ETH, not WETH. `hookData = 0x`. 
No extra hops. No LP add/remove.
Submit Universal Router `V4_SWAP` / `EXACT_INPUT_SINGLE` on Base. Approve token via Permit2 when selling.
Slippage 15% default, 25%+ on a fresh pool. Warn above ~0.01 ETH on a new book.

```text
@bankrbot use twentypad to buy 0.0001 ETH of TWENTY
@bankrbot use twentypad to sell 10000 TWENTY

```

## Claim

Fees are hook fees in the quote asset on FeeEscrow, not Uniswap LP fees.

```text
owed(account, asset) view
claim(asset)
claimTo(to, asset)

```

ETH asset = `address(0)`. Selectors: `claim` `0x1e83409a`, `claimTo` `0x34a1ca89`.
Must sign as the credited account (usually the launch wallet). Wrong wallet → owed 0; do not send a tx.

1. Read owed for ETH and USDC.
2. If both 0, stop.
3. `claim(asset)` or `claimTo(to, asset)`, value `0`. One tx per asset.
4. Re-read owed; reply with tx + amount.

Creator share is 70% of the 1% hook fee. Platform 30%. Anti-snipe surplus → platform.

```text
@bankrbot use twentypad to check my TwentyPad fees
@bankrbot use twentypad to claim my ETH fees

```

Never call `credit` (hook-only).

## Scripts

Run these with bash from the skill root. Need `cast` (Foundry) and `BASE_RPC`.

- `scripts/owed.sh <wallet>` — print ETH/USDC owed
- `scripts/claim.sh eth|usdc [to]` — print claim calldata (or `--send` if PRIVATE_KEY set)
- `scripts/launch.sh --name NAME --symbol TICK --quote eth|usdc` — mine salt + print createLaunch calldata
- `scripts/swap.sh` — print pool key + direction (do not use default DEX)

Prefer scripts for encoding. Do not hand-roll ABI if a script exists.

## After writes

Always return tx hash + Basescan. For launches also return the CA (should end in the live suffix). For swaps return amounts in/out. For claims return owed before/after.


