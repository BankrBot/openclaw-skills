---
name: jb-omnichain-ui
description: |
  Omnichain UI patterns for Juicebox V6. Use when: (1) building deploy flows that
  target multiple chains with single gas payment, (2) displaying unified cross-chain
  project data, (3) implementing chain-selection for payments, (4) showing aggregate
  balances and activity across all project chains.
version: 6.0.0
---

# Juicebox V6 Omnichain UI Development

Build frontends that deploy and interact with Juicebox projects across multiple chains using viem and shared styles.

## Philosophy

> **Pay once on any chain. Deploy everywhere. Query unified data.**

### What is an omnichain project?

An "omnichain project" is a set of Juicebox projects deployed across multiple chains, connected via suckers for token bridging.

**Key concept:** Project IDs cannot be coordinated across chains — each chain assigns the next available ID independently. Deploying to Ethereum might give you project #42, while Optimism gives #17. Suckers link these separate projects together so they function as one logical project with unified token bridging.

Omnichain UIs enable:
- Single-payment multi-chain deployments via Relayr
- Unified project data across all chains via Bendystraw (grouped by `suckerGroupId`)
- Cross-chain token bridging via sucker pairs

## Verified omnichain deployment facts

Verified against `nana-omnichain-deployers-v6`, `nana-suckers-v6`, and `nana-core-v6`.

| Fact | Value |
|------|-------|
| Deployer | `JBOmnichainDeployer` (canonical address in `references/shared/chain-config.json`, same on all 8 chains) |
| Launch (custom 721 config) | `launchProjectFor(address owner, string projectUri, JBOmnichain721Config deploy721Config, JBRulesetConfig[] rulesetConfigurations, JBTerminalConfig[] terminalConfigurations, string memo, JBSuckerDeploymentConfig suckerDeploymentConfiguration) payable returns (uint256 projectId, IJB721TiersHook hook, address[] suckers)` |
| Launch (default 721 config) | Same name, without `deploy721Config` — deploys an empty-tier hook using the first ruleset's `baseCurrency` |
| Creation fee | `payable` — `msg.value` MUST equal `JBProjects.creationFee()` EXACTLY (capped at 0.001 ether; can be 0) |
| Add suckers to existing project | `deploySuckersFor(uint256 projectId, JBSuckerDeploymentConfig suckerDeploymentConfiguration)` — requires `DEPLOY_SUCKERS` permission from the project owner |
| Deterministic sucker addresses | The registry salt is `keccak256(abi.encode(config.salt, msgSender))` — the SAME sender must submit on every chain for sucker addresses to match, which is what makes each sucker find its cross-chain peer |
| 721 hook lookup | `JBOmnichainDeployer.tiered721HookOf(projectId, rulesetId)` — the deployer is the project's data hook and proxies to the real 721 hook |
| Meta-tx support | `JBOmnichainDeployer`, `JBController`, and `JBMultiTerminal` are `ERC2771Context` contracts trusting the canonical `ERC2771Forwarder` |

Sucker config structs (ABI order):

```solidity
struct JBSuckerDeploymentConfig {
    JBSuckerDeployerConfig[] deployerConfigurations;
    bytes32 salt;                 // same salt + same sender on every chain
}
struct JBSuckerDeployerConfig {
    IJBSuckerDeployer deployer;   // per chain-pair deployer, from chain-config.json
    bytes32 peer;                 // bytes32(0) = default peer (same sucker address on the remote chain)
    JBTokenMapping[] mappings;
}
struct JBTokenMapping {
    address localToken;           // NATIVE_TOKEN (0x...EEEe) or the local ERC-20 (per-chain USDC address!)
    uint32 minGas;
    bytes32 remoteToken;          // bytes32-padded remote token address
}
```

Sucker deployers are per chain-pair; read them from `references/shared/chain-config.json`: `JBOptimismSuckerDeployer` / `JBBaseSuckerDeployer` / `JBArbitrumSuckerDeployer` (native bridges, on both endpoints of each pair) and `JBCCIPSuckerDeployer__{ETH,OP,BASE,ARB}` (CCIP, keyed by the remote chain). Chain-specific — never assume one address across chains.

Lane selection is asset-specific. Route canonical USDC through the corresponding CCIP deployer. Native-bridge deployers are the default for native ETH only; an OP Stack or Arbitrum ERC-20 route must map the exact token the live bridge delivers or burns in both directions, and the destination terminal must account for that token. Registry approval and same-address mapping do not validate the bridge pair.

## Verified meta-transaction facts (Relayr signing)

The canonical forwarder is OpenZeppelin's `ERC2771Forwarder`, deployed as `ERC2771Forwarder` in `references/shared/chain-config.json`.

