# Token Deployment Reference

Deploy and manage tokens on Base and Robinhood Chain (via Doppler / Uniswap V4) and Solana (via Raydium LaunchLab). Older tokens launched through Clanker remain fully claimable; fee claims auto-detect Doppler vs Clanker.

## Supported Chains

| Chain | Protocol | Token Standard | Best For |
|-------|----------|----------------|----------|
| **Base** (CLI / web default) | Doppler (Uniswap V4) | ERC20 | Memecoins, social/agent tokens |
| **Robinhood Chain** (agent / deploy-API default) | Doppler (Uniswap V4) | ERC20 | Memecoins alongside tokenized stocks |
| **Solana** | Raydium LaunchLab | SPL | High-speed trading, bonding curves |

> **The EVM default differs by surface.** `bankr launch` and the web launch form preselect **Base**; the AI agent and `POST /token-launches/deploy` fall back to **Robinhood Chain** when the request names no chain. Name the chain explicitly whenever it matters.

> **Builder exits:** selling a token you earn creator fees on through Bankr's ordinary swap/limit/stop/DCA/TWAP tools is intentionally restricted (buying and transferring still work). To take profit, builders use a **Glidepath** — a capped, AI-paced gradual sell managed from the token page at [bankr.bot](https://bankr.bot). Glidepath is a web feature, not a CLI/API action. Details: https://docs.bankr.bot/token-launching/glidepath

---

## Solana Token Launches (Raydium LaunchLab)

Launch SPL tokens on Solana with a bonding curve mechanism that auto-migrates to a Raydium CPMM pool.

### Deployment Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| **Name** | Yes | Token name (1-32 chars) | "MoonRocket" |
| **Symbol** | No | Ticker (1-20 chars), defaults to name | "MOON" |
| **Image** | No | Logo URL | "https://example.com/logo.png" |
| **Decimals** | No | Token decimals (0-9), default 6 | 6 |
| **Fee Recipient** | No | Wallet to receive 99.9% of creator fees | "7xKXtg..." |
| **Cliff Period** | No | Vesting cliff in seconds | 2592000 (30 days) |
| **Unlock Period** | No | Vesting period in seconds | 7776000 (90 days) |
| **Locked Amount** | No | Tokens to lock for vesting | 500000000 |

### Prompt Examples

**Launch tokens:**
- "Launch a token called MOON on Solana"
- "Deploy a Solana memecoin called DOGE2"
- "Launch SpaceRocket with symbol ROCK"
- "Create a token with 30 day cliff and 90 day vesting"
- "Launch BRAIN and route fees to 7xKXtg..."

**Check fees:**
- "How much fees can I claim for MOON?"
- "Check fee status for my token"

**Claim fees:**
- "Claim my fees for MOON" (works for both creator and fee recipient)
- "Claim creator fees for my token"

**Fee Key NFTs:**
- "Show my Fee Key NFTs"
- "What tokens do I have fee rights for?"
- "Transfer fees for MOON to 7xKXtg..."

**Claim shared fee NFT (post-migration):**
- "Claim my fee NFT for ROCKET"

### Bonding Curve Mechanics

1. **Launch**: Token starts with a bonding curve that determines price based on supply
2. **Trading**: Early buyers get lower prices; price increases as more tokens are bought
3. **Migration**: When bonding curve fills, token auto-migrates to Raydium CPMM pool
4. **Post-Migration**: Trading continues on standard AMM with LP fee distribution

**Benefits:**
- Fair launch mechanism (no pre-allocation needed)
- Price discovery through market demand
- Automatic liquidity provision
- No rug pull risk (liquidity is locked)

### Fee Structure

**During Bonding Curve Phase:**
| Fee | Recipient | Description |
|-----|-----------|-------------|
| 1% | Bankr Platform | Platform fee |
| 0.5% | Creator | Creator trading fee (or split with fee recipient) |

**Fee Sharing (when feeRecipient specified):**
| Share | Recipient | Description |
|-------|-----------|-------------|
| 99.9% | Fee Recipient | Main share of creator fees |
| 0.1% | Creator | Referrer fee |

