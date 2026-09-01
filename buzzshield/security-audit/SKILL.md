---
name: buzzshield-security-audit
description: Scan smart contracts for vulnerabilities before interacting. 68 sub-patterns across 10 attack classes, built from $583M+ in real exploit forensics. EVM + Solana + Move + Cairo.
---

# BuzzShield V6 — Autonomous Smart Contract Security Audit

Scan any smart contract for vulnerabilities before you interact with it. 68 sub-patterns across 10 attack classes, built from $583M+ in real exploit forensics.

## Capabilities

- **Quick Check (H.2c):** Paste a contract address — get an instant uninitialized-admin vulnerability scan across EVM chains (Ethereum, Base, Arbitrum, Optimism, BSC) and Solana
- **Deep Audit:** 12-phase analysis covering reentrancy, oracle manipulation, signature replay, capability injection, parser differentials, and C memory safety
- **Pattern Matching:** 68 sub-patterns derived from real exploits: Ekubo $1.4M (B.8), Wasabi $5.5M (H.2d), Kelp $293M (H.1), Drift $285M (H), Grok $174K (G.1), and more
- **Adversarial Verification:** LLM-powered skeptic layer that challenges every finding to eliminate false positives
- **Pre-Trade Security Gate:** Scan tokens before swapping — catch rug pulls, honeypots, and malicious callbacks before they drain your wallet

## Attack Classes

| Class | Name                 | Sub-Patterns | Notable Exploit            |
| ----- | -------------------- | ------------ | -------------------------- |
| A     | Validation Asymmetry | 12           | Multiple DeFi protocols    |
| B     | Identity Trust       | 8            | Ekubo $1.4M                |
| C     | Operation Ordering   | 4            | Race condition exploits    |
| D     | Reentrancy           | 2            | Sharwa $33K                |
| E     | Oracle/Price Feed    | 2            | Sharwa price manipulation  |
| F     | Signature Replay     | 5            | Cross-chain replay attacks |
| G     | Capability Injection | 3            | Grok $174K                 |
| H     | Off-Chain Trust      | 8            | Kelp $293M, Wasabi $5.5M   |
| I     | Parser Differential  | 4            | Firedancer HTTP            |
| J     | C Memory Safety      | 10           | CVE-2026-0300 PAN-OS       |

## Usage Examples

"scan this contract 0xABC... on Base for vulnerabilities"
"is this token safe to buy? check 0xDEF... on Ethereum"
"run a deep audit on this Solana program BNS48..."
"check if this contract has an uninitialized admin bug"
"what attack patterns does BuzzShield detect?"

## How It Works

1. **Fetch** — Pull verified source from block explorer or decompile bytecode
2. **Invariant Scan** — Match against 68 sub-patterns (Pattern A through J)
3. **H.2c Hunt** — Specifically check for uninitialized admin/owner storage
4. **B.8 Hunt** — Check for callback payer trust violations
5. **Skeptic Review** — Adversarial LLM challenges each finding
6. **Risk Score** — SAFE / LOW / MEDIUM / HIGH / CRITICAL with evidence

## Live Product

- **Web UI:** https://shield.buzzbd.ai
- **API:** https://api.buzzbd.ai/api/v1/buzzshield/scan
- **x402 Endpoint:** Pay-per-scan via USDC on Base (coming soon)

## Architecture

Powered by Pashov Audit Group's open-source solidity-auditor v2 and x-ray v1 (MIT licensed), extended with BuzzShield's proprietary pattern catalog and adversarial verification layers. Built by Buzz BD Agent (SolCex Exchange) running Claude Opus 4.7 24/7.

## Requirements

- No API key needed for basic scans via shield.buzzbd.ai
- x402 micropayment (USDC on Base) for API access (coming soon)
- Supports: Solidity, Vyper, Rust (Solana), Move, Cairo

## About

Built by Ogie (SolCex Exchange) — a chef who codes through conversation. No formal CS background, built entirely through conversational AI. Competing in Colosseum Frontier Hackathon (Agent #3734).

- GitHub: https://github.com/buzzbysolcex/buzz-bd-agent
- Twitter: @BuzzBySolCex
- Live: https://shield.buzzbd.ai
