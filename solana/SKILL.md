---
name: solana-native
description: Native Solana DeFi operations beyond basic swaps. Use when the user wants to launch tokens on Pump.fun, trade NFTs on Tensor, create Blinks (shareable transactions), use Jupiter limit orders/DCA, or submit Jito MEV bundles. Complements bankr's Solana support with protocol-specific features.
metadata: {"clawdbot":{"emoji":"☀️","homepage":"https://solana.com","requires":{"bins":["curl","jq"]}}}
---

# Solana Native ☀️

Advanced Solana DeFi operations that go beyond basic swaps. This skill provides direct access to Solana-native protocols and features.

## Quick Start

### Environment Setup

```bash
mkdir -p ~/.clawdbot/skills/solana-native
cat > ~/.clawdbot/skills/solana-native/config.json << 'EOF'
{
  "rpcUrl": "https://api.mainnet-beta.solana.com",
  "keypairPath": "~/.config/solana/id.json"
}
EOF
```

Optional API keys for enhanced functionality:
- `HELIUS_API_KEY` - Enhanced RPC, webhooks, DAS API
- `JITO_API_KEY` - MEV bundle submission
- `TENSOR_API_KEY` - NFT trading

## Capabilities Overview

### 1. Pump.fun Token Launching
Deploy memecoins on Solana's leading token launchpad.

### 2. Jupiter Advanced
- Limit orders
- DCA (Dollar Cost Averaging)
- Price alerts

### 3. Tensor NFT Trading
Trade Solana NFTs on the leading marketplace.

### 4. Blinks (Solana Actions)
Create shareable transaction links for Twitter, Discord, anywhere.

### 5. Jito MEV Bundles
Submit atomic transaction bundles with sandwich protection.

**References:**
- [references/pumpfun.md](references/pumpfun.md) - Token launching
- [references/jupiter-advanced.md](references/jupiter-advanced.md) - Limit orders, DCA
- [references/tensor.md](references/tensor.md) - NFT trading
- [references/blinks.md](references/blinks.md) - Shareable transactions
- [references/jito.md](references/jito.md) - MEV bundles

---

## Pump.fun Token Launching

### Deploy a Token

**Prompt examples:**
- "Launch a token called DOGE2 with symbol D2 on pump.fun"
- "Create a pump.fun token: name=MoonCat, symbol=MCAT, description=The next big cat coin"
- "Deploy memecoin on Solana with 1B supply"

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| name | Yes | Token name |
| symbol | Yes | Ticker (2-10 chars) |
| description | No | Token description |
| image | No | Logo URL or base64 |
| twitter | No | Twitter handle |
| telegram | No | Telegram group |
| website | No | Project website |

**Process:**
1. Upload metadata to IPFS
2. Create token via pump.fun program
3. Initialize bonding curve
4. Return token address + pump.fun URL

**Fee structure:**
- Creation fee: ~0.02 SOL
- Trading fee: 1% (goes to creators after graduation)
- Graduation threshold: ~$69k market cap

### Check Token Status

```bash
scripts/solana-native.sh pumpfun status <token_address>
```

### Claim Creator Fees

```bash
scripts/solana-native.sh pumpfun claim <token_address>
```

---

## Jupiter Advanced Features

### Limit Orders

**Prompt examples:**
- "Set limit order to buy SOL at $180"
- "Sell 100 BONK when price hits $0.00003"
- "Limit buy 10 SOL worth of JUP at $0.80"

**How it works:**
- Orders stored on-chain via Jupiter Limit Order program
- Executed by keepers when price conditions met
- No expiration (cancel anytime)
- Partial fills supported

### DCA (Dollar Cost Average)

**Prompt examples:**
- "DCA $50 into SOL every day for 30 days"
- "Set up weekly $100 buys of JUP"
- "DCA 1 SOL into BONK every hour for 24 hours"

**Parameters:**
| Parameter | Description |
|-----------|-------------|
| inputMint | Token to sell (usually USDC/SOL) |
| outputMint | Token to buy |
| inAmount | Amount per order |
| inAmountPerCycle | Amount per interval |
| cycleFrequency | Interval in seconds |
| minOutAmount | Minimum output (slippage) |

