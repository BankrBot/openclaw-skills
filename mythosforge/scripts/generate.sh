#!/usr/bin/env bash
# generate.sh — MythosForge image generation: text prompt → image, via Replicate.
# Mirrors MythosForge's production image pipeline; supports multiple Replicate models.
#
# Usage:
#   REPLICATE_API_TOKEN=... ./generate.sh "<prompt>" [options]
#
# Options:
#   -m, --model NAME    flux-schnell | nano-banana-2 | retro-diffusion
#                       (default: flux-schnell — MythosForge's production default)
#   -o, --out FILE      Output image path (default: mythosforge-<timestamp>.<ext>)
#   -a, --aspect RATIO  square | landscape | portrait  (default: square)
#   -f, --format FMT    webp | png | jpg   (default: webp; coerced per model)
#   -h, --help          Show this help
#
# Models:
#   flux-schnell     fast, general (black-forest-labs/flux-schnell) — webp/png/jpg
#   nano-banana-2    high-quality, general (google/nano-banana-2)   — png/jpg, 2K
#   retro-diffusion  pixel-art / game assets (retro-diffusion/rd-plus) — png
#
# Requires: bash, curl, jq. Exits non-zero on any error (fail-closed).

set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }
usage() { sed -n '5,22p' "$0" | sed 's/^# \{0,1\}//'; }

# --- args --------------------------------------------------------------------
PROMPT=""; OUT=""; ASPECT="square"; FORMAT="webp"; MODEL="flux-schnell"
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--model)  MODEL="${2:?--model needs a value}"; shift 2;;
    -o|--out)    OUT="${2:?--out needs a path}"; shift 2;;
    -a|--aspect) ASPECT="${2:?--aspect needs a value}"; shift 2;;
    -f|--format) FORMAT="${2:?--format needs a value}"; shift 2;;
    -h|--help)   usage; exit 0;;
    --)          shift; break;;
    -*)          die "unknown option: $1";;
    *)           if [ -z "$PROMPT" ]; then PROMPT="$1"; else PROMPT="$PROMPT $1"; fi; shift;;
  esac
done

# --- preconditions (after parsing so --help never needs them) ----------------
command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq   >/dev/null 2>&1 || die "jq is required"
[ -n "${REPLICATE_API_TOKEN:-}" ] || \
  die "REPLICATE_API_TOKEN is not set (get one at https://replicate.com/account/api-tokens)"
[ -n "$PROMPT" ] || die "a text prompt is required (e.g. \"a neon cyberpunk fox\")"
case "$ASPECT" in square|landscape|portrait) :;; *) die "invalid --aspect: $ASPECT (square|landscape|portrait)";; esac
case "$FORMAT" in webp|png|jpg) :;; *) die "invalid --format: $FORMAT (webp|png|jpg)";; esac

# --- per-model adapter: sets SLUG, BODY, EXT ---------------------------------
# Each Replicate model has its own input schema; we map the shared
# prompt/aspect/format args onto each model's fields (verified from their llms.txt).
case "$MODEL" in
  flux-schnell)
    SLUG="black-forest-labs/flux-schnell"
    case "$ASPECT" in square) R="1:1";; landscape) R="16:9";; portrait) R="3:4";; esac
    EXT="$FORMAT"   # webp/png/jpg all supported
    BODY=$(jq -n --arg p "$PROMPT" --arg r "$R" --arg f "$EXT" \
      '{input:{prompt:$p, num_outputs:1, aspect_ratio:$r, output_format:$f, output_quality:85, go_fast:true}}')
    ;;
  nano-banana-2)
    SLUG="google/nano-banana-2"
    case "$ASPECT" in square) R="1:1";; landscape) R="16:9";; portrait) R="3:4";; esac
    EXT="$FORMAT"; [ "$EXT" = "webp" ] && EXT="png"   # nano-banana-2 supports png/jpg only
    BODY=$(jq -n --arg p "$PROMPT" --arg r "$R" --arg f "$EXT" \
      '{input:{prompt:$p, aspect_ratio:$r, resolution:"2K", output_format:$f}}')
    ;;
  retro-diffusion)
    SLUG="retro-diffusion/rd-plus"
    # rd-plus has no aspect_ratio — map aspect to a pixel-art canvas; output is PNG.
    case "$ASPECT" in square) W=256; H=256;; landscape) W=384; H=256;; portrait) W=256; H=384;; esac
    EXT="png"
    BODY=$(jq -n --arg p "$PROMPT" --argjson w "$W" --argjson h "$H" \
      '{input:{prompt:$p, style:"default", width:$w, height:$h}}')
    ;;
  *) die "invalid --model: $MODEL (flux-schnell|nano-banana-2|retro-diffusion)";;
esac

API="https://api.replicate.com/v1/models/$SLUG/predictions"
[ -n "$OUT" ] || OUT="mythosforge-$(date +%Y%m%d-%H%M%S).$EXT"

# --- submit (Prefer: wait often returns succeeded in one call) ---------------
RESP=$(curl -sS -w $'\n%{http_code}' -X POST "$API" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d "$BODY") || die "request to Replicate failed (network/curl)"
CODE=$(printf '%s' "$RESP" | tail -n1)
JSON=$(printf '%s' "$RESP" | sed '$d')
case "$CODE" in
  200|201) :;;
  *) die "Replicate ($MODEL) returned HTTP $CODE: $(printf '%s' "$JSON" | jq -r '.detail // .title // .' 2>/dev/null || printf '%s' "$JSON")";;
esac

st()  { printf '%s' "$1" | jq -r '.status // empty'; }
# output is an array of URLs (flux, rd-plus) or a single URL string (nano-banana-2)
url() { printf '%s' "$1" | jq -r 'if (.output|type)=="array" then (.output[0] // empty) else (.output // empty) end'; }

# --- poll until terminal -----------------------------------------------------
ST=$(st "$JSON"); URL=$(url "$JSON"); i=0
while [ "$ST" != "succeeded" ] && [ "$i" -lt 30 ]; do
  case "$ST" in
    failed|canceled) die "Replicate prediction $ST: $(printf '%s' "$JSON" | jq -r '.error // empty')";;
  esac
  GET=$(printf '%s' "$JSON" | jq -r '.urls.get // empty')
  [ -n "$GET" ] || die "prediction pending but no poll URL (status: ${ST:-unknown})"
  sleep 2
  JSON=$(curl -sS "$GET" -H "Authorization: Bearer $REPLICATE_API_TOKEN") || die "poll request failed"
  ST=$(st "$JSON"); URL=$(url "$JSON"); i=$((i+1))
done
[ "$ST" = "succeeded" ] || die "Replicate prediction did not succeed (status: ${ST:-timeout})"
[ -n "$URL" ] || die "no output URL in succeeded prediction"

# --- download ----------------------------------------------------------------
curl -sSL -o "$OUT" "$URL" || die "failed to download image"
[ -s "$OUT" ] || { rm -f "$OUT"; die "downloaded image was empty"; }

echo "✓ wrote $OUT (model: $MODEL, $ASPECT, $EXT, prompt: \"$PROMPT\")"
