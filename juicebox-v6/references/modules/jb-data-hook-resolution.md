---
name: jb-data-hook-resolution
description: |
  Resolve which hooks actually run on pay and cash-out for a Juicebox V6 project by unwrapping
  `ruleset.metadata.dataHook` (REVOwner, JBOmnichainDeployer, JBBuybackHookRegistry, bare
  JB721TiersHook / JBBuybackHook, custom). Use when: (1) quoting a pay or cash-out and the
  ruleset `dataHook` is a wrapper singleton, (2) finding a project's buyback pool or 721 shop,
  (3) deciding whether NFTs price cash-outs, (4) a UI shows the wrong pool / no shop for a
  revnet or omnichain project, (5) building `pay`/`cashOut` metadata for the right hook ID.
version: 6.0.0
---

# Data hook resolution

`JBRulesetMetadata.dataHook` is rarely the hook that does the work. Revnets and omnichain 721
projects set a singleton wrapper as the data hook and store the real hooks in the wrapper's own
storage. A webclient must unwrap before it can quote weights, route swaps, or find a shop.

## What the terminal does

`JBTerminalStore` calls the data hook only when the flag is set **and** the address is nonzero:

| Flow | Condition | Call | Result used for |
|------|-----------|------|-----------------|
| Pay | `useDataHookForPay && dataHook != 0` | `beforePayRecordedWith(ctx) → (weight, JBPayHookSpecification[])` | `weight` replaces `ruleset.weight`; each non-`noop` spec gets `afterPayRecordedWith{value: amount}` from `JBMultiTerminal` |
| Cash out | `useDataHookForCashOut && dataHook != 0` | `beforeCashOutRecordedWith(ctx) → (cashOutTaxRate, effectiveCashOutCount, effectiveTotalSupply, effectiveSurplusValue, JBCashOutHookSpecification[])` | Full override of the bonding curve; `reclaimAmount` capped at local surplus; non-`noop` specs get `afterCashOutRecordedWith` |

Spec structs (ABI order): `(address hook, bool noop, uint256 amount, bytes metadata)`. A spec with
`noop = true` and `amount != 0` reverts `JBTerminalStore_NoopHookSpecHasAmount`.

Metadata packing (`JBRulesetMetadataResolver`): bit 80 `useDataHookForPay`, bit 81
`useDataHookForCashOut`, bits 82–241 `dataHook`.

`JBController` also consults the data hook: `sender == dataHook` or
`dataHook.hasMintPermissionFor(projectId, ruleset, sender)` grants `mintTokensOf` without
`allowOwnerMinting`. Wrappers forward this too (REVOwner → LOANS, registry, suckers;
JBOmnichainDeployer → suckers, extra hook; registry → resolved hook).

## Resolution decision table

All addresses are identical on every chain; read them from `references/shared/chain-config.json`.

| `dataHook` equals | Identify by | Wraps | Runs on pay | Runs on cash-out |
|-------------------|-------------|-------|-------------|------------------|
| `REVOwner` `0x2ba4705ad0332cdfb299b452068438bcba3faaf3` | address match (also ERC-165 `IJBRulesetDataHook` + `IJBCashOutHook`) | `tiered721HookOf(revnetId) → IJB721TiersHook` (zero if none); `BUYBACK_HOOK()` = `JBBuybackHookRegistry` | 721 hook first (its split amount), then `registry.hookOf(id)` with the remainder; specs merged `[721, buyback]` | Buyback hook only (via registry) plus REVOwner's own fee spec; loans/suckers/cash-out delay applied first. 721 hook never prices cash-outs on a revnet |
| `JBOmnichainDeployer` `0xb853758a70a6b4216c09f1d071ea2344aba0a34f` | address match (ERC-165 `IJBOmnichainDeployer`, `IJBRulesetDataHook`) | `tiered721HookOf(projectId, rulesetId) → (hook, useDataHookForCashOut)`; `extraDataHookOf(projectId, rulesetId) → (dataHook, useDataHookForPay, useDataHookForCashOut)` | 721 hook always (when set), then extra hook if its stored `useDataHookForPay`; weight from the extra hook | 721 hook if its stored `useDataHookForCashOut`; otherwise extra hook if its stored `useDataHookForCashOut`. Never both |
| `JBBuybackHookRegistry` `0x72f55a54cd53410a5ff175508a5a384227081788` | address match (ERC-165 `IJBBuybackHookRegistry`) | `hookOf(projectId)`: per-project `setHookFor` pin → `defaultHook` if `projectId > defaultHookProjectIdThreshold` → historical default segment → `address(0)` | resolved buyback hook | resolved buyback hook (registry forwards both) |
| a `JBBuybackHook` (default `0x77bee1ad2ac0ace98a9b5b58d75685c8b4d94948`; any allowed hook) | ERC-165 `IJBBuybackHook` `0x16f0f2dd`, or `registry.isHookAllowed(addr)` | nothing | itself — swaps when the pool beats issuance | itself — routes cash-outs through the pool unless the `cashOut` metadata entry sets `skip`, no pool, or no project token |
| a `JB721TiersHook` clone | ERC-165 `IJB721TiersHook` `0xc74ac2fc`; `JBAddressRegistry.deployerOf(addr) == JB721TiersHookDeployer` | nothing | itself — mints tiers, weight from `pricingContext` | itself, only if the ruleset bit `useDataHookForCashOut` is set |
| `CTDeployer`, `DefifaHook`, unknown | fallthrough | project-specific | treat as opaque custom hook: no buyback pool, no shop unless the address itself answers `STORE()` | same |
| `address(0)` or both flags false | — | — | none | none |