| Fact | Value |
|------|-------|
| EIP-712 domain | `{ name: 'Juicebox', version: '1', chainId, verifyingContract: <ERC2771Forwarder> }` |
| Typed struct | `ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)` |
| Nonce | Read from `forwarder.nonces(from)` — signed inside the typed data but NOT part of the execute calldata |
| Execute | `execute(ForwardRequestData request) payable` where `ForwardRequestData = { from, to, value, gas, deadline, data, signature }` (7 fields, no nonce) |
| Value rule | `msg.value` must equal `request.value` exactly — for `launchProjectFor` set it to `JBProjects.creationFee()` |

## Tool references

- `/jb-relayr` — Multi-chain transaction bundling API
- `/jb-bendystraw` — Cross-chain data aggregation API

### Relayr (transactions)

```javascript
const RELAYR_API = 'https://api.relayr.ba5ed.com';

// 1. Sign forward requests for each chain
// 2. POST /v1/bundle/prepaid to get payment options
// 3. User pays on one chain
// 4. Poll /v1/bundle/{uuid} for completion

// No API key required
```

### Bendystraw (data)

```javascript
// Mainnet chains: https://bendystraw.xyz/{API_KEY}/graphql
// Testnet chains: https://testnet.bendystraw.xyz/{API_KEY}/graphql
// The keyed route is REQUIRED in browsers — the keyless /graphql endpoint is CORS-locked.
// Contact @peripheralist on X for a key. Use a server-side proxy to keep it secret.
```

