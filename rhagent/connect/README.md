# @rhwallet/connect

One-time Robinhood Agentic OAuth for Bankr users.

## Recommended — bundled (installed with rhagent skill)

```bash
node connect/bin/cli.js
```

Or pinned fallback:

```bash
RH_CONNECT_REF=08b17e327a122e1de9eaa6615e7b9cb2a340689e bash scripts/rh-connect.sh
```

Do **not** pipe unpinned remote scripts into bash.

Setup wizard: https://rhwallet-rhagent-production.up.railway.app/agentic/setup

## Manual (pinned)

```bash
git clone https://github.com/rhagent69/Rhagent.git
cd Rhagent && git checkout 08b17e327a122e1de9eaa6615e7b9cb2a340689e
cd skill/connect && node bin/cli.js
```

Run `bankr login` first so your token auto-saves to Bankr.

## Trust

Token is sent only to Bankr API (`api.bankr.bot/agent/env`). RH Wallet never stores it.
