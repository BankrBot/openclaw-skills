# Transfers Reference

Send tokens to a 0x address or ENS name directly via the CLI / Wallet API, or to social handles via the AI agent.

## CLI Command

```bash
# Transfer with token symbol resolution
bankr wallet transfer --to <recipient> --token <symbol> --amount <amount>
bankr wallet transfer --to <recipient> --token <symbol> --amount <amount> --chain <chain>

# Examples — recipient may be a 0x address or ENS-style name (.eth, .base.eth, .cb.id)
bankr wallet transfer --to 0x1234... --token ETH --amount 0.1
bankr wallet transfer --to vitalik.eth --token USDC --amount 50 --chain base
bankr wallet transfer --to name.base.eth --native --amount 0.01
```

`--to` accepts a 0x address or an ENS-style name; ENS names (`.eth`, `.base.eth`, `.cb.id`) are resolved to an address via `/addresses/resolve` before the transfer is submitted, so the call fails fast with a clear error if the name doesn't resolve. To send to social handles (Twitter, Farcaster, Telegram), use the AI agent (`bankr agent ...`) instead — the CLI's direct `transfer` command intentionally does not accept handles to keep money-moving inputs unambiguous.

The `--token` flag resolves token symbols (e.g. `USDC`) to contract addresses via the search API.

## REST API

```bash
# Direct transfer via Wallet API
curl -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "vitalik.eth", "token": "USDC", "amount": "50", "chain": "base"}'
```

The `/wallet/transfer` endpoint is a write endpoint — requires `walletApiEnabled`, `readOnly: false`, and is subject to `allowedRecipients` enforcement and IP allowlist.

### Recipient Resolution Helper

If you need to resolve an ENS-style name to a 0x address yourself (without submitting a transfer), use the structured `/addresses/resolve` endpoint. It is public — no API key required.

```bash
curl "https://api.bankr.bot/addresses/resolve?value=vitalik.eth&type=ens"
# → { "resolved": true, "address": "0x...", "displayName": "vitalik.eth" }
```

`type` is one of `address`, `ens`, `twitter`, `farcaster`. The legacy `/public/resolve-recipient` endpoint still works as a backward-compat alias but is marked deprecated (Sunset: 2026-06-03). Migrate to `/addresses/resolve`. A parallel `/users/search` endpoint is available for Twitter/Farcaster username lookup (legacy alias: `/public/search-users`, same deprecation timeline).

## Supported Transfers

- **EVM Chains**: Base, Polygon, Ethereum (mainnet), Unichain, World Chain, Arbitrum, BNB Chain
  - Native tokens: ETH, POL, BNB
  - ERC20 tokens: USDC, USDT, WETH, etc.
- **Solana**: SOL and SPL tokens (via AI agent — the CLI's `bankr wallet transfer` is EVM-only)

## Recipient Formats

Pass the bare username for social handles (no `.eth` suffix even if the user's display name has one) — the resolver only matches by exact Farcaster/Twitter username.

| Format | Example | `bankr wallet transfer` | AI agent (`bankr agent`) |
|--------|---------|:-----------------------:|:------------------------:|
| EVM address | `0x1234...abcd` | ✓ | ✓ |
| Solana address | `9xKc...abc` | — | ✓ |
| ENS | `vitalik.eth` | ✓ (resolved client-side) | ✓ |
| Basename | `name.base.eth` | ✓ (resolved client-side) | ✓ |
| Coinbase ID | `name.cb.id` | ✓ (resolved client-side) | ✓ |
| Twitter | `@elonmusk` | — | ✓ |
| Farcaster | `@dwr` | — | ✓ |
| Telegram | `@username` | — | ✓ |

**Social handle resolution** (agent only): handles are resolved to a linked wallet address before sending. The user must have linked a wallet to the social platform for resolution to succeed.

## Amount Formats

| Format | Example | Description |
|--------|---------|-------------|
| USD | `$50` | Dollar amount |
| Percentage | `50%` | Percentage of balance |
| Exact | `0.1 ETH` | Specific amount |

## Prompt Examples

**To addresses:**
- "Send 0.5 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
- "Transfer 100 USDC to 9xKc...abc"
- "Send $20 of ETH to 0x1234..."

**To ENS / Basenames:**
- "Send 1 ETH to vitalik.eth"
- "Transfer $50 of USDC to mydomain.eth"
- "Send 10 USDC to friend.base.eth"

**To social handles:**
- "Send $20 of ETH to @friend on Twitter"
- "Transfer 0.1 ETH to @user on Farcaster"
- "Send 50 USDC to @buddy on Telegram"

**With chain specified:**
- "Send ETH on Base to vitalik.eth"
- "Send 10% of my ETH to @friend"
- "Transfer USDC on Polygon to 0x..."

## Chain Selection

If not specified, Bankr selects automatically based on:
- Recipient activity patterns
- Gas costs
- Token availability
- Liquidity

Specify chain in prompt if you need a specific network. The CLI's `bankr wallet transfer` defaults to `base`; pass `--chain <name>` to override.

## Common Issues

| Issue | Resolution |
|-------|------------|
| ENS not found | Verify the ENS name exists and is registered |
| `--to` rejected as invalid | The CLI accepts only 0x addresses and ENS-style names (`.eth`, `.base.eth`, `.cb.id`). For social handles use the AI agent. |
| Social handle not found | Check username spelling and platform |
| No linked wallet | User hasn't linked wallet to their social account |
| Insufficient balance | Reduce amount or ensure enough funds |
| Wrong chain | Specify chain explicitly in prompt |
| Gas required | Ensure you have native token for gas |

## Security Notes

- **Verify recipient** - Always double-check before confirming
- **Address preview** - Social handle resolution shows the resolved address
- **Irreversible** - Blockchain transactions cannot be undone
- **Large transfers** - May require additional confirmation
- **Test first** - Send small amount first for new recipients

## Best Practices

1. **Start small** - Test with small amounts for new recipients
2. **Verify address** - Double-check resolved addresses
3. **Check chain** - Ensure recipient uses the same chain
4. **Gas buffer** - Keep some native token for future transactions
5. **ENS preferred** - More reliable than social handles
6. **Screenshot** - Save transaction hash for records
