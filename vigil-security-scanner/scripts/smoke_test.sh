#!/bin/bash
# Smoke test all VIGIL tools against the live endpoint
ENDPOINT="https://mcp.vigil.codes/tools/call"
USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
WETH="0x4200000000000000000000000000000000000006"
AERO="0x940181a94a35a4569e4529a3cdfb74e38fd98631"
VITALIK="0xd8da6bf26964af9d7eed9e03e53415d37aa96045"

call() {
    local name="$1"
    local args="$2"
    local label="$3"
    echo "── $label ──"
    local body
    body=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"%s","arguments":%s}}' "$name" "$args")
    local resp
    resp=$(curl -sS -m 45 -X POST "$ENDPOINT" -H "Content-Type: application/json" -d "$body")
    echo "$resp" | python3 -c "import sys,json
try:
    d = json.load(sys.stdin)
    if 'result' in d:
        print('OK')
        print(json.dumps(d['result'], indent=2)[:700])
    elif 'error' in d:
        print('ERROR')
        print(json.dumps(d['error'], indent=2)[:700])
    elif 'x402Version' in d or 'accepts' in d:
        accepts = (d.get('accepts') or [{}])[0]
        price = accepts.get('maxAmountRequired', '?')
        print('PAYMENT_REQUIRED (expected — x402 paid tool)')
        print('  price (USDC atomic units):', price)
        print('  resource:', accepts.get('resource', '?'))
    else:
        print('UNEXPECTED:', json.dumps(d)[:300])
except Exception as e:
    print('PARSE_FAIL:', e)
" 2>&1
    echo ""
}

call vigil_scan_approvals  "{\"wallet\":\"$VITALIK\",\"chain\":\"base\"}"  "1. scan_approvals (vitalik on base)"
call vigil_scan_token      "{\"token\":\"$USDC\",\"chain\":\"base\"}"      "2. scan_token (USDC base)"
call vigil_detect_honeypot "{\"token\":\"$USDC\",\"chain\":\"base\"}"      "3. detect_honeypot (USDC base)"
call vigil_safety_score    "{\"contract\":\"$USDC\",\"chain\":\"base\"}"   "4a. safety_score (USDC base)"
call vigil_safety_score    "{\"contract\":\"$WETH\",\"chain\":\"base\"}"   "4b. safety_score (WETH base)"
call vigil_safety_score    "{\"contract\":\"$AERO\",\"chain\":\"base\"}"   "4c. safety_score (AERO base)"
call vigil_wallet_report   "{\"wallet\":\"$VITALIK\",\"chain\":\"base\"}"  "5. wallet_report (vitalik)"
call vigil_monitor_wallet  "{\"wallet\":\"$VITALIK\",\"chain\":\"base\",\"lookback_blocks\":500}" "6. monitor_wallet (vitalik)"