**At Migration (when bonding curve completes):**
| LP Share | Recipient | Description |
|----------|-----------|-------------|
| 40% | Bankr Platform | Locked platform LP |
| 50% | Token Creator | Locked creator LP (Fee Key NFT) |
| 10% | Burned | Deflationary mechanism |

**Post-Migration:**
- Token trades on Raydium CPMM pool
- Fee Key NFT holders can claim 50% of LP trading fees

### Fee Claiming

**Checking Fee Status:**
- Use "How much fees can I claim for TOKEN?" to check status
- Shows pool status (bonding curve vs migrated)
- Explains how to claim based on your role

**Standard Tokens (No Fee Sharing):**
- Creator claims all 0.5% trading fees
- Use "Claim my fees for TOKEN"
- Requires ~0.005 SOL gas

**Tokens with Fee Sharing Arrangement:**
- BOTH creator AND fee recipient can initiate claims
- Fees automatically split: 99.9% to recipient, 0.1% to creator
- Gas is sponsored by Bankr (free for users)
- Use "Claim my fees for TOKEN" (works for either party)

**Post-Migration Fee Claiming:**
1. Fee recipient claims Fee Key NFT: "Claim my fee NFT for TOKEN"
2. Then claim ongoing LP fees: "Claim CPMM fees for TOKEN"

### Fee Key NFTs

Fee Key NFTs represent the right to claim LP trading fees after migration.

**How They Work:**
- Created when token migrates from bonding curve to CPMM
- Represent 50% share of LP trading fees
- Standard SPL token (decimals=0, amount=1)
- Transferable (with restrictions for permanent arrangements)

**Managing Fee Rights:**
- View your NFTs: "Show my Fee Key NFTs"
- Transfer to another wallet: "Transfer fees for TOKEN to ADDRESS"
- Claim if designated recipient: "Claim my fee NFT for TOKEN"

### Fee Recipient (Permanent Arrangements)

Specify a `feeRecipient` to route creator fees to a different wallet.

**How It Works:**
1. Launch token with `feeRecipient` address
2. During bonding curve: EITHER party can claim fees
3. Fees split automatically: 99.9% to recipient, 0.1% to creator
4. After migration: recipient claims Fee Key NFT
5. Recipient uses "Claim CPMM fees" for ongoing LP fees

**Important:**
- Creates a PERMANENT arrangement
- Deployer CANNOT transfer their Fee Key NFT
- Only the designated recipient can claim the NFT
- Use for treasuries, DAOs, collaborators, or charity

**Who Can Claim During Bonding Curve:**
- Token creator (deployer)
- Designated fee recipient
- Either party initiates, fees split automatically

### Vesting Parameters

Optional vesting for team tokens or investor allocations.

| Parameter | Description | Example |
|-----------|-------------|---------|
| Cliff Period | Time before any tokens unlock | 30 days = 2592000 seconds |
| Unlock Period | Time for gradual unlock after cliff | 90 days = 7776000 seconds |
| Locked Amount | Total tokens to lock | In token units with decimals |

### Gas Fees

| Operation | Cost | Sponsored? |
|-----------|------|------------|
| Token Launch | ~0.01-0.02 SOL | Yes (within limits) |
| Standard Fee Claim | ~0.005 SOL | No |
| Shared Fee Claim | ~0.005 SOL | Yes (always) |
| Transfer Fee Rights | ~0.005 SOL | No |
| Claim Fee NFT | ~0.005 SOL | No |

Gas is sponsored for token launches within daily limits (1/day standard, 10/day Bankr Club).
Shared fee claims are always sponsored to ensure atomic claim+transfer.

### Rate Limits (Solana)

| User Type | Daily Limit | Gas Sponsored |
|-----------|-------------|---------------|
| Standard Users | Unlimited | 1 token/day |
| Bankr Club Members | Unlimited | 10 tokens/day |

Users can launch additional tokens beyond sponsored limits by paying ~0.01 SOL gas.

