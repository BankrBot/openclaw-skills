---
name: jb-event-explorer-ui
description: |
  Event browser UI for Juicebox V6 projects. Use when: (1) building activity feeds
  showing payments and cash outs, (2) debugging transactions by viewing emitted
  events, (3) creating historical views of project activity, (4) need filtered
  event lists by type/project/time with decoded parameters.
version: 6.0.0
---

# Juicebox V6 Event Explorer UI

Browse, filter, and decode Juicebox protocol events. See payment history, cash outs, payouts, and configuration changes.

## Uses shared components

| Component | Purpose |
|-----------|---------|
| `references/shared/styles.css` | Dark theme, buttons, cards, badges |
| `references/shared/wallet-utils.js` | Chain config, formatting utilities |
| `references/shared/chain-config.json` | RPC URLs, contract addresses (8 chains) |
| `references/shared/abis/*.json` | Verified event signatures |

## Event signatures (verified against references/shared/abis)

Emitted by `JBMultiTerminal`:

```solidity
event Pay(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address payer, address beneficiary, uint256 amount, uint256 newlyIssuedTokenCount, string memo, bytes metadata, address caller)
event CashOutTokens(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address holder, address beneficiary, uint256 cashOutCount, uint256 cashOutTaxRate, uint256 reclaimAmount, bytes metadata, address caller)
event SendPayouts(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address projectOwner, uint256 amount, uint256 amountPaidOut, uint256 fee, uint256 netLeftoverPayoutAmount, address caller)
event SendPayoutToSplit(uint256 indexed projectId, uint256 indexed rulesetId, uint256 indexed group, JBSplit split, uint256 amount, uint256 netAmount, address caller)
event UseAllowance(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address beneficiary, address feeBeneficiary, uint256 amount, uint256 amountPaidOut, uint256 netAmountPaidOut, string memo, address caller)
event AddToBalance(uint256 indexed projectId, uint256 amount, uint256 returnedFees, string memo, bytes metadata, address caller)
event HoldFee(uint256 indexed projectId, address indexed token, uint256 indexed amount, uint256 fee, address beneficiary, address caller)
event ProcessFee(uint256 indexed projectId, address indexed token, uint256 indexed amount, bool wasHeld, address beneficiary, address caller)
```

Emitted by `JBController`:

```solidity
event LaunchProject(uint256 rulesetId, uint256 projectId, string projectUri, string memo, address caller)
event LaunchRulesets(uint256 rulesetId, uint256 projectId, string projectUri, string memo, address caller)
event QueueRulesets(uint256 rulesetId, uint256 projectId, string memo, address caller)
event MintTokens(address indexed beneficiary, uint256 indexed projectId, uint256 tokenCount, uint256 beneficiaryTokenCount, string memo, uint256 reservedPercent, address caller)
event BurnTokens(address indexed holder, uint256 indexed projectId, uint256 tokenCount, string memo, address caller)
event SendReservedTokensToSplits(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address owner, uint256 tokenCount, uint256 leftoverAmount, address caller)
```

