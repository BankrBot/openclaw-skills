# 🎁 Airdrop Checker — Copy-Paste Commands

Copy any of these commands directly into your Bankr agent.

> 💡 **Kleos checks airdrop eligibility using on-chain methods** — contract queries, OpenSea API, Etherscan transaction history, and merkle proof verification. **No browser wallet connection needed.** If a claim page requires connecting MetaMask/Rabby, Kleos will tell you to check manually and offer on-chain verification.

## Wallet Management

```
add wallet 0x1234... as 'Main ETH' to my airdrop tracker
```

```
add wallet solana:Abc... as 'Solana Vault'
```

```
show my tracked wallets
```

```
remove wallet 0x1234... from my tracker
```

## On-Chain NFT Holding Check (Most Reliable)

```
check if I hold any [collection] NFTs
```

```
check if 0x1234... holds [collection] NFTs
```

```
check [collection] holdings for all my tracked wallets
```

```
which of my wallets hold [collection] NFTs?
```

## Snapshot Verification

```
did I hold [collection] before March 15, 2026?
```

```
verify if 0xabcd... was a holder of [collection] at block 19000000
```

```
check snapshot eligibility for [project] — did I hold before the cutoff?
```

## OpenSea API — Full NFT Holdings

```
what NFTs does 0x1234... own?
```

```
show all NFT holdings for my tracked wallets
```

```
compare which collections I hold across all wallets
```

## Transaction History Check (Protocol Airdrops)

```
check if I ever interacted with [protocol] contract
```

```
did wallet 0x1234... use [dApp] before their snapshot?
```

```
show [protocol] interaction history for all my tracked wallets
```

## Claim Page Discovery (Read-Only)

```
find the official claim page for [project] airdrop
```

```
when is the [project] airdrop claim deadline?
```

```
monitor [project] claim page — alert me when claim opens
```

## Merkle Proof Verification

```
check if 0x1234... is in [project] merkle tree
```

```
verify my merkle proof eligibility for [project]
```

## Airdrop Discovery

```
what airdrops are coming up?
```

```
are there any new NFT airdrops I should know about?
```

```
check if I'm eligible for any new airdrops right now
```

## Discovery Automation

```
every day at 10am, search for new airdrop announcements
```

```
every Monday, scan upcoming airdrops and check my eligibility
```

```
every 12 hours, check my tracked claim pages for status changes
```

## Batch Multi-Wallet Check

```
check [project] eligibility for all my tracked wallets using on-chain data
```

```
scan all my tracked wallets for any unclaimed airdrops
```

## Value Tracking

```
what's my total airdrop value — claimed + pending?
```

```
how much have I made from airdrops?
```

```
estimate the value of my pending unclaimed airdrops
```

## Wallet Security

```
scan my wallet for suspicious or spam NFTs
```

```
warn me if any unknown tokens appear in my tracked wallets
```

## Combo Setup (Pro)

```
Set up airdrop monitoring:
1. Every day at 10am, search for new airdrop announcements
2. For each new airdrop found, check holdings on-chain for all tracked wallets
3. Every Monday, scan NFT holdings via OpenSea API and cross-reference with known airdrops
4. Alert me if any tracked wallet becomes eligible for a new airdrop
5. Monitor claim pages for opening dates
6. Alert 48h before any claim deadline
7. Send weekly summary: claimed value, pending value, new opportunities
```

## What Kleos CANNOT Do (Be Honest)

When the user asks something impossible, tell them directly:

> ⚠️ Kleos cannot connect browser wallets. If a claim page requires MetaMask/Rabby/Phantom connection, go to the site manually in your browser and connect your wallet.
>
> ✅ But I CAN verify your holdings on-chain to confirm eligibility. Want me to check?