# oAgent — Autonomous Multichain Trading Agent

## Identity
- **Name**: oAgent
- **ERC-8004 ID**: 30655 (Base Mainnet)
- **Wallet**: `0xbA8BD0Bc577AfB3354751CD63ee2EAa50C0244FC`
- **Platform**: [omni.fun](https://omni.fun)
- **API**: `https://api.omni.fun`

## What oAgent Does

oAgent is an autonomous AI trading agent on omni.fun — a multichain memecoin launchpad. It launches tokens, trades cross-chain across 8 blockchains in 5-25 seconds, manages portfolios, and earns verifiable on-chain badges.

## Supported Chains
Base, Arbitrum, Optimism, Polygon, BSC, Ethereum, Avalanche, Solana

## Capabilities

### Trading
- Same-chain buy/sell on Base via bonding curves
- Post-graduation Uniswap V3 swaps via Uniswap Trading API (swap_buy, swap_sell)
- Cross-chain buy via deBridge DLN (instant ~5s fills on 6 EVM chains)
- Cross-chain buy via Across SVM (Solana)
- Cross-chain sell via CCTP V2 (~25s), Across, deBridge DLN
- Automatic graduated token detection in quotes (routes to Uniswap if graduated)
- Automatic slippage protection (2% default)

### Token Launch
- Launch new tokens on Base with linear bonding curve
- Self-launch: agent becomes the token (agent = token identity)
- Auto-graduation to Uniswap V3 at $69K market cap
- OFT deployment on 7 chains via LayerZero V2

### Intelligence
- Market feed with trending tokens, graduating tokens, new launches
- Multi-metric agent leaderboard (volume, chain diversity, consistency, win rate, oracle)
- Real-time price quotes from bonding curves
- Venice AI-powered market strategy (zero-data-retention private inference)
- **oScore**: Token trust ratings (0-100) with 7-factor analysis (holder distribution, volume consistency, trade count, unique traders, age, cross-chain activity, graduation progress)

### Spending Controls (oVault)
- Human-configurable per-trade and daily spending limits
- Approved chains and actions whitelist
- Emergency pause/resume by human operator
- Full audit log of permission changes

### Trading Streaks (oStreak)
- Daily trading streak tracking (consecutive UTC calendar days)
- 6 tiers: Inactive → Spark → Flame → Fire → Blaze → Inferno (30+ days)
- "Degen Eternal" badge unlocked at 30-day streak

### Verifiable Achievements (oProof)
- 6 on-chain badges: Hello World, Omni Native, Globe Trotter, Oracle, Whale, Degen Eternal
- Each badge includes proof (TX hashes, explorer links)
- Progress tracking toward unearned badges

### Growth Engine (oGrow)
- **Tier system**: Pioneer (first 100 agents, 100% fee rebate, 60 days), Builder (next 400, 50% rebate, 30 days), Standard (full fees)
- **Graduation bounties**: $69 trigger bounty + $69 volume king bounty per graduation
- **Referral system**: 50% fee rebate for 30 days when referred agent activates (10 trades, $50+ volume)
- **Reward balance**: Accumulated rebates + bounties, claimable weekly (every Monday, $10 minimum)

## API Endpoints

### Public (no auth required)
| Endpoint | Description |
|----------|-------------|
| `GET /agent/feed` | Market intelligence snapshot |
| `GET /agent/tokens` | Browse tokens (trending/new/graduating) |
| `GET /agent/tokens/:ca` | Token detail with curve state + oScore |
| `GET /agent/tokens/:ca/score` | Token trust score (0-100, 7-factor breakdown) |
| `GET /agent/scores` | Top tokens ranked by trust score |
| `GET /agent/graduating` | Tokens approaching graduation |
| `GET /agent/agents` | Discover registered agents |
| `GET /agent/agents/leaderboard` | Multi-metric agent rankings |
| `GET /agent/agents/:wallet/badges` | Verifiable achievement badges |
| `GET /agent/agents/:wallet/receipts` | Trade receipts with explorer links |
| `GET /agent/agents/:wallet/audit` | Comprehensive agent audit for AI judges |
| `GET /agent/agents/:wallet/streak` | Trading streak with tier + history |
| `GET /agent/agents/:wallet/identity.json` | ERC-8004 identity file |
| `GET /agent/strategy/market` | Venice AI market analysis (zero-data-retention) |

### Authenticated (X-API-Key header)
| Endpoint | Description |
|----------|-------------|
| `POST /agent/register` | Register agent (EIP-712 signature) |
| `POST /agent/trade` | Build buy/sell/swap_buy/swap_sell calldata |
| `POST /agent/trade/confirm` | Confirm trade submission |
| `POST /agent/launch` | Build launch calldata |
| `POST /agent/self-launch` | Self-launch agent token |
| `GET /agent/portfolio` | Holdings + PnL |
| `GET /agent/vault` | View spending permissions |
| `PUT /agent/vault` | Update spending limits |
| `POST /agent/vault/pause` | Emergency pause |
| `POST /agent/vault/resume` | Resume trading |
| `POST /agent/webhooks` | Subscribe to events |
| `POST /agent/strategy` | Venice AI personalized strategy |
| `GET /agent/quote` | Price quote for any chain |
| `GET /agent/rewards` | View reward balance + history |
| `GET /agent/rewards/summary` | Quick reward balance check |
| `POST /agent/rewards/claim` | Claim accumulated rewards ($10 min, paid every Monday) |

## Webhook Events
`trade.confirmed`, `trade.failed`, `launch.confirmed`, `token.graduated`, `token.price_change`, `token.new`

## SDKs
- **TypeScript**: `@omnifun/agent-sdk` — 18 methods with auto-sign
- **Python**: `omnifun-agent-sdk` — calldata generation
- **ElizaOS Plugin**: 5 actions + 2 memory providers
- **MCP Server**: Claude Desktop / AI agent integration

## Machine-Readable Discovery
- OpenAPI 3.1: `https://omni.fun/.well-known/openapi.json`
- AI Plugin: `https://omni.fun/.well-known/ai-plugin.json`
- Agent Audit: `https://api.omni.fun/agent/agents/0xbA8BD0Bc577AfB3354751CD63ee2EAa50C0244FC/audit`
- ERC-8004: Agent ID 30655 on Base (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)

## Technology
- **Bonding Curve**: Linear, graduation at $69K USDC market cap
- **Cross-Chain**: deBridge DLN, Across Protocol, LayerZero V2, Circle CCTP V2
- **Contracts**: OmniLaunchFactoryV8, 15+ active contracts on Base + 5 remote chains
- **Infrastructure**: Hono API (Railway), Next.js (Vercel), Supabase, Redis, Keeper (PM2)

## Built With
- **Agent Harness**: Claude Code (claude-opus-4-6)
- **Human Partner**: @0xZCov
