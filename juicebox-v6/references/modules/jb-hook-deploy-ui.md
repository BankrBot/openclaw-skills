---
name: jb-hook-deploy-ui
description: |
  Browser-based hook deployment UI for Juicebox V6. Use when: (1) deploying
  custom pay/cash-out hooks without CLI, (2) need in-browser Solidity compilation
  via a compile API, (3) deploying and verifying hooks in one flow, (4) attaching
  deployed hooks to existing projects. Single HTML file deployment interface.
version: 6.0.0
---

# Juicebox V6 Hook Deployment UI

Deploy custom hooks directly from the browser. Compile Solidity code, deploy to any chain, verify on block explorers, and attach to a Juicebox project.

## Overview

```
1. Paste or load Solidity source code
2. Compile via a server-side solc endpoint
3. Deploy via connected wallet
4. Optionally verify on Etherscan/Basescan/etc.
5. Attach hook to project ruleset (dataHook in ruleset metadata)
```

## Verified hook interfaces

Verified against `nana-core-v6`. Core contracts compile with `pragma solidity 0.8.28`; interfaces are `^0.8.0`, so hooks can use `^0.8.23` or later.

| Interface | Callback |
|-----------|----------|
| `IJBPayHook` | `afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable` |
| `IJBCashOutHook` | `afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable` |
| `IJBRulesetDataHook` | `beforePayRecordedWith(...)` / `beforeCashOutRecordedWith(...)` — the ruleset's `dataHook` decides weights and which pay/cash-out hooks run |

`JBAfterPayRecordedContext` fields (ABI order):

| Field | Type |
|-------|------|
| `payer` | `address` |
| `projectId` | `uint256` |
| `rulesetId` | `uint256` |
| `amount` | `JBTokenAmount` |
| `forwardedAmount` | `JBTokenAmount` |
| `weight` | `uint256` |
| `newlyIssuedTokenCount` | `uint256` |
| `beneficiary` | `address` |
| `hookMetadata` | `bytes` |
| `payerMetadata` | `bytes` |

`JBAfterCashOutRecordedContext` fields (ABI order):

| Field | Type |
|-------|------|
| `holder` | `address` |
| `projectId` | `uint256` |
| `rulesetId` | `uint256` |
| `cashOutCount` | `uint256` |
| `reclaimedAmount` | `JBTokenAmount` |
| `forwardedAmount` | `JBTokenAmount` |
| `cashOutTaxRate` | `uint256` |
| `beneficiary` | `address payable` |
| `hookMetadata` | `bytes` |
| `cashOutMetadata` | `bytes` |

`JBTokenAmount`: `{ address token; uint8 decimals; uint32 currency; uint256 value; }`

Import path for hooks: `@bananapus/core-v6/src/...` (npm package `@bananapus/core-v6`, GitHub `Bananapus/nana-core-v6`).

