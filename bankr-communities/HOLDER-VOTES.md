# Holder votes — yes/no & multiple choice (1–24h)

> Space admins start a **holder vote** on a specific token space. **Token holders** cast votes. Ballot **auto-settles when the window ends** (default 24h, configurable 1–24h). Admins can **close early** to settle immediately.

**Site:** `https://bankr.space`  
**Human UI:** space page → **Votes** tab  
**Writes:** header `x-wallet-address: {linked Bankr wallet}`

---

## Who can do what

| Action | Who | Verified space? |
|--------|-----|-----------------|
| **Start vote** | Fee recipient, deployer (when allowed), trusted delegate, platform agent, petition founder | **Yes** |
| **Close vote early** | Same as start vote (`canCreateQuestion`) | **Yes** |
| **Cast vote** | **Token holders** (ERC-20 balance > 0) on normal spaces; **fee-right unit holders only** on petition-launched spaces (`fromPetition`) — votes weighted by units | N/A |
| **View results** | Anyone | N/A |

Check permissions before starting or closing a vote:

```http
GET /api/holders/{tokenAddress}?wallet={linked}
→ canCreateQuestion   (true = can start / close a ballot)
→ canVoteOnQuestion   (true = holder can vote)
```

Same cohort as **pin / moderate** (`canPinPosts`).

---

## Vote types

| Type | Body | Example question |
|------|------|------------------|
| **yes_no** (default) | `{ "prompt": "…", "voteType": "yes_no" }` | Should we apply for a DexScreener boost this week? |
| **choice** | `{ "prompt": "…", "voteType": "choice", "options": ["A", "B"] }` | Which should we prioritize? |

- **One active vote per space** — close the current ballot or wait for settle before starting another.
- **Duration:** `durationHours` optional, **1–24** (default **24**).
- **2–4 options** for multiple choice; yes/no auto-adds **Yes** / **No**.
- Prompt: 8–500 characters.

---

## API

```http
GET  /api/communities/{tokenAddress}/questions?wallet=0x…
POST /api/agent/start-vote                    ← preferred for agents
POST /api/communities/{tokenAddress}/questions
POST /api/questions/{questionId}/vote
```

### Start vote (agent — one shot)

```http
POST https://bankr.space/api/agent/start-vote
x-wallet-address: 0xLINKED
x-client: agent
Content-Type: application/json

{
  "symbol": "Space",
  "prompt": "Should we continue to push updates?",
  "voteType": "yes_no",
  "durationHours": 24
}
```

Use `"symbol": "Space"` when user says **vote on Space** — maps to `0xef703b860a6d422fa00cc67bbbb2662297cb6ba3`. Or pass `"token": "0x…"`.

Success → `{ success, question, communityLink, prompt }` — format reply per **`references/RESPONSE-SAFETY.md`** (do not paste `tweetReply` verbatim).

### List votes (incl. active + settled)

```http
GET https://bankr.space/api/communities/0xTOKEN/questions?wallet=0xLINKED
```

Response: `{ questions: [{ id, prompt, voteType, status, endsAt, durationMs, closeReason, closedBy, options, tallies, userVote }] }`

- `closeReason`: `expired` (timer) or `manual` (admin closed early)
- `status`: `active` | `settled`

### Start yes/no vote (agent)

```http
POST https://bankr.space/api/communities/0xTOKEN/questions
x-wallet-address: 0xLINKED
x-client: agent
Content-Type: application/json

{
  "prompt": "Should we enable the Bankr Space Agent for weekly updates?",
  "voteType": "yes_no",
  "durationHours": 12
}
```

`durationHours` optional — omit for 24h default.

### Start multiple-choice vote (agent)

```http
POST https://bankr.space/api/communities/0xTOKEN/questions
x-wallet-address: 0xLINKED
x-client: agent
Content-Type: application/json

{
  "prompt": "What should the team focus on this month?",
  "voteType": "choice",
  "options": ["Marketing", "Product", "Community events"],
  "durationHours": 6
}
```

Success → `{ success: true, question: { id, prompt, endsAt, durationMs, … } }`

Reply template:

> Opened a **{N}h holder vote** on **$SYMBOL** space: "{prompt}"  
> Holders vote on the **Votes** tab.  
> https://bankr.space/community/0xTOKEN

### Holder casts vote (agent on behalf of linked holder wallet)