> These figures cover **Solana LaunchLab launches only**. EVM (Doppler) launches run on a separate and much tighter quota — 3 counted attempts per rolling 24 hours for every wallet type. See [Launch Quota and Rate Limits](#launch-quota-and-rate-limits).

---

## EVM Token Launches (Base, Robinhood Chain & Arbitrum, via Doppler)

Launch ERC20 tokens on Base, Robinhood Chain or Arbitrum One. New launches create a Uniswap V4 pool via Doppler with a fixed supply and a single swap-fee tier shared between you and the protocol. The default chain differs by surface (see [Supported Chains](#supported-chains)), so name it explicitly — `bankr launch --chain robinhood`, `"chain": "arbitrum"`, or "launch a token on base". Robinhood Chain memecoin launches need no location verification — that gate only applies to Robinhood-issued tokenized stocks.

**Chain capability matrix:**

| | Base | Robinhood Chain | Arbitrum One |
|---|---|---|---|
| Default quote asset | WETH | WETH | WETH |
| `pairedStockAddress` (tokenized stock) | Yes — B20 equities | Yes — Robinhood stocks | **No** |
| `pairedTokenAddress` (quote token) | Yes — 5 fixed tokens | **No** | **No** |
| Retail launch gas | Sponsored | Wallet pays | Wallet pays |

Arbitrum launches are therefore **WETH-paired only**. Everything else — supply, fee schedule, creator vesting, quote-only fees, degen mode, fee claiming — behaves as on Base. Fund the launch wallet with ETH on Arbitrum before deploying.

### Token Economics

| Property | Value |
|----------|-------|
| **Supply** | 100 billion on standard launches; fixed and not mintable after deployment. The web launch flow accepts a custom whole-number supply (1 to 100 billion); the deploy API and CLI always launch at the standard 100 billion |
| **Pool** | Uniswap V4 |
| **Pool swap fee** | 0.7% per trade — **95% to the creator** |
| **All-in swap fee** | 1.75% of volume (pool fee + hook-added legs) |

Every trade pays a **0.7% swap fee on the pool, and 95% of it goes to you** — 0.665% of trading volume, paid directly and claimable anytime. On top of that the hook adds the Bankr protocol fee + BNKR buyback and LP fee:

| Recipient | Share of volume |
|-----------|-----------------|
| **Creator (you)** — 95% of the 0.7% pool swap fee, claim anytime | **0.665%** |
| **LP fee** (via hook) — a second creator-side fee: compounds as permanently locked liquidity in your own pool, strengthening your token's liquidity on every swap | **0.285%** |
| Bankr protocol fee (via hook) | 0.475% |
| BNKR buyback (via hook) | 0.2375% |
| Protocol (Doppler) | ~0.0875% |

**Fee schedules are fixed at launch and never change retroactively.** Tokens launched before the current structure keep the schedule they launched with: the creator's 95% of the 0.7% pool fee works exactly the same, only the hook add-on differs. Claiming, redirecting, and transferring all behave identically on older tokens.

Fees accumulate in your token and WETH and can be claimed anytime.

### Quote-Only Fees (optional, fixed at launch)

By default creator fees accrue as a mix of the launched token and the quote token (e.g. WETH). At launch you can instead opt into **quote-only fees**, so the entire creator share is collected in the quote token. **Your total take is identical either way** — this is a denomination choice, not a rate change.

| How | Syntax |
|-----|--------|
| Natural language | "launch a token with quote-only fees" |
| CLI | `bankr launch --name MyToken --quote-only-fees` |
| Deploy API | `"quoteOnlyFees": true` |
| Web | toggle in the launch form |

Two knock-on effects for anyone integrating against a quote-only token:

- **Claiming** — the creator's fee entry lives on the **hook contract's** fees manager rather than the pool initializer, and the whole claim arrives in the quote token with no launched-token leg. The claim APIs resolve the right contract automatically.
- **Transferring fee rights** — a direct on-chain `updateBeneficiary` call must target the hook address, not the initializer. The Bankr transfer endpoints resolve this for you either way.

Like the fee schedule, this option cannot be changed after launch.

### Base Quote Tokens (optional, fixed at launch)

Base launches can quote the new token's pool in one of **five fixed tokens** instead of WETH. Pass `chain: "base"` together with one of the allowlisted addresses:

| Quote token | What it is | `pairedTokenAddress` | Decimals |
|-------------|------------|----------------------|----------|
| BNKR | BankrCoin, Bankr's native token | `0x22af33fe49fd1fa80c7149773dde5890d3c76f3b` | 18 |
| ba3Pump | Bankr-bridged $PUMP from Solana | `0x5577a294ae5a21446a11b0e4100ca83803995720` | 18 |
| cbHYPE | Coinbase Wrapped Hyperliquid (HYPE) on Base | `0xB200000000000000000000451d033a5000cb479e` | 18 |
| cbZEC | Coinbase Wrapped ZEC on Base | `0xB2000000000000000000008501b13360000cb2EC` | 8 |
| TAO | Bittensor's TAO on Base | `0xf3081494b87e8d5fb7960f066e931d1d0e6e3d67` | 18 |

- **Base only.** These are not launch quote-token options on Robinhood Chain or Arbitrum.
- **User-key launches only** — not available on org Partner Key deploys.
- **Mutually exclusive with `pairedStockAddress`.** Sending both is rejected; omit both to get WETH.
- The allowlist is fixed — an arbitrary ERC-20 is not accepted as a quote token.
- **cbHYPE and cbZEC wait on reviewed on-chain quote-token liquidity.** If Bankr reports either pair isn't ready, that's a real refusal — the launch does not silently fall back to WETH or to a paired stock. Retry once the pair is live.
- cbHYPE and cbZEC are Coinbase-wrapped **crypto** assets, not tokenized stocks: they go in `pairedTokenAddress`, never `pairedStockAddress`, and no location/geo verification applies to them.
- Volume in a BNKR- or ba3Pump-quoted pool remains eligible for the weekly developer rebate under the same rules as a WETH-quoted launch.
- Everything else — supply, the fee schedule, creator vesting, quote-only fees, degen mode — behaves exactly as on a WETH launch. "Quote token" here just names the pool's other side.

### Creator Vesting (on by default, fixed at launch)

Every non-partner EVM launch premints **15% of supply to the fee recipient** and vests it over **1 year with a 30-day cliff** — nothing unlocks for the first 30 days, then it vests continuously until fully unlocked at the one-year mark (the cliff sits *inside* the year, not on top of it). The remaining **85%** seeds the Uniswap V4 pool, so trading starts clean.

| Property | Value |
|----------|-------|
| Allocation | 15% of supply (15B on a standard 100B launch) |
| Cliff | 30 days |
| Total duration | 1 year, including the cliff |
| Recipient | The fee recipient set at launch — fixed, and **not** moved by a later fee-rights transfer |

- **Turning it off**: ask the agent to deploy "with no vesting", pick **No vesting** in the web launch flow, pass `disableVesting: true` to the deploy API, or use `bankr launch --no-vesting`. With vesting off, 100% of supply is sold into the pool and nothing is preminted.
- There is no custom percentage or schedule — vesting is either the default 15% or off.

**Reading and claiming the allocation.** The schedule is public on-chain data, so the read needs no authentication:

```bash
# Schedule + position for a launch (optionally for a specific beneficiary)
curl "https://api.bankr.bot/token-launches/0xTOKEN/vesting?beneficiary=0xWALLET"
```

The response carries the chain, token symbol, the recorded `recipient`, whether the queried `beneficiary` is `eligible`, and a `vesting` object: `phase` (`cliff` | `vesting` | `complete`), `vestingStart` / `cliffEndsAt` / `vestingEndsAt` (unix seconds), `totalAmount`, `releasedAmount`, `claimableAmount`, `lockedAmount`, and `unlockedPercent`. A non-Bankr token returns `404`.

Claiming releases whatever has vested to the beneficiary. Custodial Bankr wallets claim through the authenticated claim route or the token page at [bankr.bot](https://bankr.bot); an external/connected wallet fetches an unsigned `release()` transaction from `POST /token-launches/{tokenAddress}/vesting/build-claim` (body `{ "beneficiaryAddress": "0x…" }`) and signs it locally — `release()` only ever pays `msg.sender`, so holding the key is the authorization.

```bash
bankr agent prompt "How much of my MTK allocation has vested?"
bankr agent prompt "Claim my vested MTK"
```

### Degen Mode (optional, fixed at launch)

Degen mode starts the token at a **$2,500 market cap** instead of the standard starting cap, so the curve's early range is far more volatile. Everything else about the launch — supply, fee schedule, curve shape, vesting — is unchanged.

| How | Syntax |
|-----|--------|
| Natural language | "launch MOON in degen mode" |
| Deploy API | `"degenMode": true` |
| Web | toggle in the launch form |

- **Explicit opt-in only.** You have to ask for the mode by name. A token *called* DEGEN, or generic "make it risky" phrasing, does not turn it on.
- **The figure is fixed at $2,500.** There is no custom starting market cap to request.
- **Not available on partner deploys** — those are rejected with a `400` rather than quietly launched at the standard cap.
- No `bankr launch` flag yet; use the agent or the deploy API from the command line.

### Deployment Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| **Name** | Yes | Full token name | "My Token" |
| **Symbol** | No | Ticker, 1-20 characters; defaults to the first 4 characters of the name if omitted | "MTK" |
| **Description** | No | Token description | "A community token" |
| **Image** | No | Logo URL or upload | URL or file |
| **Website** | No | Project website | "myproject.com" |
| **Twitter** | No | Associated tweet / X handle for social proof | "@myproject" |
| **Telegram** | No | Telegram group | "@mytoken" |
| **Fee Recipient** | No | Route creator fees to a wallet, ENS, or social handle | "@partner" |
| **Quote-only fees** | No | Collect all creator fees in the quote token; fixed at launch | `quoteOnlyFees: true` |
| **Degen mode** | No | Start at a $2,500 market cap; explicit opt-in, not on partner deploys | `degenMode: true` |
| **Paired stock** | No | Quote the pool in a registry tokenized stock instead of WETH | `pairedStockAddress: "0x…"` |
| **Paired quote token** | No | Base only — quote the pool in BNKR, ba3Pump, cbHYPE, cbZEC or TAO instead of WETH; not combinable with a paired stock | `pairedTokenAddress: "0x…"` |
| **Chain** | No | `robinhood` (agent/API default), `base` (CLI and web default), or `arbitrum` | `chain: "arbitrum"` |
| **Disable vesting** | No | Skip the default 15% creator vesting and sell 100% of supply into the pool | `disableVesting: true` (`--no-vesting`) |

### Prompt Examples

**Deploy tokens:**
- "Deploy a token called BankrFan with symbol BFAN"
- "Create a memecoin: name=DogeKiller, symbol=DOGEK"
- "Deploy token with website myproject.com and Twitter @myproject"
- "Create a token on Base"
- "Launch MOON in degen mode"
- "Launch a token called CoolBot on robinhood"
- "Launch a token called CoolBot and route fees to @partner"
- "Launch a token with quote-only fees"
- "Launch MOON on Arbitrum"
- "Launch FROG on Base paired with TAO"
- "Launch a token with no vesting"

**Creator vesting:**
- "How much of my MTK allocation has vested?"
- "When does my MTK vesting cliff end?"
- "Claim my vested MTK"

**Claim fees:**
- "Claim fees for my token MTK"
- "How much can I claim for MyToken?"
- "Claim legacy Clanker fees" (older tokens — claims auto-detect Doppler vs Clanker)

**Update metadata:**
- "Update description for MyToken"
- "Add Twitter link to my token"
- "Update logo for MyToken"

### Launch Quota and Rate Limits

**The launch quota is universal — Bankr Club does not raise it.**

| Wallet type | Counted launch attempts per rolling 24 hours |
|-------------|----------------------------------------------|
| Standard | 3 |
| Bankr Club | 3 |
| Partner organization wallet | 3 |
| Provisioned partner wallet | 3 |

On top of the quota you may deploy at most **one token per minute**.

**When a slot is actually consumed.** Quota is reserved immediately before metadata pinning: validation, recipient resolution and pricing failures ahead of that point never cost you a slot, and **simulations** (`--simulate` / `simulateOnly: true`) never reserve one. Once an attempt has been — or may have been — broadcast, it counts. A failed attempt that Bankr can prove never reached the chain gives its slot back, along with its name and fee-recipient allowance; the classification deliberately fails safe, so a deploy that errors after submission stays counted rather than being handed back on a guess.

After the third counted attempt, wait for the oldest one to age out of the 24-hour window.

**Anti-spam caps (all return `429`), counting only launches that went out:**

| Cap | Scope | Limit |
|-----|-------|-------|
| Same token name | Per account, per hour | 3 |
| Same token name | Across all accounts, per hour | 10 |
| Fee-recipient address | Across all accounts, per 24 hours | 20 |

### Launch-Wallet Requirements (anti-sybil)

Standard and Bankr Club launches require the Bankr wallet to be:

- **At least 24 hours old**, measured from when Bankr created the wallet — not from the age of the linked X or other social account
- Holding **at least 0.002 native ETH on the launch chain**

Both checks run *before* quota is reserved, metadata is pinned, or a transaction is submitted, so a rejection here costs neither a launch attempt nor gas. The balance minimum applies even on Base, where Bankr sponsors deploy gas; on Robinhood Chain and Arbitrum it also has to cover the launch's own gas. Validated active partner-organization and provisioned-wallet launch paths are exempt from both requirements — only while the organization is active with token launching enabled, and (for a provisioned wallet) while the wallet stays active and linked to that organization. Retail **simulations** still require the 24-hour wallet age, but skip the balance check.

### Gas Sponsorship

**Retail launch gas is sponsored on Base only.** On Robinhood Chain and Arbitrum the launch wallet pays its own network gas. Partner launches follow their organization's sponsorship policy instead.

Across every sponsored path (launches, fee claims, transfers), a non-partner wallet gets at most:

- **10 sponsored transactions per rolling 24 hours**, and
- **$3 of sponsored gas per rolling 24 hours**

Whichever runs out first ends sponsorship until the window resets. This matters for agents claiming many tokens' fees daily, or launching on a chain during a fee spike — budget for paying your own gas past those ceilings.

**On an unsponsored deploy, a near-empty wallet is refused up front.** The wallet's native balance is checked against a conservative per-chain floor *before* anything is built or broadcast, returning copy that explains the situation rather than spending a signer round-trip to fail on-chain with a bare "not enough native token to cover gas". The floor is deliberately low, so borderline balances still proceed to real estimation downstream. If you deploy programmatically, fund the deploying wallet with gas rather than relying on the retry.

### Five-Minute Balance Cap

For the first **five minutes** after a non-partner launch, each wallet may hold no more than **2% of the token's total supply**. A buy or transfer that would leave the receiving wallet above 2% fails until the cap expires.

This is separate from the roughly 10-second anti-snipe fee decay: the anti-snipe mechanism changes the swap fee, while this rule limits the recipient's balance. Partner launches are exempt, and the expiry is encoded on-chain at launch, so existing tokens keep whatever expiry they launched with.

High-volume or bot-like deploy patterns can trigger automated spam protections and temporary or permanent restrictions — enforced hardest on the X path, where repeatedly breaching the one-per-minute limit restricts the account for 24 hours (a limited state: login, balances and withdrawals still work). For legitimate programmatic deploy use cases, open a support ticket before scaling up.

### Stock-Paired Launches

Instead of pairing your token's pool with WETH, you can pair it with a registry **tokenized stock**, so the token trades against equity exposure rather than against ETH. Available on **Base** (B20 equities) and **Robinhood Chain**.

```bash
bankr agent prompt "Launch a token called Semis paired with NVDA on base"
```

```json
POST /token-launches/deploy
{ "name": "Semis", "symbol": "SEMIS", "chain": "base", "pairedStockAddress": "0x..." }
```

- Only stocks Bankr can price are offered — the launch curve's tick math needs a USD price, so an unpriceable stock would fail late rather than early.
- The same rule set validates the pairing in the launch wizard, the deploy API, and the agent, so what's offered is what's accepted.
- Pairing is fixed at launch, like the fee schedule.
- The pool's quote asset is the stock, so a swap leg that touches it is subject to that stock's location verification like any other stock trade.

### Fee Structure

- 0.7% swap fee on the pool, **95% of it to the creator** (0.665% of volume); the hook adds the Bankr protocol fee + BNKR buyback and LP fee on top, 1.75% all-in — see [Token Economics](#token-economics) for the full split
- The 0.285% LP fee is creator-side as well, strengthening your token's liquidity on every swap — 0.95% of volume working for your side in total
- Fees accrue in your token and WETH (quote token only on [quote-only](#quote-only-fees-optional-fixed-at-launch) launches); claimable anytime via "Claim fees for my token"
- Fee schedules are fixed at launch — older tokens keep the schedule they launched with
- Older tokens launched via Clanker are still claimable — the claim path auto-detects the protocol

### Deployment Process

1. **Specify Parameters**: Name (required); symbol, description, social links, fee recipient (optional)
2. **Contract Deployment**: Doppler deploys the ERC20 and creates the Uniswap V4 pool with automatic liquidity
3. **Verification**: Get the token address and pool metadata, view on a block explorer

### Taking Profit (Glidepath)

Selling a token you earn creator fees on through Bankr's swap/limit/stop/DCA/TWAP tools is restricted (buying and transferring are unaffected). To take profit, builders use a **Glidepath** — a capped, AI-paced gradual sell that feeds a committed slice of your tokens back into the pool over time instead of dumping. Glidepath is available for Base and Robinhood Chain launches and is managed from the token page at [bankr.bot](https://bankr.bot) (a web feature, not a CLI/API action). Details: https://docs.bankr.bot/token-launching/glidepath

---

## Common Issues

| Issue | Chain | Resolution |
|-------|-------|------------|
| Launch quota reached (EVM) | EVM | Wait for the oldest of your 3 attempts to age out of the rolling 24h window — Bankr Club does not raise the cap |
| Launch wallet rejected (EVM) | EVM | Wallet must be ≥ 24h old and hold ≥ 0.002 native ETH on the launch chain |
| Name/symbol taken | EVM | Choose different name |
| Insufficient SOL | Solana | Add SOL for gas fees |
| NFT not found | Solana | Token may still be on bonding curve |
| Cannot transfer NFT | Solana | Permanent fee arrangement exists |
| No fees to claim | Solana | No trades yet or recently claimed |
| Token migrated | Solana | Use CPMM fee claiming instead |

## Best Practices

### Before Deploying
1. **Choose unique name/symbol** — Check availability
2. **Prepare branding** — Logo, description ready
3. **Choose right chain** — Solana for bonding curves, Base for ERC20
4. **Understand fees** — Know the fee structure for your chain

### During Deployment
1. **Solana**: Only tokenName is required — don't over-specify
2. **EVM**: Add metadata and social links immediately
3. **Save addresses** — Token address and any NFT mints

### After Deployment
1. **Check fee status** — "How much fees can I claim for TOKEN?"
2. **Claim fees regularly** — Don't leave money unclaimed
3. **Monitor migration** (Solana) — Fee Key NFT created at migration
4. **Engage community** — Marketing and updates

## Security Considerations

### Solana (LaunchLab)
- Bonding curve prevents rug pulls (liquidity locked)
- LP is automatically locked at migration
- Fee Key NFTs are standard SPL tokens
- Permanent fee arrangements are immutable
- Shared fee claims use atomic transactions (claim+transfer)

### EVM (Base / Doppler)
- Standard ERC20 with a fixed, non-mintable 100B supply
- Liquidity lives in a Uniswap V4 pool
- Verifiable on block explorer
- Creator controls metadata and fee routing

## Legal Considerations

**Disclaimer:**
- Token deployment may have legal implications
- Consider securities laws in your jurisdiction
- Consult legal counsel for serious projects
- Be transparent with community
- Don't make price promises

---

**Solana Tip**: Just say "Launch TOKEN_NAME" — only the name is required. Symbol defaults to name, and the bonding curve handles everything else.

**Fee Claiming Tip**: Both creator and fee recipient can claim fees during bonding curve. Just say "Claim my fees for TOKEN" — the system handles the split automatically.

**EVM Tip**: Add social links during deployment for better discoverability on aggregators.
