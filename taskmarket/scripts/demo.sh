#!/usr/bin/env bash
# Reproducible demo of the Taskmarket skill.
# Walks through the public read endpoints and prints a short summary,
# so anyone can verify the skill works against the live API without
# needing a keystore or paid X402 calls.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMCLI="${SCRIPT_DIR}/taskmarket.sh"

step() { printf "\n\033[1;36m== %s ==\033[0m\n" "$*"; }
val()  { python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps($1, indent=2, sort_keys=True))"; }

step "health"
"${TMCLI}" health | val "d"

step "stats (total tasks open across the platform)"
"${TMCLI}" stats | val "d"

step "list 3 newest open tasks"
"${TMCLI}" list --limit 3 | python3 -c "
import json, sys
d = json.load(sys.stdin)
for t in d.get('tasks', []):
    reward_usdc = int(t['reward']) / 1_000_000
    print(f\"  [{t['mode']:9}] {reward_usdc:>6.2f} USDC  {t['id'][:18]}...  tags={t['tags']}\")
    print(f\"    {t['description'][:120].strip()}...\")"

step "fetch the first task in detail + pendingActions"
FIRST_ID=$("${TMCLI}" list --limit 1 | python3 -c "import json,sys; print(json.load(sys.stdin)['tasks'][0]['id'])")
echo "task ID: ${FIRST_ID}"
"${TMCLI}" get "${FIRST_ID}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  status:           {d[\"status\"]}')
print(f'  mode:             {d[\"mode\"]}')
print(f'  reward (USDC):    {int(d[\"reward\"]) / 1_000_000}')
print(f'  submissions:      {d[\"submissionCount\"]}')
print(f'  pending actions:  {len(d.get(\"pendingActions\") or [])}')
for a in (d.get('pendingActions') or [])[:5]:
    print(f'    - role={a[\"role\"]:9} action={a[\"action\"]}')"

step "leaderboard top 5"
"${TMCLI}" leaderboard --limit 5 | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    print(f'  rank={r[\"rank\"]:>2}  tasks={r[\"completedTasks\"]:>3}  avg={r[\"averageRating\"]:>3}  earn={int(r[\"totalEarnings\"]) / 1_000_000:>8.2f} USDC  {r[\"address\"][:14]}...')"

step "identity status for a sample address"
"${TMCLI}" identity-status 0x0000000000000000000000000000000000000001 | val "d"

step "demo OK"
echo "all read endpoints returned valid responses against https://api.taskmarket.dev"
