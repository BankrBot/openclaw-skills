---
name: v402
description: Pay for external tool APIs using the v402 HTTP payment protocol on Solana. Use when an HTTP request returns 402 Payment Required with a V402-Intent header, or when the user wants to call paid tool services with spending controls. Handles policy enforcement, Solana USDC payments, and Ed25519 receipt verification. Trigger words include v402, paid tools, tool payments, spending budget, payment receipt, 402 payment required.
metadata: {"openclaw":{"emoji":"💳","requires":{"bins":["node"],"env":["V402_WALLET_PRIVATE_KEY"]},"homepage":"https://github.com/valeo-cash/v402"}}
---

# v402 — HTTP Payment Protocol for AI Agents

## 1. When to Use This Skill

Activate this skill when any of the following are true:

- An HTTP response returns **402 Payment Required** with a `V402-Intent` header
- The user asks you to call a **paid API** or **paid tool service**
- The user asks to check their **spending budget**, view **payment history**, or verify a **receipt**
- The user mentions "v402", "paid tools", "tool payments", or "spending budget"
- You encounter a tool endpoint that requires payment before returning results

## 2. How the Protocol Works

v402 is a non-custodial HTTP payment protocol on Solana. There is **no facilitator** — transactions are verified directly on-chain via Solana RPC.

### The 7-Step Flow

1. **Request** — Make a normal HTTP GET/POST to the tool endpoint
2. **402 Response** — Server returns HTTP 402 with a `V402-Intent` header containing a JSON payment intent:
   ```json
   {
     "id": "intent_a8f3c",
     "amount": "0.002",
     "currency": "USDC",
     "merchant": "MerchantWallet...",
     "tool_id": "web_search",
     "expires_at": 1708300800
   }
   ```
3. **Policy Check** — Check the spending policy (daily cap, per-call cap, tool allowlist, merchant allowlist). **NEVER skip this step.**
4. **Pay** — If policy passes, submit a Solana USDC transfer to the merchant's wallet
5. **Retry** — Re-send the same HTTP request with a `V402-Payment` header containing `intent_id`, `tx_signature`, and `payer`
6. **Verify & Respond** — Gateway verifies the transaction on-chain (no facilitator), checks the agent's spending policy, then returns **200 OK** with a `V402-Receipt` header
7. **Receipt** — The receipt is Ed25519 signed, portable, and independently verifiable

**Key principle:** The gateway never touches user funds. Payments go directly from agent wallet to merchant wallet on Solana.

## 3. Setup

### Required Environment Variables

```
V402_WALLET_PRIVATE_KEY=<base58 Solana private key>     # REQUIRED — agent wallet
V402_RPC_URL=https://api.devnet.solana.com               # optional, default devnet
V402_DAILY_CAP=5.0                                       # optional, default 5.0 USDC
V402_PER_CALL_CAP=1.0                                    # optional, default 1.0 USDC
V402_ALLOWED_TOOLS=web_search,get_token_price            # optional, empty = all allowed
V402_ALLOWED_MERCHANTS=                                   # optional, empty = all allowed
```

### OpenClaw Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "v402": {
        "enabled": true,
        "env": {
          "V402_WALLET_PRIVATE_KEY": "<your-base58-private-key>",
          "V402_DAILY_CAP": "5.0",
          "V402_PER_CALL_CAP": "1.0",
          "V402_ALLOWED_TOOLS": "web_search,get_token_price,get_balance"
        }
      }
    }
  }
}
```

### Install Dependencies

```bash
bash {baseDir}/scripts/install.sh
```

## 4. Helper Scripts

All scripts output JSON to stdout. Errors are also JSON: `{ "error": "..." }`.

### v402-policy.mjs — Spending Policy Manager

Manages spending limits. Pure Node.js, no external dependencies.

**Check if a payment is allowed:**
```bash
node {baseDir}/scripts/v402-policy.mjs check --amount 0.002 --tool_id web_search
# → {"allowed":true,"reason":"ok"}

