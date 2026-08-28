---
name: jb-deploy-ui
description: |
  Generate minimal deployment UIs for Juicebox V6. Use when: (1) need a standalone
  HTML page for deploying a project or hook, (2) building quick demo UIs for testing,
  (3) creating admin tools for project configuration, (4) want wallet connection
  and transaction status in a single file. No build step - viem from CDN.
version: 6.0.0
---

# Juicebox V6 Deployment UI Generator

Generate single-file frontends for deploying Juicebox projects, 721 collections, and revnets. Uses shared styles and viem for blockchain interactions.

## Philosophy

> **Show users exactly what they're doing. Make wallet connection trivial. Display transactions in flight.**

- Single HTML file, no build step
- viem from ESM CDN
- Shared CSS from `references/shared/styles.css`
- Read-only discovery from `references/shared/chain-config.json`; write targets only from the reviewed deployment manifest, with live code/selector verification
- ABIs from `references/shared/abis/*.json` — never hand-write nested tuple ABIs

## Deployment facts

| Fact | Value |
|------|-------|
| Entry point | `JBController.launchProjectFor(owner, projectUri, rulesetConfigurations, terminalConfigurations, memo)` |
| State mutability | `payable` — `msg.value` MUST equal `JBProjects.creationFee()` EXACTLY, or the call reverts with `JBController_InvalidCreationFee` |
| Creation fee source | `JBProjects.creationFee()` (view, returns uint256 wei). Capped by `MAX_CREATION_FEE = 0.001 ether`. Can be 0. |
| Returns | `uint256 projectId` |
| Access | Anyone can call on behalf of any owner. The project ERC-721 is minted to `owner`. |
| 721 / omnichain entry point | `JBOmnichainDeployer.launchProjectFor(...)` — also `payable` with the same exact-fee rule; deploys suckers and an optional 721 hook in one tx |
| Revnet entry point | `REVDeployer.deployFor(revnetId, configuration, accountingContextsToAccept, suckerDeploymentConfiguration, ...)` — `payable`; pass `revnetId = 0` and `msg.value = creationFee` for a new revnet; pre-reserved IDs must send 0 |

Key constants (`JBConstants`):

