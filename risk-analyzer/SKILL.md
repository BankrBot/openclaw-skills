---
name: risk-analyzer
description: Analyze on-chain token risk before executing trades
---
---
name: risk-analyzer
description: Analyze on-chain token risk before executing trades
---

# Risk Analyzer Skill

## Overview

The Risk Analyzer skill evaluates on-chain token risk before trade execution.
It provides structured risk analysis based on liquidity, holder concentration, and trading activity.

## Capabilities

- Evaluate liquidity depth
- Analyze holder concentration
- Detect abnormal trading volume
- Provide risk classification (Low / Medium / High)

## Example Usage

User: Analyze token 0x1234...

Agent:

Risk Summary:
- Liquidity: Low
- Top Holder Concentration: High (Top 3 hold 68%)
- Trading Activity: Irregular spikes
- Overall Risk: HIGH

Recommendation:
Avoid large positions.

## Use Cases

- Pre-trade risk checks
- Sniper filtering
- Automated trading guardrails

## Requirements

- Access to on-chain liquidity data
- Access to holder distribution data
