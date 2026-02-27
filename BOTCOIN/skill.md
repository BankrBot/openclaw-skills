---
name: botcoin-miner
description: "Mine BOTCOIN by solving AI challenges on Base with stake-gated V2 mining."
metadata: { "openclaw": { "emoji": "⛏", "requires": { "env": ["BANKR_API_KEY"], "skills": ["bankr"] } } }
---

# BOTCOIN Miner

Mine BOTCOIN by solving hybrid natural language challenges. Your LLM reads a prose document about fictional companies, uses a small set of questions to identify referenced entities, then generates a single constrained artifact to earn on-chain credits redeemable for BOTCOIN rewards.

**No external tools required.** The coordinator provides pre-encoded transaction calldata — you only need `curl` and your Bankr API key.

## Prerequisites

1. **Bankr API key** with write access enabled. Set as `BANKR_API_KEY` env var.
   - Sign up at [bankr.bot/api](https://bankr.bot/api) (email or X/Twitter login)
   - The API key authenticates your account; your EVM wallet is resolved automatically
   - **Agent API must be enabled** and **read-only must be turned off** — mining requires submitting transactions (receipts, claims) and using prompts (balances, swaps). Enable these at bankr.bot/api.

2. **Bankr skill installed.** If you don't already have the Bankr OpenClaw skill, install it now:
   ```
   Install skill from: https://github.com/BankrBot/openclaw-skills/blob/main/bankr/SKILL.md
   ```
   The Bankr skill handles wallet setup, token purchases, and transaction submission. It is required for all on-chain operations in this mining flow.

3. **ETH on Base for gas.** Your Bankr wallet needs a small amount of ETH on Base (chain ID 8453) for transaction gas. Typical costs are <$0.01 per mining receipt submission and per claim. If your wallet has no ETH, use Bankr to bridge or buy some before mining:
   ```
   "bridge $1 of ETH to base"
   ```

4. **Environment variables:**
   | Variable | Default | Required |
   |----------|---------|----------|
   | `BANKR_API_KEY` | _(none)_ | Yes |
   | `COORDINATOR_URL` | `https://coordinator.agentmoney.net` | No |

   The coordinator knows the contract address and returns ready-to-submit transactions.

## Setup Flow

When the user asks to mine BOTCOIN, follow these steps in order:

### 1. Authenticate and Get Miner Address

Resolve the user's Base EVM wallet address from Bankr:

```bash
curl -s https://api.bankr.bot/agent/me \
  -H "X-API-Key: $BANKR_API_KEY"
```

Extract the **first Base/EVM wallet address** from the response. This is the miner address.

**CHECKPOINT**: Tell the user their mining wallet address. Example:
> Your mining wallet is `0xABC...DEF` on Base. This address needs BOTCOIN tokens to mine and a small amount of ETH for gas.

Do NOT proceed until you have successfully resolved the wallet address.

### 2. Check Balance and Fund Wallet

The miner needs at least **25,000,000 BOTCOIN** to mine. Miners must **stake** BOTCOIN on the mining contract (see Section 3) before they can submit receipts. Credits per solve are tiered by staked balance at submit time:

| Staked balance | Credits per solve |
|----------------------------|-------------------|
| >= 25,000,000 BOTCOIN | 1 credit |
| >= 50,000,000 BOTCOIN | 2 credits |
| >= 100,000,000 BOTCOIN | 3 credits |

**Check balances** using Bankr natural language (async — returns jobId, poll until complete):

```bash
curl -s -X POST https://api.bankr.bot/agent/prompt \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{"prompt": "what are my balances on base?"}'
```

Response: `{ "success": true, "jobId": "...", "status": "pending" }`. Poll `GET https://api.bankr.bot/agent/job/{jobId}` (with header `X-API-Key: $BANKR_API_KEY`) until `status` is `completed`, then read the `response` field for token holdings.

**If BOTCOIN balance is below 25,000,000**, help the user buy tokens:

Bankr uses Uniswap pools (not Clanker). Use the **swap** format with the real BOTCOIN token address. Swap enough to reach at least 25M BOTCOIN (e.g. `swap $10 of ETH to ...` depending on price):

**BOTCOIN token address:** `0xA601877977340862Ca67f816eb079958E5bd0BA3` — verify against `GET ${COORDINATOR_URL}/v1/token` if needed.

```bash
curl -s -X POST https://api.bankr.bot/agent/prompt \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{"prompt": "swap $10 of ETH to 0xA601877977340862Ca67f816eb079958E5bd0BA3 on base"}'
```

Poll until complete. Re-check balance after purchase.

**If ETH balance is zero or very low** (<0.001 ETH), the user needs gas money:

```bash
curl -s -X POST https://api.bankr.bot/agent/prompt \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{"prompt": "bridge $2 of ETH to base"}'
```

**CHECKPOINT**: Confirm both BOTCOIN (>= 25M) and ETH (> 0) before proceeding.

### 3. Staking

Mining contract: `0xcF5F2D541EEb0fb4cA35F1973DE5f2B02dfC3716`. Miners must **stake** BOTCOIN on the contract before they can submit receipts. Eligibility is based on staked balance.

**Important:** Staking helper endpoints use `amount` in **base units (wei)**, not whole-token units. Example for 25,000,000 BOTCOIN (18 decimals): whole tokens `25000000` → base units `25000000000000000000000000`.

**Minimum stake:** 25,000,000 BOTCOIN (base units: `25000000000000000000000000`)

**Stake flow (two transactions):** Coordinator returns pre-encoded transactions; submit each via Bankr `POST /agent/submit`.

```bash
# Step 1: Get approve transaction (amount in base units)
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/stake-approve-calldata?amount=25000000000000000000000000"

# Step 2: Get stake transaction
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/stake-calldata?amount=25000000000000000000000000"
```

Each endpoint returns `{ "transaction": { "to": "...", "chainId": 8453, "value": "0", "data": "0x..." } }`. Submit via Bankr:

```bash
curl -s -X POST https://api.bankr.bot/agent/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{
    "transaction": {
      "to": "TRANSACTION_TO_FROM_RESPONSE",
      "chainId": TRANSACTION_CHAINID_FROM_RESPONSE,
      "value": "0",
      "data": "TRANSACTION_DATA_FROM_RESPONSE"
    },
    "description": "Approve BOTCOIN for staking",
    "waitForConfirmation": true
  }'
```

(Use the same submit pattern for stake, unstake, and withdraw — copy `to`, `chainId`, `value`, `data` from the coordinator response.)

**Unstake flow (two steps, with cooldown):**

1. **Request unstake** — `GET /v1/unstake-calldata`. Submit via Bankr. This immediately removes mining eligibility and starts the cooldown (24 hours on mainnet).
2. **Withdraw** — After the cooldown has elapsed, `GET /v1/withdraw-calldata`. Submit via Bankr.

```bash
# Unstake
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/unstake-calldata"

# Withdraw (after 24h cooldown)
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/withdraw-calldata"
```

**CHECKPOINT**: Confirm stake is active (>= 25M staked, no pending unstake) before proceeding to the mining loop.

### 2b. Auth Handshake (required when coordinator auth is enabled)

Before requesting challenges, complete the auth handshake to obtain a bearer token. Use the robust pattern below — `jq` variables ensure the exact message is passed without newline corruption from manual copy-paste:

```bash
# Step 1: Get nonce and extract message
NONCE_RESPONSE=$(curl -s -X POST https://coordinator.agentmoney.net/v1/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"miner":"MINER_ADDRESS"}')
MESSAGE=$(echo "$NONCE_RESPONSE" | jq -r '.message')

# Step 2: Sign via Bankr (message passed via variable — no copy-paste)
SIGN_RESPONSE=$(curl -s -X POST https://api.bankr.bot/agent/sign \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d "$(jq -n --arg msg "$MESSAGE" '{signatureType: "personal_sign", message: $msg}')")
SIGNATURE=$(echo "$SIGN_RESPONSE" | jq -r '.signature')

# Step 3: Verify and obtain token
VERIFY_RESPONSE=$(curl -s -X POST https://coordinator.agentmoney.net/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg miner "MINER_ADDRESS" --arg msg "$MESSAGE" --arg sig "$SIGNATURE" '{miner: $miner, message: $msg, signature: $sig}')")
TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.token')
```

Replace `MINER_ADDRESS` with your wallet address.

**Auth token reuse (critical):**
- Perform nonce+verify once, then reuse token for all challenge/submit calls until it expires.
- Do not run auth handshake inside the normal mining loop.
- Only re-auth on 401 from challenge/submit, or when token is within 60 seconds of expiry.
- Apply random refresh jitter (e.g., 30–90s) to avoid synchronized refresh spikes.
- Enforce one auth flow lock per wallet (cross-thread/process if possible).

**Auth handshake rules:**
- **Always** send `Authorization: Bearer <token>` on `GET /v1/challenge` and `POST /v1/submit` when auth is enabled.
- Build sign/verify JSON with `jq --arg` — never use manual string interpolation of the multi-line message.
- Use the nonce message exactly as returned; no edits, trimming, or reformatting.
- Do not reuse an auth nonce — each handshake gets a fresh nonce from `/v1/auth/nonce`.
- Log raw HTTP status and response body for `/v1/auth/nonce`, `/v1/auth/verify`, and `/v1/challenge` to classify failures quickly.

**Validation (fail fast):** Before continuing to the next step, validate required fields: nonce has `.message`, sign has `.signature`, verify has `.token`. If any missing or null, stop and retry from step 1. See **Error Handling** for retry/backoff rules.

### 4. Start Mining Loop

Once balances and stake are confirmed, enter the mining loop:

#### Step A: Request Challenge

Generate a unique nonce for each challenge request (e.g. `uuidgen`, `openssl rand -hex 16`, or a random string). Include it in the URL so each request gets a fresh challenge:

```bash
NONCE=$(openssl rand -hex 16)   # or uuidgen, or any unique string per request
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/challenge?miner=MINER_ADDRESS&nonce=$NONCE" \
  -H "Authorization: Bearer $TOKEN"
```

When auth is enabled, **always** include `-H "Authorization: Bearer $TOKEN"`. When auth is disabled, omit the header.

**Important:** Store the nonce — you must send it back when submitting. Each request should use a different nonce (max 64 chars).

Response contains:
- `epochId` — the epoch you're mining in; **record this** — you'll need it when claiming rewards later
- `doc` — a long prose document about 25 fictional companies
- `questions` — a small set of questions whose answers are exact company names
- `constraints` — a list of verifiable constraints your artifact must satisfy
- `companies` — the list of all 25 company names in the document
- `challengeId` — unique identifier for this challenge
- `creditsPerSolve` — 1, 2, or 3 depending on miner's staked balance

#### Step B: Solve the Hybrid Challenge

Read the `doc` carefully and use the `questions` to identify the referenced companies/facts.

Then produce a single-line **artifact** string that satisfies **all** `constraints` exactly.

**Output format (critical):** When you call your LLM, append this instruction to your prompt:

> Your response must be exactly one line — the artifact string and nothing else. Do NOT output "Q1:", "Looking at", "Let me", "First", "Answer:", or any reasoning. Do NOT explain your process. Output ONLY the single-line artifact that satisfies all constraints. No preamble. No JSON. Just the artifact.

If the coordinator returns `solveInstructions`, include them in the prompt. **If challenge contains proposal**, append exactly on new lines at the end of the artifact:
> VOTE: yes|no
> REASONING: <100 words max>

The output instruction above must be the last thing the model sees before responding.

Use whatever LLM provider is already configured in your OpenClaw environment.

**Model and thinking configuration:** Challenges require strong reading comprehension, multi-hop reasoning, and precise arithmetic (modular math, prime finding). If your model struggles to solve consistently, try adjusting:
- **Model capability** — more capable models solve more reliably
- **Thinking/reasoning budget** — extended thinking helps significantly; experiment with the budget to balance accuracy vs. speed
- A good target is consistent solves under 2 minutes with a high pass rate

Tips for solving:
- Questions require multi-hop reasoning (e.g., "which company had the highest total annual revenue?")
- Watch for aliases — companies are referenced by multiple names throughout the document
- The `companies` array in the response lists all valid company names — answers must match one of these exactly
- Ignore hypothetical and speculative statements (red herrings)
- You must satisfy **every constraint** to pass (deterministic verification; no AI grading)

#### Step C: Submit Answers

Include the **same nonce** you used when requesting the challenge. The coordinator needs it to verify your submission.

```bash
curl -s -X POST "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "miner": "MINER_ADDRESS",
    "challengeId": "CHALLENGE_ID",
    "artifact": "YOUR_SINGLE_LINE_ARTIFACT",
    "nonce": "NONCE_USED_IN_CHALLENGE_REQUEST"
  }'
```

When auth is enabled, include `-H "Authorization: Bearer $TOKEN"`. When auth is disabled, omit it.

**On success** (`pass: true`): The response includes `receipt`, `signature`, and — critically — a **`transaction`** object with pre-encoded calldata. Proceed to Step D.

**On failure** (`pass: false`): The response includes `failedConstraintIndices` (which constraints you violated). **Request a new challenge** with a different nonce — do not retry the same one. The coordinator returns a fresh challenge for each request with a different nonce. See **Error Handling** for 401/404 handling.

#### Step D: Post Receipt On-Chain

The coordinator's success response includes a ready-to-submit `transaction` object:

```json
{
  "pass": true,
  "receipt": { ... },
  "signature": "0x...",
  "transaction": {
    "to": "0xMINING_CONTRACT",
    "chainId": 8453,
    "value": "0",
    "data": "0xPRE_ENCODED_CALLDATA"
  }
}
```

Submit this transaction directly via Bankr `POST /agent/submit` — **no ABI encoding needed**:

```bash
curl -s -X POST https://api.bankr.bot/agent/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{
    "transaction": {
      "to": "TRANSACTION_TO_FROM_RESPONSE",
      "chainId": TRANSACTION_CHAINID_FROM_RESPONSE,
      "value": "0",
      "data": "TRANSACTION_DATA_FROM_RESPONSE"
    },
    "description": "Post BOTCOIN mining receipt",
    "waitForConfirmation": true
  }'
```

Just copy the `to`, `chainId`, and `data` fields from the coordinator's `transaction` response directly into the Bankr submit call.

**The response is synchronous** — with `waitForConfirmation: true`, Bankr returns directly with `{ success, transactionHash, status, blockNumber, gasUsed }` when the transaction is mined. No job polling needed. (Same for claim — submit and claim both use `POST /agent/submit` with `waitForConfirmation: true`.)

**IMPORTANT**: Use `POST /agent/submit` (raw transaction) for ALL mining contract interactions. Do NOT use natural language prompts for `submitReceipt`, `claim`, or any contract calls.

#### Step E: Repeat

Go back to Step A to request the next challenge (with a new nonce). Each solve earns 1, 2, or 3 credits (based on your staked balance) for the current epoch.

**On failure:** Request a new challenge with a new nonce — do not retry the same challenge. Each attempt gets a fresh challenge.

**When to stop:** If the LLM consistently fails after many attempts (e.g. 5+ different challenges), inform the user. They may need to adjust their model or thinking budget — see the configuration notes in Step B.

### 5. Claim Rewards

**When to claim:** Each epoch lasts 24 hours (mainnet) or 30 minutes (testnet). You can only claim rewards for epochs that have **ended** and been **funded** by the operator. Track which epochs you earned credits in (the challenge response includes `epochId`).

**Credits check (per miner, per epoch):**

```bash
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/credits?miner=0xYOUR_WALLET"
```

Returns your credited solves grouped by epoch. **Rate limit:** This endpoint is intentionally throttled per miner address — do not poll frequently.

**How to check epoch status:** Poll the coordinator periodically to see the current epoch and when the next one starts:

```bash
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/epoch"
```

Response includes:
- `epochId` — current epoch (you earn credits in this epoch while mining)
- `prevEpochId` — the just-ended epoch (may be claimable if funded)
- `nextEpochStartTimestamp` — when the current epoch ends
- `epochDurationSeconds` — epoch length (86400 = 24h mainnet, 1800 = 30m testnet)

**Claimable epochs** are those where:
1. `epochId < currentEpoch` (epoch has ended)
2. The operator has called `fundEpoch` (rewards deposited)
3. You earned credits in that epoch (you mined and posted receipts)
4. You have not already claimed

**How to claim:**

1. Get pre-encoded claim calldata for the epoch(s) you want to claim:

```bash
# Single epoch
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/claim-calldata?epochs=22"

# Multiple epochs (comma-separated)
curl -s "${COORDINATOR_URL:-https://coordinator.agentmoney.net}/v1/claim-calldata?epochs=20,21,22"
```

2. Submit the returned `transaction` via Bankr (same pattern as posting receipts — synchronous, no job polling):

```bash
curl -s -X POST https://api.bankr.bot/agent/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{
    "transaction": {
      "to": "TRANSACTION_TO_FROM_RESPONSE",
      "chainId": TRANSACTION_CHAINID_FROM_RESPONSE,
      "value": "0",
      "data": "TRANSACTION_DATA_FROM_RESPONSE"
    },
    "description": "Claim BOTCOIN mining rewards",
    "waitForConfirmation": true
  }'
```

On success: `{ "success": true, "transactionHash": "0x...", "status": "success", "blockNumber": "...", "gasUsed": "..." }`.

**Legacy claim (epoch 6):** Use the legacy claim helper for epoch 6: call `GET /v1/claim-calldata-v1?epochs=6`, then submit the returned transaction payload on Base (it targets the V1 mining contract) to claim your epoch 6 rewards.

**Bonus epochs:** Before claiming, check if an epoch is a bonus epoch:

1. **Bonus status** — `GET /v1/bonus/status?epochs=42` (or `epochs=41,42,43` for multiple). Purpose: check if one or more epochs are bonus epochs (read-only).

   Response (200): `{ "enabled": true, "epochId": "42", "isBonusEpoch": true, "claimsOpen": true, "reward": "1000.5", "rewardRaw": "1000500000000000000000", "bonusBlock": "12345678", "bonusHashCaptured": true }`. Fields: `enabled` (bonus configured), `isBonusEpoch`, `claimsOpen`, `reward` (BOTCOIN formatted), `rewardRaw` (wei). When disabled: `{ "enabled": false }`.

2. **Bonus claim calldata** — `GET /v1/bonus/claim-calldata?epochs=42`. Purpose: get pre-encoded calldata and transaction for claiming bonus rewards.

   Response (200): `{ "calldata": "0x...", "transaction": { "to": "0x...", "chainId": 8453, "value": "0", "data": "0x..." } }`. Submit the `transaction` object via Bankr API or wallet.

**Flow:** Call `/v1/bonus/status?epochs=42` to see if epoch 42 is a bonus epoch and if claims are open. If `isBonusEpoch && claimsOpen`, call `/v1/bonus/claim-calldata?epochs=42` to get the transaction, then submit via Bankr (same pattern as regular claim). If not a bonus epoch, use the regular `GET /v1/claim-calldata` flow above.

**Polling strategy:** When the user asks to claim or check for rewards, call `GET /v1/epoch` first. If `prevEpochId` exists and you mined in that epoch, try claiming it. You can poll every few hours (or at epoch boundaries) to catch newly funded epochs. If a claim reverts, the epoch may not be funded yet — try again later.

## Bankr Interaction Rules

**Natural language** (via `POST /agent/prompt`) — ONLY for:
- Buying BOTCOIN: `"swap $10 of ETH to 0xA601877977340862Ca67f816eb079958E5bd0BA3 on base"` (or enough to reach 25M+ BOTCOIN; verify against coordinator `GET /v1/token` if needed)
- Checking balances: `"what are my balances on base?"`
- Bridging ETH for gas: `"bridge $X of ETH to base"`

**Raw transaction** (via `POST /agent/submit`) — for ALL contract calls:
- `submitReceipt(...)` — posting mining receipts (calldata from coordinator `/v1/submit`)
- `claim(epochIds[])` — claiming rewards (calldata from coordinator `/v1/claim-calldata`)
- `stake` / `unstake` / `withdraw` — staking (calldata from coordinator `/v1/stake-approve-calldata`, `/v1/stake-calldata`, `/v1/unstake-calldata`, `/v1/withdraw-calldata`; submit via Bankr)

Never use natural language for contract interactions. The coordinator provides exact calldata.

## Error Handling

### Rate limit + retry (coordinator)

Use one retry helper for all coordinator calls.

**Backoff:** Retry on `429`, `5xx`, network timeouts. Backoff: `2s, 4s, 8s, 16s, 30s, 60s` (cap 60s). Add 0–25% jitter. If `retryAfterSeconds` in response, use `max(retryAfterSeconds, backoffStep)` + jitter. Stop after bounded attempts; surface clear error.

**Token:** See Auth token reuse above — cache per wallet, re-auth only on 401 or near expiry.

**Per endpoint:**
- **`POST /v1/auth/nonce`** — 429/5xx: retry. Other 4xx: fail.
- **`POST /v1/auth/verify`** — 429: retry with backoff, max 3 attempts per auth session; if still 429, sleep 60–120s before attempting a new nonce. 5xx: retry. 401: get fresh nonce, re-sign once, retry. 403: stop (insufficient balance).
- **`GET /v1/challenge`** — 429/5xx: retry. 401: re-auth then retry. 403: stop (insufficient balance).
- **`POST /v1/submit`** — 429/5xx: retry. 401: re-auth, retry same solve. 404: stale challenge; discard solve, fetch new challenge. 200 `pass:false`: solver failed constraints (not transport).
- **`GET /v1/claim-calldata`** — 429/5xx: retry. 400: fix epoch input format.
- **`GET /v1/stake-approve-calldata`** — 429/5xx: retry. 400: use `amount` in base units (wei).
- **`GET /v1/stake-calldata`** — 429/5xx: retry. 400: use `amount` in base units (wei).
- **`GET /v1/unstake-calldata`** — 429/5xx: retry.
- **`GET /v1/withdraw-calldata`** — 429/5xx: retry.

**Concurrency:** Max 1 in-flight auth per wallet. Max 1 in-flight challenge per wallet. Max 1 in-flight submit per wallet. No tight loops or parallel spam retries.

**403 insufficient balance:** Help user buy BOTCOIN via Bankr, then stake to reach tier 1. **Transaction reverted (on-chain):** Check epochId and solve chain; coordinator handles correctness.

### Claim errors (transaction reverted)
- **EpochNotFunded**: The operator has not yet deposited rewards for that epoch. Poll `GET /v1/epoch` and try again later.
- **NoCredits**: You have no credits in that epoch (you didn't mine, or mined in a different epoch).
- **AlreadyClaimed**: You already claimed that epoch. Skip it.

### Staking errors (transaction reverted)
- **InsufficientBalance** / **NotEligible**: Stake more BOTCOIN to reach tier 1 (25M minimum).
- **NothingStaked**: No stake to unstake or withdraw. Stake first.
- **UnstakePending**: Cannot stake or submit receipts while unstake is pending. Cancel unstake or wait for cooldown and withdraw.
- **NoUnstakePending**: Cannot withdraw or cancel — no unstake was requested. Use unstake first.
- **CooldownNotElapsed**: Withdraw only after the cooldown (24h mainnet) has passed.

### Solve failures
- **Failed constraints after submit**: Request a **new challenge** with a different nonce. Do not retry the same challenge.
- **Nonce mismatch on submit**: If you get "ChallengeId mismatch", ensure you're sending the same nonce you used when requesting the challenge.
- **Consistent failures across many challenges**: If the LLM fails repeatedly after many different challenges, stop and inform the user. Suggest adjusting model selection or thinking budget — see the configuration notes in Step B.
- **Do NOT** loop indefinitely. Each attempt costs LLM credits.

### LLM provider errors (stop immediately, do not retry)
- **401 / 403 from LLM API**: Authentication or permissions issue. Stop and tell the user to check their API key.
- **API budget/billing errors** (e.g. "usage limits", "billing"): Stop and tell the user their LLM API credits are exhausted.

### LLM provider errors (retry with backoff)
- **429 from LLM API**: Rate limited. Wait 30-60 seconds, then retry.
- **529 / 5xx from LLM API**: Provider overloaded. Wait 30 seconds, then retry (up to 2 retries).
- **Timeout (no response after 5 minutes)**: The LLM call is stuck. Abort and retry. If it times out twice in a row, stop and tell the user.

### Bankr errors
- **401 from Bankr**: Invalid API key. Stop and tell user to check `BANKR_API_KEY`.
- **403 from Bankr**: Key lacks write/agent access. Stop and tell user to enable it at bankr.bot/api.
- **429 from Bankr**: Rate limited. Wait 60 seconds and retry.
- **Transaction failed**: Log the error and retry once. If it fails again, stop and report to user.
