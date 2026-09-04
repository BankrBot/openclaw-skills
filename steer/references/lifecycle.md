# Steer lifecycle

Use this reference for market work and curated vault operations. Every new Bankr vault uses `--management curated`. Each gate must pass before advancing. Replace angle-bracket values with reviewed facts, not symbols or guesses.

The CLI intentionally uses different protocol aliases by command family. Do not transfer an alias from one family without checking help:

- `<POOL_PROTOCOL>` for pool lifecycle is `uniswap`, `sushi`, or `uniswap-v4`.
- `<VAULT_PROTOCOL>` for manifests and vault creation is `uniswap-v3`, `sushi-v3`, or `uniswap-v4`.
- `<TEND_PROTOCOL>` is optional for an existing vault and, when used, is the vault registry alias such as `uniswap`, `sushi`, `uniswap-v4`, or a supported existing-vault adapter.

## 1. Establish the market tuple

Record chain, DEX, protocol family and version, canonical token addresses and decimals, fee, tick spacing, hooks when applicable, and pool address or ID. Use discovery sources only to find candidates. Use the CLI, factory, and RPC state as authority.

```sh
steer pools support --chain <CHAIN> --protocol <POOL_PROTOCOL>
steer markets inspect <POOL> --chain <CHAIN> --protocol <MARKET_PROTOCOL>
```

If the requested protocol or action is unsupported, stop and report the capability boundary. Do not send a factory transaction assembled from third-party ABI text. In particular, existing Aerodrome Slipstream pools may be inspectable and eligible existing vaults may be operable, but new infrastructure is allowed only when the installed CLI proves that preparation path is supported.

For a supported pool-creation path, prepare first and save the resulting artifact:

```sh
steer pools create prepare \
  --account <BANKR_WALLET> --base <BASE_TOKEN> --quote <QUOTE_TOKEN> \
  --price <INITIAL_PRICE> --fee-tier <FEE> \
  --chain <CHAIN> --protocol <POOL_PROTOCOL> \
  --out <POOL_PLAN.json> --format json --full-output
```

Review the sorted tokens, factory, fee or tick configuration, initial price, expected signer, simulation, expiry, and full request transaction. Follow the Bankr execution boundary in [bankr-execution.md](bankr-execution.md), then verify the receipt:

```sh
steer pools create verify <TX_HASH> --plan <POOL_PLAN.json> --format json --full-output
```

For a multi-step capability, stop after each verified receipt and use the CLI's documented continuation command. Do not assume a second initialization transaction exists or fabricate it.

## 2. Resolve price direction and curated ranges

For the canonical pool ordering, calculate:

```text
human token1/token0 = 1.0001 ^ tick * 10 ^ (token0Decimals - token1Decimals)
```

Invert only when the intended quote is token0 per token1. Confirm wrapper, rebasing, or corporate-action multipliers. A curated vault has no connector or strategy scheduler. Any proposed range must come from the user or an explicit, bounded range policy.

Use representative history to assess range-exit risk, capital efficiency, swap cost, and adverse selection. Do not imply that a historical replay is a live strategy plan or that a curated vault will tend itself.

## 3. Build and validate a curated manifest

Initialize a curated manifest from the exact pool, then validate it against the same identity:

```sh
steer vaults init \
  --management curated --out <MANIFEST.json> \
  --pool <POOL> --protocol <VAULT_PROTOCOL>

steer vaults manifest validate <MANIFEST.json> \
  --pool <POOL> --protocol <VAULT_PROTOCOL> --management curated \
  --format json --full-output
```

Check tokens, decimals, fee, tick spacing, manager model, and runtime protocol. A curated manifest must use the approved no-op strategy, empty strategy configuration, no connectors, and no schedule. `vaults manifest preview` is a Steer-managed strategy command, so do not use it for curated vaults.

Publishing creates an external artifact. After a specific confirmation, inspect the final validated local bytes, then record the returned CID:

```sh
steer vaults manifest publish <MANIFEST.json> \
  --pool <POOL> --protocol <VAULT_PROTOCOL> --management curated \
  --format json --full-output
```

The curated model is the only new-vault management mode in this Bankr skill. It requires the canonical no-op strategy, empty strategy configuration, no connectors, a direct manager, and zero GasVault funding.

## 4. Create and verify the vault

Prepare, review, and save the creation artifact:

```sh
steer vaults create prepare \
  --account <BANKR_WALLET> --manifest-cid <CID> \
  --pool <POOL> --protocol <VAULT_PROTOCOL> --management curated \
  --format json --full-output
```