node {baseDir}/scripts/v402-policy.mjs check --amount 2.0 --tool_id hack_tool
# → {"allowed":false,"reason":"Tool \"hack_tool\" not in allowed list [web_search, get_token_price]"}
```

**View current budget:**
```bash
node {baseDir}/scripts/v402-policy.mjs budget
# → {"daily_cap":5,"per_call_cap":1,"spent_today":0.002,"remaining":4.998,"resets_at":"2025-02-20T00:00:00.000Z"}
```

**View payment history:**
```bash
node {baseDir}/scripts/v402-policy.mjs history
# → {"total":2,"payments":[...]}

node {baseDir}/scripts/v402-policy.mjs history --limit 5
```

**Record a payment (after on-chain confirmation):**
```bash
node {baseDir}/scripts/v402-policy.mjs record --amount 0.002 --tool_id web_search --merchant MerchantWallet --tx_signature 5Uj8kR...mL3nW --intent_id intent_a8f3c
```

**Reset daily state:**
```bash
node {baseDir}/scripts/v402-policy.mjs reset
```

### v402-pay.mjs — Solana Payment Submission

Submits USDC SPL token transfers on Solana. Requires `@solana/web3.js`, `@solana/spl-token`, `bs58`.

**Submit payment:**
```bash
node {baseDir}/scripts/v402-pay.mjs pay --amount 0.002 --merchant MerchantWallet --intent_id intent_a8f3c --tool_id web_search
# → {"success":true,"tx_signature":"5Uj8kR...","confirmed_ms":420,"amount":0.002,"merchant":"...","payer":"..."}
```

**Check wallet balances:**
```bash
node {baseDir}/scripts/v402-pay.mjs wallet
# → {"address":"AgentWallet...","sol_balance":0.5,"usdc_balance":10.0,"rpc_url":"https://api.devnet.solana.com"}
```

### v402-verify.mjs — Receipt Verification

Verifies receipts by checking the referenced transaction on-chain.

**Verify a receipt:**
```bash
node {baseDir}/scripts/v402-verify.mjs verify --receipt '{"intent_id":"...","tx_signature":"...","amount":"0.002","payer":"...","merchant":"..."}'
# → {"valid":true,"on_chain":true,"payer_match":true,"slot":12345,"block_time":"..."}
```

**Inspect a transaction:**
```bash
node {baseDir}/scripts/v402-verify.mjs inspect --tx 5Uj8kR...mL3nW
# → {"signature":"...","slot":12345,"status":"success","explorer":"https://explorer.solana.com/tx/..."}
```

### v402-http.mjs — Full Automated Flow

**This is the main script for most tool calls.** It handles the entire 402 flow automatically: request → detect 402 → parse intent → check policy → pay → retry → return results + receipt.

```bash
node {baseDir}/scripts/v402-http.mjs call --url "https://tools.v402.dev/api/search?q=solana+ai"
# → full result with body, payment info, receipt, and remaining budget

node {baseDir}/scripts/v402-http.mjs call --url "https://tools.v402.dev/api/price" --method POST --body '{"token":"SOL"}'
```

**Successful response:**
```json
{
  "success": true,
  "status": 200,
  "body": { "results": [{ "title": "...", "url": "..." }] },
  "payment": {
    "amount": 0.002,
    "currency": "USDC",
    "tx_signature": "5Uj8kR...mL3nW",
    "confirmed_ms": 420,
    "intent_id": "intent_a8f3c"
  },
  "receipt": { "version": 2, "signature": "ed25519:..." },
  "budget": { "spent_today": 0.002, "remaining": 4.998 }
}
```

**Blocked by policy:**
```json
{
  "blocked": true,
  "reason": "Tool \"deploy_token\" not in allowed list [web_search, get_token_price, get_balance]",
  "intent": { "amount": "0.01", "tool_id": "deploy_token" }
}
```

## 5. Full Payment Flow — Step by Step

When you need to manually handle the flow (instead of using `v402-http.mjs`):

### Step 1: Make the initial request

```bash
curl -s -o /dev/null -w "%{http_code}" -D - https://tools.v402.dev/api/search?q=solana
```

If the response is **200**, the endpoint is free — use the response directly.
If the response is **402**, proceed to Step 2.

### Step 2: Parse the V402-Intent header

Extract the `V402-Intent` header from the 402 response. It contains JSON:
```json
{
  "id": "intent_a8f3c",
  "amount": "0.002",
  "currency": "USDC",
  "merchant": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tool_id": "web_search",
  "expires_at": 1708300800
}
```

### Step 3: Check spending policy

```bash
node {baseDir}/scripts/v402-policy.mjs check --amount 0.002 --tool_id web_search --merchant 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

