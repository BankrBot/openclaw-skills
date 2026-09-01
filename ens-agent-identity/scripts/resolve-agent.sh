#!/bin/bash
# ENS Agent Identity - Resolve an agent's ENS name and all metadata
# Usage: ./resolve-agent.sh <ens-name>
# Example: ./resolve-agent.sh alpha-go.bankr.eth

set -e

ENS_NAME="${1:?Usage: resolve-agent.sh <ens-name>}"

echo "=== Resolving Agent: $ENS_NAME ===" >&2
echo "" >&2

# Resolve address, avatar, and all agent text records in a single Node.js call.
# Display goes to stderr; machine-readable JSON goes to stdout.
ENS_NAME="$ENS_NAME" node -e "
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const ensName = process.env.ENS_NAME;

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

const AGENT_KEYS = [
  'agent:type',
  'agent:capabilities',
  'agent:chains',
  'agent:a2a',
  'agent:version',
  'agent:creator',
  'agent:token',
  'agent:token:symbol',
  'agent:token:address',
  'agent:delegation',
  'agent:mode',
  'agent:policy',
  'agent:chainId',
];

(async () => {
  try {
    const name = normalize(ensName);

    const address = await client.getEnsAddress({ name });

    let avatar = null;
    try { avatar = await client.getEnsAvatar({ name }); } catch {}

    // Resolve all text records in parallel
    const results = await Promise.allSettled(
      AGENT_KEYS.map(async (key) => ({
        key,
        value: await client.getEnsText({ name, key }),
      }))
    );

    const records = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.value) {
        records[result.value.key] = result.value.value;
      }
    }

    // Display summary to stderr
    console.error('Name:    ' + ensName);
    console.error('Address: ' + (address || '(none)'));
    if (avatar) console.error('Avatar:  ' + avatar);
    console.error('');
    console.error('--- Agent Metadata ---');

    const keys = Object.keys(records);
    if (keys.length === 0) {
      console.error('No agent text records found');
    } else {
      const pad = Math.max(...keys.map(k => k.length));
      for (const [key, value] of Object.entries(records)) {
        console.error(key.padEnd(pad + 2) + value);
      }
    }
    console.error('');

    // Machine-readable JSON to stdout
    const output = {
      name: ensName,
      address: address || null,
      avatar: avatar || null,
      records,
    };
    console.log(JSON.stringify(output, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
})();
"
