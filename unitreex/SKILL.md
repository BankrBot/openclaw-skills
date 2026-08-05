---
name: unitreex
description: >-
  Control a real Unitree G1 humanoid robot with natural language. Send
  commands like "wave hello", "shake hands", or "sit down" and the agent
  translates them into safe, whitelisted actions on physical hardware via the
  user's bridge server. The bridge owns all safety — FSM gating, battery
  checks, and a hard action whitelist — so the agent can ask, but never make
  the robot do anything unsafe. Use when the user wants to move, control, or
  check on their Unitree humanoid robot, or mentions their robot bridge.
  Triggers: "wave on my robot", "tell my Unitree to sit", "robot battery",
  "shake hands G1", "make the robot dance/stand/walk", "unitree".
emoji: 🦾
tags: [robotics, unitree, humanoid, hardware, real-world, embodied-ai]
visibility: public
---

# UnitreeX — Unitree Humanoid Skill

You control a **real Unitree humanoid robot** through a small bridge server
the user runs on the robot's local network. You do **not** talk to the robot
directly — you only ever call the bridge's HTTP API. The bridge owns all
safety: it will reject unsafe actions, so trust its responses.

## Setup (tell the user, once)

To use this skill the user must provide:

1. `BRIDGE_URL` — the public URL from their tunnel (cloudflared/ngrok).
2. `BRIDGE_TOKEN` — the secret bearer token configured on the bridge.

Every request includes the header: `Authorization: Bearer <BRIDGE_TOKEN>`.

If the user hasn't set up a bridge yet, point them to
https://github.com/richard7463/unitree-skill — the bridge runs in mock mode
with no hardware, so they can wire the full path before the robot arrives.

## How to handle a user request

1. **Map** the user's natural language to exactly one action name from the
   whitelist below. If nothing matches, tell the user what the robot *can* do.
2. **Check state first** for any motion/pose change: call `GET /state`. If the
   robot is not `ready` (fsm != `balance_stand`) and the user asked for
   movement, first issue `balance_stand`, then the action.
3. **Send** `POST /command` with `{"action": "<name>"}`.
4. **Report** results in a crisp style, e.g.:
   > done on your Unitree: waved hello 👋 — robot was balance-standing, battery 87%.
5. If the bridge returns HTTP **422**, it *refused* the action for safety.
   Read `message`, explain plainly, and suggest the fix (e.g. "battery too low",
   "robot is sitting — say 'stand up' first"). Never retry a refused action
   without addressing the reason.
6. If the action is marked **dangerous**, ask the user to confirm, then resend
   with `{"action": "<name>", "confirm": true}`.

## Endpoints

### `GET /state`
Returns `{ fsm, battery, ready, mock }`. Call before motion.

### `GET /actions`
Returns the live whitelist with per-action requirements. Source of truth if in
doubt.

### `POST /command`
Body: `{ "action": string, "confirm"?: boolean }`
Success (200): `{ ok: true, action, message, state }`
Refused (422): `{ ok: false, action, message, state }`

## Action whitelist

| Say something like… | action | Notes |
|---|---|---|
| "wave", "say hi", "wave hello" | `wave` | needs standing |
| "shake hands", "give me a handshake" | `shake_hand` | needs balance stand |
| "nod", "say yes", "nod your head" | `nod` | needs standing; gesture-only |
| "stand up", "get up" | `stand_up` | from sit/damp |
| "get ready", "balance", "steady" | `balance_stand` | required before walking |
| "sit down", "take a seat" | `sit` | |
| "stand tall", "rise up" | `high_stand` | |
| "crouch", "get low" | `low_stand` | |
| "walk forward", "come here", "step forward" | `walk_forward` | needs ready + battery ≥30% |
| "turn around", "spin" | `turn` | needs ready + battery ≥30% |
| "relax", "soften", "damp" | `damp` | safe soft state |
| "go limp", "release" | `zero_torque` | **dangerous** — must be supported; confirm required |

## Example interactions

**User:** wave hello to everyone
→ `GET /state` → ready
→ `POST /command {"action":"wave"}`
→ "done on your Unitree: waved hello 👋 (battery 86%)."

**User:** come here
→ `GET /state` → fsm `sit`, not ready
→ `POST /command {"action":"stand_up"}` → then `{"action":"balance_stand"}`
→ `POST /command {"action":"walk_forward"}`
→ "stood up, balanced, and walked forward. battery 84%."

**User:** go limp
→ dangerous → "That makes the robot go completely limp — make sure it's
supported. Confirm?" → on yes → `POST /command {"action":"zero_torque","confirm":true}`

## Safety contract

- Never invent actions outside the whitelist.
- Never bypass a 422 refusal.
- Always surface battery / state to the user when reporting.
- For anything involving walking or falling risk, prefer confirming with the
  user if context is ambiguous.