Follow [bankr-execution.md](bankr-execution.md) and call `submit_raw_transaction` for the one exact Bankr submission. Then verify:

```sh
steer vaults create verify <TX_HASH> --format json --full-output
```

The reviewed plan and post-state must agree on vault address, manifest CID, curated direct-manager mode, Bankr manager wallet, strategy, and tokens. Curated creation always uses zero GasVault funding.

## 5. Approve and deposit

Refresh wallet balances and prices. Convert human amounts to raw integers using actual token order and decimals. Set intentional nonzero minimums.

```sh
steer vaults deposit prepare <VAULT> \
  --account <BANKR_WALLET> --chain <CHAIN> \
  --amount0-desired <RAW0> --amount0-min <MIN0> \
  --amount1-desired <RAW1> --amount1-min <MIN1> \
  --format json --full-output
```

Deposit preparation may return one action at a time: exact token0 approval, exact token1 approval, then protected deposit. Submit and verify each one independently. Re-run preparation after each confirmed step because allowance, balances, price, and the next action can change.

If any submitted action fails, inspect rather than retry blindly:

```sh
steer transactions verify <TX_HASH> --trace --format json --full-output
```

The deposit gate is actual deposited amounts at or above reviewed minimums and shares delivered to the intended recipient.

## 6. Quote, prepare, and execute a curated tend

Before considering a tend, use [rebalance-context.md](rebalance-context.md) when the agent needs a compact vault and market view. Call it through one `execute_cli` invocation. The helper runs only `vaults inspect` and hourly `markets history` internally, with a narrow read-only GraphQL fallback for the known `volumeUsd` subgraph schema error. It never runs profile, quote, preparation, or submission.

Confirm the vault is curated and the Bankr wallet is its direct manager. A curated vault has no strategy output, so do not run `steer vaults tend plan`. Require the complete replacement ranges and weights from the user or a current explicitly authorized policy.

Quote the complete replacement set, not only a changed range:

```sh
steer vaults tend quote <VAULT> \
  --account <BANKR_WALLET> --protocol <TEND_PROTOCOL> \
  --position <LOWER>:<UPPER>:<WEIGHT>,<LOWER>:<UPPER>:<WEIGHT> \
  --slippage-bps <BPS> --total-weight <TOTAL_WEIGHT> \
  --format json --full-output
```

For Uniswap V4, pass the exact canonical pool key as well:

```text
--pool-key <CURRENCY0>:<CURRENCY1>:<FEE>:<TICK_SPACING>:<HOOKS>
```

The quote is read-only and time-sensitive. Review the pinned block, pool and protocol, current and quoted price, inventory, complete positions and weights, swap direction and amount, estimated output, slippage limit, and simulation. `--skipSwap` is valid only for an intentional zero-swap tend.

Prepare a fresh authoritative transaction with the same complete positions:

```sh
steer vaults tend prepare <VAULT> \
  --account <BANKR_WALLET> --protocol <TEND_PROTOCOL> \
  --position <LOWER>:<UPPER>:<WEIGHT>,<LOWER>:<UPPER>:<WEIGHT> \
  --slippage-bps <BPS> --total-weight <TOTAL_WEIGHT> \
  --format json --full-output
```

Compare this fresh preparation to the reviewed quote. Stop if ranges, swap, price limit, signer, block, or simulation changed materially. If it is still acceptable and the user confirms it, or a current automated authorization passes [automated-tend.md](automated-tend.md), submit only that fresh exact transaction through `submit_raw_transaction`.

After the receipt:

```sh
steer transactions verify <TX_HASH> --trace --format json --full-output
steer vaults inspect <VAULT> --chain <CHAIN>
```

For an initial deployment, confirm an AMM position exists and its ticks match the intended complete replacement set.

## Completion checks

- A pool exists only after its receipt and initialized state are verified.
- A vault exists only after its address, manifest CID, manager mode, strategy identity, tokens, and gas reserve match the reviewed plan.
- A deposit is complete only after actual deposited amounts meet the reviewed minimums and shares reach the intended recipient.
- A funded vault is not necessarily positioned. An initial curated deployment is complete only after a successful verified tend creates matching onchain positions.
- Curated no-op vaults do not produce a strategy plan. Do not invent one. A verified direct manager may prepare a manual quote and tend only when the user supplies the intended ranges or an explicitly authorized policy derives them.
