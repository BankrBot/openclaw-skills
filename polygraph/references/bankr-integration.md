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

`A` and `B` are usable grades for read-only or low-value use; `D` and `F` are refusals by default
(`D` = unexpected egress, `F` = injection or leak). **For a signed action or a payment, require a
local `A`.** A **remote** server caps at `B` because its egress was never observed — so a remote `B`
is exactly the case where network exfiltration wasn't tested; don't route value through it without a
manual review. Use `PAYMENT_PASSING` (or `gateDecision(…, { requireEgressVerified: true })`) for that
path. Never skip the fingerprint check.

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

A self-minted grade is **forgeable**, so the bar scales with what Bankr is about to do.
`readAttestation` already binds to our EAS schema (fail-closed) and a fixed Base RPC, and
`gateDecision` checks revocation, expiry, and the server-ref + fingerprint binding. For a **signed
action or payment**, add: a grade whose **egress was actually verified** (a local `A`, not a
remote/no-sandbox `B`), an **attester allowlist**, and an **accepted methodology version** — or,
strongest, **re-run the harness yourself** and compare.

```ts
import { readAttestation, liveFingerprint, gateDecision, PAYMENT_PASSING } from "@polygraphso/litmus";

// Signers Bankr trusts to mint a grade (lowercased — the gate compares case-insensitively).
// This is polygraph's Base-mainnet attester; empty/omit ⇒ don't rely on the signature at all,
// re-run the harness (use case 1) before routing value instead.
const TRUSTED_ATTESTERS = new Set<string>(["0xa31f8bcbde4deb0dcd7f7252e5478505a9930b5d"]);

async function safeToPay(serverRef: string): Promise<boolean> {
  const attestation = await readAttestation(serverRef);   // EAS read: schema- + chain-bound, fail-closed
  if (!attestation) return false;

  const live = await liveFingerprint(serverRef);          // recompute current tool surface
  const decision = gateDecision(attestation, live, PAYMENT_PASSING, undefined, {
    requireEgressVerified: true,                          // exclude remote/no-sandbox B
    allowedAttesters: TRUSTED_ATTESTERS,                  // a forged grade from an unknown signer is refused
    acceptedMethodologyVersions: new Set(["litmus-v10"]),
  });                                                     // (revocation, expiry, fingerprint binding handled inside)
  return decision.action === "pay";
}

// Only let Bankr sign/pay once the upstream tool clears the value bar
if (await safeToPay("npm/@vendor/price-oracle-mcp")) {
  await bankr("swap $100 USDC to ETH on base");
} else {
  console.warn("Upstream MCP server failed the polygraph payment gate — refusing to execute.");
}
```

For read-only or low-value use, `gateDecision(attestation, live)` (default `{A,B}`, fingerprint
match) is enough — the extra options above are the value-routing bar.

### 3. Inline MCP verification

With the polygraph MCP server configured, the agent can verify before it acts:

```
verify_attestation { "serverRef": "npm/@polygraphso/litmus" }
→ { status: "attested", grade: "A", network: "base",
    attestationUid: "0xf8c4df0b59b6bad5601375abdd6ab9ca0d8a397519d996b6b7cc2fc2cde4ddf7",
    toolDefsFingerprint: "0x474c34713eb29bf537294173c85dd273c6d93a735b73c8226eccf970abf0bbd8",
    categories: { c01: "pass", c02: "pass", c03: "pass", c04: "pass" },
    resolvedVersion: "0.21.1",
    evidenceURI: "https://polygraph.so/grade/npm/@polygraphso/litmus?v=0.21.1",
    revoked: false }
```

That is a **live grade on Base mainnet** — polygraph's own MCP server, graded A (C-01–C-04 all
pass), attested by `0xa31f…30b5d`:
[view on easscan](https://base.easscan.org/attestation/view/0xf8c4df0b59b6bad5601375abdd6ab9ca0d8a397519d996b6b7cc2fc2cde4ddf7).
The evidence is content-addressed (`evidenceHash` = keccak256 of the canonical bundle at
`evidenceURI`), so you can re-hash it to verify the grade without trusting any server.

Then recompute the live fingerprint and only proceed if it equals `toolDefsFingerprint`. For a
payment, also confirm the attester is one you trust and that egress was verified (a local `A`), or
re-run the harness — the verify response alone is a forgeable, self-minted record.

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

`POLYGRAPH_API_URL` has HTTPS enforced (plain `http` only for `localhost`), so it isn't a MITM
vector — but point it only at the official endpoint or a mirror you control. An attacker-controlled
lookup endpoint can return fabricated grades, which is fatal for an execution decision.

## Best practices

1. **Verify before you execute.** Check the grade *and* the fingerprint before letting Bankr
   sign or pay through any server-derived data.
2. **Never trust a grade without the fingerprint match** — a graded-then-swapped server is the
   obvious attack.
3. **Scale the bar to the action.** Read-only/low-value: accept A/B. **Signed actions / payments:
   require a local A** (`PAYMENT_PASSING` / `requireEgressVerified`) — a remote B never had its
   egress observed.
4. **A self-minted grade is forgeable.** Before routing value, also require a trusted **attester**
   and an accepted **methodology version**, or re-run the open harness — the signature alone proves
   nothing; reproducibility does.
5. **Re-verify on change.** Cache by fingerprint; if the live fingerprint changes, re-gate.
6. **A skill grade is static, not behavioral.** It scans text and bundled files; it can't see a
   command built or fetched at runtime. Manually review any skill that runs install-time code or
   carries transaction instructions, regardless of its letter.
7. **Treat a pass as a measurement, not a guarantee.** It bounds risk; it does not remove it.
   Keep Bankr's own transaction-verification guards on.
