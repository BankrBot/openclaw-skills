---
name: jb-interact-ui
description: |
  Generate interaction UIs for existing Juicebox V6 projects. Use when: (1) building a
  custom pay form for a specific project, (2) creating cash out or claim interfaces,
  (3) need standalone HTML for project supporters, (4) building demo pages without
  full app infrastructure. Single-file HTML with viem.
version: 6.0.0
---

# Juicebox V6 Interaction UI Generator

Generate single-file frontends for interacting with existing Juicebox projects using viem and shared styles. Pay into treasuries, cash out tokens, mint tier NFTs, run owner operations, view project state — no build tools required.

## Philosophy

> **Let users interact with Juicebox projects without touching a command line.**

- Single HTML file, no build step; viem from ESM CDN
- Shared CSS from `references/shared/styles.css`, helpers from `references/shared/wallet-utils.js`
- Read-only discovery data comes from `references/shared/chain-config.json`; write targets come only from `references/shared/deployment-manifest.json` via async `getContractAddress(chainId, name, { write: true })`
- ABIs: hand-write only the minimal fragments shown here (verified below), or load full ABIs from `references/shared/abis/*.json` via `loadABI(name)`

## Verified contract facts

All signatures verified against `nana-core-v6`.

| Function | Contract | Signature |
|----------|----------|-----------|
| Pay | `JBMultiTerminal` | `pay(uint256 projectId, address token, uint256 amount, address beneficiary, uint256 minReturnedTokens, string memo, bytes metadata) payable returns (uint256 beneficiaryTokenCount)` |
| Cash out | `JBMultiTerminal` | `cashOutTokensOf(address holder, uint256 projectId, uint256 cashOutCount, address tokenToReclaim, uint256 minTokensReclaimed, address payable beneficiary, bytes metadata) returns (uint256 reclaimAmount)` |
| Cash out preview | `JBMultiTerminal` | `previewCashOutFrom(address holder, uint256 projectId, uint256 cashOutCount, address tokenToReclaim, address payable beneficiary, bytes metadata) view returns (JBRuleset ruleset, uint256 reclaimAmount, uint256 cashOutTaxRate, JBCashOutHookSpecification[] hookSpecifications)` |
| Send payouts | `JBMultiTerminal` | `sendPayoutsOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut) returns (uint256 amountPaidOut)` |
| Use allowance | `JBMultiTerminal` | `useAllowanceOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut, address payable beneficiary, address payable feeBeneficiary, string memo) returns (uint256 netAmountPaidOut)` |
| Surplus | `JBMultiTerminal` | `currentSurplusOf(uint256 projectId, address[] tokens, uint256 decimals, uint256 currency) view returns (uint256)` (empty `tokens` = all accepted tokens) |
| Current ruleset | `JBController` | `currentRulesetOf(uint256 projectId) view returns (JBRuleset ruleset, JBRulesetMetadata metadata)` |
| Total supply | `JBController` | `totalTokenSupplyWithReservedTokensOf(uint256 projectId) view returns (uint256)` |
| Pending reserved | `JBController` | `pendingReservedTokenBalanceOf(uint256 projectId) view returns (uint256)` |
| Distribute reserved | `JBController` | `sendReservedTokensToSplitsOf(uint256 projectId) returns (uint256)` |
| Claim credits | `JBController` | `claimTokensFor(address holder, uint256 projectId, uint256 tokenCount, address beneficiary)` |
| Credit balance | `JBTokens` | `creditBalanceOf(address holder, uint256 projectId) view returns (uint256)` (public mapping) |
| Project token | `JBTokens` | `tokenOf(uint256 projectId) view returns (address)` (public mapping; `address(0)` = no ERC-20 deployed) |
| Total balance | `JBTokens` | `totalBalanceOf(address holder, uint256 projectId) view returns (uint256)` (credits + ERC-20) |
| Owner | `JBProjects` | `ownerOf(uint256 projectId) view returns (address)` |
| Primary terminal | `JBDirectory` | `primaryTerminalOf(uint256 projectId, address token) view returns (address)` |

Constants:

