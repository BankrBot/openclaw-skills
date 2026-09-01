# Setup — RH Wallet + Bankr (stateless)

**Hosted gateway:** see [hosted-config.md](hosted-config.md) for the public URL and gateway secret (built into the skill — no need to set `RH_WALLET_API_URL` or `RH_GATEWAY_SECRET` unless self-hosting).

## 1. Create Robinhood API credentials

```bash
pip install pynacl
python scripts/generate_rh_keypair.py
```

1. Register the **public** key in Robinhood crypto settings (web classic)
2. Copy the **API key** (`rh-api-...`)
3. Keep the **private key** for Bankr env only

## 2. Bankr Agent tool environment

**Gear → Agent tool environment** (not x402):

| Variable | Required? | Value |
|----------|-----------|--------|
| `RH_API_KEY` | **Yes** | Your `rh-api-...` |
| `RH_PRIVATE_KEY_BASE64` | **Yes** | Your private key |
| `RH_GATEWAY_SECRET` | No | Default in [hosted-config.md](hosted-config.md) |
| `RH_WALLET_API_URL` | No | Default in [hosted-config.md](hosted-config.md) |
| `RH_MAX_ORDER_USD` | No | e.g. `25` |
| `RH_REQUIRE_CONFIRMATION` | No | `true` |

## 3. Install skill

```text
install the skill at https://github.com/anondevv69/RH-Wallet/tree/main/skill
```

## 4. Test

- “What’s my Robinhood buying power?”
- “Robinhood price of BTC-USD”

## Self-hosting (optional)

Override `RH_WALLET_API_URL` and `RH_GATEWAY_SECRET` in Bankr env. See [RAILWAY.md](../../RAILWAY.md).

## Security

- **Robinhood keys** stay in Bankr env — gateway does not store them
- **Gateway secret** is public (invite code for the shared signer); it does not access anyone’s RH account without their keys
- Never paste private keys into chat
