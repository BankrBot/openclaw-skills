---
name: bankr-router
description: Local smart routing layer for Bankr LLM Gateway traffic. Use when explaining or installing Bankr Router, switching auto/eco/premium profiles, configuring OpenClaw providers, verifying routing, or debugging router/Bankr model issues.
repository: https://github.com/tachikomared/bankr-router
---

# Bankr Router (OpenClaw plugin skill)

## Summary
Bankr Router is a **local smart router** that sits in front of the **Bankr LLM Gateway**. You can find the source code and latest releases here: [https://github.com/tachikomared/bankr-router](https://github.com/tachikomared/bankr-router)

It does **not** replace Bankr. It chooses **which model/profile to use** before requests go to Bankr, then forwards the request upstream.

**Benefits:**
- Lower cost by default (route simpler prompts to cheaper models).
- Better fallback behavior and retries.
- Local control over routing policy.
- Clear visibility into planned vs final vs upstream model selection.
- Easy profile switching: **auto / eco / premium**.

---

## When to use
- You want cheaper default routing without changing app code.
- You want a local routing layer in front of Bankr.
- You need retries/fallbacks + observability.
- You want predictable behavior for **auto / eco / premium** modes.
- You prefer local plugin control over hosted routing.

---

## What this skill can help with
Use this skill to:
- Explain what Bankr Router is and why it matters.
- Explain tradeoffs between auto / eco / premium.
- Install the plugin locally.
- Configure OpenClaw provider entries.
- Verify the router is active.
- Switch routing modes.
- Troubleshoot common errors.
- Identify when agent overrides bypass the router.
- Explain stats/health endpoints.
- Explain **dry-run vs real execution** (`/v1/route` vs `/v1/chat/completions`).

---

## Prerequisites
- Node.js (20+ recommended)
- OpenClaw installed and running
- Bankr provider configured via:
  ```bash
  bankr llm setup openclaw --install
  ```
- Local repo path may differ from examples
- OpenClaw config path may differ (common: `~/.openclaw/openclaw.json`)

---

## Install (step-by-step)

### 1) Build the plugin
```bash
cd /path/to/openclawbankrrouter
npm install
npm run build
```

### 2) Add plugin entry to OpenClaw config
Edit your OpenClaw config (commonly `~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/openclawbankrrouter"]
    },
    "entries": {
      "bankr-router": {
        "enabled": true,
        "config": {
          "host": "127.0.0.1",
          "port": 8787,
          "openclawConfigPath": null,
          "bankrProviderId": "bankr",
          "routerProviderId": "bankr-router"
        }
      }
    }
  }
}
```

### 3) Add the router provider to models.providers
```json
{
  "models": {
    "providers": {
      "bankr-router": {
        "baseUrl": "http://127.0.0.1:8787/v1",
        "apiKey": "local-router"
      }
    }
  }
}
```

### 4) Set default agent model to the router
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr-router/auto",
        "fallbacks": ["bankr-router/eco"]
      }
    }
  }
}
```

### 5) Restart the gateway
```bash
openclaw gateway restart
```

---

## Verify
Run these exact checks:

### Health check
```bash
curl http://127.0.0.1:8787/health
```

### Ensure models exist
```bash
openclaw models list | grep bankr-router
```

### Dry-run routing (no real upstream call)
```bash
curl http://127.0.0.1:8787/v1/route \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
```

### Real execution (upstream call)
```bash
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{"model":"bankr-router/auto","messages":[{"role":"user","content":"say ok"}]}'
```

---

## Mode switching
**auto** = balanced smart routing (default)
**eco** = cheapest practical routing
**premium** = highest quality routing

### Switch default model (OpenClaw config)
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr-router/eco",
        "fallbacks": ["bankr-router/auto"]
      }
    }
  }
}
```
Restart gateway after changing defaults:
```bash
openclaw gateway restart
```

---

## How to explain this to a user (agent-ready)
Use these short explanations:

**What is Bankr Router?**
> It’s a local routing layer in front of Bankr that picks the right model before the request goes upstream.

**Why do I need it?**
> It lowers cost, improves fallback behavior, and gives you local control over model selection.

**When should I use eco?**
> Use eco when cost is the top priority and you’re fine with “good enough” quality.

**Does this replace Bankr?**
> No. Bankr Router only routes requests; Bankr still runs the models.

**Does this make inference free?**
> No. It only reduces cost by routing simpler prompts to cheaper models.

**What does the skill do for me?**
> It installs, configures, verifies, and explains the router + its modes and debugging steps.

---

## Troubleshooting

### Unknown model `bankr-router/auto`
- Ensure `models.providers.bankr-router` exists.
- Ensure agent allowlists (if any) include `bankr-router/*`.
- Restart the gateway after config change.

### Plugin not loaded
- Verify the repo path is in `plugins.load.paths`.
- Ensure `plugins.entries.bankr-router.enabled = true`.
- Rebuild: `npm run build`.

### Port already in use
- Router default port is **8787**. Change `plugins.entries.bankr-router.config.port` or stop the conflicting process.

### Gateway restart loop
- Check config JSON is valid.
- Check `openclawConfigPath` if auto-discovery fails.

### Requests bypass router
- An agent or tool may be **overriding its model**.
- Check `agents.defaults.model` and per-agent `model` overrides.

### Planned vs final model confusion
- **plannedModel** = initial route decision
- **finalModel** = model that actually succeeded
- **upstreamModel** = model returned by Bankr

### Streaming issues
- Test non-stream first (`/v1/chat/completions` without `stream=true`).
- Ensure router and gateway are on the same machine or low-latency network.

### Wrong OpenClaw config path
Set explicit path:
```json
{
  "plugins": {
    "entries": {
      "bankr-router": {
        "config": {
          "openclawConfigPath": "/absolute/path/to/openclaw.json"
        }
      }
    }
  }
}
```

### Bankr provider missing
- Run: `bankr llm setup openclaw --install`
- Ensure `models.providers.bankr` exists and has an API key.

### Model exists in `/v1/route` but not in `/v1/chat/completions`
- `/v1/route` is dry-run only. Real execution requires valid Bankr credentials.

---

## Useful commands (ops)
```bash
# build
npm run build

# restart gateway
openclaw gateway restart

# router health
curl http://127.0.0.1:8787/health

# router stats/diagnostics (if enabled)
curl http://127.0.0.1:8787/v1/diagnostics

# list models
openclaw models list | grep bankr-router

# tail gateway logs
journalctl --user -u openclaw-gateway.service -n 50 --no-pager
