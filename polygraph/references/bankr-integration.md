# Polygraph + Bankr Integration Guide

## Overview

Polygraph is the **verify** layer; Bankr is the **execute** layer. Before a Bankr agent adds
an MCP server as a tool, routes a payment through it, or trusts its output, gate it through
its polygraph grade. Untrusted tool surfaces are exactly how an agent gets prompt-injected or
made to leak a key — polygraph turns "should I trust this server?" into a checkable fact.

```
┌──────────────────────────────────────────────────────────────┐
│                          Your Agent                            │
├──────────────────────────────────────────────────────────────┤
│   ┌─────────────┐                 ┌─────────────┐              │
│   │  Polygraph  │     Verify      │    Bankr    │   Execute    │
│   │   Skill     │ ───────────────▶│    Skill    │ ───────────▶ │
│   └─────────────┘                 └─────────────┘              │
│         │                               │                      │
│         ▼                               ▼                      │
│   • Look up grade (A–F)          • Swaps / transfers           │
│   • Verify onchain attestation   • Stop-loss / DCA             │
│   • Recompute live fingerprint   • Token launches              │
│   • gate: pay / refuse           • Any signed action           │
└──────────────────────────────────────────────────────────────┘
```

## The core rule: fingerprint must match

A grade is only valid for the exact tool surface it was measured against. An attestation binds
the grade to a `toolDefsFingerprint`. **Before trusting a server, recompute its live
fingerprint and require it to equal the attested one.** If they differ, the server changed
after it was graded — treat it as ungraded and refuse. This is the built-in rug-pull check.

`A` and `B` are usable grades; `D` and `F` are refusals by default (`D` = unexpected egress,
`F` = injection or leak). Pick your own threshold, but never skip the fingerprint check.

## Use cases

### 1. Gate a new MCP tool before your agent adds it

```bash
REF="npm/@some-vendor/their-mcp-server"

# Run the harness (or use `polygraphso check $REF` for a published grade)
GRADE=$(npx -y -p @polygraphso/litmus polygraphso-litmus litmus "$REF" --json | jq -r '.grade')

case "$GRADE" in
  A|B) echo "✓ $REF graded $GRADE — safe to wire up" ;;
  *)   echo "✗ $REF graded $GRADE — do NOT add as a tool"; exit 1 ;;
esac
```

`litmus` exits non-zero on D/F, so in CI you can also just let the exit code gate the step.

### 2. Verify-then-execute (the agent gate)

```ts
import { readAttestation, liveFingerprint, gateDecision } from "@polygraphso/litmus";

async function safeToUse(serverRef: string): Promise<boolean> {
  const attestation = await readAttestation(serverRef);   // onchain EAS record on Base
  if (!attestation || attestation.revoked) return false;

  const live = await liveFingerprint(serverRef);          // recompute current tool surface
  const decision = gateDecision(attestation, live);       // checks grade + fingerprint match
  return decision.action === "pay";
}

// Only let Bankr act once the upstream tool is verified
if (await safeToUse("npm/@vendor/price-oracle-mcp")) {
  await bankr("swap $100 USDC to ETH on base");
} else {
  console.warn("Upstream MCP server failed polygraph gate — refusing to execute.");
}
```

### 3. Inline MCP verification

With the polygraph MCP server configured, the agent can verify before it acts:

```
verify_attestation { "serverRef": "npm/@vendor/price-oracle-mcp" }
→ { status: "attested", grade: "A", attestationUid: "0x…", toolDefsFingerprint: "0x…", revoked: false, network: "base" }
```

Then recompute the live fingerprint and only proceed if it equals `toolDefsFingerprint`.

## MCP configuration (Polygraph + Bankr)

```json
{
  "mcpServers": {
    "polygraph": {
      "command": "npx",
      "args": ["-y", "-p", "@polygraphso/litmus", "polygraphso-litmus-mcp"],
      "env": { "POLYGRAPH_API_URL": "https://polygraph.so" }
    },
    "bankr": {
      "command": "npx",
      "args": ["bankr-mcp-server"],
      "env": { "BANKR_API_KEY": "bk_..." }
    }
  }
}
```

## Best practices

1. **Verify before you execute.** Check the grade *and* the fingerprint before letting Bankr
   sign or pay through any server-derived data.
2. **Never trust a grade without the fingerprint match** — a graded-then-swapped server is the
   obvious attack.
3. **Pick a threshold and enforce it.** Default: accept A/B, refuse D/F; decide C-as-reserved
   per your risk tolerance.
4. **Re-verify on change.** Cache by fingerprint; if the live fingerprint changes, re-gate.
5. **Treat a pass as a measurement, not a guarantee.** It bounds risk; it does not remove it.
   Keep Bankr's own transaction-verification guards on.
