---
name: peer
description: Use Peer's official CLI and MCP server to query Peer protocol data, onramp an agent wallet from fiat, or prepare custody-separated Peer Cash transactions. Trigger on Peer, ZKP2P, fiat onramp, fiat offramp, agent wallet funding, Peer Cash, peer-protocol-cli, or mcp.peer.xyz.
---

# Peer

Use the official Peer agent interface on Base. Start with read-only authority,
then move to a local profile only when the job needs transaction preparation.

## Choose the smallest authority

| Surface | Use it for | Authority |
| --- | --- | --- |
| Hosted MCP | Quotes, protocol state, market data, checkout reads, and Peer Cash reads | Read-only; no signing material |
| Local CLI | JSON-first shell workflows and preview-first protocol writes | Reads execute; writes preview unless explicitly confirmed |
| Local `cash` MCP | Preparing unsigned Peer Cash transactions | Never accepts private keys, signs, or broadcasts |
| Local `full` MCP | Complete operator surface | Keep writes preview-first |

## Connect

For an MCP client, connect the safe hosted default:

```text
https://mcp.peer.xyz/mcp
```

Check its public health endpoint before relying on it:

```bash
curl -fsS https://mcp.peer.xyz/health
```

For CLI or local MCP workflows, use the released npm package. Do not install the
unrelated `peer-cli` package.

```bash
npx -y peer-protocol-cli@0.3.1 --help
npx -y peer-protocol-cli@0.3.1 mcp --profile read-only
```

Use `--profile cash` for unsigned Peer Cash plans and `--profile full` only for
the complete local operator surface.

## Fund an agent wallet

1. Read live liquidity and quote data; do not assume a payment platform,
   currency, rate, or amount bound.
2. Build the onramp intent as a preview first.
3. Show the destination wallet, fiat amount, USDC amount, payment method, and
   expected effect to the user.
4. Execute only after the user approves that exact plan.
5. Read the resulting intent and onchain state before retrying an uncertain
   submission.

Example quote:

```bash
npx -y peer-protocol-cli@0.3.1 quote \
  --from USD \
  --amount 100 \
  --platform wise
```

Inspect `peer intent --help` for the current preview and execution flags rather
than inventing parameters from memory.

## Prepare a Peer Cash order

1. Use the local `cash` profile and read live payout capabilities.
2. Request an estimate, clearly treating it as an estimate rather than a locked
   rate.
3. Prepare the ordered unsigned transactions.
4. Verify Base chain `8453`, token, amount, destination, value, calldata purpose,
   and expected effect.
5. Ask the user to approve the exact plan before a host wallet signs or
   broadcasts anything.
6. After confirmation, resolve the transaction receipt into a durable order and
   read it back before reporting success.

## Safety

- Never send a private key, seed phrase, signer token, or wallet file to the
  hosted MCP server.
- Keep shared agents on the hosted or local read-only profile.
- Never start `full` with automatic execution enabled in a shared agent.
- Treat every write as a preview until the user approves its exact target,
  amount, and effect.
- On timeout or unknown submission status, inspect the named transaction and
  current Peer state before any retry.

Official docs: <https://agents.peer.xyz>
