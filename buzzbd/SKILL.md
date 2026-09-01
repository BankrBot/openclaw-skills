---
name: buzzbd-token-intelligence
description: Accesses BuzzBD token scoring, swarm simulation intelligence, and CEX listing qualification through either x402 micropayments or API key auth.
---

# BuzzBD Token Intelligence Skill

Use this skill when an agent needs cross-chain token scoring, 10,000-agent swarm simulation results, or CEX listing qualification data.

## Base URL

- `BUZZBD_BASE_URL`: `https://api.buzzbd.ai`
- Use this origin for runtime requests and discovery docs (`/.well-known/agent.json`, `/.well-known/x402.json`, `/llms.txt`).

## Access Model

- Use x402 or API key for monetized requests.
- Prefer Bankr wallet tooling when available.
- Support vanilla x402 clients as a first-class fallback.
- Include `x-buzzbd-api-key` when available; runtime requests can be authorized via either x402 payment handling or API key auth.
- If using Bankr signing (`/agent/sign`), provide a Bankr API key via `X-API-Key` with Agent API access enabled and signing permissions.

## Platform Stats

| Metric | Value |
|--------|-------|
| Tokens Tracked | 363 |
| Intel Sources | 31 |
| Chains Covered | 19 |
| Swarm Agents | 10,000 (standard: 1,000) |
| Monte Carlo | 26ms per 100K iterations |
| Smart Contracts | 4 Base mainnet + 1 Solana mainnet |
| Agent Identity | ERC-8004: ETH #25045, Base #17483, Avalanche #18709 |

## Core Endpoints

- `GET /api/v1/score-token?address={addr}&chain={chain}` — 11-factor composite score (0-100)
- `GET /api/v1/pipeline/tokens` — full pipeline with scores, stages, and classification
- `GET /api/v1/mirofish/token/{address}/latest` — latest swarm simulation result
- `GET /api/v1/mirofish/stats` — aggregate simulation statistics
- `GET /api/v1/simulate` — Monte Carlo simulation (1000x100 iterations, 26ms)
- `POST /api/v1/mirofish/store` — submit simulation results (authenticated)

## Scoring System (11 Factors, 100 Points)

| Factor | Weight | Source |
|--------|--------|--------|
| Market Cap | 15% | DexScreener, CoinGecko |
| Liquidity Depth | 20% | DexScreener, HeyAnon MCP |
| 24h Volume | 10% | DexScreener |
| Social Presence | 10% | DexScreener .info.socials, CoinGecko |
| Token Age | 5% | DexScreener |
| Team Transparency | 5% | CoinGecko, manual verification |
| FDV Gap Penalty | -15% | DexScreener (FDV vs MCap ratio) |
| Honeypot Detection | -20% | DexScreener buy/sell tax analysis |
| Ghost Token Filter | -10% | Zero volume + zero holder detection |
| Security Audit | 10% | CoinGecko, contract verification |
| Stablecoin Exclusion | filter | Automatic exclusion from scoring |

### Score Actions

| Score | Category | Action |
|-------|----------|--------|
| 85-100 | HOT | Immediate BD outreach — CEX listing candidate |
| 70-84 | WARM | Priority queue — monitor for listing window |
| 50-69 | WATCH | Check back 48h — improvement possible |
| 0-49 | SKIP | Does not meet minimum criteria |

**Calibration note:** 0 out of 363 tokens currently clear the 85-point HOT threshold. The engine is honest by design — it catches what manual audits miss.

## MiroFish Swarm Simulation

10,000-agent hybrid swarm intelligence engine:

| Component | Count | Method |
|-----------|-------|--------|
| LLM Agents | 400 (10K) / 200 (1K) | Ollama qwen3:8b, individual reasoning |
| Heuristic Agents | 9,600 (10K) / 800 (1K) | JS rule-based, deterministic |
| Clusters | 5 | degen, whale, institutional, community, market_dynamics |
| Rounds | 10-20 | Sequential with social feed propagation |
| Wave Architecture | 4 x 2,500 | Each wave inherits prior social feed |

**Validated result:** Nasdog (SOL) — 0.669 consensus after 20 rounds. Institutional cluster held skeptical at 0.440 while degen cluster pushed to 0.85. Emergence, not programmed.

## Smart Contracts (On-Chain Verification)

| Chain | Contract | Purpose |
|-------|----------|---------|
| Base | 0xbf81316266dBB79947c358e2eAAc6F338Fa388Fb | ScoreStorage |
| Base | 0xF09bB39c9591F1745dDB2F8Aa990e1e0e68F9B28 | BuzzRegistry |
| Base | 0xE234C46ecF4A0439D2FE16C0868B5C405E7e7505 | ListingEscrow |
| Base | 0x9dD4e8158C6fB0a32663E6A4eFF0fC79B304F387 | RevenueShare |
| Solana | EUQoSgsGZzipuayB8AnZHXUMRtLwwy5SuRi4YgFXiogd | ScoreStorage (PDA) |

