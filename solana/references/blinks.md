# Blinks (Solana Actions)

Create shareable transaction links that work anywhere.

## Overview

Blinks (Blockchain Links) turn any Solana transaction into a clickable link. Users click → wallet prompts → transaction executes. No app needed.

**Works on:**
- Twitter/X
- Discord
- Websites
- QR codes
- Anywhere URLs work

## How It Works

1. **Create Action** - Define what the transaction does
2. **Generate URL** - Get a shareable action URL
3. **Share** - Post on Twitter, Discord, etc.
4. **User Clicks** - Wallet-compatible clients detect the blink
5. **Execute** - User approves, transaction goes through

## Action Types

### Transfer (Tips/Payments)

**Prompt examples:**
- "Create a blink for tipping me 0.1 SOL"
- "Make a tip jar link accepting any amount"
- "Generate payment link for 10 USDC"

**Use cases:**
- Content creator tips
- Payment requests
- Donations

### Swap

**Prompt examples:**
- "Create a blink to buy my token"
- "One-click swap link for SOL → JUP"
- "Share link to buy 100 BONK"

**Use cases:**
- Token promotion
- Easy onboarding
- Affiliate swaps

### Mint

**Prompt examples:**
- "Create mint blink for my NFT collection"
- "Generate minting link for 0.5 SOL"
- "NFT mint button"

**Use cases:**
- NFT launches
- Embedded minting
- Cross-platform mints

### Vote

**Prompt examples:**
- "Create governance vote blink"
- "Voting link for proposal #42"
- "DAO voting action"

**Use cases:**
- Governance
- Polls
- Community decisions

### Custom

Any transaction can become a blink!

- "Make a blink for staking SOL"
- "Create action for claiming rewards"
- "Shareable link for any transaction"

## Creating Blinks

### Simple Transfer Blink

```bash
scripts/solana-native.sh blinks create transfer \
  --recipient <your_wallet> \
  --amount 0.1 \
  --label "Tip the creator"
```

Returns:
```
Action URL: solana-action:https://yourdomain.com/api/actions/tip
Blink URL: https://dial.to/?action=solana-action:...
```

### With Metadata

```bash
scripts/solana-native.sh blinks create transfer \
  --recipient <wallet> \
  --amount 1.0 \
  --label "Buy me a coffee" \
  --icon "https://example.com/coffee.png" \
  --title "Coffee Fund" \
  --description "Support my work with SOL"
```

## Action Specification

### GET Response (Metadata)

```json
{
  "title": "Buy Coffee",
  "icon": "https://example.com/icon.png",
  "description": "Send SOL to support the creator",
  "label": "Pay 0.1 SOL",
  "links": {
    "actions": [
      {
        "label": "0.1 SOL",
        "href": "/api/action?amount=0.1"
      },
      {
        "label": "0.5 SOL",
        "href": "/api/action?amount=0.5"
      },
      {
        "label": "1 SOL",
        "href": "/api/action?amount=1"
      }
    ]
  }
}
```

### POST Response (Transaction)

```json
{
  "transaction": "base64_encoded_transaction",
  "message": "Thanks for the tip!"
}
```

## Hosting Options

### 1. Self-Hosted

Deploy your own action server:
```bash
# Clone template
git clone https://github.com/solana-developers/solana-actions
cd solana-actions

# Deploy to Vercel/Railway/etc.
```

### 2. Use dial.to

Wrap any action URL:
```
https://dial.to/?action=solana-action:https://your-action-url
```

### 3. Action Providers

Some platforms host actions for you:
- Sphere
- Dialect
- Community tools

## Best Practices

1. **Clear labeling** - Users should know what they're signing
2. **Appropriate icons** - Visual recognition matters
3. **Test thoroughly** - Try in multiple wallets
4. **Handle errors** - Graceful failure messages
5. **Secure endpoints** - Validate inputs, prevent abuse

## Compatibility

### Wallets

| Wallet | Support |
|--------|---------|
| Phantom | ✅ |
| Solflare | ✅ |
| Backpack | ✅ |
| Brave | ✅ |

### Platforms

| Platform | Support |
|----------|---------|
| Twitter/X | ✅ (via clients) |
| Discord | ✅ (via bots) |
| Farcaster | ✅ |
| Telegram | ✅ (via bots) |

## Security

⚠️ **For Users:**
- Always verify the action URL domain
- Check transaction details in wallet
- Be wary of unfamiliar blinks

⚠️ **For Creators:**
- Validate all inputs
- Don't expose private keys
- Rate limit endpoints
- Log suspicious activity

## Resources

- **Spec**: https://solana.com/docs/advanced/actions
- **Examples**: https://github.com/solana-developers/solana-actions
- **Debug**: https://dial.to
- **Unfurl**: https://actions.dialect.to