## Complete Hook Deploy UI Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deploy Custom Hook</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .step { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); }
    .step:last-child { border-bottom: none; }
    .step-number { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 0.875rem; font-weight: 600; flex-shrink: 0; }
    .step-number.active { background: var(--accent); }
    .step-number.complete { background: var(--success); }
    .step-title { font-weight: 500; }
    .step-desc { font-size: 0.75rem; color: var(--text-muted); }
    .constructor-args { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
    .arg-input { margin-bottom: 0.5rem; }
    .arg-input label { font-size: 0.75rem; }
    .chain-select { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .chain-chip { padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 0.875rem; background: var(--bg-primary); color: var(--text-primary); }
    .chain-chip.selected { background: var(--accent); border-color: var(--accent); }
    .output { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem; font-family: monospace; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Deploy Custom Hook</h1>
    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Compile, deploy, and attach hooks to your Juicebox project</p>

    <div class="card" style="margin-bottom: 1rem;">
      <button class="btn" id="connect-btn" onclick="connectWallet()">Connect Wallet</button>
      <div id="wallet-info" class="hidden" style="margin-top: 0.75rem;">
        <span class="badge-success">Connected: <span id="wallet-address"></span> on <span id="wallet-chain"></span></span>
      </div>
    </div>

    <div class="card" style="margin-bottom: 1rem;">
      <div class="step"><div class="step-number" id="step1-num">1</div><div><div class="step-title">Source Code</div><div class="step-desc">Paste or load Solidity code</div></div></div>
      <div class="step"><div class="step-number" id="step2-num">2</div><div><div class="step-title">Compile</div><div class="step-desc">Generate ABI and bytecode</div></div></div>
      <div class="step"><div class="step-number" id="step3-num">3</div><div><div class="step-title">Deploy</div><div class="step-desc">Deploy contract to chain</div></div></div>
      <div class="step"><div class="step-number" id="step4-num">4</div><div><div class="step-title">Attach</div><div class="step-desc">Set as project data hook</div></div></div>
    </div>

    <div class="grid">
      <div>
        <div class="card">
          <h2>Source Code</h2>
          <div class="tabs" style="margin-bottom: 1rem;">
            <div class="tab active" onclick="showTab('paste')">Paste</div>
            <div class="tab" onclick="showTab('catalog')">From Catalog</div>
            <div class="tab" onclick="showTab('file')">Upload</div>
          </div>

          <div id="tab-paste">
            <textarea id="source-code" rows="18" style="font-family: monospace; font-size: 0.8rem;" placeholder="// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJBPayHook} from '@bananapus/core-v6/src/interfaces/IJBPayHook.sol';
// ... your hook code"></textarea>
          </div>

          <div id="tab-catalog" class="hidden">
            <label>Select Hook Template</label>
            <select id="catalog-select" onchange="loadFromCatalog()">
              <option value="">-- Select a template --</option>
              <optgroup label="Pay Hooks">
                <option value="pay-cap">Payment Cap Hook</option>
                <option value="pay-allowlist">Allowlist Pay Hook</option>
              </optgroup>
              <optgroup label="Cash Out Hooks">
                <option value="cashout-fee">Fee Extraction Hook</option>
              </optgroup>
            </select>
            <div id="catalog-preview" class="output" style="margin-top: 0.5rem; min-height: 100px;"></div>
          </div>

          <div id="tab-file" class="hidden">
            <input type="file" id="file-input" accept=".sol" onchange="loadFromFile()">
          </div>

          <button class="btn" style="margin-top: 1rem;" onclick="compileSource()">Compile</button>
        </div>

        <div class="card">
          <h2>Compiler Output</h2>
          <div id="compile-status"></div>
          <div id="compile-errors" class="output hidden" style="color: var(--error);"></div>

          <div id="compile-success" class="hidden">
            <label>Select Contract</label>
            <select id="contract-select" onchange="selectContract()">
              <option value="">-- Select contract to deploy --</option>
            </select>
            <div id="constructor-args" class="constructor-args hidden">
              <label style="font-weight: 600;">Constructor Arguments</label>
              <div id="args-container"></div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <h2>Target Chain</h2>
          <div class="chain-select" id="chain-select">
            <div class="chain-chip selected" data-chain="1" onclick="selectChain(this)">Ethereum</div>
            <div class="chain-chip" data-chain="10" onclick="selectChain(this)">Optimism</div>
            <div class="chain-chip" data-chain="8453" onclick="selectChain(this)">Base</div>
            <div class="chain-chip" data-chain="42161" onclick="selectChain(this)">Arbitrum</div>
            <div class="chain-chip" data-chain="11155111" onclick="selectChain(this)">Sepolia</div>
          </div>
        </div>

        <div class="card">
          <h2>Deploy Contract</h2>
          <div id="deploy-status"></div>
          <button class="btn" id="deploy-btn" onclick="deployContract()" disabled>Deploy Hook</button>

          <div id="deploy-result" class="hidden" style="margin-top: 1rem;">
            <label>Contract Address</label>
            <div class="output" id="deployed-address"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
              <button class="btn-secondary" onclick="copyAddress()">Copy</button>
              <button class="btn-secondary" onclick="viewOnExplorer()">Explorer</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Verify Contract (Optional)</h2>
          <label>Etherscan API Key</label>
          <input type="text" id="etherscan-key" placeholder="Your API key">
          <button class="btn-secondary" id="verify-btn" onclick="verifyContract()" disabled>Verify</button>
          <div id="verify-status" style="margin-top: 0.5rem;"></div>
        </div>

        <div class="card">
          <h2>Attach to Project</h2>
          <label>Project ID</label>
          <input type="number" id="project-id" placeholder="e.g., 1">
          <label>Hook Type</label>
          <select id="hook-type">
            <option value="pay">Pay Hook</option>
            <option value="cashout">Cash Out Hook</option>
            <option value="both">Both</option>
          </select>
          <button class="btn" id="attach-btn" onclick="attachToProject()" disabled>Queue Ruleset with Hook</button>
          <div id="attach-status" style="margin-top: 0.5rem;"></div>
        </div>
      </div>
    </div>
  </div>

  <script type="module">
    import { createWalletClient, custom } from 'https://esm.sh/viem';
    import { CHAIN_CONFIGS, truncateAddress } from '/references/shared/wallet-utils.js';

    const EXPLORERS = {
      1: { name: 'Etherscan', url: 'https://etherscan.io', api: 'https://api.etherscan.io' },
      11155111: { name: 'Sepolia', url: 'https://sepolia.etherscan.io', api: 'https://api-sepolia.etherscan.io' },
      10: { name: 'Optimism', url: 'https://optimistic.etherscan.io', api: 'https://api-optimistic.etherscan.io' },
      8453: { name: 'Basescan', url: 'https://basescan.org', api: 'https://api.basescan.org' },
      42161: { name: 'Arbiscan', url: 'https://arbiscan.io', api: 'https://api.arbiscan.io' }
    };

    const HOOK_CATALOG = {
      'pay-cap': { name: 'Payment Cap Hook', source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJBPayHook} from "@bananapus/core-v6/src/interfaces/IJBPayHook.sol";
import {JBAfterPayRecordedContext} from "@bananapus/core-v6/src/structs/JBAfterPayRecordedContext.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract PaymentCapHook is IJBPayHook {
    uint256 public immutable MAX_PAYMENT;
    error PaymentExceedsCap(uint256 amount, uint256 cap);

    constructor(uint256 maxPayment) { MAX_PAYMENT = maxPayment; }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
        if (context.amount.value > MAX_PAYMENT) revert PaymentExceedsCap(context.amount.value, MAX_PAYMENT);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBPayHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}` },
      'pay-allowlist': { name: 'Allowlist Pay Hook', source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJBPayHook} from "@bananapus/core-v6/src/interfaces/IJBPayHook.sol";
import {JBAfterPayRecordedContext} from "@bananapus/core-v6/src/structs/JBAfterPayRecordedContext.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AllowlistPayHook is IJBPayHook, Ownable {
    mapping(address => bool) public allowed;
    error NotAllowed(address payer);

    constructor(address[] memory initialAllowed) Ownable(msg.sender) {
        for (uint256 i; i < initialAllowed.length; i++) allowed[initialAllowed[i]] = true;
    }

    function setAllowed(address addr, bool status) external onlyOwner { allowed[addr] = status; }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
        if (!allowed[context.payer]) revert NotAllowed(context.payer);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBPayHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}` },
      'cashout-fee': { name: 'Fee Extraction Hook', source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IJBCashOutHook} from "@bananapus/core-v6/src/interfaces/IJBCashOutHook.sol";
import {JBAfterCashOutRecordedContext} from "@bananapus/core-v6/src/structs/JBAfterCashOutRecordedContext.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract FeeExtractionHook is IJBCashOutHook {
    address payable public immutable FEE_RECIPIENT;
    uint256 public constant FEE_BPS = 500; // 5%

    constructor(address payable feeRecipient) { FEE_RECIPIENT = feeRecipient; }

    function afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable override {
        uint256 fee = (context.forwardedAmount.value * FEE_BPS) / 10_000;
        if (fee > 0) FEE_RECIPIENT.transfer(fee);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBCashOutHook).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}` }
    };

    let walletClient = null;
    let connectedAddress = null;
    let compiledContracts = {};
    let selectedContract = null;
    let deployedAddress = null;
    let selectedChainId = 1;
    let sourceCode = '';

    window.showTab = function(tab) {
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-paste').classList.toggle('hidden', tab !== 'paste');
      document.getElementById('tab-catalog').classList.toggle('hidden', tab !== 'catalog');
      document.getElementById('tab-file').classList.toggle('hidden', tab !== 'file');
    };

    window.loadFromCatalog = function() {
      const template = HOOK_CATALOG[document.getElementById('catalog-select').value];
      if (template) {
        document.getElementById('catalog-preview').textContent = template.source;
        document.getElementById('source-code').value = template.source;
        sourceCode = template.source;
      }
    };

    window.loadFromFile = function() {
      const file = document.getElementById('file-input').files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('source-code').value = e.target.result;
        sourceCode = e.target.result;
      };
      reader.readAsText(file);
    };

    window.selectChain = function(el) {
      document.querySelectorAll('.chain-chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedChainId = parseInt(el.dataset.chain);
    };

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install a web3 wallet'); return; }
      try {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        connectedAddress = address;
        walletClient = createWalletClient({ chain: CHAIN_CONFIGS[selectedChainId], transport: custom(window.ethereum) });

        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        document.getElementById('wallet-address').textContent = truncateAddress(address);
        document.getElementById('wallet-chain').textContent = CHAIN_CONFIGS[parseInt(chainId, 16)]?.name || `Chain ${parseInt(chainId, 16)}`;
        document.getElementById('wallet-info').classList.remove('hidden');
        document.getElementById('connect-btn').textContent = 'Connected';
        document.getElementById('connect-btn').disabled = true;
        updateStep(1, 'active');
      } catch (e) { console.error(e); alert('Failed to connect'); }
    };

    window.compileSource = async function() {
      sourceCode = document.getElementById('source-code').value;
      if (!sourceCode.trim()) { showStatus('compile-status', 'error', 'Please enter source code'); return; }

      showStatus('compile-status', 'info', 'Compiling... (requires compilation API)');
      document.getElementById('compile-errors').classList.add('hidden');
      document.getElementById('compile-success').classList.add('hidden');

      try {
        const response = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: sourceCode })
        });

        if (!response.ok) throw new Error('Compilation service unavailable');
        const result = await response.json();

        if (result.errors?.some(e => e.severity === 'error')) {
          const errors = result.errors.filter(e => e.severity === 'error');
          document.getElementById('compile-errors').textContent = errors.map(e => e.formattedMessage).join('\n');
          document.getElementById('compile-errors').classList.remove('hidden');
          showStatus('compile-status', 'error', `Compilation failed with ${errors.length} error(s)`);
          return;
        }

        compiledContracts = {};
        for (const [fileName, file] of Object.entries(result.contracts || {})) {
          for (const [contractName, contract] of Object.entries(file)) {
            compiledContracts[contractName] = { abi: contract.abi, bytecode: contract.evm.bytecode.object };
          }
        }

        if (Object.keys(compiledContracts).length === 0) {
          showStatus('compile-status', 'error', 'No contracts found');
          return;
        }

        const select = document.getElementById('contract-select');
        select.innerHTML = '<option value="">-- Select contract --</option>' +
          Object.keys(compiledContracts).map(n => `<option value="${n}">${n}</option>`).join('');
        document.getElementById('compile-success').classList.remove('hidden');
        showStatus('compile-status', 'success', `Compiled ${Object.keys(compiledContracts).length} contract(s)`);
        updateStep(2, 'complete');
      } catch (error) {
        showStatus('compile-status', 'error', `Error: ${error.message}`);
      }
    };

    window.selectContract = function() {
      const name = document.getElementById('contract-select').value;
      if (!name) { selectedContract = null; document.getElementById('deploy-btn').disabled = true; return; }

      selectedContract = compiledContracts[name];
      const constructor = selectedContract.abi.find(i => i.type === 'constructor');
      const argsContainer = document.getElementById('args-container');
      argsContainer.innerHTML = '';

      if (constructor?.inputs?.length > 0) {
        document.getElementById('constructor-args').classList.remove('hidden');
        constructor.inputs.forEach((input, i) => {
          argsContainer.innerHTML += `<div class="arg-input"><label>${input.name} (${input.type})</label><input type="text" id="arg-${i}" placeholder="${input.type}"></div>`;
        });
      } else {
        document.getElementById('constructor-args').classList.add('hidden');
      }
      document.getElementById('deploy-btn').disabled = false;
    };

    window.deployContract = async function() {
      if (!selectedContract || !connectedAddress) { showStatus('deploy-status', 'error', 'Select contract first'); return; }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== selectedChainId) {
        showStatus('deploy-status', 'warning', `Please switch to ${CHAIN_CONFIGS[selectedChainId]?.name}`);
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + selectedChainId.toString(16) }] });
          walletClient = createWalletClient({ chain: CHAIN_CONFIGS[selectedChainId], transport: custom(window.ethereum) });
        } catch (e) { return; }
      }

      showStatus('deploy-status', 'info', 'Deploying...');
      document.getElementById('deploy-btn').disabled = true;

      try {
        const constructor = selectedContract.abi.find(i => i.type === 'constructor');
        const args = [];
        if (constructor?.inputs) {
          constructor.inputs.forEach((input, i) => {
            const value = document.getElementById(`arg-${i}`).value;
            args.push(parseArg(value, input.type));
          });
        }

        const hash = await walletClient.deployContract({
          abi: selectedContract.abi,
          bytecode: `0x${selectedContract.bytecode}`,
          args,
          account: connectedAddress
        });

        showStatus('deploy-status', 'info', 'Waiting for confirmation...');

        const receipt = await pollForReceipt(hash);
        deployedAddress = receipt.contractAddress;

        document.getElementById('deployed-address').textContent = deployedAddress;
        document.getElementById('deploy-result').classList.remove('hidden');
        showStatus('deploy-status', 'success', 'Deployed!');
        updateStep(3, 'complete');
        document.getElementById('verify-btn').disabled = false;
        document.getElementById('attach-btn').disabled = false;
      } catch (error) {
        showStatus('deploy-status', 'error', `Failed: ${error.message}`);
        document.getElementById('deploy-btn').disabled = false;
      }
    };

    async function pollForReceipt(hash, attempts = 30) {
      for (let i = 0; i < attempts; i++) {
        const receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (receipt) return receipt;
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error('Transaction not confirmed');
    }

    function parseArg(value, type) {
      if (type.startsWith('uint') || type.startsWith('int')) return BigInt(value);
      if (type === 'bool') return value.toLowerCase() === 'true';
      if (type.endsWith('[]')) return JSON.parse(value);
      return value;
    }

    window.copyAddress = () => { navigator.clipboard.writeText(deployedAddress); showStatus('deploy-status', 'success', 'Copied!'); };
    window.viewOnExplorer = () => { window.open(`${EXPLORERS[selectedChainId].url}/address/${deployedAddress}`, '_blank'); };

    window.verifyContract = async function() {
      const apiKey = document.getElementById('etherscan-key').value;
      if (!apiKey) { showStatus('verify-status', 'warning', 'API key required'); return; }

      showStatus('verify-status', 'info', 'Submitting verification...');

      try {
        const response = await fetch(`${EXPLORERS[selectedChainId].api}/api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            apikey: apiKey, module: 'contract', action: 'verifysourcecode',
            contractaddress: deployedAddress, sourceCode: sourceCode,
            codeformat: 'solidity-single-file',
            contractname: document.getElementById('contract-select').value,
            compilerversion: 'v0.8.28+commit.7893614a', optimizationUsed: '1', runs: '200'
          })
        });
        const result = await response.json();
        showStatus('verify-status', result.status === '1' ? 'success' : 'error',
          result.status === '1' ? 'Verification submitted!' : `Failed: ${result.result}`);
      } catch (error) { showStatus('verify-status', 'error', `Error: ${error.message}`); }
    };

    window.attachToProject = function() {
      const projectId = document.getElementById('project-id').value;
      const hookType = document.getElementById('hook-type').value;
      if (!projectId) { showStatus('attach-status', 'error', 'Enter project ID'); return; }

      showStatus('attach-status', 'info', `To attach hook to project ${projectId}:

Call JBController.queueRulesetsOf(projectId, rulesetConfigurations, memo) with, in each ruleset's metadata:
- useDataHookForPay: ${hookType === 'pay' || hookType === 'both'}
- useDataHookForCashOut: ${hookType === 'cashout' || hookType === 'both'}
- dataHook: ${deployedAddress}

The dataHook must implement IJBRulesetDataHook and return this contract as a pay/cash-out
hook specification. Pay/cash-out hooks only run if the ruleset's data hook specifies them.
Use /jb-ruleset for full ruleset configuration.`);
      updateStep(4, 'complete');
    };

    function showStatus(id, type, msg) {
      const el = document.getElementById(id);
      el.className = type === 'error' ? 'badge-error' : type === 'success' ? 'badge-success' : type === 'warning' ? 'badge-warning' : '';
      el.style.display = 'block';
      el.style.padding = '0.75rem';
      el.style.marginBottom = '0.75rem';
      el.style.whiteSpace = 'pre-wrap';
      el.textContent = msg;
    }

    function updateStep(step, status) {
      document.getElementById(`step${step}-num`).className = 'step-number ' + status;
    }
  </script>
