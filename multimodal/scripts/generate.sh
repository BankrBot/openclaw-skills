#!/bin/bash
#
# multimodal/scripts/generate.sh
# Powerful generation orchestrator for the multimodal skill (v1.5)
#
# Features:
# - Robust argument parsing (long + short options)
# - Built-in style templates with automatic prompt enhancement
# - Meme text overlay support
# - Multiple output formats (human, json, command, all)
# - Variation generation
# - Ready-to-paste bankr skill commands
# - High-quality prompt engineering
#
# This script remains thin — it does NOT call paid APIs itself.
# It prepares excellent prompts and tells the agent exactly how to
# execute generation using the core `bankr` skill + x402.

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Defaults
PROMPT=""
TEMPLATE="general"
ASPECT="1:1"
COUNT=2
STYLE=""
TOP_TEXT=""
BOTTOM_TEXT=""
NEGATIVE=""
OUTPUT_MODE="all"
DO_VARIATIONS=false

# Parse arguments (supports both --long and -short)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt|-p)             PROMPT="$2"; shift 2 ;;
    --template|-t)           TEMPLATE="$2"; shift 2 ;;
    --aspect|-a)             ASPECT="$2"; shift 2 ;;
    --count|-c)              COUNT="$2"; shift 2 ;;
    --style|-s)              STYLE="$2"; shift 2 ;;
    --top-text)              TOP_TEXT="$2"; shift 2 ;;
    --bottom-text)           BOTTOM_TEXT="$2"; shift 2 ;;
    --negative)              NEGATIVE="$2"; shift 2 ;;
    --output|-o)             OUTPUT_MODE="$2"; shift 2 ;;
    --variations)            DO_VARIATIONS=true; shift 1 ;;
    -h|--help)               print_generate_usage; exit 0 ;;
    *)                       log_error "Unknown argument: $1"; print_generate_usage; exit 1 ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  log_error "--prompt is required"
  print_generate_usage
  exit 1
fi

print_header "GENERATE"

log_info "Base prompt:     $PROMPT"
log_info "Template:        $TEMPLATE"
log_info "Aspect ratio:    $ASPECT"
log_info "Count:           $COUNT"
[[ -n "$STYLE" ]]       && log_info "Extra style:     $STYLE"
[[ -n "$TOP_TEXT" ]]    && log_info "Meme top text:   $TOP_TEXT"
[[ -n "$BOTTOM_TEXT" ]] && log_info "Meme bottom:     $BOTTOM_TEXT"

# === Prompt Engineering ===
BASE_ENHANCED=$(enhance_prompt "$PROMPT" "$TEMPLATE")

if [[ -n "$STYLE" ]]; then
  FINAL_PROMPT="$BASE_ENHANCED, $STYLE"
else
  FINAL_PROMPT="$BASE_ENHANCED"
fi

# Handle meme text
if [[ -n "$TOP_TEXT$ BOTTOM_TEXT" ]]; then
  MEME_HINT=""
  [[ -n "$TOP_TEXT" ]] && MEME_HINT+=" Top text: \"$TOP_TEXT\"."
  [[ -n "$BOTTOM_TEXT" ]] && MEME_HINT+=" Bottom text: \"$BOTTOM_TEXT\"."
  FINAL_PROMPT="${FINAL_PROMPT}. Meme format with bold white text${MEME_HINT}"
fi

NEGATIVE_PROMPT="${NEGATIVE:-$(get_negative_prompt)}"

log_success "Enhanced prompt ready"

# === Variations (simple but effective) ===
VARIATIONS_JSON="[]"
if $DO_VARIATIONS; then
  VARIATIONS=(
    "$FINAL_PROMPT, different angle, dramatic side lighting"
    "$FINAL_PROMPT, close-up portrait, shallow depth of field"
    "$FINAL_PROMPT, wide establishing shot, environmental storytelling"
    "$FINAL_PROMPT, vibrant color grade, filmic look"
  )
  VARIATIONS_JSON=$(printf '%s\n' "${VARIATIONS[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  log_info "Generated 4 creative variations"
fi

# === Output ===
case "$OUTPUT_MODE" in
  human|all)
    echo ""
    echo ">>> ENHANCED PROMPT (use this)"
    echo "$FINAL_PROMPT"
    echo ""
    echo ">>> NEGATIVE PROMPT"
    echo "$NEGATIVE_PROMPT"
    echo ""

    echo ">>> RECOMMENDED BANKR SKILL COMMAND (copy-paste ready)"
    echo ""
    cat <<CMD
Use the bankr skill to generate ${COUNT} image(s) using the best available Grok Imagine or Flux x402 endpoint.

Prompt: "$FINAL_PROMPT"
Aspect ratio: $ASPECT
Number of images: $COUNT
Negative prompt: "$NEGATIVE_PROMPT"
CMD

    if [[ -n "$TOP_TEXT$BOTTOM_TEXT" ]]; then
      echo "Meme text overlays included in prompt above."
    fi

    echo ""
    echo "After results appear, ask the user which one(s) they like."
    echo "Then run:"
    echo "  bash /skills/multimodal/scripts/mint.sh --image <chosen-url> --name \"...\" --description \"...\""
    echo ""
    ;;

  json|command)
    ;;
esac

# === Structured JSON Output (most powerful for agents) ===
JSON_PAYLOAD=$(cat <<JSON
{
  "action": "generate_images_via_bankr",
  "version": "1.5",
  "template": "$(json_escape "$TEMPLATE")",
  "original_prompt": "$(json_escape "$PROMPT")",
  "enhanced_prompt": "$(json_escape "$FINAL_PROMPT")",
  "negative_prompt": "$(json_escape "$NEGATIVE_PROMPT")",
  "aspect_ratio": "$ASPECT",
  "count": $COUNT,
  "meme_text": {
    "top": "$(json_escape "$TOP_TEXT")",
    "bottom": "$(json_escape "$BOTTOM_TEXT")"
  },
  "recommended_models": ["grok-imagine", "flux"],
  "variations": $VARIATIONS_JSON,
  "next_steps": [
    "Execute the bankr command shown above",
    "Present generated images to the user",
    "If user approves any for minting, call mint.sh"
  ],
  "suggested_mint_command_example": "bash /skills/multimodal/scripts/mint.sh --image <url> --name \"My PFP\" --description \"...\""
}
JSON
)

if [[ "$OUTPUT_MODE" == "json" || "$OUTPUT_MODE" == "all" ]]; then
  emit_json "$JSON_PAYLOAD"
fi

# Command-only mode still shows the important command
if [[ "$OUTPUT_MODE" == "command" ]]; then
  echo "BANKR_COMMAND:"
  cat <<CMD
Use the bankr skill to generate ${COUNT} image(s) using the best Grok Imagine or Flux x402 endpoint with this exact prompt: "$FINAL_PROMPT". Aspect: $ASPECT. Count: $COUNT. Negative: "$NEGATIVE_PROMPT".
CMD
fi

log_success "generate.sh completed successfully"
