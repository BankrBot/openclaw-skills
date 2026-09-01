#!/bin/bash
# rmesh-ask.sh — Ask the Signa Brain a question
# Usage: ./rmesh-ask.sh <question>

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"

QUESTION="${1:?Usage: rmesh-ask.sh <question>}"

echo "🧠 Asking Signa Brain: $QUESTION"
echo ""

RESULT=$(curl -s -X POST "${SIGNA_BASE}/api/brain" \
    -H "Content-Type: application/json" \
    -d "{\"goal\": $(python3 -c "import json; print(json.dumps('$QUESTION'))")}" 2>/dev/null)

echo "$RESULT" | python3 -c "
import sys, json

d = json.load(sys.stdin)
if not d.get('ok'):
    print(f'❌ Error: {d.get(\"error\", \"unknown\")}')
    sys.exit(1)

print(f'📝 Answer:')
print(f'   {d.get(\"answer\", \"no answer\")}')
print()

plan = d.get('plan', [])
if plan:
    print(f'🔧 Plan:')
    for step in plan:
        print(f'   • {step}')
    print()

tools = d.get('tools', [])
if tools:
    print(f'📊 Data Sources:')
    for tool in tools:
        cap = tool.get('cap', '?')
        output = tool.get('output', {})
        if isinstance(output, dict):
            summary = output.get('summary', str(output)[:100])
        else:
            summary = str(output)[:100]
        print(f'   • {cap}: {summary}')
    print()

verify = d.get('verify', {})
if verify:
    print(f'🔐 Signature: {d.get(\"signature\", \"\")[:40]}...')
    print(f'   Brain: {d.get(\"brain\", \"\")}')
    print(f'   Scheme: {verify.get(\"scheme\", \"\")}')
    print(f'   Verify: {verify.get(\"how\", \"\")}')
" 2>/dev/null
