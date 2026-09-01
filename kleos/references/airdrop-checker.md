# Airdrop Checker Strategy

Check NFT and token airdrop eligibility for any wallet address using **on-chain queries, public APIs, and blockchain explorers** — no browser wallet connection needed.

## How It Actually Works

Bankr's browser automation can view pages and fill forms, but **cannot connect browser wallets** (MetaMask, Rabby, Phantom). Kleos uses these realistic methods instead:

| Method | What It Checks | Requires |
|--------|---------------|----------|
| **On-chain contract query** | NFT/token holdings at snapshot, merkle proof verification | Contract address |
| **OpenSea API** | List of NFTs held by any address | None (public) |
| **Etherscan/block explorer** | Transaction history, contract interactions | None (public) |
| **Search for claim page** | Find official claim URLs, check deadlines | Browser automation (read-only) |
| **Address-input pages** | Rare claim pages with text input (not wallet connect button) | Browser automation |

## Multi-Wallet Support

Kleos checks your **Bankr wallet** automatically. Add external wallets for tracking:

```
"add wallet 0x1234... as 'Main ETH' to my airdrop tracker"
"add wallet solana:Abc... as 'Solana Vault'"
"show my tracked wallets"
"remove wallet 0x1234... from my tracker"
```

Tracked wallets saved to `/.memory/nft-airdrops.md`:
```markdown
## Tracked Wallets
- Bankr (Base): 0xbankr... — auto
- Main ETH: 0x1234... — added: [date]
- Cold Storage: 0x5678... — added: [date]
```

---

## Method 1: On-Chain NFT Holding Check (Most Reliable)

For checking if a wallet held an NFT at a specific snapshot:

```
"check if 0x1234... holds any [collection] NFTs"
"did wallet 0x1234... hold [collection] at block [N]?"
"check my eligibility for [project] — do I hold their NFT?"
```

**Agent steps:**
1. Get the collection's contract address and chain
2. Query the ERC-721 contract:
   - `balanceOf(address)` — current holdings
   - `balanceOf(address)` at specific block (via `eth_call` with block number)
   - `tokenOfOwnerByIndex(address, index)` — list owned token IDs
3. Cross-reference with snapshot block if known
4. Report: holdings found, token IDs, whether snapshot qualifies

### Checking Multiple Wallets

```
"check [collection] holdings for all my tracked wallets"
"which of my wallets hold [collection] NFTs?"
```

### Snapshot Verification

```
"check if 0x1234... held [collection] before March 15, 2026"
"verify snapshot eligibility for wallet 0xabcd... — block [N]"
```

---

## Method 2: OpenSea API Check

For listing all NFTs owned by any address:

```
"what NFTs does 0x1234... own?"
"show NFT holdings for wallet 0x5678... on base"
"compare NFT holdings across my tracked wallets"
```

**Agent steps:**
1. Determine chain (base/ethereum/polygon)
2. Query OpenSea public API: `https://api.opensea.io/api/v2/chain/{chain}/account/{address}/nfts`
3. Parse response — list collections, token IDs, floor prices
4. Cross-reference with known airdrop project collections
5. Report: total NFTs, collections breakdown, potential airdrop eligibility

> Note: OpenSea API is public and rate-limited. Use `execute_cli` with `curl` to query.

---

## Method 3: Transaction History Check

For protocol-based airdrops (early users, testnet participation):

```
"check if 0x1234... ever interacted with [protocol] contract"
"did my wallet use [dApp] before their snapshot date?"
"show [protocol] interaction history for wallet 0xabcd..."
```

**Agent steps:**
1. Get the protocol's contract address(es)
2. Use Etherscan/block explorer API or browser automation to check:
   - Transaction history for the wallet
   - Filter by contract address(es) and date range
3. Report: number of interactions, first/last interaction date, whether before snapshot

### Etherscan Query (via browser automation)

Navigate to `https://etherscan.io/address/{wallet}#internaltx` or use Etherscan API if API key is configured:

```
"every transaction from 0x1234... to 0x[protocol_contract]"
```

---

## Method 4: Claim Page Discovery (Read-Only)

Find and monitor official claim pages:

```
"find the claim page for [project] airdrop"
"when is [project] airdrop claim deadline?"
"monitor [project] claim page for opening"
```

