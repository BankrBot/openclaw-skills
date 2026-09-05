---
name: clash-of-perps-ai-agent
description: Play and manage Clash of Perps through the hosted MCP server. Use when an agent needs to collect resources, build or upgrade a base, manage ships and troops, reinforce casualties, or plan and execute AI battles with live browser playback.
tags: [gaming, mcp, ai-agent, strategy]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://mcp.clashofperps.fun/skills.md"
---
# Clash of Perps AI Agent Skill

Use this skill to operate a player's Clash of Perps account through MCP tools. Prefer the MCP tools over raw HTTP calls or UI scraping. Each write tool updates game state and notifies any open browser so the player can watch AI actions live.

## Connection

- Hosted MCP endpoint: `https://mcp.clashofperps.fun/mcp`
- Local test MCP endpoint: `http://127.0.0.1:4100/mcp`
- Skill document: `https://mcp.clashofperps.fun/skills.md`
- Auth header: `Authorization: Bearer <cop_ai_key>`
- The player creates and revokes `cop_ai_...` keys in Profile -> AI Agent.

Treat the `cop_ai_...` key as a secret. Do not print it back to the user, commit it, or include it in logs.

## Operating Loop

1. Call `get_base_state` first. Inspect resources, caps, buildings, ships, production, troop levels, and catalog.
2. Collect production with `collect_resources` before spending.
3. Make one change at a time, then inspect the returned state or call `get_base_state` again.
4. Prefer economy stability: keep storage/caps healthy, keep mine and sawmill upgraded, and avoid spending the last resources without a clear goal.
5. Keep one attack path usable: port -> ship -> loaded troops -> reinforce after casualties.

## Grid Rules

- `grid_index: 0` is the main island body. Use it for every base building except `port`.
- `grid_index: 1` is the side coast/port grid. Use it only for `port`.
- `grid_index: 2` is the front attack/deployment space. Never place base buildings there.
- On `grid_index: 0`, prefer returned slots with `grid_z >= 4`; the front edge is reserved for approach and visual spacing.
- Always call `find_build_slots` before `place_building`. Do not guess open cells.

## Base Management Tools

- `get_base_state({ include_catalog?: boolean })`: inspect the full current base. Start here.
- `get_building_catalog()`: inspect building costs, footprints, unlocks, troop definitions, and grid rules.
- `collect_resources({ building_id? })`: collect one producer, or all mines/sawmills when `building_id` is omitted.
- `find_build_slots({ type, grid_index?, limit? })`: get valid open cells for a building.
- `place_building({ type, grid_x, grid_z, grid_index? })`: place a building. Use grid 0 for normal buildings and grid 1 for ports.
- `upgrade_building({ building_id })`: upgrade an owned building by id.
- `move_building({ building_id, grid_x, grid_z, grid_index? })`: move a building. Ports with docked ships cannot be moved.
- `remove_building({ building_id })`: remove one owned building.
- `upgrade_troop({ troop_type })`: upgrade `knight`, `mage`, `barbarian`, `archer`, or `ranger`.

## Ships And Troops

- `buy_ship({ port_id })`: buy a ship at an owned port.
- `load_ship_troop({ port_id, troop_name })`: load one troop into the ship. Valid troops are `Knight`, `Mage`, `Barbarian`, `Archer`, and `Ranger`.
- `swap_ship_troop({ port_id, slot, troop_name })`: replace one troop slot without changing the reinforcement template.
- `unload_ship_troops({ port_id })`: remove the ship loadout.
- `reinforce_ships()`: restore missing troops from templates after battle. Cost is 50 gold per restored troop.

After every battle, inspect casualties and call `reinforce_ships` when the player has enough gold.

## Attack Workflow

Use `execute_ai_attack_plan` for battles. It finds an enemy, validates the complete replay server-side, settles victory or defeat, stores the battle log, removes casualties, and broadcasts `AI ONLINE BATTLE` to any currently open browser.

The MCP server allows one AI battle per player per minute. If the tool returns a cooldown error, wait for the cooldown instead of retrying repeatedly.

Default smart attack:

```json
{}
```

Calling `execute_ai_attack_plan` with an empty request uses `auto_tactics: true`. The server inspects the matched enemy, chooses landing slots, targets defensive towers with cannon shots, and uses a rally marker only when it helps.

Manual attack shape:

```json
{
  "auto_tactics": true,
  "ships": [
    { "ship_index": 0, "slot": 1, "t": 0.2 },
    { "ship_index": 1, "slot": 2, "t": 0.55 }
  ],
  "cannon_shots": [
    { "target_type": "strongest_defense", "t": 4.0 },
    { "target_type": "weakest_defense", "t": 5.1 }
  ],
  "rally_marker": {
    "target_type": "tombstone",
    "t": 5.0,
    "flight_time": 0.8
  }
}
```

## Attack Best Practices

- Call `get_attack_slots` before a manual attack. It returns 5 stable ship slots (`0..4`) spread along the attack line.
- Prefer a focused landing. For 1-3 ships, use neighboring slots closest to valuable or exposed buildings. For 4-5 ships, widen the group but keep one attack front.
- Split pressure only when defenses heavily cover one side. For example, use slots `0` and `4` for two ships, or `0`, `2`, and `4` for three.
- Cannon shots are support fire. Target `turret` and `archer_tower`, not the Town Hall.
- Valid cannon selectors include `strongest_defense`, `weakest_defense`, `turret`, and `archer_tower`. If the enemy has no defensive towers, omit cannon shots.
- Rally marker is a focus command, not damage. Use it after ships are landing, usually around `t: 5.0`, on a nearby non-Town-Hall objective such as `tombstone` or a blocking economy/storage building.
- Avoid dragging troops directly into a turret with the rally marker unless there is no safer useful objective.
- Cannon and marker effects land on impact, not at launch. Keep marker `flight_time` around `0.6-1.2`.

## Common User Requests

- "Collect my resources": call `get_base_state`, then `collect_resources({})`.
- "Build an archer tower": call `get_base_state`, `find_build_slots({ "type": "archer_tower", "grid_index": 0 })`, then `place_building`.
- "Upgrade sawmill to level 2": find the sawmill in `get_base_state`, then call `upgrade_building` until it reaches level 2 or resources run out.
- "Find an enemy and attack": confirm a loaded ship exists, then call `execute_ai_attack_plan({})`.
- "Recover after battle": call `get_base_state`, inspect ships/casualties, then `reinforce_ships`.

## Safety Rules

- Never use `grid_index: 2` for base construction.
- Never target the Town Hall with cannon shots.
- Never assume a building id. Read it from `get_base_state`.
- Never spam `execute_ai_attack_plan`; respect the one-minute cooldown.
- Do not promise live playback if the player's browser is closed. The battle is still stored in the battle log.
- If a tool rejects an action, inspect the error and current base state before trying a different action.