## x402 API Call Checklist

1. Send request to BuzzBD endpoint without payment headers.
2. If response is `402`, parse `PAYMENT-REQUIRED`.
3. Sign payment and retry with `PAYMENT-SIGNATURE`.
4. On success, parse `PAYMENT-RESPONSE`.
5. Apply retry/backoff rules for `429` and transient `5xx`.

## Concrete TypeScript Example (x402 Client Wrapper)

```ts
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const baseUrl = process.env.BUZZBD_BASE_URL ?? "https://api.buzzbd.ai";
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;

const signer = privateKeyToAccount(evmPrivateKey);

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Score a token
const scoreRes = await fetchWithPayment(
  `${baseUrl}/api/v1/score-token?address=7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr&chain=solana`,
  { method: "GET", headers: { "Content-Type": "application/json" } }
);

if (!scoreRes.ok) {
  throw new Error(`request_failed:${scoreRes.status}:${await scoreRes.text()}`);
}

const data = await scoreRes.json();
console.log("score:", data.composite_score, "category:", data.category);

// Get swarm simulation result
const simRes = await fetchWithPayment(
  `${baseUrl}/api/v1/mirofish/token/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr/latest`,
  { method: "GET" }
);

const sim = await simRes.json();
console.log("consensus:", sim.final_belief, "agents:", sim.agent_count);
```

## Bankr-Compatible Signer Adapter

```ts
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

async function createBankrSigner(apiKey: string) {
  const meRes = await fetch("https://api.bankr.bot/agent/me", {
    headers: { "X-API-Key": apiKey }
  });
  if (!meRes.ok) throw new Error(`bankr_me_failed:${meRes.status}`);
  const me = await meRes.json();
  const address = me.walletAddress as `0x${string}`;

  return {
    address,
    async signTypedData(payload: unknown): Promise<`0x${string}`> {
      const signRes = await fetch("https://api.bankr.bot/agent/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          signatureType: "eth_signTypedData_v4",
          typedData: payload
        })
      });
      if (!signRes.ok) throw new Error(`bankr_sign_failed:${signRes.status}`);
      const signed = await signRes.json();
      return signed.signature as `0x${string}`;
    }
  };
}

const bankrSigner = await createBankrSigner(process.env.BANKR_API_KEY!);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(bankrSigner as never));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPayment(
  `${process.env.BUZZBD_BASE_URL}/api/v1/score-token?address=0x...&chain=base`,
  { method: "GET" }
);
```

Use the private-key signer path by default. Use the Bankr adapter when your runtime only has Bankr API signing access.

## Session Spending Cap

Recommended: set a session spending cap of **$1.00 USDC** for exploratory use. Token scoring queries cost $0.05 each; simulation results cost $0.25. A $1 cap covers 20 score lookups or 4 simulation pulls.

## Code Review / Safety Notes

- All scoring data is read-only — no state mutations on external contracts.
- x402 payments settle on Base (USDC). Verify contract address before signing.
- Monte Carlo simulations run server-side; no client-side compute required.
- Swarm simulation results include cluster-level belief breakdowns for auditability.
- On-chain score verification: compare API score against Base ScoreStorage contract.

## Supported Chains

Solana, Ethereum, BSC, Base, Arbitrum, XRPL, Avalanche, Polygon, Fantom, Optimism, Cronos, zkSync, Linea, Scroll, Mantle, Blast, Mode, Sei, NEAR.

## Intelligence Sources (31)

DexScreener, CoinGecko, HeyAnon MCP, Hyperliquid, JingSwap, AIBTC MCP, Stacks Explorer, Phantom MCP, Financial Datasets MCP, and 22 additional cross-chain data feeds.

## References

- Token scoring methodology: `references/token-scoring.md`
- CEX listing process: `references/listing-process.md`

## About

Buzz is the autonomous BD agent for SolCex Exchange — the world's first Zero-Human Exchange Listing Company. Running 24/7 on Hetzner CPX62 (16 vCPU, 32GB RAM).

- **Site:** [buzzbd.ai](https://buzzbd.ai)
- **GitHub:** [buzzbysolcex/buzz-bd-agent](https://github.com/buzzbysolcex/buzz-bd-agent)
- **Twitter:** [@BuzzBySolCex](https://x.com/BuzzBySolCex)
- **Payments:** x402 protocol (USDC on Base)
- **Identity:** ERC-8004 registered on ETH, Base, Avalanche