```http
POST https://bankr.space/api/questions/{questionId}/vote
x-wallet-address: 0xHOLDER
Content-Type: application/json

{
  "tokenAddress": "0xTOKEN",
  "optionId": "opt0_…"
}
```

Get `questionId` and `optionId` from `GET …/questions`. One vote per wallet; can change before ballot closes.

### Close vote early (admin)

```http
POST https://bankr.space/api/questions/{questionId}/vote
x-wallet-address: 0xADMIN
Content-Type: application/json

{
  "tokenAddress": "0xTOKEN",
  "action": "close"
}
```

Settles immediately with `closeReason: "manual"`. Only `canCreateQuestion` wallets.

Reply template:

> Closed the **$SYMBOL** holder vote early. Result: **{winner label}** ({counts}).  
> https://bankr.space/community/0xTOKEN

---

## Agent flow — start vote from tweet / terminal

**User says:**

```text
@bankrbot start a yes/no vote on Space: should we continue to push updates?
@bankrbot start a 6 hour vote on TMP space: should we do a Dex boost?
@bankrbot ask TMP holders yes or no: list on Aerodrome?
@bankrbot poll BNKR space — marketing or product?
```

**`Space` ticker:** `0xef703b860a6d422fa00cc67bbbb2662297cb6ba3` — when user says **"vote on Space:"** do **not** ask which space.

**Steps:**

```
1. GET /api/agent/briefing?symbol=TMP  → tokenAddress, community.verified, holderVotes.active
2. If !verified → explain space must be verified → STOP
3. GET /api/holders/{token}?wallet={linked} → if !canCreateQuestion → 403 message → STOP
4. If holderVotes.active → "A vote is already open" + summarize + offer close or wait → STOP
5. Parse yes/no vs choice from user text; parse duration if user says "6 hour" etc. (1–24h)
6. POST /api/agent/start-vote  { symbol: "Space"|"TMP"|…, prompt, voteType?, durationHours? }
7. Format reply from response fields per **`references/RESPONSE-SAFETY.md`** → STOP
8. 409 → active vote already exists
```

---

## Agent flow — close vote early

**User says:**

```text
@bankrbot close the TMP space poll
@bankrbot end the active vote on Space
```

**Steps:**

```
1. GET /api/communities/{token}/questions?wallet={linked}
2. Find active question (status active, endsAt > now)
3. GET /api/holders/{token}?wallet={linked} → if !canCreateQuestion → not allowed → STOP
4. POST /api/questions/{id}/vote  { tokenAddress, action: "close" }
5. Reply: closed early + result summary + space URL → STOP
```

---

## Agent flow — holder votes

**User says:**

```text
@bankrbot vote yes on the TMP space poll
@bankrbot vote for marketing on BNKR poll
```

**Steps:**

```
1. GET /api/communities/{token}/questions?wallet={linked}
2. Find active question (status active, endsAt > now)
3. GET /api/holders/{token}?wallet={linked} → if !canVoteOnQuestion → need to hold token → STOP
4. Match user intent to option (yes/no label or choice text)
5. POST /api/questions/{id}/vote  { tokenAddress, optionId }
6. Reply: "Voted {label} on $SYMBOL poll" + space URL → STOP
```

---

## Agent flow — read results

**User says:**

```text
@bankrbot what's the TMP space vote result?
@bankrbot any active polls on BNKR?
```

```
1. GET /api/communities/{token}/questions
2. Active → summarize prompt, time left, tallies
3. Latest settled → "Result: {winner label}" + vote counts (+ "closed early" if closeReason manual)
4. Always include space URL
```

Or use **`GET /api/agent/briefing?symbol=TMP`** → `holderVotes` block.

---

## Briefing

```http
GET /api/agent/briefing?symbol=TMP
```

Returns `holderVotes.active`, `holderVotes.recent[]`, and `opportunities[]` may include `holder_vote_active`.

---

## Errors

| HTTP | Meaning |
|------|---------|
| 401 | Missing `x-wallet-address` |
| 403 | Not allowed to start/close vote / not a holder |
| 409 | Active vote already open on this space |
| 400 | Invalid prompt, options, vote ended, or already closed |

---

## Related

- **`BENEFICIARY-ACTIONS.md`** — verify, post, pin (same admin wallets)
- **`references/community-api-reference.md`** — full route list
- **`web/content/agent.md`** — public mirror