## Omnichain Deploy UI Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deploy Omnichain Project</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    body { max-width: 640px; margin: 0 auto; }
    .subtitle { color: var(--text-muted); margin-bottom: 1.5rem; }
    .chain-select { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .chain-chip { padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 0.875rem; background: var(--bg-secondary); }
    .chain-chip.selected { background: var(--accent); border-color: var(--accent); }
    .chain-chip.payment { background: var(--success); border-color: var(--success); }
    h2 { font-size: 1rem; color: var(--text-muted); margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Deploy Omnichain Project</h1>
  <p class="subtitle">Deploy to multiple chains with a single payment</p>

  <div class="card">
    <button id="connect-btn" class="btn" onclick="connectWallet()">Connect Wallet</button>
    <div id="wallet-status" class="hidden">
      Connected: <span id="wallet-address"></span>
    </div>
  </div>

  <div class="card">
    <h2>Select Target Chains</h2>
    <div class="chain-select" id="target-chains">
      <div class="chain-chip" data-chain="1" onclick="toggleChain(this)">Ethereum</div>
      <div class="chain-chip" data-chain="10" onclick="toggleChain(this)">Optimism</div>
      <div class="chain-chip" data-chain="8453" onclick="toggleChain(this)">Base</div>
      <div class="chain-chip" data-chain="42161" onclick="toggleChain(this)">Arbitrum</div>
    </div>
  </div>

  <div class="card">
    <label>Project Metadata URI</label>
    <input type="text" id="project-uri" placeholder="ipfs://...">
  </div>

  <div class="card hidden" id="payment-section">
    <h2>Select Payment Chain</h2>
    <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">Pay gas on one chain. Relayr handles the rest.</p>
    <div class="chain-select" id="payment-chains"></div>
  </div>

  <div class="card">
    <button id="deploy-btn" class="btn" onclick="startDeploy()" disabled>Step 1: Sign for Each Chain</button>
  </div>

  <div class="card hidden" id="tx-status">
    <h2>Deployment Status</h2>
    <div id="chain-statuses"></div>
  </div>

  <script type="module">
    import { createPublicClient, createWalletClient, custom, http, formatEther, encodeFunctionData } from 'https://esm.sh/viem';
    import { CHAIN_CONFIGS, getContractAddress, truncateAddress } from '/references/shared/wallet-utils.js';

    const RELAYR_API = 'https://api.relayr.ba5ed.com';

    const FORWARDER_ABI = [
      { name: 'nonces', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
      { name: 'execute', type: 'function', stateMutability: 'payable',
        inputs: [{ name: 'request', type: 'tuple', components: [
          { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' }, { name: 'gas', type: 'uint256' },
          { name: 'deadline', type: 'uint48' }, { name: 'data', type: 'bytes' },
          { name: 'signature', type: 'bytes' }
        ]}],
        outputs: [] }
    ];

    const PROJECTS_ABI = [
      { name: 'creationFee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
    ];

    let walletClient, address;
    let selectedChains = new Set();
    let currentQuote = null;

    window.toggleChain = function(el) {
      const chainId = el.dataset.chain;
      if (selectedChains.has(chainId)) {
        selectedChains.delete(chainId);
        el.classList.remove('selected');
      } else {
        selectedChains.add(chainId);
        el.classList.add('selected');
      }
      document.getElementById('deploy-btn').disabled = selectedChains.size === 0;
    };

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install MetaMask'); return; }
      walletClient = createWalletClient({ chain: CHAIN_CONFIGS[1], transport: custom(window.ethereum) });
      const [addr] = await walletClient.requestAddresses();
      address = addr;

      document.getElementById('wallet-address').textContent = truncateAddress(address);
      document.getElementById('wallet-status').classList.remove('hidden');
      document.getElementById('connect-btn').classList.add('hidden');
    };

    window.startDeploy = async function() {
      if (selectedChains.size === 0) return;

      const btn = document.getElementById('deploy-btn');
      btn.disabled = true;
      btn.textContent = 'Signing...';

      try {
        const signedRequests = [];

        for (const chainIdStr of selectedChains) {
          const chainId = parseInt(chainIdStr);
          btn.textContent = `Signing for ${CHAIN_CONFIGS[chainId].name}...`;

          const publicClient = createPublicClient({ chain: CHAIN_CONFIGS[chainId], transport: http() });
          const forwarder = getContractAddress(chainId, 'ERC2771Forwarder');
          const deployer = getContractAddress(chainId, 'JBOmnichainDeployer');

          // launchProjectFor is payable: the forward request value must equal the creation fee.
          const creationFee = await publicClient.readContract({
            address: getContractAddress(chainId, 'JBProjects'), abi: PROJECTS_ABI, functionName: 'creationFee'
          });

          const calldata = buildLaunchCalldata(chainId);
          const { requestData } = await signForwardRequest({
            publicClient, chainId, forwarder, target: deployer, calldata, value: creationFee
          });

          signedRequests.push({
            chain: chainId,
            target: forwarder,
            data: encodeFunctionData({ abi: FORWARDER_ABI, functionName: 'execute', args: [requestData] }),
            value: creationFee.toString()
          });
        }

        btn.textContent = 'Getting quote...';
        currentQuote = await getRelayrQuote(signedRequests);

        showPaymentOptions(currentQuote);
        btn.textContent = 'Step 2: Select Payment Chain';

      } catch (error) {
        console.error(error);
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
      }
    };

    async function signForwardRequest({ publicClient, chainId, forwarder, target, calldata, value }) {
      // Nonce is read from the forwarder and signed, but is NOT part of the execute calldata.
      const nonce = await publicClient.readContract({
        address: forwarder, abi: FORWARDER_ABI, functionName: 'nonces', args: [address]
      });

      const deadline = Math.floor(Date.now() / 1000) + 48 * 60 * 60;

      const message = {
        from: address,
        to: target,
        value,
        gas: 2_000_000n,
        nonce,
        deadline,
        data: calldata
      };

      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: 'Juicebox',       // the forwarder was deployed with this EIP-712 name
          version: '1',
          chainId,
          verifyingContract: forwarder
        },
        types: {
          ForwardRequest: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'gas', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint48' },
            { name: 'data', type: 'bytes' }
          ]
        },
        primaryType: 'ForwardRequest',
        message
      });

      // ForwardRequestData for execute(): 7 fields, no nonce.
      const requestData = {
        from: message.from,
        to: message.to,
        value: message.value,
        gas: message.gas,
        deadline: message.deadline,
        data: message.data,
        signature
      };

      return { message, signature, requestData };
    }

    function buildLaunchCalldata(chainId) {
      // Encode JBOmnichainDeployer.launchProjectFor(owner, projectUri, rulesetConfigurations,
      // terminalConfigurations, memo, suckerDeploymentConfiguration).
      // Load the full ABI from /references/shared/abis/JBOmnichainDeployer.json — the structs are deeply
      // nested; never hand-write them. See /jb-project for ruleset/terminal config encoding
      // and /jb-omnichain-erc20-config for per-chain token mappings (USDC differs per chain!).
      return '0x';
    }

    async function getRelayrQuote(signedRequests) {
      const response = await fetch(`${RELAYR_API}/v1/bundle/prepaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: signedRequests, virtual_nonce_mode: 'Disabled' })
      });
      if (!response.ok) throw new Error('Failed to get quote');
      return await response.json();
    }

    function showPaymentOptions(quote) {
      document.getElementById('payment-section').classList.remove('hidden');

      const container = document.getElementById('payment-chains');
      container.innerHTML = '';

      quote.payment_info.forEach(payment => {
        const chain = CHAIN_CONFIGS[payment.chain];
        if (!chain) return;

        const costEth = formatEther(BigInt(payment.amount));
        const chip = document.createElement('div');
        chip.className = 'chain-chip';
        chip.innerHTML = `${chain.name}<br><small>${parseFloat(costEth).toFixed(4)} ETH</small>`;
        chip.onclick = () => selectPaymentChain(payment, chip);
        container.appendChild(chip);
      });
    }

    async function selectPaymentChain(payment, chip) {
      document.querySelectorAll('#payment-chains .chain-chip').forEach(c => c.classList.remove('payment'));
      chip.classList.add('payment');

      const btn = document.getElementById('deploy-btn');
      btn.textContent = `Pay on ${CHAIN_CONFIGS[payment.chain].name}`;
      btn.disabled = false;
      btn.onclick = () => executePayment(payment);
    }

    async function executePayment(payment) {
      const btn = document.getElementById('deploy-btn');
      btn.disabled = true;
      btn.textContent = 'Confirm in wallet...';

      try {
        await walletClient.switchChain({ id: payment.chain });
        const hash = await walletClient.sendTransaction({
          account: address,
          to: payment.target,
          value: BigInt(payment.amount),
          data: payment.calldata,
          chain: CHAIN_CONFIGS[payment.chain]
        });

        btn.textContent = 'Payment sent...';
        showStatusPanel();
        pollBundleStatus(currentQuote.bundle_uuid);

      } catch (error) {
        console.error(error);
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
      }
    }

    function showStatusPanel() {
      document.getElementById('tx-status').classList.remove('hidden');
      const container = document.getElementById('chain-statuses');
      container.innerHTML = '';

      for (const chainId of selectedChains) {
        const item = document.createElement('div');
        item.className = 'stat-row';
        item.id = `status-${chainId}`;
        item.innerHTML = `<span class="stat-label">${CHAIN_CONFIGS[parseInt(chainId)].name}</span><span class="stat-value status-badge">Pending</span>`;
        container.appendChild(item);
      }
    }

    async function pollBundleStatus(bundleUuid) {
      const poll = async () => {
        try {
          const response = await fetch(`${RELAYR_API}/v1/bundle/${bundleUuid}`);
          const status = await response.json();

          status.transactions.forEach((tx, i) => {
            const chainId = Array.from(selectedChains)[i];
            const statusEl = document.querySelector(`#status-${chainId} .status-badge`);
            if (!statusEl) return;

            if (tx.status === 'Success' || tx.status === 'Completed') {
              statusEl.textContent = 'Complete';
              statusEl.style.color = 'var(--success)';
            } else if (tx.status === 'Failed') {
              statusEl.textContent = 'Failed';
              statusEl.style.color = 'var(--error)';
            } else {
              statusEl.textContent = tx.status;
            }
          });

          const allDone = status.transactions.every(tx => ['Success', 'Completed', 'Failed'].includes(tx.status));
          if (!allDone) setTimeout(poll, 2000);
          else document.getElementById('deploy-btn').textContent = 'Deployment Complete!';

        } catch (error) {
          console.error('Poll error:', error);
          setTimeout(poll, 2000);
        }
      };

      poll();
    }
  </script>