| Constant | Value | Meaning |
|----------|-------|---------|
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` | Sentinel token address for ETH |
| `NATIVE_TOKEN_CURRENCY` | `61166` (`uint32(uint160(NATIVE_TOKEN))`) | Accounting-context currency for ETH |
| `MAX_RESERVED_PERCENT` | `10_000` | 10,000 = 100% reserved |
| `MAX_CASH_OUT_TAX_RATE` | `10_000` | 10,000 = 100% tax (no reclaim) |
| `MAX_WEIGHT_CUT_PERCENT` | `1_000_000_000` | 1e9 = 100% cut per cycle |
| `SPLITS_TOTAL_PERCENT` | `1_000_000_000` | 1e9 = 100% of a split group |
| `FEE_BENEFICIARY_PROJECT_ID` | `1` | Protocol fee project |
| Protocol fee | `25 / 1000` = 2.5% | On qualifying outflows |

Currency IDs (`JBCurrencyIds`) — used for `baseCurrency` and price-feed lookups:

| ID | Currency |
|----|----------|
| `1` | ETH |
| `2` | USD |

`baseCurrency` (in ruleset metadata) uses `JBCurrencyIds` for well-known currencies or `uint32(uint160(tokenAddress))` for tokens. `JBAccountingContext.currency` uses `uint32(uint160(tokenAddress))` — for native ETH that is `61166`, NOT `1` and NOT `0`. The canonical native accounting context is `{ token: NATIVE_TOKEN, decimals: 18, currency: 61166 }`.

**Weight semantics**: `weight` is tokens minted per unit of `baseCurrency`, as an 18-decimal fixed-point `uint112`. When the paid currency equals `baseCurrency`, `tokenCount = amount * weight / 10^tokenDecimals`. Pass `weight = 1` to inherit the decayed weight from the previous ruleset; `weight = 0` mints nothing.

## Struct reference (ABI order)

`JBRulesetConfig`:

| Field | Type | Notes |
|-------|------|-------|
| `mustStartAtOrAfter` | `uint48` | 0 = start immediately after previous ruleset |
| `duration` | `uint32` | Seconds. 0 = active until explicitly replaced |
| `weight` | `uint112` | 18-decimal fixed point |
| `weightCutPercent` | `uint32` | Out of 1e9. 100,000,000 = 10% cut per cycle |
| `approvalHook` | `address` | e.g. `JBDeadline3Days` from chain-config; zero address = none |
| `metadata` | `JBRulesetMetadata` | See below |
| `splitGroups` | `JBSplitGroup[]` | Empty = no payouts/reserved splits configured |
| `fundAccessLimitGroups` | `JBFundAccessLimitGroup[]` | **Empty = ZERO payout limit — the project cannot pay out anything** |

`JBRulesetMetadata` (19 fields, ABI order):

| Field | Type |
|-------|------|
| `reservedPercent` | `uint16` (out of 10,000) |
| `cashOutTaxRate` | `uint16` (out of 10,000) |
| `baseCurrency` | `uint32` |
| `pausePay` | `bool` |
| `pauseCreditTransfers` | `bool` |
| `allowOwnerMinting` | `bool` |
| `allowSetCustomToken` | `bool` |
| `allowTerminalMigration` | `bool` |
| `allowSetTerminals` | `bool` |
| `allowSetController` | `bool` |
| `allowAddAccountingContext` | `bool` |
| `allowAddPriceFeed` | `bool` |
| `ownerMustSendPayouts` | `bool` |
| `holdFees` | `bool` |
| `scopeCashOutsToLocalBalances` | `bool` |
| `useDataHookForPay` | `bool` |
| `useDataHookForCashOut` | `bool` |
| `dataHook` | `address` |
| `metadata` | `uint16` |

`JBTerminalConfig`:

| Field | Type |
|-------|------|
| `terminal` | `address` (`JBMultiTerminal` from chain-config) |
| `accountingContextsToAccept` | `JBAccountingContext[]` |

To let the project accept any token by swap, add a second entry `{ terminal: JBRouterTerminalRegistry, accountingContextsToAccept: [] }` (the SDK's `buildTerminalConfigurations` emits exactly this pair; the production create flow gates it on an "allow any token" option). Production launches go through `JB721TiersHookProjectDeployer.launchProjectFor` rather than `JBController.launchProjectFor` directly so a 721 store hook exists from day one.

`JBAccountingContext`: `{ token: address, decimals: uint8, currency: uint32 }`

`JBSplitGroup`: `{ groupId: uint256, splits: JBSplit[] }`

`JBSplit` (ABI order): `{ percent: uint32, projectId: uint64, beneficiary: address, preferAddToBalance: bool, lockedUntil: uint48, hook: address }`

`JBFundAccessLimitGroup`: `{ terminal: address, token: address, payoutLimits: JBCurrencyAmount[], surplusAllowances: JBCurrencyAmount[] }` where `JBCurrencyAmount` = `{ amount: uint224, currency: uint32 }`

## Template: Project Deployment UI

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deploy Juicebox Project</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    .preview { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem; font-family: monospace; font-size: 0.75rem; margin: 0.5rem 0; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container" style="max-width: 640px;">
    <h1>Deploy Juicebox Project</h1>

    <div class="card">
      <button class="btn" id="connect-btn" onclick="connectWallet()">Connect Wallet</button>
      <div id="wallet-status" class="hidden" style="margin-top: 0.75rem;">
        <span class="badge-success">Connected: <span id="wallet-address"></span> on <span id="network-name"></span></span>
      </div>
    </div>

    <div class="card">
      <h2>Project Details</h2>
      <label>Project Metadata URI (ipfs://...)</label>
      <input type="text" id="project-uri" placeholder="ipfs://Qm...">
      <label>Owner Address (defaults to connected wallet)</label>
      <input type="text" id="owner-address" placeholder="0x...">
    </div>

    <div class="card">
      <h2>Ruleset Configuration</h2>
      <label>Duration (days, 0 = no cycles)</label>
      <input type="number" id="duration" value="0" min="0">
      <label>Tokens per ETH</label>
      <input type="number" id="weight" value="1000000" min="0">
      <label>Reserved Percent (%)</label>
      <input type="number" id="reserved-percent" value="0" min="0" max="100">
      <label>Cash Out Tax Rate (%)</label>
      <input type="number" id="cash-out-tax" value="0" min="0" max="100">
    </div>

    <div class="card">
      <h2>Transaction Preview</h2>
      <div id="tx-preview" class="preview">Connect wallet to see preview</div>
      <button class="btn" id="deploy-btn" onclick="deploy()" disabled>Deploy Project</button>
    </div>

    <div id="tx-status" class="card hidden"></div>
  </div>

  <script type="module">
    import {
      createWalletClient, createPublicClient, custom, http, parseEther, zeroAddress,
      parseEventLogs, encodeFunctionData, decodeFunctionData, keccak256
    } from 'viem';
    import {
      CHAIN_CONFIGS, loadABI, getContractAddress, verifyWriteTarget,
      truncateAddress, getTxUrl, waitForSuccess
    } from '/references/shared/wallet-utils.js';

    const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';
    const NATIVE_TOKEN_CURRENCY = 61166; // uint32(uint160(NATIVE_TOKEN))
    const ETH_CURRENCY = 1;              // JBCurrencyIds.ETH (baseCurrency)

    const PROJECTS_ABI = [
      { name: 'creationFee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
      { name: 'Transfer', type: 'event', inputs: [
        { name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }
      ] }
    ];
    const DIRECTORY_ABI = [
      { name: 'controllerOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
      { name: 'isTerminalOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'bool' }] }
    ];

    let walletClient = null;
    let publicClient = null;
    let connectedAddress = null;
    let chainId = 1;
    let addresses = null;
    let controllerAbi = null;

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install a web3 wallet'); return; }

      try {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        connectedAddress = address;
        chainId = parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16);

        walletClient = createWalletClient({ chain: CHAIN_CONFIGS[chainId], transport: custom(window.ethereum) });
        publicClient = createPublicClient({ chain: CHAIN_CONFIGS[chainId], transport: http() });
        controllerAbi = await loadABI('JBController'); // exact nested tuple ABI — do not hand-write
        addresses = {
          JBController: await getContractAddress(chainId, 'JBController', { write: true }),
          JBProjects: await getContractAddress(chainId, 'JBProjects'),
          JBDirectory: await getContractAddress(chainId, 'JBDirectory'),
          JBMultiTerminal: await getContractAddress(chainId, 'JBMultiTerminal')
        };

        document.getElementById('wallet-address').textContent = truncateAddress(address);
        document.getElementById('network-name').textContent = CHAIN_CONFIGS[chainId]?.name || `Chain ${chainId}`;
        document.getElementById('wallet-status').classList.remove('hidden');
        document.getElementById('connect-btn').classList.add('hidden');
        document.getElementById('deploy-btn').disabled = false;

        updatePreview();
      } catch (e) { console.error(e); alert('Failed to connect'); }
    };

    function getConfig() {
      return {
        owner: document.getElementById('owner-address').value || connectedAddress,
        projectUri: document.getElementById('project-uri').value || '',
        duration: parseInt(document.getElementById('duration').value) * 86400,
        weight: parseEther(document.getElementById('weight').value),
        reservedPercent: parseInt(document.getElementById('reserved-percent').value) * 100,
        cashOutTaxRate: parseInt(document.getElementById('cash-out-tax').value) * 100
      };
    }

    function updatePreview() {
      const config = getConfig();
      document.getElementById('tx-preview').textContent = JSON.stringify({
        owner: config.owner,
        duration: `${config.duration} seconds`,
        weight: `${config.weight} (18-decimal fixed point)`,
        reservedPercent: `${config.reservedPercent / 100}%`,
        cashOutTaxRate: `${config.cashOutTaxRate / 100}%`
      }, null, 2);
    }

    window.deploy = async function() {
      const config = getConfig();
      if (!addresses) { alert('Unsupported network'); return; }

      showStatus('info', 'Please confirm in wallet...');

      try {
        // msg.value must equal the creation fee EXACTLY (0 is valid when the fee is 0).
        const creationFee = await publicClient.readContract({
          address: addresses.JBProjects,
          abi: PROJECTS_ABI,
          functionName: 'creationFee'
        });

        const rulesetConfig = {
          mustStartAtOrAfter: 0,
          duration: config.duration,
          weight: config.weight,
          weightCutPercent: 0,
          approvalHook: zeroAddress,
          metadata: {
            reservedPercent: config.reservedPercent,
            cashOutTaxRate: config.cashOutTaxRate,
            baseCurrency: ETH_CURRENCY,
            pausePay: false, pauseCreditTransfers: false,
            allowOwnerMinting: false, allowSetCustomToken: false,
            allowTerminalMigration: false, allowSetTerminals: false,
            allowSetController: false, allowAddAccountingContext: false,
            allowAddPriceFeed: false, ownerMustSendPayouts: false,
            holdFees: false, scopeCashOutsToLocalBalances: false,
            useDataHookForPay: false, useDataHookForCashOut: false,
            dataHook: zeroAddress, metadata: 0
          },
          splitGroups: [],
          fundAccessLimitGroups: [] // empty = zero payout limit
        };

        const terminalConfig = {
          terminal: addresses.JBMultiTerminal,
          accountingContextsToAccept: [{ token: NATIVE_TOKEN, decimals: 18, currency: NATIVE_TOKEN_CURRENCY }]
        };

        const call = {
          address: addresses.JBController,
          abi: controllerAbi,
          functionName: 'launchProjectFor',
          args: [config.owner, config.projectUri, [rulesetConfig], [terminalConfig], 'Deployed via Juicebox UI'],
          value: creationFee,
          account: connectedAddress
        };
        const calldata = encodeFunctionData(call);
        await verifyWriteTarget(publicClient, 'JBController', { selector: calldata.slice(0, 10), keccak256 });
        const decoded = decodeFunctionData({ abi: controllerAbi, data: calldata });
        if (!confirm(`Chain ${chainId}\nTarget ${addresses.JBController}\nFunction ${decoded.functionName}\nOwner ${config.owner}\nCreation fee ${creationFee} wei\nProceed?`)) return;
        const { request } = await publicClient.simulateContract(call);
        const hash = await walletClient.writeContract(request);

        showStatus('info', `Transaction sent: ${truncateAddress(hash)}`);
        const receipt = await waitForSuccess(publicClient, hash, { prove: async (candidate) => {
          const [event] = parseEventLogs({
            abi: PROJECTS_ABI, eventName: 'Transfer',
            logs: candidate.logs.filter(l => l.address.toLowerCase() === addresses.JBProjects.toLowerCase())
          });
          if (!event || event.args.to.toLowerCase() !== config.owner.toLowerCase()) return false;
          const [owner, controller, isTerminal] = await Promise.all([
            publicClient.readContract({ address: addresses.JBProjects, abi: PROJECTS_ABI, functionName: 'ownerOf', args: [event.args.tokenId], blockNumber: candidate.blockNumber }),
            publicClient.readContract({ address: addresses.JBDirectory, abi: DIRECTORY_ABI, functionName: 'controllerOf', args: [event.args.tokenId], blockNumber: candidate.blockNumber }),
            publicClient.readContract({ address: addresses.JBDirectory, abi: DIRECTORY_ABI, functionName: 'isTerminalOf', args: [event.args.tokenId, addresses.JBMultiTerminal], blockNumber: candidate.blockNumber })
          ]);
          return owner.toLowerCase() === config.owner.toLowerCase()
            && controller.toLowerCase() === addresses.JBController.toLowerCase() && isTerminal;
        }});

        // Prove the project exists: JBProjects mints the project NFT (Transfer from 0x0) to `owner`.
        const [minted] = parseEventLogs({
          abi: PROJECTS_ABI, eventName: 'Transfer', logs: receipt.logs.filter(l => l.address.toLowerCase() === addresses.JBProjects.toLowerCase())
        });
        if (!minted || minted.args.to.toLowerCase() !== config.owner.toLowerCase()) throw new Error('No project NFT minted to owner in receipt');
        showStatus('success', `Project #${minted.args.tokenId} deployed! <a href="${getTxUrl(chainId, hash)}" target="_blank">View tx</a>`);
      } catch (error) {
        showStatus('error', `Failed: ${error.message}`);
      }
    };

    function showStatus(type, message) {
      const el = document.getElementById('tx-status');
      el.className = `card badge-${type}`;
      el.innerHTML = message;
      el.classList.remove('hidden');
    }

    document.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', updatePreview));
  </script>
