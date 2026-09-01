#!/bin/bash
# ERC-8004 - Upload registration file to IPFS via Pinata
# Usage: ./upload-to-ipfs.sh <json-file>
# Example: ./upload-to-ipfs.sh /tmp/agent-registration.json
# Requires: PINATA_JWT environment variable

set -euo pipefail

JSON_FILE="${1:?Usage: upload-to-ipfs.sh <json-file>}"

if [ -z "${PINATA_JWT:-}" ]; then
  echo "Error: PINATA_JWT environment variable not set" >&2
  echo "Get your JWT from https://app.pinata.cloud/developers/api-keys" >&2
  exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
  echo "Error: File not found: $JSON_FILE" >&2
  exit 1
fi

# Validate it's valid JSON before uploading
if ! jq empty "$JSON_FILE" 2>/dev/null; then
  echo "Error: $JSON_FILE is not valid JSON" >&2
  exit 1
fi

echo "=== Uploading to IPFS via Pinata ===" >&2
echo "File: $JSON_FILE" >&2

# Upload to Pinata — --fail ensures non-2xx responses are treated as errors
RESPONSE=$(curl -s --fail -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer $PINATA_JWT" \
  -F "file=@$JSON_FILE" \
  -F 'pinataMetadata={"name": "erc-8004-agent-registration"}') || {
  echo "Error: Pinata upload failed (HTTP error)" >&2
  exit 1
}

# Extract CID
CID=$(echo "$RESPONSE" | jq -r '.IpfsHash // empty')

if [ -z "$CID" ]; then
  echo "Error: Upload failed — no IpfsHash in response" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

IPFS_URI="ipfs://$CID"
echo "=== SUCCESS ===" >&2
echo "CID: $CID" >&2
echo "URI: $IPFS_URI" >&2
echo "Gateway: https://gateway.pinata.cloud/ipfs/$CID" >&2

# Output just the URI for piping
echo "$IPFS_URI"
