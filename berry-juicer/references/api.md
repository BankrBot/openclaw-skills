# Berry Juicer API Reference

Base URL: `https://juicerapi.berryfi.org`

All reads are public. All spends are authorized by a wallet signature over `berry-inference:{address-lowercase}:{timestamp}`, sent in the `x-berry-address`, `x-berry-timestamp`, and `x-berry-sig` headers. Signatures are single-use and time-bound.

## Public read endpoints (no auth)

### GET /api/config
Returns chain and protocol parameters.

```json
{
  "chainId": 8453,
  "depositFactory": "0x...",
  "quoteAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "creatorShareBps": 8000,
  "inferenceProvider": "surplus",
  "inferenceIsolation": "per-creator",
  "supportedTokens": ["0x..."]
}
```

### GET /api/creators/{address}/balance
The creator's isolated inference balance, read from on-chain USDC in their inference wallet.

```json
{
  "creator": "0x...",
  "isolated": true,
  "walletAddress": "0x...",
  "credited6dp": "1000000",
  "spent6dp": "0",
  "remaining6dp": "1000000"
}
```
Amounts are 6-decimal USDC units: `1000000` = $1.00.

### GET /api/creators/{address}/vaults
The creator's vaults, split by status.

```json
{
  "creator": "0x...",
  "open": [{ "vault": "0x...", "token": "0x...", "amount": "...", "status": "open", "pendingFees": "..." }],
  "closed": [],
  "all": []
}
```

### GET /api/creators/{address}/inference
Harvest and credit history for the creator (real harvests only).

### GET /api/creators/{address}/spends
Per-call inference spend records for the creator.

### GET /api/models
The live model catalog with pricing.

- `GET /api/models` returns text/chat models (the default).
- `GET /api/models?all=true` returns every model, including image, video, and audio.

```json
{
  "count": 141,
  "models": [
    {
      "id": "llama-3.3-70b-instruct",
      "name": "Llama 3.3 70B Instruct",
      "contextLength": 131072,
      "modality": "text->text",
      "pricing": { "promptPerToken": "0.0000006000", "completionPerToken": "0.0000030000" }
    }
  ]
}
```
The `id` is the exact string to send as `model` when running inference. Multiply a per-token price by 1,000,000 for price per million tokens.

## Authenticated endpoint

### POST /api/inference/chat
OpenAI-compatible chat completion, paid from the creator's harvested USDC at the chosen model's live rate.

Headers:
- `x-berry-address`: creator wallet address, lowercase
- `x-berry-timestamp`: millisecond timestamp used in the signed message
- `x-berry-sig`: signature of `berry-inference:{address}:{timestamp}` (personal_sign)
- `Content-Type: application/json`

Body:
```json
{
  "model": "llama-3.3-70b-instruct",
  "messages": [{ "role": "user", "content": "..." }]
}
```

Success: the model response plus a `billing` object. Error shape:
```json
{ "error": { "code": "auth_failed | unknown_model | no_balance | provider_error | internal_error", "message": "...", "support": true } }
```

## Signing with Bankr

```bash
ADDR=$(bankr wallet me --json | jq -r '.address' | tr 'A-Z' 'a-z')
TS=$(($(date +%s) * 1000))
SIG=$(bankr wallet sign --json --message "berry-inference:${ADDR}:${TS}" | jq -r '.signature')
```

Or via the Bankr REST API:
```bash
curl -s -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"signatureType\": \"personal_sign\", \"message\": \"berry-inference:${ADDR}:${TS}\"}"
```

## On-chain deposit and withdrawal

Deposit (create a vault) and withdraw are on-chain calls executed by the Bankr wallet via `bankr wallet submit` (raw transaction) or the Berry dapp at `https://berryfi.org/juicer`. The deposit factory address and supported tokens come from `GET /api/config`. Only the creator wallet can withdraw its own vault.
