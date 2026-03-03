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