</body>
</html>
```

## Omnichain Dashboard UI Template

Display unified stats across all chains using Bendystraw. Group data lives on `suckerGroup`; per-chain breakdowns come from the `projects` table filtered by `suckerGroupId`.

```html
<script type="module">
  import { truncateAddress, formatEth, formatNumber } from '/references/shared/wallet-utils.js';

  const API_PROXY = '/api/bendystraw'; // server-side proxy holding the API key

  async function query(graphql, variables = {}) {
    const response = await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: graphql, variables })
    });
    const body = await response.json();
    if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
    return body.data;
  }

  // 1) Resolve the sucker group from any one (projectId, chainId). version is REQUIRED — pass 6.
  async function getSuckerGroupId(projectId, chainId) {
    const data = await query(`
      query($projectId: Float!, $chainId: Float!, $version: Float!) {
        project(projectId: $projectId, chainId: $chainId, version: $version) { name suckerGroupId }
      }
    `, { projectId, chainId, version: 6 });
    return data.project?.suckerGroupId ?? null; // null = single-chain project
  }

  // 2) Group-wide aggregates.
  async function getGroupStats(suckerGroupId) {
    const data = await query(`
      query($id: String!) {
        suckerGroup(id: $id) {
          projects createdAt
          volume volumeUsd balance tokenSupply
          paymentsCount contributorsCount nftsMintedCount
        }
      }
    `, { id: suckerGroupId });
    return data.suckerGroup;
  }

  // 3) Per-chain breakdown: the project rows sharing the suckerGroupId.
  async function getChainBreakdown(suckerGroupId) {
    const data = await query(`
      query($id: String!) {
        projects(where: { suckerGroupId: $id, version: 6 }) {
          items { projectId chainId name balance volume volumeUsd paymentsCount token tokenSymbol }
        }
      }
    `, { id: suckerGroupId });
    return data.projects.items;
  }

  // 4) Recent activity across the whole group.
  async function getRecentPayments(suckerGroupId) {
    const data = await query(`
      query($id: String!, $version: Int!) {
        payEvents(
          where: { suckerGroupId: $id, version: $version }
          orderBy: "timestamp"
          orderDirection: "desc"
          limit: 10
        ) {
          items { timestamp from beneficiary amount amountUsd memo chainId projectId }
        }
      }
    `, { id: suckerGroupId, version: 6 });
    return data.payEvents.items;
  }