If `allowed: false`, **stop** and report the reason to the user. Never pay without policy approval.

### Step 4: Check expiry

Verify `expires_at` is in the future: `Date.now() / 1000 < expires_at`. If expired, request a fresh intent.

### Step 5: Submit payment

```bash
node {baseDir}/scripts/v402-pay.mjs pay --amount 0.002 --merchant 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU --intent_id intent_a8f3c --tool_id web_search
```

### Step 6: Retry with proof

Send the same request with the `V402-Payment` header:
```bash
curl -H 'V402-Payment: {"intent_id":"intent_a8f3c","tx_signature":"5Uj8kR...","payer":"AgentWallet..."}' https://tools.v402.dev/api/search?q=solana
```

### Step 7: Extract receipt

The 200 response includes a `V402-Receipt` header with an Ed25519-signed receipt.

After every payment, report to the user:
- What was purchased (tool and query)
- Amount paid and currency
- Remaining daily budget

## 6. Automated Flow

For most tool calls, prefer the automated script — it handles everything in one command:

```bash
node {baseDir}/scripts/v402-http.mjs call --url "https://tools.v402.dev/api/search?q=solana+ai"
```

This handles: request → detect 402 → parse intent → check policy → pay → retry → return results + receipt.

Only use the manual step-by-step flow when you need fine-grained control or debugging.

## 7. Important Rules

1. **NEVER skip the policy check before paying.** Policy protects the user's funds.
2. **NEVER pay if the policy rejects** — tell the user why the payment was blocked and how to adjust the policy.
3. **Always check intent expiry** before submitting payment. Expired intents will be rejected.
4. **Only USDC on Solana** is currently supported.
5. **Report costs after every payment**: amount, currency, what was purchased, and remaining daily budget.
6. **If no wallet is configured**, tell the user how to set `V402_WALLET_PRIVATE_KEY` in their OpenClaw config.
7. **Receipts are portable** — they can be independently verified using the Ed25519 signature without contacting anyone.

## 8. Slash Commands

| Command | Action |
|---|---|
| `/v402 budget` | Show remaining daily budget, caps, and reset time |
| `/v402 history` | Show payment history for this session |
| `/v402 verify <receipt>` | Verify an Ed25519-signed v402 receipt |
| `/v402 wallet` | Show wallet address, SOL and USDC balances |

## 9. Known Tool Services

| Service | Endpoint | Price | Tool ID |
|---|---|---|---|
| Web Search | `https://tools.v402.dev/api/search` | 0.002 USDC | `web_search` |
| Token Data | `https://tools.v402.dev/api/price` | 0.001 USDC | `get_token_price` |
| Solana RPC | `https://tools.v402.dev/api/balance` | 0.0005 USDC | `get_balance` |

## 10. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `V402_WALLET_PRIVATE_KEY is not set` | Missing wallet | Set the env var in OpenClaw config |
| `Insufficient USDC balance` | Wallet has no USDC | Fund wallet on devnet or mainnet |
| `Intent has expired` | Waited too long | Make a fresh request to get a new intent |
| `Daily cap would be exceeded` | Budget exhausted | Wait for UTC midnight reset or increase `V402_DAILY_CAP` |
| `Tool "X" not in allowed list` | Tool blocked by policy | Add the tool to `V402_ALLOWED_TOOLS` |
| `402 received but no V402-Intent header` | Non-v402 paywall | Endpoint uses a different payment system |
| `Transaction not found on-chain` | RPC lag or wrong cluster | Wait a few seconds and retry, or check `V402_RPC_URL` cluster |
