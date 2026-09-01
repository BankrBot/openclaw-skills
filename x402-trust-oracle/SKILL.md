---
name: x402-trust-oracle
description: Pre-payment trust checks for x402 trading-feed endpoints. Use before paying an unknown or drifting x402 market data, signal, analytics, or trading feed endpoint.
tags:
  - x402
  - trust
  - trading
  - risk
  - base
  - usdc
metadata:
  clawdbot:
    emoji: "✓"
    homepage: "https://x402oracle.com"
    requires:
      bins:
        - curl
---

# x402 Trust Oracle

x402 Trust Oracle helps Bankr and onchain agents check whether an x402 trading feed looks safe enough to pay. It is a pre-payment trust check for endpoints that return x402 HTTP 402 challenges.

Canonical site: https://x402oracle.com

Trade-check endpoint facts:

- endpoint https://api.x402oracle.com/v1/trade-check
- route /v1/trade-check
- price $0.002 / 2000 atomic USDC
- network eip155:8453
- asset 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- payTo 0x2DF1AEc598a104Fc15E80C0B60e50C497559A980

## When to use this skill

Use this skill before paying an x402 trading feed when:

- The user wants to buy a market-data, signal, analytics, quant, or trading endpoint.
- The endpoint is new to the agent or has not been checked recently.
- The price, asset, payTo, chain, or response shape appears to have changed.
- The feed is part of an automated trading workflow where bad data can cause loss.

Do not use this as a trading strategy or price oracle. It is a trust and drift signal for the x402 endpoint itself.

## Required input

Have the candidate feed URL ready. If available, also include the expected method, expected price, expected network, expected asset, and expected payTo from the feed's unpaid 402 challenge.

## Basic call

Call the x402 Trust Oracle trade-check endpoint with the feed URL in the request body:

```bash
curl -sS -X POST "https://api.x402oracle.com/v1/trade-check" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example-feed.invalid/path"}'
```

If your x402 client receives a 402 challenge from the oracle, pay only when the challenge matches the expected oracle facts above: $0.002 / 2000 atomic USDC on eip155:8453, asset 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, payTo 0x2DF1AEc598a104Fc15E80C0B60e50C497559A980, route /v1/trade-check, endpoint https://api.x402oracle.com/v1/trade-check.

## Decision logic

Use the oracle response as a pre-payment gate for the trading feed:

```
IF verdict == "block"       -> do not pay the trading feed. Explain the failed trust signal.
IF verdict == "warn"        -> ask the user before paying, and include the warning reason.
IF verdict == "unknown"     -> treat as no trust history. Use small exposure or skip.
IF verdict == "allow"       -> the feed passed the current trust check; proceed only if the user's trading policy also allows it.
```

Always compare the candidate feed's current x402 challenge against the details the user expected. A changed payTo, asset, network, route, or price is a drift signal even if the URL looks familiar.

## Agent workflow

1. Fetch the candidate trading feed without payment to observe its HTTP 402 challenge.
2. Extract the feed URL and any challenge details you can safely observe without paying.
3. Call endpoint https://api.x402oracle.com/v1/trade-check with the feed URL and known challenge facts.
4. Pay the trading feed only if the oracle verdict and the user's risk limits allow it.
5. Record the oracle verdict and the feed challenge facts alongside any trade decision.

## Safety notes

- x402 Trust Oracle evaluates endpoint trust. It does not guarantee trading profit or data accuracy.
- Never ignore a changed payment address, asset, network, or price.
- Prefer a fresh check immediately before an automated trading action.
- If the oracle is unavailable, default to conservative behavior for unknown paid feeds.