</script>
```

## Server-side proxy

Bendystraw's keyed endpoint embeds the API key in the URL — keep it server-side.

```typescript
// pages/api/bendystraw.ts
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const response = await fetch(
    `https://bendystraw.xyz/${process.env.BENDYSTRAW_API_KEY}/graphql`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }
  );

  res.json(await response.json());
}
```

Use `https://testnet.bendystraw.xyz/...` when the UI targets sepolia chains.

## Common patterns

### Poll after Relayr deploy

```javascript
async function deployAndWaitForIndex(bundleUuid) {
  await waitForBundleCompletion(bundleUuid);   // poll /v1/bundle/{uuid}

  // Wait for Bendystraw to index (~1 minute), then fetch.
  await new Promise(r => setTimeout(r, 60_000));
  return getSuckerGroupId(projectId, chainId);
}
```

### Per-chain project IDs

After an omnichain deploy, resolve each chain's project ID from the sucker group (`suckerGroup.projects` is an array of per-chain project row IDs; the `projects` query above returns `projectId` + `chainId` pairs). Never assume the same project ID across chains — see `/jb-omnichain-per-chain-projectids`.

## Important limitation: aggregate payout limits

**Payout limits in omnichain projects are per-chain, not aggregate.**

A 10 ETH payout limit on a 4-chain project allows up to 40 ETH of payouts total (10 ETH × 4 chains). There is no atomic way to enforce aggregate limits across chains.

**See `/jb-omnichain-payout-limits` for approaches.** Quick guidance:
- Soft caps → set per-chain limits that sum to ~80% of the goal
- Need automation → cron + Relayr to pause when a threshold approaches
- Hard compliance limits → single-chain only, or oracle infrastructure

## Common mistakes

- **Wrong `execute` calldata shape** — the forwarder's `execute` takes ONE `ForwardRequestData` struct `(from, to, value, gas, deadline, data, signature)`. The nonce is signed in the typed data (read from `forwarder.nonces(from)`) but is not a calldata field. Encoding `(request, signature)` as two arguments reverts.
- **Hardcoding nonce 0** — reusing or guessing nonces makes the signature invalid; always read `nonces(from)` per chain.
- **Forgetting the creation fee** — `launchProjectFor` reverts unless the forwarded `value` equals `JBProjects.creationFee()` exactly (per chain).
- **Different senders per chain** — sucker salts mix in the sender; a different signer on one chain produces mismatched sucker addresses and the suckers never pair.
- **Same ERC-20 address on all chains** — token mappings need each chain's own token address (USDC differs per chain). See `/jb-omnichain-erc20-config`.
- **Canonical USDC on a native-bridge deployer** — the mapping allowlist does not validate the bridge's registered pair. Select the CCIP deployer for canonical USDC.
- **Keyless Bendystraw endpoint** — CORS-locked; always use the keyed route (proxied server-side).
- **Omitting `version: 6`** in Bendystraw project queries.
- **Assuming a shared project ID across chains** — resolve per-chain IDs via the sucker group.

## Related skills

- `/jb-omnichain-payout-limits` — Aggregate limit constraints and solutions
- `/jb-omnichain-erc20-config` — Per-chain token addresses in sucker mappings
- `/jb-omnichain-per-chain-projectids` — Per-chain project ID resolution
- `/jb-suckers` — Core sucker mechanics (prepare/toRemote/claim flow)
- `/jb-relayr` — Complete Relayr API reference
- `/jb-bendystraw` — Complete Bendystraw GraphQL reference
- `/jb-deploy-ui` — Single-chain deployment UIs
- `/jb-interact-ui` — Project interaction UIs