</body>
</html>
```

## Compilation API endpoint

For browser compilation, run a server-side endpoint:

```typescript
// pages/api/compile.ts
import solc from 'solc';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { source } = req.body;
  const input = {
    language: 'Solidity',
    sources: { 'contract.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }, optimizer: { enabled: true, runs: 200 } }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  res.json(output);
}

function findImports(path) {
  // Resolve from GitHub/npm — see Import Resolution below
  return { error: 'Import not found: ' + path };
}
```

## Import resolution

```javascript
const IMPORT_MAPPINGS = {
  '@bananapus/core-v6/': 'https://raw.githubusercontent.com/Bananapus/nana-core-v6/main/',
  '@bananapus/721-hook-v6/': 'https://raw.githubusercontent.com/Bananapus/nana-721-hook-v6/main/',
  '@bananapus/suckers-v6/': 'https://raw.githubusercontent.com/Bananapus/nana-suckers-v6/main/',
  '@openzeppelin/contracts/': 'https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v5.0.0/contracts/'
};
```

## 721 tiers hooks — use the audited deployers

Do not compile a tiered NFT hook by hand. The canonical `JB721TiersHook` deploys as an EIP-1167 clone via audited factories (addresses in `references/shared/chain-config.json`):

| Task | Call |
|------|------|
| Add an NFT hook to an existing project | `JB721TiersHookDeployer.deployHookFor(uint256 projectId, JBDeploy721TiersHookConfig config, bytes32 salt) returns (IJB721TiersHook)` |
| New project + NFT hook in one tx | `JB721TiersHookProjectDeployer.launchProjectFor(address owner, JBDeploy721TiersHookConfig deployTiersHookConfig, JBLaunchProjectConfig launchProjectConfig, IJBController controller, bytes32 salt) payable returns (uint256 projectId, IJB721TiersHook hook)` — `msg.value` must equal `JBProjects.creationFee()` exactly |
| Omnichain project + hook + suckers | `JBOmnichainDeployer.launchProjectFor(...)` — see `/jb-omnichain-ui` |

Non-zero `salt` gives a deterministic clone address; the effective salt mixes in `msg.sender`, so use the same sender on every chain for matching addresses.

## Common mistakes

- **Attaching a pay/cash-out hook directly as `dataHook`** — the `dataHook` must implement `IJBRulesetDataHook`; it decides which pay/cash-out hooks run and with what amounts. A bare `IJBPayHook` set as `dataHook` reverts every pay. Either implement both interfaces in one contract (return itself as the hook specification) or write a small data hook that specifies your pay hook.
- **Forgetting `useDataHookForPay` / `useDataHookForCashOut`** — with the flags false, the `dataHook` address is ignored.
- **Missing `supportsInterface`** — terminals check ERC-165 support; hooks without it are rejected.
- **`payable` callbacks** — `afterPayRecordedWith`/`afterCashOutRecordedWith` must be `payable`: forwarded native token amounts arrive as `msg.value`.
- **Trusting `context` without checking the caller** — anyone can call your hook. Validate `msg.sender` is a terminal registered in `JBDirectory` (`isTerminalOf(projectId, msg.sender)`) before acting on the context.

## Related skills

- `/jb-pay-hook` — Generate pay hook Solidity code
- `/jb-cash-out-hook` — Generate cash out hook Solidity code
- `/jb-split-hook` — Generate split hook Solidity code
- `/jb-ruleset` — Ruleset configuration for attaching hooks
- `/jb-interact-ui` — Project interaction UIs
