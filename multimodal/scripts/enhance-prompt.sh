#!/bin/bash
#
# multimodal/scripts/enhance-prompt.sh
# Standalone powerful prompt enhancement engine (v1.5)
#
# Can be called independently to turn weak user prompts into
# production-grade prompts optimized for Grok Imagine, Flux, etc.
#
# Usage:
#   bash enhance-prompt.sh --prompt "a cat" --template cyberpunk --strength high

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROMPT=""
TEMPLATE="general"
STRENGTH="medium"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt|-p) PROMPT="$2"; shift 2 ;;
    --template|-t) TEMPLATE="$2"; shift 2 ;;
    --strength) STRENGTH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: enhance-prompt.sh -p 'your idea' [-t template] [--strength low|medium|high]"
      exit 0
      ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

[[ -z "$PROMPT" ]] && { log_error "--prompt required"; exit 1; }

print_header "PROMPT ENHANCER"

log_info "Original:  $PROMPT"
log_info "Template:  $TEMPLATE"
log_info "Strength:  $STRENGTH"

ENHANCED=$(enhance_prompt "$PROMPT" "$TEMPLATE")

# Extra strength layers
if [[ "$STRENGTH" == "high" ]]; then
  ENHANCED="$ENHANCED, masterpiece, best quality, intricate details, professional lighting, 8k resolution, sharp focus"
elif [[ "$STRENGTH" == "medium" ]]; then
  ENHANCED="$ENHANCED, highly detailed, sharp focus"
fi

echo ""
echo ">>> ENHANCED PROMPT (copy this)"
echo "$ENHANCED"
echo ""

NEGATIVE=$(get_negative_prompt)
echo ">>> RECOMMENDED NEGATIVE PROMPT"
echo "$NEGATIVE"

emit_json "$(cat <<JSON
{
  "action": "enhance_prompt",
  "original": "$(json_escape "$PROMPT")",
  "enhanced": "$(json_escape "$ENHANCED")",
  "negative": "$(json_escape "$NEGATIVE")",
  "template": "$TEMPLATE",
  "strength": "$STRENGTH"
}
JSON
)"

log_success "Prompt enhancement complete"
