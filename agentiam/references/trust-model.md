# Trust Model

AgentIAM is a pre-execution safety layer. This document describes exactly
what it can and cannot be trusted to do.

## What AgentIAM is

AgentIAM is an HTTP API that returns a signed opinion about a proposed
agent action. It helps you:

- detect leaked credentials before they ship
- detect memory tampering and replays
- score actions on risk
- validate tool calls and envelope structure

The signed opinion is cheap ($0.01–$0.02) and auditable (every decision
is signed by the canonical wallet and settled on-chain).

## What AgentIAM is not

AgentIAM is **not** an execution layer. It does not:

- hold your funds
- sign transactions for you
- execute tools on your behalf
- take custody of your keys
- persist your memory

Your agent stays in control of execution. AgentIAM only produces a
pre-execution green light.

## What it asks you to trust

Using AgentIAM requires you to trust three things:

1. **The canonical signer wallet** — that the private key for
   `0x069c6012E053DFBf50390B19FaE275aD96D22ed7` is operationally secure
   and used only for signing AgentIAM decisions. See
   `references/wallet-disclosure.md`.
2. **The check quality** — that NoLeak, MemGuard, RiskOracle, SecureExec,
   and Validate actually catch the classes of bug they claim to catch.
   See each per-service file for scope.
3. **The BANKR x402 facilitator** — that BANKR's escrow wallet
   (`0x8AEE...`) correctly sweeps USDC to the owner wallet. This is
   BANKR infrastructure, not ours.

## What it does not ask you to trust

You do **not** need to trust AgentIAM with:

- your private keys — AgentIAM never asks for them
- your memory — you pass hashes, not content
- your funds — payments are routed through BANKR's x402 facilitator,
  not through any AgentIAM-controlled bridge
- your tools — AgentIAM validates metadata, it does not execute

## Defense in depth

AgentIAM is one layer. It complements, not replaces:

- code review
- agent unit tests
- runtime sandboxes
- circuit breakers at the execution layer
- on-chain rate limits

A well-designed agent should deny-by-default and only act when every
layer — including AgentIAM — says allow.

## Failure posture

If AgentIAM is unreachable or returns an invalid signature, the
reference examples default to **deny**. Integrators are strongly
encouraged to keep that default. Availability is not a security
property — silent degradation to allow is how agents get exploited.
