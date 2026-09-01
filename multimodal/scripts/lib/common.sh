#!/bin/bash
#
# multimodal/scripts/lib/common.sh
# Shared utilities for all multimodal skill scripts.
# Source this at the top of other scripts: source "$(dirname "$0")/lib/common.sh"
#

set -euo pipefail

# Colors for better output (when supported)
if [ -t 1 ]; then
  BOLD="\033[1m"
  RESET="\033[0m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  BLUE="\033[34m"
  RED="\033[31m"
else
  BOLD=""
  RESET=""
  GREEN=""
  YELLOW=""
  BLUE=""
  RED=""
fi

log_info()    { echo -e "${BLUE}[INFO]${RESET} $*" >&2; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET} $*" >&2; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_success() { echo -e "${GREEN}[OK]${RESET} $*" >&2; }

# Print a nice header
print_header() {
  local title="$1"
  local version="${2:-1.5}"
  echo "========================================"
  echo "MULTIMODAL ${title^^} (v${version})"
  echo "========================================"
}

# Escape string for safe JSON
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  echo "$s"
}

# Output a clean JSON block
emit_json() {
  local json="$1"
  echo ""
  echo "JSON_SUMMARY:"
  echo "$json"
}

# Basic prompt quality enhancer
enhance_prompt() {
  local base="$1"
  local template="${2:-general}"

  local booster=""

  case "$template" in
    cyberpunk|neon)
      booster=", neon reflections, rain-slicked streets, holographic elements, high contrast, cinematic lighting, ultra detailed"
      ;;
    meme)
      booster=", bold meme style, high contrast, simple shapes, internet culture energy, slightly absurd"
      ;;
    banner|marketing)
      booster=", professional composition, clean typography space, modern aesthetic, high quality product shot feel"
      ;;
    pfp|avatar)
      booster=", centered subject, clean background or subtle environment, highly detailed face/eyes, premium PFP quality"
      ;;
    logo)
      booster=", minimalist yet bold, vector style, excellent negative space, memorable silhouette"
      ;;
    retro|pixel)
      booster=", 80s/90s aesthetic, limited color palette, slight scanlines or dithering, nostalgic"
      ;;
    abstract)
      booster=", striking composition, bold shapes and color theory, artistic, gallery quality"
      ;;
    *)
      booster=", highly detailed, sharp focus, professional lighting, award-winning composition"
      ;;
  esac

  echo "${base}${booster}"
}

# Get quality boosters for negative prompt
get_negative_prompt() {
  echo "blurry, low resolution, deformed, ugly, bad anatomy, extra limbs, watermark, text artifacts, cropped, worst quality, overexposed"
}

# Print usage for generate.sh style scripts
print_generate_usage() {
  cat <<'USAGE'
Usage:
  generate.sh --prompt "..." [options]

Required:
  --prompt, -p "text"          Base subject prompt

Optional:
  --template, -t NAME          cyberpunk | meme | banner | pfp | logo | retro | abstract | general
  --aspect, -a RATIO           1:1 | 16:9 | 9:16 | 3:2 | 2:3 (default: 1:1)
  --count, -c N                Number of images (default: 2)
  --style, -s "text"           Extra style descriptors
  --top-text, --bottom-text    For meme generation
  --negative "text"            Custom negative prompt
  --output, -o FORMAT          human | json | command | all (default: all)
  --variations                 Generate creative variation prompts
  --help, -h

Examples:
  generate.sh -p "cyberpunk cat" -t cyberpunk -a 1:1 -c 4
  generate.sh --prompt "Base memecoin drama" --template meme --top-text "Wen moon?" --bottom-text "$CATZ"
USAGE
}