`JBSplit` tuple: `(uint32 percent, uint64 projectId, address beneficiary, bool preferAddToBalance, uint48 lockedUntil, address hook)`.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Event Explorer                         │
├─────────────────────────────────────────────────────────┤
│  Project: [____] Chain: [▼] Event Type: [▼] [Search]   │
├─────────────────────────────────────────────────────────┤
│  ┌─ Pay ─────────────────────────────── 2 min ago ───┐  │
│  │ 0xabc...def paid 1.5 ETH → Project 42             │  │
│  │ Tokens: 1,500 · Memo: "Supporting the project"    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─ CashOut ─────────────────────────── 15 min ago ──┐  │
│  │ 0x123...456 cashed out 500 tokens for 0.4 ETH     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Complete event explorer template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Juicebox Event Explorer</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    .event-card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 0.75rem; overflow: hidden; }
    .event-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; cursor: pointer; }
    .event-header:hover { background: var(--bg-hover); }
    .event-type { display: flex; align-items: center; gap: 0.5rem; }
    .event-time { font-size: 0.75rem; color: var(--text-muted); }
    .event-summary { font-size: 0.875rem; padding: 0 1rem 0.75rem; }
    .event-details { padding: 1rem; border-top: 1px solid var(--border-color); display: none; }
    .event-details.open { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Event Explorer</h1>
    <p class="subtitle">Browse all Juicebox project events</p>

    <!-- Filters -->
    <div class="card">
      <div class="filters">
        <div class="filter-group">
          <label>Project ID</label>
          <input type="number" id="filter-project" placeholder="All projects" style="width: 120px;">
        </div>

        <div class="filter-group">
          <label>Chain</label>
          <select id="filter-chain" style="width: 150px;">
            <option value="1">Ethereum</option>
            <option value="10">Optimism</option>
            <option value="8453">Base</option>
            <option value="42161">Arbitrum</option>
            <option value="11155111">Sepolia</option>
            <option value="11155420">OP Sepolia</option>
            <option value="84532">Base Sepolia</option>
            <option value="421614">Arb Sepolia</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Event Type</label>
          <select id="filter-type" style="width: 150px;">
            <option value="">All Events</option>
            <option value="Pay">Payments</option>
            <option value="CashOutTokens">Cash Outs</option>
            <option value="SendPayouts">Payouts</option>
            <option value="MintTokens">Token Mints</option>
            <option value="LaunchProject">Project Launches</option>
            <option value="QueueRulesets">Ruleset Changes</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Time Range</label>
          <select id="filter-time" style="width: 130px;">
            <option value="1000">Last 1000 blocks</option>
            <option value="5000">Last 5000 blocks</option>
            <option value="10000">Last 10000 blocks</option>
            <option value="50000">Last 50000 blocks</option>
          </select>
        </div>

        <button onclick="loadEvents()">Search</button>

        <div style="margin-left: auto;">
          <label class="live-indicator" style="cursor: pointer;">
            <input type="checkbox" id="live-toggle" onchange="toggleLive()" style="display: none;">
            <span class="live-dot inactive" id="live-dot"></span>
            Live Updates
          </label>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value" id="stat-total">-</div>
          <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-payments">-</div>
          <div class="stat-label">Payments</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-volume">-</div>
          <div class="stat-label">Volume (ETH)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-unique">-</div>
          <div class="stat-label">Unique Addresses</div>
        </div>
      </div>
    </div>

    <!-- Events List -->
    <div id="events-container">
      <div class="loading">Select filters and search to load events</div>
    </div>

    <!-- Pagination -->
    <div class="pagination hidden" id="pagination"></div>
  </div>

  <script type="module">
    import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'https://esm.sh/viem';
    import {
      CHAIN_CONFIGS,
      CHAINS,
      loadChainConfig,
      truncateAddress,
      formatEth,
      formatNumber,
      formatTimeAgo
    } from '/references/shared/wallet-utils.js';

    // State
    let events = [];
    let currentPage = 1;
    let liveUpdateInterval = null;
    const EVENTS_PER_PAGE = 20;

    // Event signatures — verified against references/shared/abis (JBMultiTerminal.json, JBController.json)
    const EVENT_ABIS = {
      'Pay': parseAbiItem('event Pay(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address payer, address beneficiary, uint256 amount, uint256 newlyIssuedTokenCount, string memo, bytes metadata, address caller)'),
      'CashOutTokens': parseAbiItem('event CashOutTokens(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address holder, address beneficiary, uint256 cashOutCount, uint256 cashOutTaxRate, uint256 reclaimAmount, bytes metadata, address caller)'),
      'SendPayouts': parseAbiItem('event SendPayouts(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address projectOwner, uint256 amount, uint256 amountPaidOut, uint256 fee, uint256 netLeftoverPayoutAmount, address caller)'),
      'MintTokens': parseAbiItem('event MintTokens(address indexed beneficiary, uint256 indexed projectId, uint256 tokenCount, uint256 beneficiaryTokenCount, string memo, uint256 reservedPercent, address caller)'),
      'LaunchProject': parseAbiItem('event LaunchProject(uint256 rulesetId, uint256 projectId, string projectUri, string memo, address caller)'),
      'QueueRulesets': parseAbiItem('event QueueRulesets(uint256 rulesetId, uint256 projectId, string memo, address caller)')
    };

    // Make functions available globally
    window.loadEvents = loadEvents;
    window.toggleLive = toggleLive;
    window.toggleEvent = toggleEvent;

    // Load events
    async function loadEvents() {
      const projectId = document.getElementById('filter-project').value;
      const chainId = parseInt(document.getElementById('filter-chain').value);
      const eventType = document.getElementById('filter-type').value;
      const blockRange = parseInt(document.getElementById('filter-time').value);

      const container = document.getElementById('events-container');
      container.innerHTML = '<div class="loading">Loading events...</div>';

      try {
        const config = await loadChainConfig();
        const chainConfig = config.chains[chainId];

        if (!chainConfig) {
          container.innerHTML = '<div class="empty">Chain not configured</div>';
          return;
        }

        // Create viem client
        const client = createPublicClient({
          chain: CHAIN_CONFIGS[chainId],
          transport: http(chainConfig.rpc)
        });

        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock - BigInt(blockRange);

        // Get contract addresses (same on every chain)
        const terminalAddress = chainConfig.contracts.JBMultiTerminal;
        const controllerAddress = chainConfig.contracts.JBController;

        if (!terminalAddress) {
          container.innerHTML = '<div class="empty">Contract addresses not configured for this chain</div>';
          return;
        }

        // Fetch logs from both contracts
        const logs = await client.getLogs({
          address: [terminalAddress, controllerAddress].filter(Boolean),
          fromBlock,
          toBlock: 'latest'
        });

        // Parse and filter events
        events = [];
        const uniqueAddresses = new Set();
        let totalVolume = 0n;
        let paymentCount = 0;

        for (const log of logs) {
          try {
            // Try to match event signature
            let parsed = null;
            let eventName = null;

            for (const [name, abi] of Object.entries(EVENT_ABIS)) {
              try {
                const decoded = decodeEventLog({
                  abi: [abi],
                  data: log.data,
                  topics: log.topics
                });
                if (decoded) {
                  parsed = decoded;
                  eventName = name;
                  break;
                }
              } catch (e) {
                // Try next event type
              }
            }

            if (!parsed) continue;

            // Filter by event type
            if (eventType && eventName !== eventType) continue;

            // Filter by project ID
            if (projectId && parsed.args.projectId?.toString() !== projectId) continue;

            // Get block timestamp
            const block = await client.getBlock({ blockNumber: log.blockNumber });

            const event = {
              name: eventName,
              args: parsed.args,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp),
              chainId
            };

            events.push(event);

            // Stats
            if (eventName === 'Pay') {
              paymentCount++;
              totalVolume += parsed.args.amount || 0n;
              uniqueAddresses.add(parsed.args.payer);
            }
            if (parsed.args.beneficiary) {
              uniqueAddresses.add(parsed.args.beneficiary);
            }

          } catch (e) {
            // Skip unparseable
          }
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp - a.timestamp);

        // Update stats
        document.getElementById('stat-total').textContent = events.length;
        document.getElementById('stat-payments').textContent = paymentCount;
        document.getElementById('stat-volume').textContent = formatEth(totalVolume);
        document.getElementById('stat-unique').textContent = uniqueAddresses.size;

        // Render
        currentPage = 1;
        renderEvents();

      } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="empty">Error loading events: ${error.message}</div>`;
      }
    }

    // Render events
    function renderEvents() {
      const container = document.getElementById('events-container');
      const start = (currentPage - 1) * EVENTS_PER_PAGE;
      const pageEvents = events.slice(start, start + EVENTS_PER_PAGE);

      if (pageEvents.length === 0) {
        container.innerHTML = '<div class="empty">No events found</div>';
        document.getElementById('pagination').classList.add('hidden');
        return;
      }

      container.innerHTML = pageEvents.map((event, i) => renderEvent(event, start + i)).join('');

      // Pagination
      const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);
      if (totalPages > 1) {
        const pagination = document.getElementById('pagination');
        pagination.classList.remove('hidden');
        pagination.innerHTML = '';

        for (let p = 1; p <= Math.min(totalPages, 10); p++) {
          const btn = document.createElement('button');
          btn.className = `page-btn btn-secondary ${p === currentPage ? 'active' : ''}`;
          btn.textContent = p;
          btn.onclick = () => { currentPage = p; renderEvents(); };
          pagination.appendChild(btn);
        }
      } else {
        document.getElementById('pagination').classList.add('hidden');
      }
    }

    // Render single event
    function renderEvent(event, index) {
      const badge = getEventBadge(event.name);
      const summary = getEventSummary(event);
      const details = getEventDetails(event);
      const timeAgo = formatTimeAgo(event.timestamp);
      const explorer = CHAINS[event.chainId]?.explorer || 'https://etherscan.io';

      return `
        <div class="event-card">
          <div class="event-header" onclick="toggleEvent(${index})">
            <div class="event-type">
              <span class="event-badge ${badge.class}">${badge.label}</span>
              <span>${summary.title}</span>
            </div>
            <span class="event-time">${timeAgo}</span>
          </div>
          <div class="event-summary">${summary.description}</div>
          <div class="event-details" id="event-${index}">
            ${details.map(d => `
              <div class="detail-row">
                <span class="detail-label">${d.label}</span>
                <span class="detail-value">${d.value}</span>
              </div>
            `).join('')}
            <div class="detail-row mt-sm" style="padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
              <span class="detail-label">Transaction</span>
              <span class="detail-value">
                <a href="${explorer}/tx/${event.txHash}" target="_blank">
                  ${event.txHash.slice(0, 10)}...${event.txHash.slice(-8)}
                </a>
              </span>
            </div>
          </div>
        </div>
      `;
    }

    // Get event badge
    function getEventBadge(name) {
      const badges = {
        'Pay': { label: 'Pay', class: 'pay' },
        'CashOutTokens': { label: 'Cash Out', class: 'cashout' },
        'SendPayouts': { label: 'Payout', class: 'distribute' },
        'MintTokens': { label: 'Mint', class: 'mint' },
        'LaunchProject': { label: 'Launch', class: 'config' },
        'QueueRulesets': { label: 'Config', class: 'config' }
      };
      return badges[name] || { label: name, class: 'config' };
    }

    // Get event summary
    function getEventSummary(event) {
      const args = event.args;

      switch (event.name) {
        case 'Pay':
          return {
            title: `Project ${args.projectId}`,
            description: `${truncateAddress(args.payer)} paid ${formatEth(args.amount)} → ${formatNumber(args.newlyIssuedTokenCount)} tokens${args.memo ? ` · "${args.memo}"` : ''}`
          };

        case 'CashOutTokens':
          return {
            title: `Project ${args.projectId}`,
            description: `${truncateAddress(args.holder)} cashed out ${formatNumber(args.cashOutCount)} tokens for ${formatEth(args.reclaimAmount)}`
          };

        case 'SendPayouts':
          return {
            title: `Project ${args.projectId}`,
            description: `Paid out ${formatEth(args.amountPaidOut)} (fee: ${formatEth(args.fee)}, leftover to owner ${truncateAddress(args.projectOwner)}: ${formatEth(args.netLeftoverPayoutAmount)})`
          };

        case 'MintTokens':
          return {
            title: `Project ${args.projectId}`,
            description: `Minted ${formatNumber(args.tokenCount)} tokens to ${truncateAddress(args.beneficiary)}`
          };

        case 'LaunchProject':
          return {
            title: `Project ${args.projectId}`,
            description: `New project launched${args.memo ? ` · "${args.memo}"` : ''}`
          };

        case 'QueueRulesets':
          return {
            title: `Project ${args.projectId}`,
            description: `Queued new ruleset #${args.rulesetId}`
          };

        default:
          return {
            title: event.name,
            description: JSON.stringify(args)
          };
      }
    }

    // Get event details
    function getEventDetails(event) {
      const args = event.args;
      const details = [];
      const explorer = CHAINS[event.chainId]?.explorer || 'https://etherscan.io';

      // Add all named arguments
      for (const key of Object.keys(args)) {
        if (isNaN(key)) {
          let value = args[key];

          if (typeof value === 'bigint') {
            if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('count') || key.toLowerCase().includes('supply')) {
              value = formatEth(value) + ' (18-dec) / ' + formatNumber(value) + ' raw';
            } else {
              value = value.toString();
            }
          } else if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
            value = `<a href="${explorer}/address/${value}" target="_blank">${truncateAddress(value)}</a>`;
          }

          details.push({ label: key, value: String(value) });
        }
      }

      details.push({ label: 'Block', value: event.blockNumber.toString() });

      return details;
    }

    // Toggle event details
    function toggleEvent(index) {
      const details = document.getElementById(`event-${index}`);
      details.classList.toggle('open');
    }

    // Live updates
    function toggleLive() {
      const checkbox = document.getElementById('live-toggle');
      const dot = document.getElementById('live-dot');

      if (checkbox.checked) {
        dot.classList.remove('inactive');
        liveUpdateInterval = setInterval(loadEvents, 15000);
      } else {
        dot.classList.add('inactive');
        clearInterval(liveUpdateInterval);
      }
    }
  </script>