| Constant | Value |
|----------|-------|
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` |
| `NATIVE_TOKEN_CURRENCY` | `61166` = `uint32(uint160(NATIVE_TOKEN))` |
| `MAX_RESERVED_PERCENT` / `MAX_CASH_OUT_TAX_RATE` | `10_000` (= 100%) |
| Protocol fee | 2.5% (`25/1000`) on qualifying outflows |

Permissions (checked via `JBPermissions`): `cashOutTokensOf` requires the caller to be `holder` or hold `CASH_OUT_TOKENS`; `claimTokensFor` requires `holder` or `CLAIM_TOKENS`; `sendPayoutsOf` is permissionless unless `ownerMustSendPayouts` is set; `useAllowanceOf` requires the project owner or `USE_ALLOWANCE`; `sendReservedTokensToSplitsOf` is permissionless.

**Terminal resolution**: never hardcode `JBMultiTerminal`. Templates below call `resolveTerminal(publicClient, projectId, token)` from `references/shared/wallet-utils.js`, which reads `JBDirectory.primaryTerminalOf(projectId, token)` and confirms `terminal.accountingContextForTokenOf(projectId, token)` is non-empty (the returned `context.decimals` / `context.currency` are what `currentSurplusOf`, `minTokensReclaimed`, and amount formatting must use). A project whose only accounting context is USDC rejects native ETH on the multi terminal (`JBMultiTerminal_TokenNotAccepted`); tokens a project does not accept can be routed through `JBRouterTerminalRegistry.pay(...)` (swap-in), which the production pay card gates on `JBDirectory.isTerminalOf(projectId, registry)`. Cash-outs always go to the multi terminal — the router terminal has no `cashOutTokensOf`/`previewCashOutFrom`.

**ERC-20 payments**: `pay` is only `payable` for `NATIVE_TOKEN`. For ERC-20 tokens (e.g. USDC), approve the terminal first, pass `value: 0n`, and use `amount` in the token's own decimals.

## Template: Project Payment UI

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pay Project</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    body { max-width: 480px; margin: 0 auto; }
    .input-suffix { position: relative; }
    .input-suffix input { padding-right: 3rem; }
    .input-suffix span { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-75%); color: var(--text-muted); }
    .receive-preview { background: var(--bg-primary); border-radius: 4px; padding: 0.75rem; margin: 0.75rem 0; text-align: center; }
    .receive-amount { font-size: 1.25rem; font-weight: 600; }
    .receive-label { font-size: 0.75rem; color: var(--text-muted); }
    .subtitle { color: var(--text-muted); margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Pay Project #<span id="project-id">1</span></h1>
  <p class="subtitle">Contribute ETH and receive tokens</p>

  <div class="card">
    <button id="connect-btn" class="btn" onclick="connectWallet()">Connect Wallet</button>
    <div id="wallet-status" class="hidden">
      <div class="stat-row"><span class="stat-label">Connected</span><span class="stat-value" id="wallet-address"></span></div>
      <div class="stat-row"><span class="stat-label">Balance</span><span class="stat-value" id="wallet-balance"></span></div>
    </div>
  </div>

  <div class="card" id="project-stats">
    <div class="stat-row"><span class="stat-label">Surplus</span><span class="stat-value" id="treasury-surplus">-</span></div>
    <div class="stat-row"><span class="stat-label">Token Supply</span><span class="stat-value" id="token-supply">-</span></div>
    <div class="stat-row"><span class="stat-label">Issuance (per base unit)</span><span class="stat-value" id="issuance">-</span></div>
  </div>

  <div class="card">
    <label>Amount to Pay</label>
    <div class="input-suffix">
      <input type="number" id="pay-amount" placeholder="0.0" step="0.001" min="0" oninput="updateReceivePreview()">
      <span>ETH</span>
    </div>
    <div class="receive-preview">
      <div class="receive-amount" id="receive-amount">0</div>
      <div class="receive-label">tokens you'll receive (before reserved split)</div>
    </div>
    <label>Memo (optional)</label>
    <input type="text" id="memo" placeholder="Thanks for building!">
    <button id="pay-btn" class="btn" onclick="pay()" disabled>Pay Project</button>
  </div>

  <div id="tx-status" class="card hidden">
    <span id="tx-state"></span>
    <a id="tx-link" href="#" target="_blank" class="hidden">View transaction</a>
  </div>

  <script type="module">
    import { createPublicClient, createWalletClient, http, custom, formatEther, formatUnits, parseEther } from 'viem';
    import { CHAIN_CONFIGS, getContractAddress, resolveTerminal, truncateAddress, getTxUrl, waitForSuccess } from '/references/shared/wallet-utils.js';

    // Configuration
    const PROJECT_ID = 1n;
    const CHAIN_ID = 1;
    const SLIPPAGE_BPS = 500n; // 5% floor below the simulated result
    const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';

    const TERMINAL_ABI = [
      { name: 'pay', type: 'function', stateMutability: 'payable',
        inputs: [
          { name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }, { name: 'beneficiary', type: 'address' },
          { name: 'minReturnedTokens', type: 'uint256' }, { name: 'memo', type: 'string' },
          { name: 'metadata', type: 'bytes' }
        ],
        outputs: [{ name: 'beneficiaryTokenCount', type: 'uint256' }]
      },
      { name: 'currentSurplusOf', type: 'function', stateMutability: 'view',
        inputs: [
          { name: 'projectId', type: 'uint256' }, { name: 'tokens', type: 'address[]' },
          { name: 'decimals', type: 'uint256' }, { name: 'currency', type: 'uint256' }
        ],
        outputs: [{ type: 'uint256' }]
      }
    ];

    const CONTROLLER_ABI = [
      { name: 'currentRulesetOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'projectId', type: 'uint256' }],
        outputs: [
          { name: 'ruleset', type: 'tuple', components: [
            { name: 'cycleNumber', type: 'uint48' }, { name: 'id', type: 'uint48' },
            { name: 'basedOnId', type: 'uint48' }, { name: 'start', type: 'uint48' },
            { name: 'duration', type: 'uint32' }, { name: 'weight', type: 'uint112' },
            { name: 'weightCutPercent', type: 'uint32' }, { name: 'approvalHook', type: 'address' },
            { name: 'metadata', type: 'uint256' }
          ]},
          { name: 'metadata', type: 'tuple', components: [
            { name: 'reservedPercent', type: 'uint16' }, { name: 'cashOutTaxRate', type: 'uint16' },
            { name: 'baseCurrency', type: 'uint32' }, { name: 'pausePay', type: 'bool' },
            { name: 'pauseCreditTransfers', type: 'bool' }, { name: 'allowOwnerMinting', type: 'bool' },
            { name: 'allowSetCustomToken', type: 'bool' }, { name: 'allowTerminalMigration', type: 'bool' },
            { name: 'allowSetTerminals', type: 'bool' }, { name: 'allowSetController', type: 'bool' },
            { name: 'allowAddAccountingContext', type: 'bool' }, { name: 'allowAddPriceFeed', type: 'bool' },
            { name: 'ownerMustSendPayouts', type: 'bool' }, { name: 'holdFees', type: 'bool' },
            { name: 'scopeCashOutsToLocalBalances', type: 'bool' }, { name: 'useDataHookForPay', type: 'bool' },
            { name: 'useDataHookForCashOut', type: 'bool' }, { name: 'dataHook', type: 'address' },
            { name: 'metadata', type: 'uint16' }
          ]}
        ]
      },
      { name: 'totalTokenSupplyWithReservedTokensOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'projectId', type: 'uint256' }],
        outputs: [{ type: 'uint256' }]
      }
    ];

    let publicClient, walletClient, address, weight = 0n, reservedPercent = 0;
    let terminal, context; // resolved via JBDirectory.primaryTerminalOf + accountingContextForTokenOf

    document.getElementById('project-id').textContent = PROJECT_ID.toString();

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install MetaMask'); return; }

      const chain = CHAIN_CONFIGS[CHAIN_ID];
      publicClient = createPublicClient({ chain, transport: http() });
      walletClient = createWalletClient({ chain, transport: custom(window.ethereum) });

      const [addr] = await walletClient.requestAddresses();
      address = addr;

      const chainId = await walletClient.getChainId();
      if (chainId !== CHAIN_ID) {
        try { await walletClient.switchChain({ id: CHAIN_ID }); }
        catch { alert(`Please switch to the correct network (Chain ID: ${CHAIN_ID})`); return; }
      }

      document.getElementById('wallet-address').textContent = truncateAddress(address);
      const balance = await publicClient.getBalance({ address });
      document.getElementById('wallet-balance').textContent = `${parseFloat(formatEther(balance)).toFixed(4)} ETH`;
      document.getElementById('wallet-status').classList.remove('hidden');
      document.getElementById('connect-btn').classList.add('hidden');
      document.getElementById('pay-btn').disabled = false;

      await loadProjectStats();
    };

    async function loadProjectStats() {
      const controller = await getContractAddress(CHAIN_ID, 'JBController');
      // Throws if no terminal accepts NATIVE_TOKEN for this project (e.g. a USDC-only project): fail closed.
      try { ({ terminal, context } = await resolveTerminal(publicClient, PROJECT_ID, NATIVE_TOKEN)); }
      catch (e) { document.getElementById('pay-btn').disabled = true; alert(e.message); return; }

      const [rulesetData, totalSupply, surplus] = await Promise.all([
        publicClient.readContract({ address: controller, abi: CONTROLLER_ABI, functionName: 'currentRulesetOf', args: [PROJECT_ID] }),
        publicClient.readContract({ address: controller, abi: CONTROLLER_ABI, functionName: 'totalTokenSupplyWithReservedTokensOf', args: [PROJECT_ID] }),
        // Surplus in the accounting context's own (decimals, currency): no JBPrices feed lookup needed.
        publicClient.readContract({ address: terminal, abi: TERMINAL_ABI, functionName: 'currentSurplusOf', args: [PROJECT_ID, [], BigInt(context.decimals), BigInt(context.currency)] })
      ]);

      const [ruleset, metadata] = rulesetData;
      weight = ruleset.weight; // tokens per unit of baseCurrency, 18-decimal fixed point
      reservedPercent = Number(metadata.reservedPercent);

      document.getElementById('treasury-surplus').textContent = `${parseFloat(formatUnits(surplus, context.decimals)).toFixed(4)} ETH`;
      document.getElementById('token-supply').textContent = parseInt(formatEther(totalSupply)).toLocaleString();
      document.getElementById('issuance').textContent = parseInt(formatEther(weight)).toLocaleString();
    }

    window.updateReceivePreview = function() {
      const amount = document.getElementById('pay-amount').value || '0';
      if (weight > 0n) {
        // NOTE: exact only when the project's baseCurrency is the paid token's currency.
        // For USD-based projects the terminal converts through JBPrices first.
        const gross = parseFloat(amount) * parseFloat(formatEther(weight));
        const net = gross * (1 - reservedPercent / 10_000);
        document.getElementById('receive-amount').textContent = net.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }
    };

    window.pay = async function() {
      const amount = document.getElementById('pay-amount').value;
      const memo = document.getElementById('memo').value || '';
      if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount to pay'); return; }
      if (!terminal) { alert('No terminal accepts ETH for this project'); return; }
      const value = parseEther(amount);

      showTxPending('Please confirm in wallet...');

      try {
        // Simulate first: a failing simulation aborts before the wallet prompt, and the simulated
        // token count sets a nonzero floor so a sandwiched buyback/data-hook path reverts instead of executing.
        const call = { address: terminal, abi: TERMINAL_ABI, functionName: 'pay', value, account: address };
        const { result: expectedTokens } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, value, address, 0n, memo, '0x']
        });
        if (expectedTokens <= 0n) throw new Error('Payment preview returned zero; refusing a floorless payment.');
        const computedFloor = expectedTokens * (10_000n - SLIPPAGE_BPS) / 10_000n;
        const minReturnedTokens = computedFloor > 0n ? computedFloor : 1n;

        const { request } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, value, address, minReturnedTokens, memo, '0x']
        });
        const hash = await walletClient.writeContract(request);

        showTxSent(hash);
        await waitForSuccess(publicClient, hash);
        showTxConfirmed();
      } catch (error) {
        showTxError(error);
      }
    };

    function showTxPending(msg) {
      document.getElementById('tx-status').classList.remove('hidden');
      document.getElementById('tx-state').textContent = msg;
      document.getElementById('tx-link').classList.add('hidden');
    }
    function showTxSent(hash) {
      document.getElementById('tx-state').textContent = 'Transaction sent...';
      const link = document.getElementById('tx-link');
      link.href = getTxUrl(CHAIN_ID, hash);
      link.classList.remove('hidden');
    }
    function showTxConfirmed() { document.getElementById('tx-state').textContent = 'Payment successful!'; }
    function showTxError(error) { document.getElementById('tx-state').textContent = error.shortMessage || error.message; }
  </script>
</body>
</html>
```

