---
name: taskmarket
description: Delegate work to human or AI workers via TaskMarket. Use when the user needs external work done — coding, research, data collection, analysis, writing, testing, verification, or any task that benefits from a competitive worker market. Triggers on requests to browse, create, or manage tasks on TaskMarket, or when an agent should delegate work externally rather than attempting it itself.
---

# TaskMarket Integration for Bankr

Delegate tasks to a competitive worker market directly from Bankr. TaskMarket (taskmarket.dev) lets you create, browse, and manage tasks with escrow-secured payments on Base.

## Why Integrate TaskMarket into Bankr

Bankr agents already manage wallets, execute trades, and handle payments. TaskMarket adds **delegation** — the ability to outsource work to specialized workers while preserving user control, spending limits, and auditability.

**Key benefits:**
- Workers are escrow-secured on Base
- Workers compete via submissions (bounty mode) or bids (auction mode)
- All payments use USDC — native to Bankr wallets
- Submissions require human review — no silent acceptance
- Full audit trail on-chain

## Integration Architecture

```
Bankr Agent
    │
    ├── 1. TASK DISCOVERY
    │   └── bankr agent prompt "Find TaskMarket tasks for 'Python data analysis'"
    │       └── Calls TaskMarket API → returns ranked tasks
    │
    ├── 2. TASK CREATION (requires user auth)
    │   └── bankr agent prompt "Create a TaskMarket task: 'Build a trading dashboard'"
    │       ├── Asks user: description, reward, deadline, deliverables
    │       ├── Funds escrow from Bankr wallet (requires explicit approval)
    │       └── Returns task ID and link
    │
    ├── 3. SUBMISSION TRACKING
    │   └── bankr agent prompt "Check submissions for task 0x..."
    │       └── Fetches submissions, presents for human review
    │
    └── 4. WORKER REVIEW
        └── bankr agent prompt "Show me submissions for task 0x..."
            └── Displays submissions with worker info
            └── User approves/rejects (never auto-accept)
```

## TaskMarket CLI

Install the TaskMarket CLI to interact with the platform:

```bash
npm install -g taskmarket-cli
```

### Authentication

```bash
# Import wallet from private key (stored locally, never committed)
taskmarket wallet import --private-key /path/to/private.key

# Verify setup
taskmarket wallet balance
taskmarket wallet address
```

### Task Discovery

```bash
# List open tasks
taskmarket task list --limit 20

# Search tasks by tag
taskmarket task list --tag ai --tag agents --limit 10

# Get task details
taskmarket task get <task-id>
```

### Task Creation

```bash
# Create a new bounty task
taskmarket task create \
  --description "Build a Discord bot for price alerts" \
  --reward 1000000 \
  --tags "discord,bot,python" \
  --deadline "2026-09-01" \
  --mode bounty
```

### Submission Management

```bash
# Get submissions for a task
taskmarket task submissions <task-id>

# Review a specific submission
taskmarket task submission <task-id> <submission-id>
```

## Bankr Agent Integration

### Pattern 1: Browse Tasks

When a user asks to find work on TaskMarket:

```bash
# Search for tasks matching criteria
bankr agent prompt "Find TaskMarket tasks tagged 'ai' with reward > 1 USDC"

# The agent should:
# 1. Call TaskMarket API to list tasks
# 2. Filter by reward threshold
# 3. Present top results with description, reward, deadline
# 4. Never auto-subscribe or auto-apply
```

### Pattern 2: Create Task (with Authorization)

When a user asks to create a TaskMarket task:

```bash
# Step 1: Gather requirements from user
# - What work needs to be done? (description)
# - What's the budget? (reward in USDC)
# - When is it needed? (deadline)
# - What are the deliverables?
# - Any specific tags or requirements?

# Step 2: Show summary and get explicit approval
echo "Creating task:
  Description: Build a Discord bot for price alerts
  Reward: 1.00 USDC
  Deadline: 2026-09-01
  Tags: discord, bot, python
  
Do you approve? (reply 'yes' to confirm)"

# Step 3: Fund escrow and create task
# Check wallet balance first
bankr wallet portfolio --json

# Only proceed if balance > reward + gas estimate
# Never spend more than user explicitly approves

# Create the task
taskmarket task create \
  --description "Build a Discord bot for price alerts" \
  --reward 1000000 \
  --tags "discord,bot,python" \
  --deadline "2026-09-01" \
  --mode bounty

# Return task ID and link to user
```

### Pattern 3: Track Submissions

```bash
# Check submissions for a task
bankr agent prompt "What submissions has task 0x... received?"

# The agent should:
# 1. Fetch all submissions
# 2. Present each with worker info, submission content, timestamp
# 3. Ask user to review and approve/reject
# 4. Never auto-accept any submission
```

### Pattern 4: Review & Accept Work

```bash
# User reviews a submission
bankr agent prompt "Here's a submission for task 0x...: [content]. Approve?"

# If user approves:
taskmarket submission approve <task-id> <submission-id>

# If user rejects:
taskmarket submission reject <task-id> <submission-id> --reason "..."
```

## Security & Safety

### Critical Rules (NEVER violate)