</body>
</html>
```

## 721 NFT project deployment

Use `JB721TiersHookProjectDeployer.launchProjectFor(...)` (single chain) or `JBOmnichainDeployer.launchProjectFor(owner, projectUri, deploy721Config, rulesetConfigurations, terminalConfigurations, memo, suckerDeploymentConfiguration)` (with suckers). Both are `payable` with the exact-creation-fee rule. Load the exact ABI with `loadABI('JB721TiersHookProjectDeployer')` / `loadABI('JBOmnichainDeployer')`.

`JB721TierConfig` (ABI order):

| Field | Type |
|-------|------|
| `price` | `uint104` |
| `initialSupply` | `uint32` |
| `votingUnits` | `uint32` |
| `reserveFrequency` | `uint16` |
| `reserveBeneficiary` | `address` |
| `encodedIpfsUri` | `bytes32` |
| `category` | `uint24` |
| `discountPercent` | `uint8` |
| `flags` | `JB721TierConfigFlags` |
| `splitPercent` | `uint32` |
| `splits` | `JBSplit[]` |

`JB721TierConfigFlags` (7 bools, ABI order): `allowOwnerMint`, `useReserveBeneficiaryAsDefault`, `transfersPausable`, `useVotingUnits`, `cantBeRemoved`, `cantIncreaseDiscountPercent`, `cantBuyWithCredits`.

IPFS CID → `bytes32` encoding (strip the `Qm` multihash prefix):

```javascript
function encodeIpfsUri(cid) {
  if (!cid || !cid.startsWith('Qm')) return '0x' + '0'.repeat(64);
  const bs58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let decoded = 0n;
  for (const char of cid) decoded = decoded * 58n + BigInt(bs58.indexOf(char));
  return '0x' + decoded.toString(16).padStart(68, '0').slice(4);
}
```

## Revnet deployment

Resolve `REVDeployer` from the reviewed deployment manifest with write authorization and verify it live. `REVDeployer.deployFor` is `payable`:

- New revnet: pass `revnetId = 0` and `msg.value = JBProjects.creationFee()`.
- Pre-reserved project ID: pass the ID and `msg.value = 0` (non-zero reverts with `REVDeployer_ProjectCreationFeeNotNeeded`).

Overloads: a base variant `deployFor(revnetId, configuration, accountingContextsToAccept, suckerDeploymentConfiguration)` and a 721 variant adding `tiered721HookConfiguration` and `allowedPosts`. Production always uses the 721 variant with its own `tiered721Config`: the base variant deploys an empty hook that hardcodes 18 price decimals (mis-prices USD/USDC stores) and grants the operator all four 721 permissions (`ADJUST_721_TIERS`, `SET_721_METADATA`, `MINT_721`, `SET_721_DISCOUNT_PERCENT`). Load the exact structs with `loadABI('REVDeployer')`, then filter the ABI to the one overload you encode — viem mis-disambiguates the two tuple-heavy `deployFor`s. Revnet configuration is permanent after deployment — surface a warning in the UI.

## Common mistakes

- **Missing `value` on `launchProjectFor`**: the function is `payable` and requires `msg.value == JBProjects.creationFee()` exactly. Too little AND too much both revert. Always read the fee on-chain right before sending.
- **Hand-writing nested tuple ABIs with empty `components: []`**: the function selector is derived from the full canonical tuple signature. Empty components produce the wrong selector and the call silently misses the function. Always `loadABI(...)` from `references/shared/abis/`.
- **Wrong accounting-context currency for ETH**: use `61166` (`uint32(uint160(NATIVE_TOKEN))`), not `0` and not `1`. `1` (`JBCurrencyIds.ETH`) is only for `baseCurrency` / price-feed lookups.
- **Empty `fundAccessLimitGroups` means ZERO payouts**: the project can receive funds but cannot send payouts. Intentional for pure-membership projects; a bug otherwise.
- **Percent scales differ**: `reservedPercent` and `cashOutTaxRate` are out of 10,000; `weightCutPercent` and split `percent` are out of 1,000,000,000.
- **`weight = 1` is a sentinel**: it inherits the decayed weight from the previous ruleset; it does not mean "1 wei of tokens".

## Related skills

- `/jb-explorer-ui` - Contract read/write interface for deployed projects
- `/jb-ruleset-timeline-ui` - Ruleset history visualization
- `/jb-event-explorer-ui` - Event browsing
