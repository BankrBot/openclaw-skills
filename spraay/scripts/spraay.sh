#!/bin/bash
# spraay.sh — CLI for Spraay batch payments, x402 gateway, Bitcoin PSBT, and RTP
# Usage: ./spraay.sh <command> [args...]
# Docs: https://docs.spraay.app

GATEWAY="${SPRAAY_GATEWAY_URL:-https://gateway.spraay.app}"

case "$1" in

  # ─── Batch Payments ────────────────────────────────────────
  batch)
    # Usage: ./spraay.sh batch <chain> <token> <recipients_json>
    # Example: ./spraay.sh batch base USDC '[{"address":"0xABC...","amount":"100"},{"address":"0xDEF...","amount":"50"}]'
    curl -s -X POST "$GATEWAY/api/payments/batch" \
      -H "Content-Type: application/json" \
      -d "{\"chain\":\"$2\",\"token\":\"$3\",\"recipients\":$4}" | jq .
    ;;

  batch-csv)
    # Usage: ./spraay.sh batch-csv <chain> <token> <csv_file>
    curl -s -X POST "$GATEWAY/api/payments/batch-csv" \
      -F "chain=$2" \
      -F "token=$3" \
      -F "file=@$4" | jq .
    ;;

  tx-status)
    # Usage: ./spraay.sh tx-status <txHash>
    curl -s "$GATEWAY/api/payments/status/$2" | jq .
    ;;

  # ─── Bitcoin PSBT ──────────────────────────────────────────
  btc-fees)
    # Usage: ./spraay.sh btc-fees
    curl -s "$GATEWAY/api/bitcoin/fee-estimate" | jq .
    ;;

  btc-prepare)
    # Usage: ./spraay.sh btc-prepare <recipients_json> <feeRate> <changeAddr>
    # Example: ./spraay.sh btc-prepare '[{"address":"bc1q...","amount":50000}]' 12 bc1qchange...
    curl -s -X POST "$GATEWAY/api/bitcoin/batch-prepare" \
      -H "Content-Type: application/json" \
      -d "{\"recipients\":$2,\"feeRate\":$3,\"changeAddress\":\"$4\"}" | jq .
    ;;

  btc-broadcast)
    # Usage: ./spraay.sh btc-broadcast <signed_psbt>
    curl -s -X POST "$GATEWAY/api/bitcoin/batch-broadcast" \
      -H "Content-Type: application/json" \
      -d "{\"signedPsbt\":\"$2\"}" | jq .
    ;;

  btc-utxos)
    # Usage: ./spraay.sh btc-utxos <address>
    curl -s "$GATEWAY/api/bitcoin/utxos/$2" | jq .
    ;;

  # ─── Gateway Commands ──────────────────────────────────────
  ai)
    # Usage: ./spraay.sh ai <model> <prompt>
    curl -s -X POST "$GATEWAY/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"$2\",\"prompt\":\"$3\"}" | jq .
    ;;

  search)
    # Usage: ./spraay.sh search <query>
    curl -s -X POST "$GATEWAY/api/search/web" \
      -H "Content-Type: application/json" \
      -d "{\"query\":\"$2\"}" | jq .
    ;;

  email)
    # Usage: ./spraay.sh email <to> <subject> <body>
    curl -s -X POST "$GATEWAY/api/email/send" \
      -H "Content-Type: application/json" \
      -d "{\"to\":\"$2\",\"subject\":\"$3\",\"body\":\"$4\"}" | jq .
    ;;

  rpc)
    # Usage: ./spraay.sh rpc <chain> <method> [params_json]
    PARAMS="${4:-[]}"
    curl -s -X POST "$GATEWAY/api/rpc/$2" \
      -H "Content-Type: application/json" \
      -d "{\"method\":\"$3\",\"params\":$PARAMS}" | jq .
    ;;

  price)
    # Usage: ./spraay.sh price <pair>   (e.g., ETH/USDC)
    curl -s "$GATEWAY/api/oracle/price/$2" | jq .
    ;;

  gas)
    # Usage: ./spraay.sh gas <chain>
    curl -s "$GATEWAY/api/oracle/gas/$2" | jq .
    ;;

  ipfs-pin)
    # Usage: ./spraay.sh ipfs-pin <file>
    curl -s -X POST "$GATEWAY/api/ipfs/pin" \
      -F "file=@$2" | jq .
    ;;

  catalog)
    # Usage: ./spraay.sh catalog
    curl -s "$GATEWAY/api/bazaar/catalog" | jq .
    ;;

  # ─── Robot Task Protocol ───────────────────────────────────
  rtp-discover)
    # Usage: ./spraay.sh rtp-discover <capability> <lat,lng> [radius]
    RADIUS="${4:-10km}"
    curl -s "$GATEWAY/api/rtp/discover?capability=$2&location=$3&radius=$RADIUS" | jq .
    ;;

  rtp-commission)
    # Usage: ./spraay.sh rtp-commission <robotId> <task> <params_json>
    curl -s -X POST "$GATEWAY/api/rtp/commission" \
      -H "Content-Type: application/json" \
      -d "{\"robotId\":\"$2\",\"task\":\"$3\",\"params\":$4}" | jq .
    ;;

  rtp-status)
    # Usage: ./spraay.sh rtp-status <taskId>
    curl -s "$GATEWAY/api/rtp/status/$2" | jq .
    ;;

  rtp-cancel)
    # Usage: ./spraay.sh rtp-cancel <taskId>
    curl -s -X POST "$GATEWAY/api/rtp/cancel/$2" | jq .
    ;;

  rtp-capabilities)
    # Usage: ./spraay.sh rtp-capabilities
    curl -s "$GATEWAY/api/rtp/capabilities" | jq .
    ;;

  # ─── Escrow & Payroll ─────────────────────────────────────
  escrow-create)
    # Usage: ./spraay.sh escrow-create <chain> <token> <amount> <conditions_json>
    curl -s -X POST "$GATEWAY/api/escrow/create" \
      -H "Content-Type: application/json" \
      -d "{\"chain\":\"$2\",\"token\":\"$3\",\"amount\":\"$4\",\"conditions\":$5}" | jq .
    ;;

  payroll-create)
    # Usage: ./spraay.sh payroll-create <chain> <token> <schedule> <recipients_json>
    curl -s -X POST "$GATEWAY/api/payroll/create" \
      -H "Content-Type: application/json" \
      -d "{\"chain\":\"$2\",\"token\":\"$3\",\"schedule\":\"$4\",\"recipients\":$5}" | jq .
    ;;

  # ─── Help ──────────────────────────────────────────────────
  *|help)
    echo "spraay.sh — CLI for Spraay payment infrastructure"
    echo ""
    echo "Batch Payments:"
    echo "  batch <chain> <token> <recipients_json>       — Send batch payment"
    echo "  batch-csv <chain> <token> <csv_file>          — Batch from CSV"
    echo "  tx-status <txHash>                            — Check tx status"
    echo ""
    echo "Bitcoin PSBT:"
    echo "  btc-fees                                      — Current fee estimates"
    echo "  btc-prepare <recipients_json> <feeRate> <changeAddr>  — Prepare PSBT"
    echo "  btc-broadcast <signed_psbt>                   — Broadcast signed tx"
    echo "  btc-utxos <address>                           — Query UTXOs"
    echo ""
    echo "Gateway:"
    echo "  ai <model> <prompt>        — AI inference"
    echo "  search <query>             — Web search"
    echo "  email <to> <subj> <body>   — Send email"
    echo "  rpc <chain> <method>       — RPC call"
    echo "  price <pair>               — Price oracle"
    echo "  gas <chain>                — Gas oracle"
    echo "  ipfs-pin <file>            — Pin to IPFS"
    echo "  catalog                    — List all endpoints"
    echo ""
    echo "Robot Task Protocol:"
    echo "  rtp-discover <capability> <lat,lng>            — Find robots"
    echo "  rtp-commission <robotId> <task> <params_json>  — Hire a robot"
    echo "  rtp-status <taskId>                            — Check task status"
    echo "  rtp-cancel <taskId>                            — Cancel a task"
    echo "  rtp-capabilities                               — List capabilities"
    echo ""
    echo "Escrow & Payroll:"
    echo "  escrow-create <chain> <token> <amount> <conditions_json>"
    echo "  payroll-create <chain> <token> <schedule> <recipients_json>"
    echo ""
    echo "Environment:"
    echo "  SPRAAY_GATEWAY_URL  — Gateway URL (default: https://gateway.spraay.app)"
    echo ""
    echo "Docs: https://docs.spraay.app"
    echo "GitHub: https://github.com/plagtech"
    ;;
esac
