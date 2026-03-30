# Bankr Skills. Build your agent.

Bankr Skills equip builders with plug-and-play tools to build more powerful agents.

## Install

```
> install the [skill-name] skill from https://github.com/BankrBot/skills/tree/main/[skill-name]
```

## Available Skills

| Provider | Skill | Description |
| --- | --- | --- |
| [Bankr](https://bankr.bot) | [bankr](bankr/) | Launch a token, earn from every trade, and fund your agent. Built-in wallet with IP whitelisting, hallucination guards, and transaction verification. |
| [Builder's Garden](https://builders.garden) | [siwa](siwa/) | Sign-In With Agent (SIWA) authentication for ERC-8004 registered agents. Sign messages using Bankr wallets, verify on the server, and protect API routes with ERC-8128. |
| [Axiom](https://clawbots.org) | [bankr-signals](bankr-signals/) | Transaction-verified trading signals on Base. Register as provider, publish trades with TX hash proof, consume signals from top performers. |
| botchan | [botchan](botchan/) | On-chain agent messaging on Base. Explore agents, post to feeds, send DMs, store data permanently via Net Protocol. |
| [Endaoment](https://endaoment.org) | [endaoment](endaoment/) | Charitable donations on-chain. Look up 501(c)(3) organizations by EIN, donate crypto, deploy donor-advised fund entities. |
| [ENS](https://ens.domains) | [ens-primary-name](ens-primary-name/) | ENS name management. Set primary names, update avatars, manage reverse resolution across L1 and L2. |
| [8004.org](https://8004.org) | [erc-8004](erc-8004/) | On-chain agent identity registry. ERC-721 NFTs representing agent identities with metadata, capabilities, and trust scores. |
| [Coinbase](https://onchainkit.xyz) | [onchainkit](onchainkit/) | React component library for on-chain interactions. Wallet connectors, swap widgets, identity components, and NFT displays for Base. |
| [qrcoin](https://qrcoin.fun) | [qrcoin](qrcoin/) | QR code auction game. Scan QR codes to place bids in on-chain auctions with unique token mechanics. |
| [Veil Cash](https://veil.cash) | [veil](veil/) | Privacy-preserving transactions. Deposit into shielded pools, perform ZK withdrawals, manage private transfers. |
| yoink | [yoink](yoink/) | Social on-chain game. "Yoink" a token from the current holder. Uses Bankr for transaction execution. |
| [Neynar](https://neynar.com) | [neynar](neynar/) | Full Farcaster API integration. Post casts, like, recast, follow users, search content, and manage Farcaster identities. |
| [Quicknode](https://www.quicknode.com) | [quicknode](quicknode/) | Blockchain RPC and data access for all supported chains. Native/token balances, gas estimation, transaction status, and onchain queries for Base, Ethereum, Polygon, Solana, and Unichain. Supports API key and x402 pay-per-request access. |
| [Hydrex](https://hydrex.fi) | [hydrex](hydrex/) | Liquidity pools on Base. Lock HYDX for voting power, vote on pool strategies, deposit single-sided liquidity into auto-managed vaults, and claim oHYDX rewards. |
| [Helixa](https://helixa.xyz) | [helixa](helixa/) | Onchain identity and reputation for AI agents on Base. Mint identity NFTs, check Cred Scores, verify social accounts, update traits/narrative, and query the agent directory. Supports SIWA auth and x402 micropayments. |
| [Polygon](https://polygon.technology) | [trails](trails/) | Cross-chain swap, bridge, and DeFi orchestration via Sequence. Swap tokens across chains, bridge assets, fund a Bankr wallet from any chain, deposit into yield vaults (Aave, Morpho), get token prices, and discover earn pools. Integrates with Bankr submit() for on-chain execution. |
| [0xWork](https://0xwork.org) | [0xwork](0xwork/) | Decentralized task marketplace on Base. AI agents discover, claim, and complete tasks paid in USDC with on-chain escrow. Supports services, products, and reputation. |
| [BOTCOIN](https://botcoin.money) | [BOTCOIN](BOTCOIN/) | Mine BOTCOIN by solving AI-powered hybrid challenges on Base. Stake-gated V2 mining with on-chain reward claims via Bankr. |
| [LITCOIN](https://litcoiin.xyz) | [litcoin](litcoin/) | Proof-of-comprehension and proof-of-research mining protocol on Base. AI agents earn $LITCOIN by solving computational problems across 7 domains. Full DeFi stack: staking, vaults, LITCREDIT stablecoin, bounty board, and autonomous agent launchpad. |
| [ProductClank](https://www.productclank.com) | [productclank](productclank/) | Community-powered brand advocacy on Twitter/X. Create campaigns, discover relevant conversations, generate AI-powered replies at scale, and boost specific posts with likes and reposts. Credit-based pay-per-use with 300 free credits. |
| [Symbiosis](https://symbiosis.finance) | [symbiosis](symbiosis/) | Cross-chain token swaps across 54+ blockchains via Symbiosis protocol. Swap any token between Base, Ethereum, Polygon, Arbitrum, Solana, Bitcoin, TON, and more. Uses Bankr Submit API for on-chain execution. |
| [Zerion](https://zerion.io/agents) | [zerion](zerion/) | Interpreted crypto wallet data across 41+ chains. Portfolio values, token and DeFi positions, transaction history, PnL tracking, NFT holdings, gas prices, and swap quotes — enriched with USD values and protocol labels. Supports x402 pay-per-request ($0.01 USDC) and API key access. |
| [Zyfai](https://zyf.ai) | [zyfai](zyfai/) | Earn yield on any Ethereum wallet on Base, Arbitrum, and Plasma. Deploys a non-custodial Safe subaccount linked to the user's EOA with automated rebalancing across DeFi protocols. Session keys for gasless automation. |
| [Quotient](https://quotient.social) | [quotient](quotient/) | Market intelligence API with x402 micropayment and API key auth. Access onchain/social analytics, OpenAPI discovery, and pricing data via `q-api.quotient.social`. |

## Adding a Skill

1. Fork this repo and create a branch.
2. Create a directory for your skill:
   ```
   mkdir your-skill-name/
   ```
3. Add a `SKILL.md` — this is the only required file.
4. Optionally add `references/` for supporting docs and `scripts/` for helper scripts:
   ```
   your-skill-name/
   ├── SKILL.md
   ├── references/
   │   └── your-docs.md
   └── scripts/
       └── your-script.sh
   ```
5. Open a pull request with a description of what your skill does.

**Guidelines:** Keep `SKILL.md` clear and well-documented. Include usage examples. Test before submitting.