## Template: Cash Out UI

Cash outs burn project tokens to reclaim a pro-rata share of the terminal surplus along the ruleset's bonding curve (`cashOutTaxRate`). A single 2.5% protocol fee applies when `cashOutTaxRate != 0` and the beneficiary is not feeless.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cash Out Tokens</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    body { max-width: 480px; margin: 0 auto; }
    .input-suffix { position: relative; }
    .input-suffix input { padding-right: 4rem; }
    .input-suffix span { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-75%); color: var(--text-muted); }
    .receive-preview { background: var(--bg-primary); border-radius: 4px; padding: 0.75rem; margin: 0.75rem 0; text-align: center; }
    .receive-amount { font-size: 1.25rem; font-weight: 600; }
    .receive-label { font-size: 0.75rem; color: var(--text-muted); }
    .subtitle { color: var(--text-muted); margin-bottom: 1.5rem; }
    .warning { border-color: var(--error) !important; }
    .warning p { font-size: 0.875rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <h1>Cash Out</h1>
  <p class="subtitle">Burn tokens to reclaim ETH from the treasury surplus</p>

  <div class="card">
    <button id="connect-btn" class="btn" onclick="connectWallet()">Connect Wallet</button>
    <div id="wallet-status" class="hidden">
      <div class="stat-row"><span class="stat-label">Your Token Balance</span><span class="stat-value" id="token-balance">-</span></div>
    </div>
  </div>

  <div class="card">
    <label>Tokens to Cash Out</label>
    <div class="input-suffix">
      <input type="number" id="cash-out-amount" placeholder="0" oninput="updateCashOutPreview()">
      <span>tokens</span>
    </div>
    <button class="btn btn-secondary" onclick="setMax()" style="margin-bottom: 0.75rem;">Max</button>
    <div class="receive-preview">
      <div class="receive-amount" id="reclaim-amount">0</div>
      <div class="receive-label">ETH you'll receive (net of the 2.5% protocol fee when cash out tax is on)</div>
    </div>
    <button id="cashout-btn" class="btn" onclick="cashOut()" disabled>Cash Out</button>
  </div>

  <div class="card warning">
    <p>Cash outs burn your tokens permanently. You'll receive your share of the treasury surplus, shaped by the ruleset's cash out tax rate.</p>
  </div>

  <div id="tx-status" class="card hidden"></div>

  <script type="module">
    import { createPublicClient, createWalletClient, http, custom, formatEther, formatUnits, parseEther } from 'viem';
    import { CHAIN_CONFIGS, getContractAddress, resolveTerminal, getTxUrl, waitForSuccess } from '/references/shared/wallet-utils.js';

    const PROJECT_ID = 1n;
    const CHAIN_ID = 1;
    const SLIPPAGE_BPS = 500n; // 5% floor below the simulated result
    const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';

    const TERMINAL_ABI = [
      { name: 'cashOutTokensOf', type: 'function', stateMutability: 'nonpayable',
        inputs: [
          { name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' },
          { name: 'cashOutCount', type: 'uint256' }, { name: 'tokenToReclaim', type: 'address' },
          { name: 'minTokensReclaimed', type: 'uint256' }, { name: 'beneficiary', type: 'address' },
          { name: 'metadata', type: 'bytes' }
        ],
        outputs: [{ name: 'reclaimAmount', type: 'uint256' }]
      },
      { name: 'previewCashOutFrom', type: 'function', stateMutability: 'view',
        inputs: [
          { name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' },
          { name: 'cashOutCount', type: 'uint256' }, { name: 'tokenToReclaim', type: 'address' },
          { name: 'beneficiary', type: 'address' }, { name: 'metadata', type: 'bytes' }
        ],
        outputs: [
          { name: 'ruleset', type: 'tuple', components: [
            { name: 'cycleNumber', type: 'uint48' }, { name: 'id', type: 'uint48' },
            { name: 'basedOnId', type: 'uint48' }, { name: 'start', type: 'uint48' },
            { name: 'duration', type: 'uint32' }, { name: 'weight', type: 'uint112' },
            { name: 'weightCutPercent', type: 'uint32' }, { name: 'approvalHook', type: 'address' },
            { name: 'metadata', type: 'uint256' }
          ]},
          { name: 'reclaimAmount', type: 'uint256' },
          { name: 'cashOutTaxRate', type: 'uint256' },
          // JBCashOutHookSpecification: { hook, noop, amount, metadata } — omitting `noop` shifts every offset
          // and the preview mis-decodes for any project whose data hook returns specs (revnets, 721, buyback).
          { name: 'hookSpecifications', type: 'tuple[]', components: [
            { name: 'hook', type: 'address' }, { name: 'noop', type: 'bool' },
            { name: 'amount', type: 'uint256' }, { name: 'metadata', type: 'bytes' }
          ]}
        ]
      }
    ];

    const TOKENS_ABI = [
      { name: 'totalBalanceOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' }],
        outputs: [{ type: 'uint256' }]
      }
    ];

    let publicClient, walletClient, address, tokenBalance = 0n, terminal, context;

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install MetaMask'); return; }

      const chain = CHAIN_CONFIGS[CHAIN_ID];
      publicClient = createPublicClient({ chain, transport: http() });
      walletClient = createWalletClient({ chain, transport: custom(window.ethereum) });

      const [addr] = await walletClient.requestAddresses();
      address = addr;

      // The terminal holding the project's ETH; context.decimals denominates reclaimAmount / minTokensReclaimed.
      ({ terminal, context } = await resolveTerminal(publicClient, PROJECT_ID, NATIVE_TOKEN));

      document.getElementById('wallet-status').classList.remove('hidden');
      document.getElementById('connect-btn').classList.add('hidden');
      await loadTokenBalance();
    };

    async function loadTokenBalance() {
      const tokens = await getContractAddress(CHAIN_ID, 'JBTokens');
      tokenBalance = await publicClient.readContract({
        address: tokens, abi: TOKENS_ABI, functionName: 'totalBalanceOf', args: [address, PROJECT_ID]
      });
      document.getElementById('token-balance').textContent = parseInt(formatEther(tokenBalance)).toLocaleString() + ' tokens';
      document.getElementById('cashout-btn').disabled = tokenBalance === 0n;
    }

    window.setMax = function() {
      document.getElementById('cash-out-amount').value = parseInt(formatEther(tokenBalance));
      updateCashOutPreview();
    };

    window.updateCashOutPreview = async function() {
      const amount = document.getElementById('cash-out-amount').value || '0';
      if (parseFloat(amount) <= 0) { document.getElementById('reclaim-amount').textContent = '0'; return; }

      try {
        // previewCashOutFrom runs the data hook (REV fee, buyback) and returns the reclaim BEFORE the
        // 2.5% protocol fee, which applies to the whole reclaim when cashOutTaxRate != 0 (else only up
        // to feeFreeSurplusOf). Display the net; the on-chain floor is checked against the net too.
        const [, reclaimAmount, cashOutTaxRate] = await publicClient.readContract({
          address: terminal, abi: TERMINAL_ABI, functionName: 'previewCashOutFrom',
          args: [address, PROJECT_ID, parseEther(amount), NATIVE_TOKEN, address, '0x']
        });
        const net = cashOutTaxRate > 0n ? reclaimAmount - reclaimAmount / 40n : reclaimAmount;
        document.getElementById('reclaim-amount').textContent = parseFloat(formatUnits(net, context.decimals)).toFixed(4) + ' ETH';
        window._previewReclaim = reclaimAmount;
        document.getElementById('cashout-btn').disabled = false;
      } catch {
        // Preview reverts (e.g. an active cash-out delay) mean the cash-out would revert too.
        // Never submit without a floor derived from a successful preview.
        document.getElementById('reclaim-amount').textContent = 'Unavailable';
        window._previewReclaim = null;
        document.getElementById('cashout-btn').disabled = true;
      }
    };

    window.cashOut = async function() {
      const amount = document.getElementById('cash-out-amount').value;

      // Re-run the preview immediately before submitting so the floor reflects current state.
      await updateCashOutPreview();
      if (window._previewReclaim == null) { alert('Cash-out preview failed; not submitting.'); return; }
      if (window._previewReclaim <= 0n) { alert('Cash-out preview returned zero; not submitting.'); return; }
      // Slippage floor on the previewed (pre-fee) reclaim; 0.95 < 0.975 so it clears the post-fee check.
      // minTokensReclaimed is denominated in context.decimals (18 for ETH; 6 for USDC).
      const computedFloor = window._previewReclaim * (10_000n - SLIPPAGE_BPS) / 10_000n;
      const minReclaimed = computedFloor > 0n ? computedFloor : 1n;

      document.getElementById('tx-status').classList.remove('hidden');
      document.getElementById('tx-status').textContent = 'Please confirm in wallet...';

      try {
        const { request } = await publicClient.simulateContract({
          address: terminal,
          abi: TERMINAL_ABI,
          functionName: 'cashOutTokensOf',
          args: [address, PROJECT_ID, parseEther(amount), NATIVE_TOKEN, minReclaimed, address, '0x'],
          account: address
        });
        const hash = await walletClient.writeContract(request);

        document.getElementById('tx-status').innerHTML = `Transaction sent... <a href="${getTxUrl(CHAIN_ID, hash)}" target="_blank">View</a>`;
        await waitForSuccess(publicClient, hash);
        document.getElementById('tx-status').textContent = 'Cash out successful!';
      } catch (error) {
        document.getElementById('tx-status').textContent = error.shortMessage || error.message;
      }
    };
  </script>
