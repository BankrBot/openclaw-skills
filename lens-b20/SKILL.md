---
name: lens-b20
description: B20 token skill on Base via LENS. Use when an agent wants to create a B20 token (Base's native precompile token standard, shipped with the Beryl upgrade), validate a config with a live gas + admin-balance check plus a LENS rug-risk read on the config, build a complete ABI-encoded EIP-1559 deployment transaction, read any ERC-20 on Base, check wallet ETH balances, get current gas, or verify a tx receipt. No authentication required. Supports Base mainnet and Base Sepolia.
metadata:
  {
    "clawdbot": {
      "emoji": "\u25c9",
      "homepage": "https://lnsx.io/b20"
    }
  }
---

# LENS B20

Deploy and vet B20 tokens on Base — the native precompile token standard that ships with Base Beryl. ERC-20 compatible, role-gated, with compliance policies built in. No Solidity required.

Built by **LENS** (https://lnsx.io), the on-chain rug-risk scanner for Base. What makes this skill different: every config you `validate` or `prepare` also gets a **LENS read**, so you can see how the choices you make (retained admin, freeze, allowlist) would score on a public trust scan *before* you deploy.

All actions use real Base RPC calls — gas, nonces, and balances are fetched live from the chain, nothing is mocked. No auth, no API key.

## When to use

Use this skill when the user wants to:
- create / deploy a B20 token on Base, or build the deployment transaction for one
- check whether a token config looks safe (rug-risk / centralization read) before deploying
- read any ERC-20 on Base (name, symbol, decimals, supply, balances)
- check an address's ETH balance, current gas, or a transaction receipt

## How to use

Run the helper script with an action. Read-only actions (`info`, `gas`) take no body; the rest take a JSON payload.

```bash
# live chain status, gas, and the B20 standard overview
scripts/lens.sh info

# current EIP-1559 gas + B20 deploy cost estimate
scripts/lens.sh gas

# ETH (and optional ERC-20) balance for an address
scripts/lens.sh balance '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# read any ERC-20 on Base
scripts/lens.sh token_info '{"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}'

# validate a config: live admin-balance check + LENS rug-risk read
scripts/lens.sh validate '{"name":"LENS","symbol":"LENS","variant":"asset","decimals":18,"admin":"0x...","policies":{"freeze":true}}'

# build a full unsigned EIP-1559 deploy tx (live gas + nonce)
scripts/lens.sh prepare '{"name":"LENS","symbol":"LENS","variant":"asset","decimals":18,"supply_cap":"1000000000","admin":"0x...","network":"mainnet"}'

# check a deploy receipt + parse the new token address
scripts/lens.sh receipt '{"tx_hash":"0xabc...","network":"mainnet"}'
```

The script just wraps the public endpoint `https://lens-liard.vercel.app/api/b20-skill`, so any action can also be called directly with `curl` (see `references/lens-b20.md`).

## Safety

- This skill is **read-only by default**. `validate`, `prepare`, `token_info`, `balance`, `receipt`, `info`, and `gas` never move funds and never sign anything.
- `prepare` returns an **unsigned** transaction only. Signing and broadcasting is the user's decision and happens in their wallet, not here.
- B20 activates on Base mainnet with **Beryl on 25 Jun 2026, 18:00 UTC**. Before then you can `validate` and `prepare`, and deploy on **Base Sepolia** testnet. Only sign and broadcast on mainnet once B20 is live.

## LENS read

The `validate` and `prepare` responses include a `lensCheck` block with a **CLEAR / CAUTION** verdict. It flags a retained `admin` and a `freeze` policy as centralization risk, because that is how they score on a public LENS trust scan. For a token that reads CLEAR: no freeze, open transfers, and `adminless: true` (or renounce admin) once setup is done.

See `references/lens-b20.md` for the full action reference, token parameters, variants, compliance policies, and networks.