</body>
</html>
```

---

## Event types reference

| Event | Contract | Description |
|-------|----------|-------------|
| `Pay` | JBMultiTerminal | Payment received |
| `CashOutTokens` | JBMultiTerminal | Token cash out |
| `SendPayouts` | JBMultiTerminal | Payout distribution (aggregate) |
| `SendPayoutToSplit` | JBMultiTerminal | Per-split payout leg |
| `UseAllowance` | JBMultiTerminal | Surplus allowance used |
| `AddToBalance` | JBMultiTerminal | Balance added without minting |
| `HoldFee` / `ProcessFee` | JBMultiTerminal | Fee held / processed |
| `MintTokens` | JBController | Direct token mint |
| `BurnTokens` | JBController | Token burn |
| `LaunchProject` | JBController | New project created |
| `LaunchRulesets` | JBController | First rulesets queued for an existing project |
| `QueueRulesets` | JBController | Ruleset queued |
| `SendReservedTokensToSplits` | JBController | Reserved tokens distributed |
| `RulesetQueued` / `RulesetInitialized` | JBRulesets | Low-level ruleset storage events |

## Common mistakes

- **`Pay` token field is `newlyIssuedTokenCount`**, not `beneficiaryTokenCount`. Decoding with the wrong name silently drops the field.
- **`SendPayouts` carries `projectOwner` and `netLeftoverPayoutAmount`**; there is no `beneficiary` field on the aggregate event. Per-recipient data is on `SendPayoutToSplit`.
- **`LaunchProject` has 5 fields** (`rulesetId, projectId, projectUri, memo, caller`) — omitting `projectUri` breaks the topic0 hash and the event never matches.
- **`amount` is not always 18-decimal ETH**: terminals also accept ERC-20s (e.g. 6-decimal USDC). Check the project's accounting context before formatting with `formatEth`.
- **Public RPCs cap `eth_getLogs` ranges**: keep block ranges small or paginate requests.

---

## Related skills

- `/jb-explorer-ui` - Contract read/write interface
- `/jb-ruleset-timeline-ui` - Ruleset history
- `/jb-bendystraw` - Indexed event queries (preferred for deep history)