**Agent steps:**
1. Search Twitter/X for official announcement from the project
2. Navigate to the claim URL (read-only — no wallet connection)
3. Read page content: eligibility criteria, claim dates, instructions
4. Check if the page has a text input for address (rare but possible)
5. Save monitored claim URLs to `/.memory/nft-airdrops.md`

### Claim Monitoring Automation

```
"every day at 10am, check [claim URL] page and alert me if claim status changes"
```

---

## Method 5: Merkle Proof Verification (Advanced)

Some airdrops use merkle trees — eligibility is proven by submitting a merkle proof:

```
"verify my merkle proof for [project] airdrop"
"check if 0x1234... is in [project] merkle tree"
```

**Agent steps:**
1. Get the project's merkle root (from on-chain contract or published data)
2. If merkle tree JSON/CSV is published, download and search for the address
3. If root is on-chain, verify by computing proof from published data
4. Report: address found in tree, claimable amount, proof data

---

## What Kleos CANNOT Do

Be honest with users about these limitations:

| Cannot Do | Why | Alternative |
|-----------|-----|-------------|
| Connect browser wallets | Bankr browser has no wallet extension | Use on-chain query instead |
| Claim from external wallets | Only Bankr wallet can sign | User must claim manually from that wallet's browser |
| Sign messages for verification | No access to external private keys | User does this manually |
| Bypass "Connect Wallet" UI | Browser automation can't interact with extensions | Try on-chain methods or ask user to check manually |
| Check Discord/Twitter engagement | Requires logged-in social accounts | User checks this manually |

> ⚠️ If a claim page requires connecting a browser wallet, tell the user: "This claim page requires wallet connection. Go to [URL] in your browser, connect [wallet name], and check eligibility manually. Kleos can verify your holdings on-chain to cross-reference."

---

## Airdrop Discovery

### Find Upcoming Airdrops

```
"what airdrops are coming up?"
"are there any new NFT airdrops I should know about?"
```

**Agent steps:**
1. Use browser automation to check:
   - OpenSea Drops page (public, no wallet needed)
   - Major DeFi protocol announcement pages
   - Aggregator sites (airdrops.io, defillama airdrops)
2. Read criteria from the page
3. For each promising airdrop, check against tracked wallets using on-chain methods
4. Save to `/.memory/nft-airdrops.md`

### Discovery Automation

```
"every day at 10am, search for new airdrop announcements"
"every Monday, scan upcoming airdrops and check my wallet eligibility"
```

---

## Airdrop Value Tracking

```
"what's my total airdrop value — claimed + pending?"
"how much have I made from airdrops?"
"estimate the value of my pending unclaimed airdrops"
```

Read from `/.memory/nft-airdrops.md` and sum values.

---

## Safety & Scam Prevention

### Red Flags

- "Connect wallet to check" from random sites or DMs — STOP
- Asking for seed phrase or private key — NEVER SHARE
- Claim fees upfront — legitimate airdrops don't charge
- Unknown NFTs appearing in wallet — do NOT interact with them
- Suspicious token approvals requested

### Dust Attack Protection

```
"scan my wallet for suspicious or spam NFTs"
```

Warn user about unknown NFTs — they may be phishing attempts.

---

## Memory File Template

`/.memory/nft-airdrops.md`:
```markdown
## Tracked Wallets
- Bankr (Base): 0xbankr... — auto
- Main ETH: 0x1234... — added: [date]

## Tracking
### [Project Name]
- Type: [Token/NFT]
- Chain: [base/ethereum]
- Eligibility: [Holder/Protocol/Community]
- Check Method: [On-chain contract query / OpenSea API / Merkle proof]
- Snapshot: [Date or "TBD"]
- Claim: [Date or "TBD"]
- Claim URL: [URL]
- Status: [Tracking/Checked/Claimed/Not Eligible]
- Wallets Eligible: [list]
- Amount: [if known]
- Value USD: [approx]

## Claimed
### [Project Name] — Claimed: [Date] — Amount: [X] — Value: [Y] USD
```

---

## Edge Cases

- **Contract not verified on Etherscan**: Cannot read ABI — ask user for contract address and try raw `eth_call`
- **Solana NFTs**: No OpenSea support. Use Solana RPC to query token accounts directly
- **Multi-chain airdrop**: Check each chain separately — same project may have different snapshots per chain
- **Claim page blocked/geoblocked**: Warn user and suggest VPN or checking from a different location
- **Snapshot date unknown**: Check all holdings; warn user that eligibility may depend on a snapshot they missed