#!/bin/bash
#
# multimodal/scripts/discover.sh
# Powerful x402 visual service discovery tool (v1.5)
#
# Attempts real discovery against known Bankr / x402 infrastructure
# when running inside an agent sandbox that has network access.
# Falls back gracefully with high-quality curated knowledge.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

print_header "DISCOVER"

REGISTRY_BASE="https://x402.bankr.bot"
KNOWN_SERVICES=()

log_info "Attempting live discovery from x402 registry..."

# Try to discover actual visual services
if command -v curl >/dev/null 2>&1; then
  # Try common discovery patterns
  for endpoint in "" "/services" "/registry" "/search?q=image" "/search?q=generation"; do
    url="${REGISTRY_BASE}${endpoint}"
    if response=$(curl -s --max-time 6 "$url" 2>/dev/null); then
      if echo "$response" | grep -qiE 'image|flux|grok|visual|generation|imagine'; then
        log_success "Found potential visual services at ${url}"
        # Very lightweight extraction
        services=$(echo "$response" | grep -oE '"name":"[^"]*"' | head -10 || true)
        if [[ -n "$services" ]]; then
          while read -r line; do
            name=$(echo "$line" | cut -d'"' -f4)
            KNOWN_SERVICES+=("$name")
          done <<< "$services"
        fi
      fi
    fi
  done
else
  log_warn "curl not available in this environment — skipping live discovery"
fi

echo ""
echo ">>> CURRENT VISUAL GENERATION CAPABILITIES <<<"
echo ""

if [[ ${#KNOWN_SERVICES[@]} -gt 0 ]]; then
  log_success "Live services discovered:"
  printf '  - %s\n' "${KNOWN_SERVICES[@]}"
else
  log_warn "No live services auto-detected in this run."
fi

echo ""
echo "Recommended high-quality models (via x402 + bankr skill):"
echo "  1. Grok Imagine — Best creativity, coherence, and artistic quality"
echo "  2. Flux (Schnell or Pro) — Excellent prompt adherence and detail"
echo "  3. Community x402 imagegen services (often cheaper or specialized)"

echo ""
echo ">>> HOW TO DISCOVER MORE IN REAL TIME <<<"
echo ""
cat <<'GUIDE'
Use the bankr skill with these natural language queries:

  "List all x402 endpoints that can generate images or visuals"
  "Find the best current Grok Imagine or Flux endpoint and its price"
  "Show me all meme or PFP generation x402 services"
  "What is the cheapest image generation endpoint right now?"

Once you have an endpoint URL or name, use generate.sh to craft
an excellent prompt, then ask bankr to call that specific endpoint.
GUIDE

# Structured output
SERVICES_JSON=$(printf '%s\n' "${KNOWN_SERVICES[@]}" | jq -R . 2>/dev/null | jq -s . || echo '[]')

emit_json "$(cat <<JSON
{
  "action": "discover_visual_services",
  "live_discovered": $SERVICES_JSON,
  "recommended": [
    { "name": "grok-imagine", "strength": "creativity + coherence", "notes": "Preferred for PFPs and artistic work" },
    { "name": "flux", "strength": "prompt following + detail", "notes": "Great for complex scenes and text in images" },
    { "name": "community-x402", "strength": "price + specialization", "notes": "Check current pricing and capabilities" }
  ],
  "discovery_commands": [
    "List all x402 endpoints related to image generation",
    "Find Grok Imagine or Flux endpoints",
    "Show cheapest visual generation services"
  ],
  "next_step": "Use generate.sh with a good prompt, then execute via the bankr skill against the chosen endpoint"
}
JSON
)"

log_success "Discovery complete"
