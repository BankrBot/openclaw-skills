---
name: unfireable-safety-kernel
description: |
  Execution-time safety monitor that runs below the agent.
  The agent cannot override, bypass, or disable it.
  Blocks unauthorized transfers, prompt injection,
  blind signing, and key export attempts at runtime.
  Triggers: "protect this agent", "immutable safety layer",
  "prevent agent self-harm".
credentials: []
metadata:
  openclaw:
    requires:
      env: []
---

# Unfireable Safety Kernel

**A safety layer even the agent cannot disable. Free.**

## Commands

| Command | Response | Fee |
|---------|----------|-----|
| `protect <agent-session>` | kernel attached, monitoring active | Free |
| `status` | kernel health + recent blocks | Free |

## Install

```bash
bankr install unfireable-safety-kernel
```

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/unfireable-safety-kernel

## Upgrade

Need production-grade enforcement? → agent-safety-enforcer ($0.03/req)