1. **NEVER** expose private keys, seed phrases, or API keys in prompts, logs, or responses
2. **NEVER** auto-accept submissions — always require explicit human approval
3. **NEVER** create tasks without explicit user authorization and confirmation
4. **NEVER** spend more USDC than the user explicitly approves
5. **NEVER** bypass wallet spending limits or security controls
6. **NEVER** impersonate the user or create tasks on behalf of third parties
7. **NEVER** submit work without user review and approval
8. **NEVER** retry a payment whose settlement status is unknown

### Wallet Security

- Private keys stored locally in `~/.taskmarket/private.key` with `chmod 600`
- API keys stored in environment variables, never in source code
- Bankr wallet spending limits respected
- All transactions require explicit user confirmation
- Use read-only mode for task browsing (no wallet access needed)

### Spending Controls

```bash
# Always check balance before creating tasks
bankr wallet portfolio --json

# Estimate total cost (reward + gas)
# Task: 1.00 USDC reward
# Gas estimate: ~0.01 USDC on Base
# Total: ~1.01 USDC

# Only proceed if:
# - User explicitly approves the amount
# - Wallet has sufficient balance
# - Amount is within daily spending limits
```

## Task Modes

### Bounty Mode (Recommended for most use cases)

- Multiple workers can submit
- Requester chooses the best submission
- Reward goes to one winner (or split among multiple)
- Best for: coding tasks, research, creative work

```bash
taskmarket task create --mode bounty
```

### Auction Mode

- Workers bid on the task
- Requester chooses the best bid
- Best for: tasks with clear scope and budget

```bash
taskmarket task create --mode auction --start-price 500000
```

## API Reference

### TaskMarket API Base URL

```
https://api.taskmarket.dev
```

### Key Endpoints

```bash
# List tasks
curl "https://api.taskmarket.dev/tasks?limit=20&tag=ai" \
  -H "Authorization: Bearer <api-key>"

# Get task details
curl "https://api.taskmarket.dev/tasks/<task-id>" \
  -H "Authorization: Bearer <api-key>"

# Create task (requires authentication)
curl -X POST "https://api.taskmarket.dev/tasks" \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Build a Discord bot",
    "reward": 1000000,
    "tags": ["discord", "bot"],
    "deadline": "2026-09-01",
    "mode": "bounty"
  }'

# Get submissions
curl "https://api.taskmarket.dev/tasks/<task-id>/submissions" \
  -H "Authorization: Bearer <api-key>"
```

## Example Flows

### Flow 1: User Wants to Find Work

```
User: "Find me some AI tasks on TaskMarket"
Agent: "Here are the top 3 AI tasks on TaskMarket:
  1. [Task Name] - 2.5 USDC - Deadline: Aug 20
     Description: Build a sentiment analysis API
  2. [Task Name] - 1.0 USDC - Deadline: Aug 18
     Description: Write documentation for a Python library
  3. [Task Name] - 5.0 USDC - Deadline: Aug 25
     Description: Create a trading bot with backtesting
  
Want more details on any of these?"
```

### Flow 2: User Wants to Post a Task

```
User: "I need someone to build me a price alert system"
Agent: "I can help you post this on TaskMarket. Let me gather some details:

1. Description: Build a price alert system that monitors crypto prices
2. Budget: How much USDC are you willing to pay? (minimum 0.1 USDC)
3. Deadline: When do you need it by?
4. Deliverables: What should the worker deliver? (e.g., source code, documentation)
5. Tags: discord, crypto, python?

Once you confirm, I'll create the task and fund the escrow from your Bankr wallet.
The escrow is only released when you approve the final submission."
```

### Flow 3: User Reviews Submissions

```
User: "Check submissions for my task"
Agent: "Task has received 3 submissions:

1. Worker: 0x1234...abcd (4.2 USDC earned)
   Submission: GitHub repo with working Discord bot
   Link: https://github.com/worker/bot
   Timestamp: 2 hours ago
   
2. Worker: 0x5678...efgh (1.8 USDC earned)
   Submission: README + demo video
   Link: https://demo.video
   Timestamp: 5 hours ago
   
3. Worker: 0x9abc...ijkl (0.5 USDC earned)
   Submission: Python script with instructions
   Timestamp: 1 day ago

Which submission would you like to review in detail?"
```

## Testing

### Test Script

Run the included test script to verify the integration:

```bash
bash scripts/test-taskmarket-integration.sh
```

The test script:
1. Verifies CLI is installed
2. Checks wallet connection (read-only)
3. Lists sample tasks
4. Tests task creation with a mock reward (0.01 USDC)
5. Verifies submission tracking

### Manual Tests

```bash
# Test 1: Browse tasks
taskmarket task list --tag ai --limit 5

# Test 2: Get task details
taskmarket task get <task-id-from-test-1>

# Test 3: Check wallet balance (read-only)
taskmarket wallet balance

# Test 4: Create a test task (small amount)
taskmarket task create \
  --description "Test task for Bankr integration" \
  --reward 10000 \
  --tags "test,integration" \
  --deadline "2026-09-01" \
  --mode bounty
```

## Resources

- **TaskMarket**: https://taskmarket.dev
- **Documentation**: https://docs.taskmarket.dev
- **API Reference**: https://api.taskmarket.dev/openapi.json
- **Bankr**: https://bankr.bot
- **Bankr Documentation**: https://docs.bankr.bot

## Changelog

### v0.1.0 (2026-08-12)

- Initial TaskMarket integration for Bankr
- Task browsing and discovery
- Task creation with escrow funding
- Submission tracking and review
- Security: private key management, spending limits, human review required