### View Active Orders

```bash
scripts/solana-native.sh jupiter orders
scripts/solana-native.sh jupiter dca
```

---

## Tensor NFT Trading

### Browse Collections

**Prompt examples:**
- "Show floor price for Mad Lads"
- "What's trending on Tensor?"
- "Search Tensor for frog NFTs"

### Buy NFTs

**Prompt examples:**
- "Buy floor Mad Lad"
- "Purchase cheapest Okay Bear under 50 SOL"
- "Sweep 3 floor SMBs"

### List NFTs

**Prompt examples:**
- "List my Mad Lad #1234 for 100 SOL"
- "List all my Okay Bears 10% above floor"

### Bid on Collections

**Prompt examples:**
- "Place collection bid on Mad Lads at 80 SOL"
- "Bid 50 SOL on any Claynosaurz"

---

## Blinks (Solana Actions)

Create shareable transaction links that work anywhere - Twitter, Discord, websites.

### Create a Blink

**Prompt examples:**
- "Create a blink for tipping me 0.1 SOL"
- "Make a shareable link for buying my token"
- "Generate a donation blink"

**How it works:**
1. Define the action (transfer, swap, mint, etc.)
2. Generate action URL
3. Share on Twitter/Discord
4. Users click → wallet prompts → tx executes

### Blink Types

| Type | Use Case |
|------|----------|
| Transfer | Tips, payments, donations |
| Swap | One-click token purchases |
| Mint | NFT minting buttons |
| Vote | Governance actions |
| Custom | Any transaction |

---

## Jito MEV Bundles

Submit atomic transaction bundles with priority execution and sandwich protection.

### When to Use

- **Arbitrage**: Multi-hop swaps that must execute together
- **Liquidations**: Capture opportunities atomically
- **Sandwich protection**: Ensure your swap can't be frontrun
- **Multi-tx operations**: Token launch + buy in one bundle

### Submit Bundle

**Prompt examples:**
- "Submit my swap as a Jito bundle with 0.001 SOL tip"
- "Bundle these transactions with MEV protection"
- "Execute arbitrage atomically via Jito"

**Parameters:**
| Parameter | Description |
|-----------|-------------|
| transactions | Array of serialized transactions |
| tipLamports | Tip for validators (higher = faster) |

### Recommended Tips

| Speed | Tip Amount |
|-------|------------|
| Standard | 1,000 - 10,000 lamports |
| Fast | 10,000 - 100,000 lamports |
| Urgent | 100,000+ lamports |

---

## Common Patterns

### Launch and Buy Your Own Token

```
1. "Launch token MYTOKEN on pump.fun"
2. "Buy 1 SOL worth of MYTOKEN"
```

### Set Up Trading Automation

```
1. "DCA $100 into SOL weekly"
2. "Set limit sell for half my SOL at $250"
3. "Stop loss the other half at $150"
```

### NFT Flip Strategy

```
1. "Show trending collections on Tensor"
2. "Buy floor [collection]"
3. "List 20% above floor"
```

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Insufficient SOL | Add SOL for fees (~0.01-0.05 per tx) |
| Slippage exceeded | Increase slippage or reduce amount |
| Token not found | Verify address on Solscan |
| Bundle failed | Increase tip or retry |
| Rate limited | Wait or upgrade RPC |

## Best Practices

1. **Start small** - Test with minimal amounts
2. **Use priority fees** - Ensures execution during congestion
3. **Verify addresses** - Always double-check token/NFT addresses
4. **Monitor positions** - Check limit orders and DCA regularly
5. **Secure keypair** - Never share your private key

---

## Resources

- **Pump.fun**: https://pump.fun
- **Jupiter**: https://jup.ag
- **Tensor**: https://tensor.trade
- **Blinks Spec**: https://solana.com/docs/advanced/actions
- **Jito**: https://jito.wtf

## Scripts

All operations available via:
```bash
scripts/solana-native.sh <command> [args]
```

Commands: `pumpfun`, `jupiter`, `tensor`, `blinks`, `jito`
