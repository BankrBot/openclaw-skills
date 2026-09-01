# Morv CLI Reference

Binary: `morv` via `npx morv` or global `@morv/cli`.

Config: `.morv/config.json` (API keys, agents, installed tools).

## Setup & Auth

```bash
npx morv init                    # Interactive setup + agent.morv.ts example
npx morv login --key mv_...        # Save Morv API key from morv.run
npx morv setup                     # Update model / Morv keys
```

## Agents

```bash
npx morv agent create dca-bot \
  --daily 200 \
  --per-tx 50 \
  --tools base-x402-discovery,base-web-scraper \
  --provider groq \
  --model llama-3.3-70b-versatile

npx morv agent list
```

## Run

```bash
npx morv run "Scan Base pools and DCA if ETH dips 3%"
npx morv run -a dca-bot "Aggregate x402 DeFi data"
npx morv run -t base-x402-discovery --input '{"query":"defi"}'
```

## MCP Tools

```bash
npx morv add base-x402-discovery
npx morv tools search defi
npx morv tools list
```

## AgentGuard

```bash
npx morv guard status dca-bot
npx morv guard pause dca-bot
npx morv guard resume dca-bot
npx morv guard history dca-bot -n 20
npx morv guard policy              # Print default policy JSON
npx morv monitor dca-bot -i 5      # Live budget watch (5s refresh)
```

## Billing (hosted)

```bash
npx morv billing usage
npx morv billing statement
```

Default API: `https://api.morv.run`