Registry `hookOf` is a **default-returning** getter. Reading it for a project whose data hook is
not the registry or REVOwner yields a hook that never runs. Recognize the ruleset data hook first.

Rekeyed metadata: the registry rewrites the `pay` / `cashOut` metadata entry from its own ID to the
resolved hook's ID (`bytes4(bytes20(hook) ^ bytes20(keccak256("pay")))`). REVOwner forwards the
context to the registry, so for revnets and registry projects encode buyback quotes under the
**registry's** ID; for a bare `JBBuybackHook` encode under the hook's ID.

ERC-165 IDs (computed from declared selectors): `IJBRulesetDataHook` `0xe3472395`,
`IJB721TiersHook` `0xc74ac2fc`, `IJBBuybackHook` `0x16f0f2dd`. `REVDeployer` does **not** report
`IJBRulesetDataHook` — it is never the data hook; `REVOwner` is.

## Production algorithm (juicebox.money `MarketSection.resolveMarket`, revnet.money `resolveBuybackHook`)

1. `JBDirectory.controllerOf(projectId)` — never hardcode the controller.
2. `controller.currentRulesetOf(projectId)` → `(ruleset, metadata)`; `metadata.dataHook == 0` → none.
3. If `dataHook == JBOmnichainDeployer`: replace with `extraDataHookOf(projectId, ruleset.id).dataHook` (buyback path) or `tiered721HookOf(projectId, ruleset.id)` (shop path). One unwrap level.
4. If `dataHook ∈ {JBBuybackHookRegistry, REVOwner}` → `registry.hookOf(projectId)`, zero → none.
5. Else if `dataHook == JBBuybackHook` (config address) → itself.
6. Else → no buyback hook.
7. Pool: `hook.poolKeyOf(projectId, terminalToken)` with the project's first accounting-context token; a zero `PoolKey` means no market.

Shop path (`@bananapus/nana-sdk-core` `getProject721Shop`): revnet → `REVOwner.tiered721HookOf(id)`;
else require `useDataHookForPay` and nonzero `dataHook`; omnichain → `tiered721HookOf`; else the raw
`dataHook`, probed with `STORE()` — a "function does not exist" revert means not a 721 hook.
Cash-out pricing by NFTs: omnichain → the deployer's stored `useDataHookForCashOut` tuple (the ruleset
bit is always `true` there and says nothing); single-chain → the ruleset bit. Neither webclient uses
`supportsInterface`; both classify by address equality against `references/shared/chain-config.json`.

## `resolveDataHooks`

