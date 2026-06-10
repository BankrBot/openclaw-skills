---
name: pmfi-parbitrage
description: Deposit Base USDC into PMFI pARBITRAGE and withdraw pARB back to USDC through Bankr.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔁",
        "homepage": "https://pmfi.cc",
        "requires": { "bins": ["node", "bankr"] },
      },
  }
---

# PMFI pARBITRAGE Bankr Skill

PMFI pARBITRAGE is a Base vault for prediction market arbitrage exposure.

This skill gives Bankr users two simple actions:

1. Deposit Base USDC into PMFI pARBITRAGE.
2. Withdraw pARB back to Base USDC.

## User flow

Deposit:

USDC -> PMFI processes after vault report -> user receives pARB

Withdraw:

pARB -> PMFI processes after vault report and available liquidity -> user receives USDC

## Live contract

Vault:

0xd1ccbc2aa6e2f41817b62448089d4125e62df4fb

Chain:

Base mainnet, chainId 8453

USDC:

0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

## Commands

Deposit USDC:

node scripts/pmfi_parbitrage.mjs deposit 25

Withdraw pARB:

node scripts/pmfi_parbitrage.mjs withdraw 10

Dry run:

node scripts/pmfi_parbitrage.mjs deposit 25 --dry-run

node scripts/pmfi_parbitrage.mjs withdraw 10 --dry-run

## Natural language examples

- deposit 25 USDC into PMFI pARBITRAGE
- put 100 USDC into PMFI pARBITRAGE
- deposit 50 USDC into the PMFI vault
- withdraw 10 pARB from PMFI pARBITRAGE
- redeem 5 pARB from PMFI
- withdraw 20 pARB back to USDC

## Agent behavior

When the user asks to deposit:

1. Confirm the exact USDC amount.
2. Check that the Bankr wallet has enough Base USDC.
3. Approve USDC only if needed.
4. Submit the PMFI deposit request.
5. Return the Basescan tx link.
6. Explain: PMFI will process the deposit after the next vault report and the user will receive pARB.

When the user asks to withdraw:

1. Confirm the exact pARB amount.
2. Check that the Bankr wallet has enough pARB.
3. Submit the PMFI withdrawal request.
4. Return the Basescan tx link.
5. Explain: PMFI will process the withdrawal after the next vault report and available liquidity, and the user will receive USDC.

For vague amounts like "some", "a little", "all", or "max":

- do not execute immediately
- ask the user to confirm the exact amount
