# Pantheon StakingVault — contract reference (Robinhood Chain)

Vault (proxy): `0x541E0a67558bAd0FFb5CD61C7BA2ebB392F33edB` — Robinhood Chain, **chain id 4663**.
Live implementation behind the proxy: `0xb43e88d96c1c99c7949a32b4996b84181126176d`.
`VERSION()` returns **7**. All facts below were read live from chain on **2026-08-25**; the pool,
token and fee reads at block **45,334,150**, and the implementation, arity, selector and gas
re-checks at block **45,414,502** after the registry shipped.

**Read this first if you already know the Base pack.** RH is the same contract at an
*older* version. Base upgraded to V8 on 2026-08-24; **RH did not**. Two consequences that matter
more than anything else on this page:

1. **`poolRewardTokens` is COMPLETE on RH** — the exact opposite of Base. The long warning in the
   Base pack does not apply here. Verified below.
2. **Both chains' vaults are controlled by 2-of-6 multisigs.** RH was migrated from a single EOA
   on 2026-08-26; see the custody note at the end of this file.

## Shared lineage — proven, not asserted

The RH implementation runtime is **byte-identical (ex-metadata) to the Base V7 implementation**
`0xe0C448B467dB7C65Ed8A0827e057D81D526919b2` — 22,159 bytes on both, same solc metadata trailer
(`64736f6c634300081c` → 0.8.28). It is **not** the Base V8 build (24,103 bytes).

So RH runs the same code Base ran before the PRD-085 upgrade. The V8-only delegated-staking
verbs are confirmed absent from the RH runtime: `stakeOnBehalf` (`0x45f54bfd`),
`addToStakeOnBehalf` (`0x9b316ed6`), `initializeV5` (`0x16e1f015`), `STAKER_FOR_ROLE`
(`0x0660bbee`).

## ABI fragments (call these exactly)

**Identical to Base. No signature differs.** Every v1 selector was computed and confirmed present
in the deployed RH runtime.

```
function stake(address stakingToken, uint16 lockMonths, uint256 amount, bool autoRestakeOptIn)
function accruedReward(address user, address stakingToken, address rewardToken) view returns (uint256)
function claimReward(address stakingToken, address rewardToken)
function pools(address stakingToken) view returns (bool active, uint32 cliffMonths, uint256 totalStaked)
function stakes(address user, address stakingToken) view returns (
    uint256 amount,
    bool    autoRestake,
    uint16  lockMonths,
    uint32  lockDuration,
    uint32  stakeTime,
    uint32  unstakeRequestTime,
    uint32  unstakeTime,
    uint32  stakeMonthIndex,
    bool    compounderEnabled
)
```

Selectors: `stake` `0x946debd5` · `accruedReward` `0x814b57b3` · `claimReward` `0x4953c782` ·
`pools` `0xa4063dbc` · `stakes` `0xa4e47b66`. **All identical to Base** — the same bytes work on
both chains, which is exactly why the chain id must be checked explicitly rather than inferred
from a successful encode.

ERC-20 approve first: `approve(0x541E0a67558bAd0FFb5CD61C7BA2ebB392F33edB, exactAmount)` on the
token contract. **Note the spender differs from Base.** An approval granted to the Base vault does
nothing here.

Rules — unchanged from Base, all confirmed live:
- `lockMonths` is always `6`; `12` reverts `InvalidLockMonths` (proven).
- `autoRestakeOptIn` always `false` (skill policy). **The contract does not enforce this on RH** —
  passing `true` is accepted by the vault and fails later at the token transfer. The policy is the
  skill's to hold, not the chain's.
- Amount is the **third** argument, after `lockMonths`.
- Amounts are raw units (`human * 10^decimals`).
- Check `pools(token).active == true` before staking.

## Reading a position

Same tuple, same field meanings. Live example read at block 45,334,150 (LNOC pool):

```
stakes(0xa831c6b7…8d3b, 0x0762…a991)
  amount 220939952577987439838464 · autoRestake false · lockMonths 6
  lockDuration 16930014 · stakeTime 1786929186 · unstakeRequestTime 0
  unstakeTime 0 · stakeMonthIndex 679 · compounderEnabled false
```

A position is empty when `amount == 0`. A wallet that has exited shows `amount 0` with
`unstakeTime` set — that combination is what triggers the restake cooldown, not an error state.

## Reward tokens — the Base warning does NOT apply here

`accruedReward` and `claimReward` are per reward token; there is still no "claim everything" call.

**On RH, `poolRewardTokens` is complete and safe to read.** Verified two ways at block 45,334,150:

- The vault's entire lifetime contains **7 `RewardFundedWithCliff` events and ZERO `RewardFunded`
  events**. Every funding on RH went through the V3-era path, which pushes to the array. There is
  no V2-era residue on this chain, because the vault was deployed after V3.