```typescript
import { type PublicClient, type Address, zeroAddress, parseAbi } from 'viem'
import config from './references/shared/chain-config.json'

const ABI = parseAbi([
  'function controllerOf(uint256) view returns (address)',
  'function currentRulesetOf(uint256) view returns ((uint48 cycleNumber,uint48 id,uint48 basedOnId,uint48 start,uint32 duration,uint112 weight,uint32 weightCutPercent,address approvalHook,uint256 metadata) ruleset,(uint16 reservedPercent,uint16 cashOutTaxRate,uint32 baseCurrency,bool pausePay,bool pauseCreditTransfers,bool allowOwnerMinting,bool allowSetCustomToken,bool allowTerminalMigration,bool allowSetTerminals,bool allowSetController,bool allowAddAccountingContext,bool allowAddPriceFeed,bool ownerMustSendPayouts,bool holdFees,bool scopeCashOutsToLocalBalances,bool useDataHookForPay,bool useDataHookForCashOut,address dataHook,uint16 metadata) metadata)',
  'function tiered721HookOf(uint256) view returns (address)',
  'function tiered721HookOf(uint256,uint256) view returns (address hook, bool useDataHookForCashOut)',
  'function extraDataHookOf(uint256,uint256) view returns ((address dataHook,bool useDataHookForPay,bool useDataHookForCashOut))',
  'function hookOf(uint256) view returns (address)',
  'function isHookAllowed(address) view returns (bool)',
  'function deployerOf(address) view returns (address)',
])

export async function resolveDataHooks(client: PublicClient, chainId: number, projectId: bigint) {
  const c = (config as any).chains[String(chainId)].contracts as Record<string, Address>
  const eq = (a?: Address, b?: Address) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
  const read = (address: Address, functionName: string, args: unknown[]) =>
    client.readContract({ address, abi: ABI, functionName: functionName as any, args: args as any })
  const out = { payHooks: [] as Address[], cashOutHooks: [] as Address[], buyback: null as Address | null, tiers721: null as Address | null }

  const controller = (await read(c.JBDirectory, 'controllerOf', [projectId])) as Address
  const [ruleset, meta] = (await read(controller, 'currentRulesetOf', [projectId])) as any
  const dataHook = meta.dataHook as Address
  if (dataHook === zeroAddress || (!meta.useDataHookForPay && !meta.useDataHookForCashOut)) return out

  const buybackOf = async (h: Address): Promise<Address | null> => {
    if (eq(h, c.JBBuybackHookRegistry) || eq(h, c.REVOwner)) {
      const r = (await read(c.JBBuybackHookRegistry, 'hookOf', [projectId])) as Address
      return r === zeroAddress ? null : r
    }
    return eq(h, c.JBBuybackHook) || (await read(c.JBBuybackHookRegistry, 'isHookAllowed', [h])) ? h : null
  }
  const is721 = async (h: Address) => eq((await read(c.JBAddressRegistry, 'deployerOf', [h])) as Address, c.JB721TiersHookDeployer)

  if (eq(dataHook, c.REVOwner)) {
    const t = (await read(c.REVOwner, 'tiered721HookOf', [projectId])) as Address
    out.tiers721 = t === zeroAddress ? null : t
    out.buyback = await buybackOf(dataHook)
    out.payHooks = [out.tiers721, out.buyback].filter(Boolean) as Address[]
    out.cashOutHooks = [out.buyback, c.REVOwner].filter(Boolean) as Address[]
  } else if (eq(dataHook, c.JBOmnichainDeployer)) {
    const [t, tCashOut] = (await read(c.JBOmnichainDeployer, 'tiered721HookOf', [projectId, ruleset.id])) as [Address, boolean]
    const extra = (await read(c.JBOmnichainDeployer, 'extraDataHookOf', [projectId, ruleset.id])) as any
    out.tiers721 = t === zeroAddress ? null : t
    const x = extra.dataHook === zeroAddress ? null : (extra.dataHook as Address)
    out.buyback = x ? await buybackOf(x) : null
    out.payHooks = [out.tiers721, extra.useDataHookForPay ? x : null].filter(Boolean) as Address[]
    out.cashOutHooks = tCashOut && out.tiers721 ? [out.tiers721] : extra.useDataHookForCashOut && x ? [x] : []
  } else {
    out.buyback = await buybackOf(dataHook)
    out.tiers721 = !out.buyback && (await is721(dataHook)) ? dataHook : null
    out.payHooks = meta.useDataHookForPay ? [dataHook] : []
    out.cashOutHooks = meta.useDataHookForCashOut ? [dataHook] : []
  }
  return out
}
```

`payHooks` / `cashOutHooks` list the contracts whose `before*RecordedWith` logic decides the quote, in
call order. The terminal itself still calls only `metadata.dataHook`.

## Verifying 721 clones

Every `JB721TiersHook` is a `LibClone` proxy deployed by `JB721TiersHookDeployer`
(`0xb7b8ec35e2dd84afff04ee769c6189e7a4d44a78`), which registers each clone:
`JBAddressRegistry.deployerOf(hook) == JB721TiersHookDeployer`. This holds for clones created via
`JB721TiersHookProjectDeployer`, `JBOmnichainDeployer`, `REVDeployer`, and `CTDeployer` — they all
call the hook deployer. Use it instead of trusting `STORE()` or `supportsInterface` on an unknown
address: a malicious contract can answer both, but cannot register itself under the deployer's
address (`registerAddress` derives the address from the deployer's nonce or salt+bytecode).
Tiers then come from `JB721TiersHookStore.tiersOf(hook, ...)` at
`0x69913acf79dbba170d9efafe605ee62b42164f9c`.

## Common mistakes

- Calling `JBBuybackHookRegistry.hookOf(projectId)` without first checking that the ruleset's data hook is the registry or REVOwner. It returns a default hook for nearly every project; the returned pool never trades for projects that do not route through it.
- Treating `REVDeployer` as the revnet data hook. `REVDeployer` sets `dataHook = OWNER` (REVOwner). Reading `tiered721HookOf` on `REVDeployer` fails; read it on `REVOwner`.
- Using the ruleset bit `useDataHookForCashOut` on an omnichain project. `JBOmnichainDeployer` forces both bits `true`; the stored `tiered721HookOf(...).useDataHookForCashOut` and `extraDataHookOf(...).useDataHookForCashOut` are the only truth.
- Expecting the 721 hook to price a revnet cash-out. `REVOwner.beforeCashOutRecordedWith` never calls the 721 hook; revnet NFTs are pay-only.
- Unwrapping only one of the two omnichain getters. `extraDataHookOf` holds the buyback hook, `tiered721HookOf` holds the shop; a project can have both.
- Encoding a buyback quote under `JBBuybackHook`'s metadata ID for a revnet. REVOwner forwards to the registry, which rekeys from the registry's ID. Use the registry's ID.
- Falling back to a manifest default when recognition fails. Unknown hooks (`CTDeployer`, `DefifaHook`, custom) mean "no buyback, no shop", never "use the default pool".
- Hardcoding `JBController` as the controller. Read `JBDirectory.controllerOf(projectId)`.
