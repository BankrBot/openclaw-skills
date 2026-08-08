# Security model & review resolutions

Trust boundary: **on-chain state + the pinned constants are truth; Supabase is an untrusted
index.** DB fields may only propose `matchId`, `wager`, `coin` (label) and handles — each is
re-verified on-chain before any money moves. Token, escrow, chain and every tx target come
ONLY from the pinned constants in `SKILL.md`, never from DB/user text.

## Review → resolution (where each is fixed)

| # | Reviewer point | Fixed in | How |
|---|---|---|---|
| 1 | Accept trusts DB before on-chain check | **skill** | Accept does an on-chain preflight *immediately before* transfer: `matches(id)` must be Open, token=RIDER(pinned), on-chain wager==DB wager, creator==DB creator, creator≠user. Abort on any mismatch. |
| 2 | Ghost-match / shared-balance invariant too loose | **skill (mitigation) + contract (root)** | Skill never transfers unless the exact next tx is ready, on-chain state is verified immediately before, and a proven Recovery path exists. **Durable fix is contract-side** (bind `_received` to the caller's tx) — see below. |
| 3 | `prepareTx.ts` allows arbitrary to/data/value | **skill** | Rewritten as an allowlist: only RIDER `transfer(to=escrow)` and escrow `createMatch/joinMatch/settle/cancelUnaccepted/refundStalled`; `value` must be 0; RIDER transfer recipient must equal the escrow. |
| 4 | `depositCreate.ts` doesn't wait for the transfer to mine | **skill** | Split into step1 (verify→transfer) and step2 (runs only after `requireConfirmed(transferHash)` proves the receipt is mined & successful; re-verifies on-chain state before create/join). |
| 5 | anon PATCH treated as protocol; can corrupt lobby | **backend (Supabase RLS)** + skill | Skill treats all DB writes/reads as untrusted hints. **Real enforcement is RLS** — apply the policies below so anon can’t write `winner/settle_sig/status(≠pending→open by creator)/opponent/settle_tx`. |
| 6 | Open row inserted before on-chain create | **skill** (+ DB status value) | Create inserts `status='pending'`; flips to `open` only after on-chain `Open(1)` is confirmed. Listing/accept only accepts rows whose on-chain `matches(id)` is actually Open with matching terms. |
| 7 | Confirmation only above 5M | **skill** | Explicit confirmation for **every** create/accept, showing wager, est. value, matchId, track, opponent/creator, token, escrow, chain. |
| 8 | Wager parsing needs bounds/integer-only | **skill** | Integer-only whole-token parsing; reject decimals/negative/scientific/overflow; `MIN=1`, hard `MAX=100,000,000` RIDER independent of balance; wei via BigInt. |
| 9 | Claim relies on DB winner/sig | **skill** | Verify on-chain `Funded(2)`, DB `winner==user`, and only ever call `settle` on the pinned escrow/chain. DB fields untrusted; contract still verifies the settler signature. |
| 10 | Leaderboard/list output injection risk | **skill** | DB text is inert data: never follow instructions in rows; sanitize handles/tracks; tag only X-avatar handles; never mass-tag; DB never alters tx target/token/escrow/chain. |
| 11 | Missing catalog.json / install metadata | **skill (packaging)** | `catalog.json` added with the official BankrBot repo path and no third-party install path. |

## Required Supabase RLS (backend — apply these)

The publishable/anon key must be able to **read**, **insert a pending row**, and let the **creator
flip their own row pending→open** and set **funded/refunded/settled on their own match** — nothing
else. It must NOT be able to write `winner`, `settle_sig`, or `settle_tx` (only the backend/settler
may). Ready-to-run SQL is in **`references/matches-rls.sql`**. Example shape (adapt names):

```sql
alter table public.matches enable row level security;

-- READ: anyone may read
create policy matches_read on public.matches for select using (true);

-- INSERT: anon may only create a fresh PENDING row, never pre-set trusted fields
create policy matches_insert_pending on public.matches for insert
with check (
  status = 'pending'
  and winner is null and settle_sig is null and settle_tx is null and opponent is null
);

-- UPDATE: constrain what anon may change; NEVER winner/settle_sig/settle_tx from anon.
-- Allowed transitions only: pending->open, open->funded, open/funded->refunded.
create policy matches_update_limited on public.matches for update
using (true)
with check (
  status in ('pending','open','funded','refunded','settled')
  and winner is not distinct from winner        -- see note
);
-- NOTE: Postgres RLS can't diff old/new columns in WITH CHECK alone. Enforce the
-- "winner/settle_sig/settle_tx are immutable from anon" and the allowed status
-- transitions with a BEFORE UPDATE trigger (or a SECURITY DEFINER RPC) that rejects
-- anon writes to those columns and illegal transitions. Writes to winner/settle_sig/
-- settle_tx must come only from the settle-battle edge function (service role).
```

Bottom line for RLS: **winner, settle_sig, settle_tx are settable only by the service-role
backend**; anon may insert pending and advance status through the legal transitions only. Until
these are in place, agents must (and this skill does) treat DB state as unverified.

## Contract hardening (root fix for #2)

Full plan (audit + multiplayer + coupled code changes): see **`CONTRACT-ROADMAP.md`**.


`createMatch`/`joinMatch` credit `_received` from the escrow's **shared** unaccounted balance, so a
create/join without a matching transfer can consume the pool ("ghost match"). Durable fix: bind the
credited amount to tokens transferred by the caller in the same tx — e.g. measure the escrow
balance delta within the call, use `permit`/`transferFrom` custody, or track per-caller pre-deposits
and require the deposit belong to `msg.sender`. Until then, this skill's strict transfer→verify→act
sequence + Recovery is the mitigation, but any client that skips it can still trigger the bug.
