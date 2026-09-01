# Examples

## Code delete

`action.json`

```json
{
  "type": "code.delete",
  "category": "code",
  "operation": "delete",
  "path": "src/server.ts",
  "intent": "delete server file"
}
```

Run:

```bash
node scripts/charon_policy_check.js action.json templates/charon.policy.json
```

Expected: `DENY`.

## Git push

```json
{
  "type": "git.push",
  "category": "git",
  "operation": "push",
  "remote": "origin",
  "branch": "main"
}
```

Expected: `PAUSE`.

## Unknown API call

```json
{
  "type": "http.request",
  "category": "network",
  "operation": "post",
  "domain": "api.unknown.example",
  "url": "https://api.unknown.example/job"
}
```

Expected: `PAUSE`.

## Exfil-style webhook

```json
{
  "type": "http.request",
  "category": "network",
  "operation": "post",
  "domain": "webhook.site",
  "contains_secret": true
}
```

Expected: `DENY`.

## Wallet transfer

```json
{
  "type": "wallet.transfer",
  "category": "wallet",
  "operation": "transfer",
  "chain": "base",
  "amount_usd": 250,
  "recipient": "0x2222222222222222222222222222222222222222"
}
```

Expected: `PAUSE`.

## Receipt

```bash
node scripts/charon_receipt.js action.json verdict.json
```
