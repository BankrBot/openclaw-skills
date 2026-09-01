#!/bin/bash
#
# multimodal/scripts/mint.sh
# Powerful NFT minting workflow helper (v1.5)
#
# Generates rich metadata, prepares ready-to-use payloads for
# opensea / onchainkit + bankr skill, and outputs complete step-by-step
# instructions including royalty, attributes, and collection handling.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

IMAGE=""
NAME=""
DESCRIPTION=""
ROYALTY=0
COLLECTION=""
ATTRIBUTES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --royalty) ROYALTY="$2"; shift 2 ;;
    --collection) COLLECTION="$2"; shift 2 ;;
    --attributes) ATTRIBUTES="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: mint.sh --image <url> --name 'Name' --description '...' [--royalty 5] [--collection 'Name'] [--attributes 'key1:val1,key2:val2']"
      exit 0
      ;;
    *) log_error "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$IMAGE" || -z "$NAME" || -z "$DESCRIPTION" ]]; then
  log_error "--image, --name, and --description are required"
  exit 1
fi

print_header "MINT"

log_info "Image:       $IMAGE"
log_info "Name:        $NAME"
log_info "Royalty:     ${ROYALTY}%"

# Build attributes array if provided
ATTR_JSON="[]"
if [[ -n "$ATTRIBUTES" ]]; then
  ATTR_JSON=$(echo "$ATTRIBUTES" | tr ',' '\n' | while IFS=: read -r k v; do
    printf '{"trait_type":"%s","value":"%s"},' "$(json_escape "$k")" "$(json_escape "$v")"
  done | sed 's/,$//' | jq -s '.')
fi

# Generate rich ERC-721 style metadata
METADATA_JSON=$(cat <<JSON
{
  "name": "$(json_escape "$NAME")",
  "description": "$(json_escape "$DESCRIPTION")",
  "image": "$(json_escape "$IMAGE")",
  "external_url": "",
  "attributes": $ATTR_JSON,
  "royalty_percentage": $ROYALTY,
  "collection": "$(json_escape "${COLLECTION:-}")"
}
JSON
)

echo ""
echo ">>> GENERATED METADATA (ready to use)"
echo "$METADATA_JSON" | jq . 2>/dev/null || echo "$METADATA_JSON"

echo ""
echo ">>> RECOMMENDED MINTING WORKFLOW <<<"
echo ""
echo "1. Get explicit user confirmation + show estimated gas cost."
echo ""
echo "2. (Optional) Upload metadata to IPFS using bankr tools if the NFT skill requires it."
echo ""
echo "3. Execute mint using the correct skill combination:"
echo ""

MINT_CMD="Use the opensea skill (or onchainkit) together with the bankr skill to mint this NFT on Base: name=\"$NAME\", description=\"$DESCRIPTION\", image at $IMAGE, royalty ${ROYALTY}%"

if [[ -n "$COLLECTION" ]]; then
  MINT_CMD="$MINT_CMD, collection: $COLLECTION"
fi

if [[ -n "$ATTRIBUTES" ]]; then
  MINT_CMD="$MINT_CMD, traits: $ATTRIBUTES"
fi

echo "   $MINT_CMD"
echo ""
echo "4. Bankr will handle wallet, signing, payment approval, and gas."
echo "5. Return the transaction hash and OpenSea URL to the user."
echo ""

emit_json "$(cat <<JSON
{
  "action": "prepare_and_mint_nft",
  "version": "1.5",
  "metadata": $METADATA_JSON,
  "required_skills": ["bankr", "opensea", "onchainkit"],
  "steps": [
    "Confirm user approval and gas budget",
    "Optionally upload metadata to IPFS",
    "Call NFT skill with the metadata above",
    "Use bankr skill for signing and submission"
  ],
  "warning": "Never mint without explicit user confirmation"
}
JSON
)"

log_success "Mint preparation complete. Do not proceed without user approval."
