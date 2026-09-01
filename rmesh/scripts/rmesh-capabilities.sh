#!/bin/bash
# rmesh-capabilities.sh — List available Signa capabilities
# Usage: ./rmesh-capabilities.sh [capability_name]

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"

CAP="${1:-}"

if [ -n "$CAP" ]; then
    echo "🔧 Invoking capability: $CAP"
    echo ""
    
    RESULT=$(curl -s "${SIGNA_BASE}/api/capabilities/invoke?cap=${CAP}" 2>/dev/null)
    
    echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('ok'):
    print(f'❌ Error: {d.get(\"error\", \"unknown\")}')
    sys.exit(1)

print(f'📊 Result:')
output = d.get('output', {})
if isinstance(output, dict):
    for k, v in output.items():
        print(f'   {k}: {v}')
else:
    print(f'   {output}')
print()

verify = d.get('verify', {})
if verify:
    print(f'🔐 Signed by: {d.get(\"provider\", \"\")}')
    print(f'   Signature: {d.get(\"signature\", \"\")[:40]}...')
" 2>/dev/null
else
    echo "🔧 Available Signa Capabilities"
    echo ""
    
    RESULT=$(curl -s "${SIGNA_BASE}/api/capabilities" 2>/dev/null)
    
    echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('ok'):
    print('❌ Could not fetch capabilities')
    sys.exit(1)

builtins = d.get('builtins', [])
registered = d.get('registered', [])

print(f'Built-in ({len(builtins)}):')
for cap in builtins:
    name = cap.get('name', '?')
    desc = cap.get('description', '')[:60]
    provider = cap.get('provider', '?')
    print(f'  • {name}')
    print(f'    {desc}')
    print(f'    Provider: {provider}')
    print()

if registered:
    print(f'Registered ({len(registered)}):')
    for cap in registered:
        name = cap.get('name', '?')
        desc = cap.get('description', '')[:60]
        price = cap.get('price_usdc', 0)
        print(f'  • {name}')
        print(f'    {desc}')
        if price:
            print(f'    Price: \${price} USDC')
        print()
" 2>/dev/null
fi