- The array contents match the funded set exactly, on both live pools:

| Pool | `poolRewardTokens[]` | funded set from events | match |
|---|---|---|---|
| LNOC `0x0762…a991` | LNOC, USDG, Jimothy, JUBAKO | LNOC, USDG, Jimothy, JUBAKO | ✅ exact |
| tTEST `0xf2b0…18b0` | USDG, DIH | USDG, DIH | ✅ exact |

**Still prefer the registry when one exists** (see below) — the array is complete *today* because
of how this chain's history happened, not because the contract guarantees it. If the vault were
ever migrated from an older deployment the guarantee would evaporate silently, exactly as it did on
Base. Treat "complete on RH" as a measured fact with a date on it, not a property.

## Live pools and token facts

Both read live. **There are exactly two pools with any activity on RH.**

| Pool token | Symbol | Name | Decimals | `active` | `cliffMonths` | `totalStaked` |
|---|---|---|---|---|---|---|
| `0x076277c3d6b57B4aad34c592cd2f138e9316a991` | LNOC | Late Night Onchain | 18 | `true` | 0 | 3,111,779.42 LNOC |
| `0xf2b08B425871bB59AEdE103d5b58E655A87118B0` | tTEST | **RH Vault TEST** | 18 | `true` | 0 | 101 tTEST |

Reward tokens across both pools:

| Address | Symbol | Name | Decimals | Note |
|---|---|---|---|---|
| `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | USDG | Global Dollar | **6** | **upgradeable proxy** (EIP-1967, impl `0x68184c44…6f8f`) |
| `0x076277c3d6b57B4aad34c592cd2f138e9316a991` | LNOC | Late Night Onchain | 18 | pool pays itself |
| `0xdBCec8db3e21C1612a22b39D195D7D654cAD00Af` | Jimothy | Jimothy The Raccoon | 18 | |
| `0x141D1cFA7b93692e2A959185Ce845E4E48Fa0074` | JUBAKO | JUBAKO | 18 | |
| `0x0c1eD62D7811e5b437e537Ac9d0592469C119C74` | DIH | Dih | 18 | tTEST pool only |

**USDG is 6-decimal.** Every other token here is 18. A 6-vs-18 mistake on USDG is a 10¹²-factor
error; never infer decimals, always read them.

**`tTEST` is a test pool that is `active == true` on mainnet.** It has 101 tokens staked and a real
reward stream. Nothing on chain distinguishes it from a production vault. See the exclusions.

### Enumerating RH pools — the registry now serves this chain

**There IS an RH registry endpoint as of 2026-08-25.** The earlier version of this pack said there
was not; that is no longer true and the paragraph has been replaced rather than amended, because a
stale "there is no registry" is exactly the sentence that would push an agent into improvising
chain enumeration.

```
GET https://launch.pantheonvaults.com/api/skill/registry?chain=robinhood
```

Verified live, 2026-08-25:

```jsonc
{
  "chain": "robinhood",
  "chain_id": 4663,
  "vault_address": "0x541E0a67558bAd0FFb5CD61C7BA2ebB392F33edB",
  "count": 1,
  "tokens": [
    {
      "token_address": "0x076277c3d6b57B4aad34c592cd2f138e9316a991",
      "symbol": "LNOC",
      "name": "Late Night Onchain",
      "decimals": 18,
      "active": true,
      "reward_tokens": [
        { "address": "0x076277c3d6b57B4aad34c592cd2f138e9316a991", "symbol": "LNOC",    "decimals": 18 },
        { "address": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", "symbol": "USDG",    "decimals": 6  },
        { "address": "0xdBCec8db3e21C1612a22b39D195D7D654cAD00Af", "symbol": "Jimothy", "decimals": 18 },
        { "address": "0x141D1cFA7b93692e2A959185Ce845E4E48Fa0074", "symbol": "JUBAKO",  "decimals": 18 }
      ]
    }
  ]
}
```

Three properties of this endpoint matter for RH specifically:

1. **`vault_address` and `chain_id` are served, so never assume them.** The RH vault differs from
   Base's, and the selectors are identical across chains — a successful encode is not evidence of
   which chain you are on.
2. **The `active` flag is chain-verified.** The endpoint multicalls `pools(token)` against the
   **RH** vault over an **RH** RPC before listing anything. A database row alone does not qualify a
   token. If that gate cannot be read at all, the endpoint returns **503**, never an empty list —
   an empty `tokens` array means "nothing qualifies", not "the check failed".
3. **RH is allow-listed, Base is not.** Only explicitly permitted RH pools are served, which is how
   `tTEST` is kept out (see the exclusions below). A new RH pool is invisible to the registry until
   a human adds it — by design, and the safe default for a signing surface.

Reward-token entries key on **`address`**, not `token_address`, and `symbol`/`decimals` may be
`null` when a token could not be read. USDG returns `decimals: 6` here, which is the single most
important field on this chain to take from the response rather than assume.

## Fees and penalties — verified from contract reads

Every value below was read from the RH vault, and every one is **identical to Base**:

| Constant | RH | Base | Meaning for the user |
|---|---|---|---|
| `feePercent()` | **5** | 5 | 5% fee on every reward claim |
| `PRINCIPAL_TAX_PERCENT` | **10** | 10 | 10% of principal on a normal unstake after the lock |
| `EMERGENCY_PRINCIPAL_TAX_PERCENT` | **20** | 20 | 20% of principal on emergency exit |
| `LOCK_MONTHS` | **6** | 6 | the only accepted term |
| `UNSTAKE_COOLING_OFF` | **604800** | 604800 | 7 days between request and withdrawal |
| `RESTAKE_COOLDOWN` | **604800** | 604800 | 7 days after exiting before staking again |
| `REWARD_DISTRIBUTION_MONTHS` | **24** | 24 | funding spreads over 24 months |

**Disclosure numbers the skill must relay, verbatim:**

- Claiming rewards costs **5%** of the claimed amount.
- Unstaking normally, after the 6-month lock, costs **10%** of principal. Half is burned, half goes
  to treasury.
- Emergency exit costs **20%** of principal **and forfeits unclaimed rewards**. Half burned, half
  treasury.
- After requesting an unstake there is a **7-day** wait before the principal can be withdrawn.
- After exiting, the same wallet cannot stake that vault again for **7 days**.

Treasury on RH is `0x1f9c5017BE7ab490d29CA6cd4BDEb364C94D6177` (Treasury Safe, 2-of-6) — a
*different* address from Base's. It was an EOA until 2026-08-26; always read `treasury()` live
rather than trusting this line.

## Revert codes — translate honestly, never guess

Every selector below was **observed live** on the RH vault via `eth_call`, not copied from Base.

| Selector | Error | Tell the user |
|---|---|---|
| `0x2083cd40` | InvalidPool() | This vault isn't active on-chain. Don't retry; check pantheonvaults.com. |
| `0xfa499066` | InvalidLockMonths(uint16) | The term must be exactly 6 months. This is a bug in the request — do not retry with a different number. |
| `0x1f2a2005` | ZeroAmount() | The stake amount was zero. |
| `0x7cac15fa` | StakeAlreadyActive() | This wallet already has an active stake in that vault. One position per wallet per vault. |
| `0x3498ce58` | RestakeCooldownNotFinished() | This wallet exited that vault within the last 7 days and must wait. Give the date. |
| `0xfb348942` | NoActiveStake() | This wallet has no active stake in that vault. |
| `0xea2d0505` | NotYetEarning() | Rewards aren't claimable yet — claiming opens at 00:00 UTC on the 1st of the second calendar month after staking. Give the date. |
| `0x5aa9184d` | NoRewardToClaim() | Nothing to claim for that reward token right now. |
| `0xb509bbcf` | CliffNotPassed() | The 6-month lock hasn't ended, so a normal unstake can't be requested yet. Give the date. Do not offer emergency exit as a workaround unless the user asks. |
| `0x86d06e24` | NoUnstakeRequested() | Nothing to finalise — no unstake has been requested for this vault. |
| `0xa79d0533` | CoolingOffNotFinished() | The 7-day wait after requesting an unstake hasn't elapsed. Give the date. |
| `0x08c379a0` | Error(string) | **Not a vault error.** Decode the string and relay it. In practice this is the token, e.g. `"Insufficient allowance"` — the approve step was missed or was too small. |

**Which error you get on a pool that doesn't exist depends on the call**, exactly as on Base and
confirmed live here: `stake` reverts `InvalidPool` (`0x2083cd40`); `claimReward`,
`requestUnstake`, `finalizeUnstake`, `emergencyExit` and `addToStake` all check the *position*
first and revert `NoActiveStake` (`0xfb348942`). Never read `NoActiveStake` from a claim as proof
the vault is fine.

`NoRewardToClaim` is the one row above **not** directly observed on RH — no wallet on this chain is
yet past its first earning month. It is carried over on the strength of byte-identical bytecode.
Flagged rather than presented as measured.

Any other revert: report the raw selector and link to pantheonvaults.com support.

## Gas and UX — what changes versus Base

**Users pay their own gas. There is no sponsorship.** Measured from three real RH stake
transactions: `effectiveGasPrice` 20,000,000–20,048,000 wei (0.020–0.0200 gwei), `gasUsed`
316,628–324,490, fee **≈0.0000064 native per stake**. Re-checked 2026-08-25 at block 45,414,502:
`eth_gasPrice` 22,988,000 wei (0.022988 gwei), which puts a 320,000-gas stake at
**≈0.0000074 native**. Budget ~0.00001 to be safe. No paymaster, bundler, or ERC-4337 path exists
in the app for RH; searched and found nothing.

- **Native balances are tiny.** A live RH staker holds 0.0000585 native — about nine stakes' worth
  of gas. On Base a user's ETH balance is rarely the binding constraint; **on RH it routinely is.**
  Check the native balance before proposing a transaction, and if it is short say so plainly rather
  than letting the wallet fail.
- Gas price sits around 0.02–0.023 gwei and the block gas limit is effectively unbounded
  (1.13e15), so congestion is not a factor. Cost is not the risk; **having any native token at
  all** is.
- **A stake is two transactions**, approve then stake, exactly as on Base — so budget gas for two.
- **USDG is the stable unit on RH** (6dp, upgradeable proxy). It is a reward token on both live
  pools. It is not currently a *staking* token on either.
- The public RPC `https://rpc.mainnet.chain.robinhood.com` answers `eth_chainId`,
  `eth_blockNumber`, `eth_call` and `eth_getStorageAt` fine. **It ignores the `topics` filter on
  `eth_getLogs`** — measured 2026-08-25: a filtered request returned every log the vault has ever
  emitted, including events whose signature did not match. Filter client-side on `topics[0]` and
  the indexed positions, or a naive reader will decode the wrong events and reach confident wrong
  conclusions. Prefer the project endpoint for log-range work.

## What must NOT be enabled on RH in v1

**These are findings, not failures. Each is a verb we exclude because RH cannot support it safely
today.**

1. **`emergencyExit` — exclude, and do not mention it unprompted.** Probed live against a real RH
   position it returns **no revert**: it would succeed. It costs 20% of principal *and* forfeits
   unclaimed rewards, and it is irreversible. It is the only v1-adjacent verb that is destructive
   on first call with no second confirmation from the chain.
2. **`tTEST` `0xf2b0…18b0` — RESOLVED by the registry, and the reasoning still stands.** It is
   named "RH Vault TEST", it is `active == true` on mainnet, and it has a live reward stream;
   nothing on chain distinguishes it from production. The registry now **allow-lists** RH pools
   rather than blocklisting test ones, so tTEST is excluded by not being on the list and the next
   test pool is excluded by default. The rule to keep: never resolve an RH token from chain state
   directly — a loose match on "test" would stake real value into it.
3. **Staking verbs — UNBLOCKED as of 2026-08-25.** This item previously read "all staking verbs,
   until an RH registry exists". That registry now exists and serves this chain (see above), so the
   condition is met and RH write verbs may be enabled. The rule it protected is unchanged and
   absolute: **the registry is the only sanctioned token-resolution source on RH.** If it is
   unreachable, stop — do not enumerate chain state as a fallback.
4. **`claimReward` is safe but currently inert.** No RH wallet is past its first earning month, so
   every claim reverts `NotYetEarning`. Confirmed by reading the pool's own history: the earliest
   LNOC stake is **2026-08-15**, `stakeMonthIndex` **679** (2026-08), so rewards accrue from
   **2026-09-01** and the first claim opens **2026-10-01 00:00 UTC**. Enabling the verb is
   harmless; expect it to do nothing useful before that date, and quote the date rather than
   letting the user hit the revert.

### Custody note

**The RH vault is controlled by a 2-of-6 multisig.** As of **2026-08-26**:

| Role | Holder |
|---|---|
| Vault `owner()` + all AccessControl roles | `0x8da5186814b46EAcB9083040A949Fe92e9884373` (Safe, 2-of-6) |
| ProxyAdmin `owner()` — upgrade authority | `0x8da5186814b46EAcB9083040A949Fe92e9884373` (same Safe) |
| `treasury()` | `0x1f9c5017BE7ab490d29CA6cd4BDEb364C94D6177` (Safe, 2-of-6) |

Before that date both the vault and the ProxyAdmin were owned by a single EOA
(`0x9Eba2eCD3c07f0d693105a112ae3404F5513747A`), meaning one key could administer the vault and
upgrade its implementation. That was migrated deliberately; Base's equivalent Safe is
`0x47b22B1c84AD1A41396aa20A26f4832C51553872`, also 2-of-6.

Both chains are now equivalent in custody posture: no single key can administer or upgrade either
vault. All three values above are readable on-chain and should be checked rather than believed —
`owner()` on the vault, `owner()` on the ProxyAdmin, `treasury()` on the vault.

The skill should not editorialise about custody. Answer the question if a user asks, cite the
addresses, and tell them how to verify it themselves.