</body>
</html>
```

## Template: NFT Mint UI (721 hook)

NFTs mint when a payment carries tier IDs in the pay metadata. The metadata MUST be a `JBMetadataResolver` envelope keyed by the hook's `METADATA_ID_TARGET` — a bare `abi.encode` payload is silently ignored and no NFT mints.

`METADATA_ID_TARGET` is an immutable set to `address(this)` in the implementation's constructor. Because project hooks are EIP-1167 clones, every clone reads back the shared IMPLEMENTATION address — read it via `hook.METADATA_ID_TARGET()`, never assume the clone address.

```
metadata id = bytes4(bytes20(METADATA_ID_TARGET) ^ bytes20(keccak256("pay")))
envelope    = [32B reserved zeros][4B id][1B offset = 0x02][27B zero pad][abi.encode(bool allowOverspending, uint16[] tierIds)]
```

```html
<script type="module">
  import { createPublicClient, createWalletClient, http, custom, parseEther, encodeAbiParameters, keccak256 } from 'viem';
  import { CHAIN_CONFIGS, resolveTerminal, waitForSuccess } from '/references/shared/wallet-utils.js';

  const PROJECT_ID = 1n;
  const CHAIN_ID = 1;
  const HOOK_ADDRESS = '0x...'; // the project's JB721TiersHook clone
  const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';

  const HOOK_ABI = [
    { name: 'METADATA_ID_TARGET', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'STORE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
  ];

  const TERMINAL_ABI = [
    { name: 'pay', type: 'function', stateMutability: 'payable',
      inputs: [
        { name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' }, { name: 'beneficiary', type: 'address' },
        { name: 'minReturnedTokens', type: 'uint256' }, { name: 'memo', type: 'string' },
        { name: 'metadata', type: 'bytes' }
      ],
      outputs: [{ name: 'beneficiaryTokenCount', type: 'uint256' }]
    }
  ];

  // 4-byte id: bytes4(bytes20(idTarget) ^ bytes20(keccak256("pay")))
  function tier721MetadataId(idTarget) {
    const k = keccak256('0x706179'); // keccak256(utf8 "pay")
    const a = idTarget.slice(2, 10).toLowerCase(), b = k.slice(2, 10);
    let out = '';
    for (let i = 0; i < 8; i += 2) {
      out += (parseInt(a.substr(i, 2), 16) ^ parseInt(b.substr(i, 2), 16)).toString(16).padStart(2, '0');
    }
    return out;
  }

  // JBMetadataResolver envelope: [reserved word][lookup: id(4B)+offset(0x02)+pad][data]
  function buildTierMintMetadata(idTarget, tierIds) {
    const id = tier721MetadataId(idTarget);
    const data = encodeAbiParameters([{ type: 'bool' }, { type: 'uint16[]' }], [true, tierIds]);
    return '0x' + '00'.repeat(32) + id + '02' + '00'.repeat(27) + data.slice(2);
  }

  async function mint(tierIds, totalPriceWei, walletClient, publicClient, address, proveMint) {
    if (typeof proveMint !== 'function') throw new Error('Tier-mint event and ownership/supply proof is required.');
    // Key the metadata to METADATA_ID_TARGET (the implementation), NOT the clone address.
    const idTarget = await publicClient.readContract({
      address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'METADATA_ID_TARGET'
    });
    const metadata = buildTierMintMetadata(idTarget, tierIds);
    // Throws if the project accepts no ETH terminal. totalPriceWei must already be converted from
    // hook.pricingContext() currency via JBPrices when it is not native (see /jb-nft-gallery-ui).
    const { terminal } = await resolveTerminal(publicClient, PROJECT_ID, NATIVE_TOKEN);

    // Simulate first: surfaces a wrong envelope / sold-out tier / bad price before the wallet prompt,
    // and the simulated token count becomes the floor for the real call.
    const call = { address: terminal, abi: TERMINAL_ABI, functionName: 'pay', value: totalPriceWei, account: address };
    const { result: expectedTokens } = await publicClient.simulateContract({
      ...call, args: [PROJECT_ID, NATIVE_TOKEN, totalPriceWei, address, 0n, '', metadata]
    });
    if (expectedTokens <= 0n) throw new Error('Mint preview returned zero; refusing a floorless payment.');
    const computedFloor = expectedTokens * 95n / 100n;
    const minReturnedTokens = computedFloor > 0n ? computedFloor : 1n;

    const { request } = await publicClient.simulateContract({
      ...call, args: [PROJECT_ID, NATIVE_TOKEN, totalPriceWei, address, minReturnedTokens, '', metadata]
    });
    const hash = await walletClient.writeContract(request);
    await waitForSuccess(publicClient, hash, { prove: proveMint });
    return hash;
  }
</script>
```

Tier prices come from `JB721TiersHookStore.tiersOf(...)` (see `/jb-nft-gallery-ui` for the full tier struct and gallery). Tier prices are denominated in the hook's pricing context — check `hook.pricingContext()` which returns `(currency, decimals)`; for ETH-priced hooks the paid ETH must cover the sum of tier prices.

## Template: Project Admin UI

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Admin</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    body { max-width: 640px; margin: 0 auto; }
    .subtitle { color: var(--text-muted); margin-bottom: 1.5rem; }
    h2 { font-size: 1rem; color: var(--text-muted); margin: 1rem 0 0.75rem; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <h1>Project #<span id="project-id">1</span> Admin</h1>
  <p class="subtitle">Manage treasury operations</p>

  <div class="card">
    <button id="connect-btn" class="btn" onclick="connectWallet()">Connect Wallet</button>
    <div id="wallet-status" class="hidden">
      <div class="stat-row"><span class="stat-label">Connected</span><span class="stat-value" id="wallet-address"></span></div>
      <div class="stat-row"><span class="stat-label">Owner Status</span><span class="stat-value" id="owner-status">Checking...</span></div>
    </div>
  </div>

  <div class="card" id="treasury-card">
    <h2>Treasury Status</h2>
    <div class="stat-row"><span class="stat-label">Surplus</span><span class="stat-value" id="treasury-surplus">-</span></div>
    <div class="stat-row"><span class="stat-label">Pending Reserved Tokens</span><span class="stat-value" id="pending-reserved">-</span></div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="showTab('payouts')">Send Payouts</div>
    <div class="tab" onclick="showTab('allowance')">Use Allowance</div>
    <div class="tab" onclick="showTab('reserved')">Reserved</div>
  </div>

  <div id="payouts-tab" class="tab-content active">
    <div class="card">
      <h2>Distribute to Splits</h2>
      <label>Amount to Distribute (ETH)</label>
      <input type="number" id="payout-amount" placeholder="0.0" step="0.01">
      <button class="btn" onclick="sendPayouts()">Send Payouts</button>
    </div>
  </div>

  <div id="allowance-tab" class="tab-content">
    <div class="card">
      <h2>Use Surplus Allowance</h2>
      <label>Amount to Withdraw (ETH)</label>
      <input type="number" id="allowance-amount" placeholder="0.0" step="0.01">
      <label>Beneficiary Address</label>
      <input type="text" id="allowance-beneficiary" placeholder="0x... (defaults to connected wallet)">
      <button class="btn" onclick="useAllowance()">Withdraw from Surplus</button>
    </div>
  </div>

  <div id="reserved-tab" class="tab-content">
    <div class="card">
      <h2>Distribute Reserved Tokens</h2>
      <button class="btn" onclick="sendReservedTokens()">Distribute Reserved Tokens</button>
    </div>
  </div>

  <div id="tx-status" class="card hidden">
    <span id="tx-state"></span>
    <a id="tx-link" href="#" target="_blank" class="hidden">View transaction</a>
  </div>

  <script type="module">
    import { createPublicClient, createWalletClient, http, custom, formatEther, parseEther } from 'viem';
    import { CHAIN_CONFIGS, getContractAddress, resolveTerminal, truncateAddress, getTxUrl, waitForSuccess } from '/references/shared/wallet-utils.js';

    const PROJECT_ID = 1n;
    const CHAIN_ID = 1;
    const SLIPPAGE_BPS = 500n; // 5% floor below the simulated result
    const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';
    // Currency for native-token payout limits / allowances: uint32(uint160(NATIVE_TOKEN)).
    // Must match the currency the project configured in its fund access limit groups — limits are often
    // set in JBCurrencyIds (1 = ETH, 2 = USD); read them with
    // JBFundAccessLimits.payoutLimitsOf(projectId, rulesetId, terminal, token) / surplusAllowancesOf(...)
    // and pass that group's `currency` (amount in that currency's decimals) instead.
    const NATIVE_TOKEN_CURRENCY = 61166n;

    const TERMINAL_ABI = [
      { name: 'sendPayoutsOf', type: 'function', stateMutability: 'nonpayable',
        inputs: [
          { name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }, { name: 'currency', type: 'uint256' },
          { name: 'minTokensPaidOut', type: 'uint256' }
        ],
        outputs: [{ name: 'amountPaidOut', type: 'uint256' }]
      },
      { name: 'useAllowanceOf', type: 'function', stateMutability: 'nonpayable',
        inputs: [
          { name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }, { name: 'currency', type: 'uint256' },
          { name: 'minTokensPaidOut', type: 'uint256' }, { name: 'beneficiary', type: 'address' },
          { name: 'feeBeneficiary', type: 'address' }, { name: 'memo', type: 'string' }
        ],
        outputs: [{ name: 'netAmountPaidOut', type: 'uint256' }]
      },
      { name: 'currentSurplusOf', type: 'function', stateMutability: 'view',
        inputs: [
          { name: 'projectId', type: 'uint256' }, { name: 'tokens', type: 'address[]' },
          { name: 'decimals', type: 'uint256' }, { name: 'currency', type: 'uint256' }
        ],
        outputs: [{ type: 'uint256' }]
      }
    ];

    const CONTROLLER_ABI = [
      { name: 'sendReservedTokensToSplitsOf', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: 'projectId', type: 'uint256' }],
        outputs: [{ type: 'uint256' }]
      },
      { name: 'pendingReservedTokenBalanceOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'projectId', type: 'uint256' }],
        outputs: [{ type: 'uint256' }]
      }
    ];

    const PROJECTS_ABI = [
      { name: 'ownerOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ type: 'address' }]
      }
    ];

    let publicClient, walletClient, address, terminal;

    document.getElementById('project-id').textContent = PROJECT_ID.toString();

    window.showTab = function(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    };

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install MetaMask'); return; }

      const chain = CHAIN_CONFIGS[CHAIN_ID];
      publicClient = createPublicClient({ chain, transport: http() });
      walletClient = createWalletClient({ chain, transport: custom(window.ethereum) });

      const [addr] = await walletClient.requestAddresses();
      address = addr;

      document.getElementById('wallet-address').textContent = truncateAddress(address);
      document.getElementById('wallet-status').classList.remove('hidden');
      document.getElementById('connect-btn').classList.add('hidden');

      const projects = await getContractAddress(CHAIN_ID, 'JBProjects');
      const owner = await publicClient.readContract({ address: projects, abi: PROJECTS_ABI, functionName: 'ownerOf', args: [PROJECT_ID] });
      const isOwner = owner.toLowerCase() === address.toLowerCase();
      document.getElementById('owner-status').textContent = isOwner ? 'Owner' : 'Not Owner';

      await loadTreasuryStats();
    };

    async function loadTreasuryStats() {
      const controller = await getContractAddress(CHAIN_ID, 'JBController');
      const resolved = await resolveTerminal(publicClient, PROJECT_ID, NATIVE_TOKEN);
      terminal = resolved.terminal;

      const [surplus, pendingReserved] = await Promise.all([
        publicClient.readContract({ address: terminal, abi: TERMINAL_ABI, functionName: 'currentSurplusOf', args: [PROJECT_ID, [], BigInt(resolved.context.decimals), BigInt(resolved.context.currency)] }),
        publicClient.readContract({ address: controller, abi: CONTROLLER_ABI, functionName: 'pendingReservedTokenBalanceOf', args: [PROJECT_ID] })
      ]);

      document.getElementById('treasury-surplus').textContent = `${parseFloat(formatEther(surplus)).toFixed(4)} ETH`;
      document.getElementById('pending-reserved').textContent = parseInt(formatEther(pendingReserved)).toLocaleString() + ' tokens';
    }

    window.sendPayouts = async function() {
      const amount = document.getElementById('payout-amount').value;
      if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount'); return; }

      showTxPending('Please confirm in wallet...');

      try {
        // `amount` is denominated in `currency` (here: native-token accounting currency).
        // The terminal auto-caps at the remaining payout limit. Empty fund access limits = zero payouts.
        // Simulate first; the simulated amountPaidOut sets the floor (guards a moved price feed).
        const call = { address: terminal, abi: TERMINAL_ABI, functionName: 'sendPayoutsOf', account: address };
        const { result: expectedOut } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, parseEther(amount), NATIVE_TOKEN_CURRENCY, 0n]
        });
        if (expectedOut <= 0n) throw new Error('Payout preview returned zero; refusing to submit.');
        const minTokensPaidOut = expectedOut * (10_000n - SLIPPAGE_BPS) / 10_000n || 1n;
        const { request } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, parseEther(amount), NATIVE_TOKEN_CURRENCY, minTokensPaidOut]
        });
        const hash = await walletClient.writeContract(request);
        showTxSent(hash);
        await waitForSuccess(publicClient, hash);
        showTxConfirmed();
        await loadTreasuryStats();
      } catch (error) { showTxError(error); }
    };

    window.useAllowance = async function() {
      const amount = document.getElementById('allowance-amount').value;
      const beneficiary = document.getElementById('allowance-beneficiary').value || address;
      if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount'); return; }

      showTxPending('Please confirm in wallet...');

      try {
        // feeBeneficiary receives the fee project's tokens minted in exchange for the 2.5% fee.
        const call = { address: terminal, abi: TERMINAL_ABI, functionName: 'useAllowanceOf', account: address };
        const { result: expectedOut } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, parseEther(amount), NATIVE_TOKEN_CURRENCY, 0n, beneficiary, address, 'Surplus allowance withdrawal']
        });
        if (expectedOut <= 0n) throw new Error('Allowance preview returned zero; refusing to submit.');
        const minTokensPaidOut = expectedOut * (10_000n - SLIPPAGE_BPS) / 10_000n || 1n;
        const { request } = await publicClient.simulateContract({
          ...call, args: [PROJECT_ID, NATIVE_TOKEN, parseEther(amount), NATIVE_TOKEN_CURRENCY, minTokensPaidOut, beneficiary, address, 'Surplus allowance withdrawal']
        });
        const hash = await walletClient.writeContract(request);
        showTxSent(hash);
        await waitForSuccess(publicClient, hash);
        showTxConfirmed();
        await loadTreasuryStats();
      } catch (error) { showTxError(error); }
    };

    window.sendReservedTokens = async function() {
      const controller = await getContractAddress(CHAIN_ID, 'JBController');
      showTxPending('Please confirm in wallet...');

      try {
        const hash = await walletClient.writeContract({
          address: controller,
          abi: CONTROLLER_ABI,
          functionName: 'sendReservedTokensToSplitsOf',
          args: [PROJECT_ID],
          account: address
        });
        showTxSent(hash);
        await waitForSuccess(publicClient, hash);
        showTxConfirmed();
        await loadTreasuryStats();
      } catch (error) { showTxError(error); }
    };

    function showTxPending(msg) {
      document.getElementById('tx-status').classList.remove('hidden');
      document.getElementById('tx-state').textContent = msg;
      document.getElementById('tx-link').classList.add('hidden');
    }
    function showTxSent(hash) {
      document.getElementById('tx-state').textContent = 'Transaction sent...';
      const link = document.getElementById('tx-link');
      link.href = getTxUrl(CHAIN_ID, hash);
      link.classList.remove('hidden');
    }
    function showTxConfirmed() { document.getElementById('tx-state').textContent = 'Transaction confirmed!'; }
    function showTxError(error) { document.getElementById('tx-state').textContent = error.shortMessage || error.message; }
  </script>
</body>
</html>
```

## Template: Claim Tokens UI

Credits (unclaimed token balances tracked by `JBTokens`) convert to ERC-20 tokens via `JBController.claimTokensFor`. Only possible once the project has deployed an ERC-20 (`JBTokens.tokenOf(projectId) != address(0)`).

```html
<script type="module">
  import { createPublicClient, createWalletClient, http, custom, formatEther, parseEther, zeroAddress } from 'viem';
  import { CHAIN_CONFIGS, getContractAddress } from '/references/shared/wallet-utils.js';

  const PROJECT_ID = 1n;
  const CHAIN_ID = 1;

  const CONTROLLER_ABI = [
    { name: 'claimTokensFor', type: 'function', stateMutability: 'nonpayable',
      inputs: [
        { name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' },
        { name: 'tokenCount', type: 'uint256' }, { name: 'beneficiary', type: 'address' }
      ],
      outputs: []
    }
  ];

  const TOKENS_ABI = [
    { name: 'creditBalanceOf', type: 'function', stateMutability: 'view',
      inputs: [{ name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' }],
      outputs: [{ type: 'uint256' }]
    },
    { name: 'tokenOf', type: 'function', stateMutability: 'view',
      inputs: [{ name: 'projectId', type: 'uint256' }],
      outputs: [{ type: 'address' }]
    },
    { name: 'totalBalanceOf', type: 'function', stateMutability: 'view',
      inputs: [{ name: 'holder', type: 'address' }, { name: 'projectId', type: 'uint256' }],
      outputs: [{ type: 'uint256' }]
    }
  ];

  async function loadBalances(publicClient, address) {
    const tokens = await getContractAddress(CHAIN_ID, 'JBTokens');

    const [tokenAddr, creditBalance, totalBalance] = await Promise.all([
      publicClient.readContract({ address: tokens, abi: TOKENS_ABI, functionName: 'tokenOf', args: [PROJECT_ID] }),
      publicClient.readContract({ address: tokens, abi: TOKENS_ABI, functionName: 'creditBalanceOf', args: [address, PROJECT_ID] }),
      publicClient.readContract({ address: tokens, abi: TOKENS_ABI, functionName: 'totalBalanceOf', args: [address, PROJECT_ID] })
    ]);

    return {
      hasToken: tokenAddr !== zeroAddress,   // no ERC-20 deployed => credits cannot be claimed yet
      creditBalance,
      erc20Balance: totalBalance - creditBalance
    };
  }

  async function claim(amount, walletClient, address) {
    const controller = await getContractAddress(CHAIN_ID, 'JBController');
    // Caller must be `holder` or hold the CLAIM_TOKENS permission for the holder.
    return walletClient.writeContract({
      address: controller,
      abi: CONTROLLER_ABI,
      functionName: 'claimTokensFor',
      args: [address, PROJECT_ID, parseEther(amount), address],
      account: address
    });
  }
</script>
```

## Template: Project Dashboard (read-only)

Use the `CONTROLLER_ABI` from the payment template (`currentRulesetOf`, `totalTokenSupplyWithReservedTokensOf`) plus `JBProjects.ownerOf`. Display mappings:

| Field | Display |
|-------|---------|
| `ruleset.duration` | seconds; `0` = rulesets last indefinitely |
| `ruleset.weight` | tokens per unit of `baseCurrency`, 18-decimal fixed point |
| `ruleset.weightCutPercent` | out of `1_000_000_000`; `/ 1e7` = % cut per cycle |
| `metadata.reservedPercent` | out of `10_000`; `/ 100` = % |
| `metadata.cashOutTaxRate` | out of `10_000`; `/ 100` = %; `0` = proportional reclaim |
| `metadata.baseCurrency` | `1` = ETH, `2` = USD, else `uint32(uint160(token))` |
| `metadata.dataHook` | `address(0)` = none |

## Fetching data with Bendystraw

Prefer Bendystraw for indexed, cross-chain data. The keyed endpoint is REQUIRED in browsers — the keyless `/graphql` route is CORS-locked to a single origin.

```javascript
// Mainnet chains: https://bendystraw.up.railway.app/{API_KEY}/graphql (the production host; bendystraw.xyz lags)
// Testnet chains: https://testnet.bendystraw.xyz/{API_KEY}/graphql
// Contact @peripheralist on X for an API key. Use a server-side proxy in production.
async function bendystrawQuery(query, variables = {}) {
  const res = await fetch('https://bendystraw.up.railway.app/' + API_KEY + '/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  return body.data;
}

// Get project stats. The `version` argument is REQUIRED — pass 6.
async function getProjectStats(projectId, chainId) {
  return bendystrawQuery(`
    query($projectId: Float!, $chainId: Float!, $version: Float!) {
      project(projectId: $projectId, chainId: $chainId, version: $version) {
        name handle logoUri owner
        balance volume volumeUsd
        tokenSupply token tokenSymbol
        paymentsCount contributorsCount
        suckerGroupId
      }
    }
  `, { projectId, chainId, version: 6 });
}
```

## Generation guidelines

1. **Project ID as config** — make it easy to change which project the UI targets
2. **Network switching** — detect wrong network and prompt user to switch
3. **Real previews** — use `currentRulesetOf` weight for pay previews, `previewCashOutFrom` for cash out previews; never hardcode rates
4. **Error handling** — catch wallet rejections and contract reverts gracefully
5. **Loading states** — disable buttons during transactions
6. **Read-only mode** — support viewing data without wallet connection

## Common mistakes

- **Wrong metadata format for NFT mints** — pay metadata must be the `JBMetadataResolver` envelope keyed to `hook.METADATA_ID_TARGET()` (the implementation address, not the clone). Bare `abi.encode(bytes4, bool, uint16[])` is ignored: payment succeeds, no NFT mints.
- **`minTokensReclaimed` decimals** — denominated in the terminal token's accounting-context decimals (6 for USDC), not 18.
- **`sendPayoutsOf` amount is in the `currency` you pass** — a USD-denominated limit on a USDC terminal expects the amount in that currency's decimals. Empty fund access limit groups mean ZERO payouts (the call pays out nothing).
- **`reservedPercent`, not `reservedRate`** — and the metadata tuple has 19 fields in the exact order above; a wrong field order silently mis-decodes every ruleset read.
- **Paying ERC-20 without approval** — `pay` pulls ERC-20s via `transferFrom`; approve the terminal first and send `value: 0`.
- **Assuming weight = tokens per ETH** — weight is per unit of `baseCurrency`. USD-based projects convert the ETH payment through `JBPrices` first.
- **Hardcoding `JBMultiTerminal` / `61166` / 18 decimals** — resolve the terminal with `resolveTerminal` and take `decimals`/`currency` from its accounting context; `currentSurplusOf(..., 18, 61166)` reverts with `JBPrices_PriceFeedNotFound` on a project whose contexts include a token with no feed to 61166.
- **Keyless Bendystraw endpoint** — CORS-fails outside the prod app origin; always use the keyed route.

## Related skills

- `/jb-deploy-ui` — UIs for deploying new projects
- `/jb-omnichain-ui` — Multi-chain UIs with Relayr & Bendystraw
- `/jb-nft-gallery-ui` — Tier browsing and NFT galleries
- `/jb-query` — Direct contract queries
- `/jb-v6-api` — Contract function signatures
