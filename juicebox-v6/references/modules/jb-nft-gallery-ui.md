---
name: jb-nft-gallery-ui
description: |
  NFT gallery UI for Juicebox V6 721 hooks. Use when: (1) building a storefront to
  display and mint NFT tiers, (2) showing users their owned project NFTs,
  (3) creating tier browsing interfaces with metadata display, (4) need mint
  buttons with wallet connection for 721 projects.
version: 6.0.0
---

# Juicebox V6 NFT Gallery UI

Interactive gallery for browsing and managing NFTs from Juicebox 721 tiers hooks. Displays tier information, owned NFTs, and minting interfaces.

## Verified 721 facts

Verified against `nana-721-hook-v6`.

| Fact | Value |
|------|-------|
| Hook → store | `hook.STORE()` returns the `JB721TiersHookStore` address (also canonical in `references/shared/chain-config.json`) |
| Hook → project | `hook.projectId()` (lowercase — `uint256 public projectId`) |
| Hook → metadata target | `hook.METADATA_ID_TARGET()` — the shared implementation address all clones report; keys the pay metadata for mints |
| Hook → pricing | `hook.pricingContext()` returns `(uint256 currency, uint256 decimals)` — tier prices are denominated in this, not necessarily ETH |
| ERC-721 surface | `name()`, `symbol()`, `tokenURI(tokenId)`, `balanceOf(owner)`, `ownerOf(tokenId)`, `transferFrom(from,to,tokenId)`, plus `firstOwnerOf(tokenId)` |
| NOT enumerable | There is no `tokenOfOwnerByIndex` — enumerate owned NFTs via Bendystraw (below) or Transfer logs |
| Token ID encoding | `tokenId = tierId * 1_000_000_000 + tokenNumber`; `tierIdOfToken(tokenId) = tokenId / 1_000_000_000` (pure — compute client-side) |
| Collection supply | `store.totalSupplyOf(hook)` |
| Tiers | `store.tiersOf(address hook, uint256[] categories, bool includeResolvedUri, uint256 startingId, uint256 size)` — empty `categories` = all; `startingId = 0` = from the beginning |
| Discount | `tier.discountPercent` out of `DISCOUNT_DENOMINATOR = 200` |
| Mint mechanism | Pay the project's terminal with tier IDs in `JBMetadataResolver`-formatted metadata (see Minting below) |

`JB721Tier` struct (ABI order — use these exact types in the viem tuple):

| Field | Type |
|-------|------|
| `id` | `uint32` |
| `price` | `uint104` |
| `remainingSupply` | `uint32` |
| `initialSupply` | `uint32` |
| `votingUnits` | `uint104` |
| `reserveFrequency` | `uint16` |
| `reserveBeneficiary` | `address` |
| `encodedIpfsUri` | `bytes32` |
| `category` | `uint24` |
| `discountPercent` | `uint8` |
| `flags` | `tuple(bool allowOwnerMint, bool transfersPausable, bool cantBeRemoved, bool cantIncreaseDiscountPercent, bool cantBuyWithCredits)` |
| `splitPercent` | `uint32` |
| `resolvedUri` | `string` |

## NFT Gallery UI Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Juicebox NFT Gallery</title>
  <link rel="stylesheet" href="/references/shared/styles.css">
  <style>
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .nft-card { background: var(--bg-secondary); border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    .nft-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .nft-image { width: 100%; aspect-ratio: 1; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; position: relative; }
    .nft-image img { width: 100%; height: 100%; object-fit: cover; }
    .nft-image .placeholder { font-size: 48px; color: #444; }
    .tier-badge, .supply-badge, .owned-badge { position: absolute; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .tier-badge { top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: var(--jb-yellow); }
    .supply-badge { top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: var(--success); }
    .supply-badge.sold-out { color: var(--error); }
    .owned-badge { bottom: 10px; left: 10px; background: var(--success); color: #000; }
    .nft-info { padding: 15px; }
    .nft-name { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 5px; }
    .nft-meta { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-color); }
    .nft-price { font-size: 1.1rem; font-weight: 700; color: var(--jb-yellow); }
    .mint-btn { width: 100%; padding: 12px; background: var(--jb-yellow); color: #000; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 10px; }
    .mint-btn:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }
    .category-filter { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
    .category-chip { padding: 6px 14px; background: var(--bg-tertiary); border-radius: 20px; font-size: 13px; cursor: pointer; color: var(--text-muted); }
    .category-chip.active { background: var(--jb-yellow); color: #000; }
  </style>
</head>
<body>
  <div class="container">
    <h1>NFT Gallery</h1>

    <div class="card" style="margin-bottom: 20px;">
      <div class="input-row">
        <input type="text" id="hookAddress" placeholder="721 Hook Address (0x...)">
        <select id="chainSelect">
          <option value="1">Ethereum</option>
          <option value="10">Optimism</option>
          <option value="8453">Base</option>
          <option value="42161">Arbitrum</option>
          <option value="11155111">Sepolia</option>
        </select>
        <button class="btn" onclick="loadGallery()">Load Gallery</button>
      </div>
    </div>

    <div class="card" id="walletSection" style="display: none; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span id="walletStatus">Not connected</span>
          <span class="code" id="walletAddress" style="margin-left: 10px;"></span>
        </div>
        <button class="btn-secondary" id="connectBtn" onclick="connectWallet()">Connect Wallet</button>
      </div>
    </div>

    <div class="stats" id="statsBar" style="display: none; margin-bottom: 20px;">
      <div class="stat-card"><div class="stat-value" id="totalTiers">-</div><div class="stat-label">Total Tiers</div></div>
      <div class="stat-card"><div class="stat-value" id="totalMinted">-</div><div class="stat-label">Total Minted</div></div>
      <div class="stat-card"><div class="stat-value" id="totalSupply">-</div><div class="stat-label">Max Supply</div></div>
      <div class="stat-card"><div class="stat-value" id="floorPrice">-</div><div class="stat-label">Floor Price</div></div>
    </div>

    <div class="tabs" id="tabsContainer" style="display: none;">
      <div class="tab active" data-tab="tiers" onclick="switchTab('tiers')">All Tiers</div>
      <div class="tab" data-tab="owned" onclick="switchTab('owned')">My NFTs</div>
    </div>

    <div class="category-filter" id="categoryFilter"></div>
    <div id="galleryContainer"></div>
  </div>

  <script type="module">
    import { createPublicClient, http, formatUnits, isAddress, createWalletClient, custom, encodeAbiParameters, keccak256, parseAbiItem } from 'https://esm.sh/viem';
    import { CHAIN_CONFIGS, getContractAddress, truncateAddress } from '/references/shared/wallet-utils.js';

    const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe';

    const TIER_FLAGS = { name: 'flags', type: 'tuple', components: [
      { name: 'allowOwnerMint', type: 'bool' }, { name: 'transfersPausable', type: 'bool' },
      { name: 'cantBeRemoved', type: 'bool' }, { name: 'cantIncreaseDiscountPercent', type: 'bool' },
      { name: 'cantBuyWithCredits', type: 'bool' }
    ]};

    const HOOK_ABI = [
      { name: 'STORE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { name: 'projectId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { name: 'METADATA_ID_TARGET', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      { name: 'pricingContext', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'currency', type: 'uint256' }, { name: 'decimals', type: 'uint256' }] },
      { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
      { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
      { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
      { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
      { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] }
    ];

    const STORE_ABI = [
      { name: 'tiersOf', type: 'function', stateMutability: 'view',
        inputs: [
          { name: 'hook', type: 'address' }, { name: 'categories', type: 'uint256[]' },
          { name: 'includeResolvedUri', type: 'bool' }, { name: 'startingId', type: 'uint256' },
          { name: 'size', type: 'uint256' }
        ],
        outputs: [{ type: 'tuple[]', components: [
          { name: 'id', type: 'uint32' }, { name: 'price', type: 'uint104' },
          { name: 'remainingSupply', type: 'uint32' }, { name: 'initialSupply', type: 'uint32' },
          { name: 'votingUnits', type: 'uint104' }, { name: 'reserveFrequency', type: 'uint16' },
          { name: 'reserveBeneficiary', type: 'address' }, { name: 'encodedIpfsUri', type: 'bytes32' },
          { name: 'category', type: 'uint24' }, { name: 'discountPercent', type: 'uint8' },
          TIER_FLAGS,
          { name: 'splitPercent', type: 'uint32' }, { name: 'resolvedUri', type: 'string' }
        ]}]
      },
      { name: 'totalSupplyOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'hook', type: 'address' }], outputs: [{ type: 'uint256' }] }
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

    let publicClient = null, walletClient = null;
    let allTiers = [], ownedNFTs = [];
    let currentTab = 'tiers', selectedCategory = null;
    let hookAddress = '', chainId = 1, connectedAddress = null;
    let priceDecimals = 18, metadataIdTarget = null, projectId = null;

    window.loadGallery = async function() {
      hookAddress = document.getElementById('hookAddress').value;
      chainId = parseInt(document.getElementById('chainSelect').value);

      if (!hookAddress || !isAddress(hookAddress)) { alert('Please enter a valid hook address'); return; }

      const container = document.getElementById('galleryContainer');
      container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading NFT collection...</div>';

      publicClient = createPublicClient({ chain: CHAIN_CONFIGS[chainId], transport: http() });

      try {
        const [storeAddr, pid, idTarget, pricing] = await Promise.all([
          publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'STORE' }),
          publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'projectId' }),
          publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'METADATA_ID_TARGET' }),
          publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'pricingContext' })
        ]);
        projectId = pid;
        metadataIdTarget = idTarget;
        priceDecimals = Number(pricing[1]);

        allTiers = await publicClient.readContract({
          address: storeAddr, abi: STORE_ABI, functionName: 'tiersOf',
          args: [hookAddress, [], true, 0n, 100n]
        });

        let totalMinted = 0, totalMaxSupply = 0, floorPrice = 0n;
        const categories = new Set();

        allTiers.forEach(tier => {
          totalMinted += Number(tier.initialSupply) - Number(tier.remainingSupply);
          totalMaxSupply += Number(tier.initialSupply);
          if (tier.category) categories.add(Number(tier.category));
          if (tier.remainingSupply > 0 && (floorPrice === 0n || BigInt(tier.price) < floorPrice)) {
            floorPrice = BigInt(tier.price);
          }
        });

        document.getElementById('totalTiers').textContent = allTiers.length;
        document.getElementById('totalMinted').textContent = totalMinted.toLocaleString();
        document.getElementById('totalSupply').textContent = totalMaxSupply.toLocaleString();
        document.getElementById('floorPrice').textContent = floorPrice > 0n ? formatUnits(floorPrice, priceDecimals) : 'N/A';

        if (categories.size > 0) {
          let categoryHtml = '<div class="category-chip active" onclick="filterCategory(null)">All</div>';
          [...categories].sort((a, b) => a - b).forEach(cat => {
            categoryHtml += `<div class="category-chip" onclick="filterCategory(${cat})">Category ${cat}</div>`;
          });
          document.getElementById('categoryFilter').innerHTML = categoryHtml;
        }

        document.getElementById('statsBar').style.display = 'grid';
        document.getElementById('tabsContainer').style.display = 'flex';
        document.getElementById('walletSection').style.display = 'flex';

        renderTiers();
      } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="empty">Error loading collection: ${error.message}</div>`;
      }
    };

    window.connectWallet = async function() {
      if (!window.ethereum) { alert('Please install a web3 wallet'); return; }
      try {
        const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        connectedAddress = address;
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
        } catch (e) { console.log('Chain switch failed', e); }

        walletClient = createWalletClient({ chain: CHAIN_CONFIGS[chainId], transport: custom(window.ethereum) });

        document.getElementById('walletStatus').textContent = 'Connected:';
        document.getElementById('walletAddress').textContent = truncateAddress(address);

        await loadOwnedNFTs(address);
      } catch (error) {
        console.error(error);
        alert('Failed to connect wallet');
      }
    };

    // The 721 hook is NOT enumerable (no tokenOfOwnerByIndex).
    // Enumerate owned NFTs from Transfer logs; tier ID = tokenId / 1e9.
    // Prefer the Bendystraw `nfts` query when an API key is available (see below).
    async function loadOwnedNFTs(ownerAddress) {
      try {
        const logs = await publicClient.getLogs({
          address: hookAddress,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
          args: { to: ownerAddress },
          fromBlock: 0n
        });

        ownedNFTs = [];
        const seen = new Set();
        for (const log of logs) {
          const tokenId = log.args.tokenId;
          if (seen.has(tokenId.toString())) continue;
          seen.add(tokenId.toString());

          // Confirm current ownership (the token may have been transferred away or burned).
          let owner;
          try {
            owner = await publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'ownerOf', args: [tokenId] });
          } catch { continue; }
          if (owner.toLowerCase() !== ownerAddress.toLowerCase()) continue;

          const tierId = tokenId / 1_000_000_000n;
          const tier = allTiers.find(t => BigInt(t.id) === tierId);

          let metadata = {};
          try {
            const uri = await publicClient.readContract({ address: hookAddress, abi: HOOK_ABI, functionName: 'tokenURI', args: [tokenId] });
            if (uri) {
              const metadataUrl = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
              if (uri.startsWith('data:application/json')) {
                metadata = JSON.parse(atob(uri.split(',')[1]));
              } else {
                metadata = await (await fetch(metadataUrl)).json();
              }
            }
          } catch (e) { console.log('Failed to load metadata for token', tokenId.toString()); }

          ownedNFTs.push({ tokenId: tokenId.toString(), tierId: tierId.toString(), tier, metadata });
        }

        if (currentTab === 'owned') renderOwnedNFTs(); else renderTiers();
      } catch (error) { console.error('Failed to load owned NFTs:', error); }
    }

    window.switchTab = function(tab) {
      currentTab = tab;
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.tabs .tab[data-tab="${tab}"]`).classList.add('active');
      if (tab === 'tiers') renderTiers(); else renderOwnedNFTs();
    };

    window.filterCategory = function(category) {
      selectedCategory = category;
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      if (category === null) document.querySelector('.category-chip').classList.add('active');
      else document.querySelectorAll('.category-chip').forEach(c => {
        if (c.textContent === `Category ${category}`) c.classList.add('active');
      });
      renderTiers();
    };

    function renderTiers() {
      const container = document.getElementById('galleryContainer');
      let filteredTiers = [...allTiers];
      if (selectedCategory !== null) filteredTiers = filteredTiers.filter(t => Number(t.category) === selectedCategory);

      if (filteredTiers.length === 0) {
        container.innerHTML = '<div class="empty">No tiers match the current filter</div>';
        return;
      }

      let html = '<div class="gallery-grid">';
      filteredTiers.forEach(tier => {
        const minted = Number(tier.initialSupply) - Number(tier.remainingSupply);
        const soldOut = Number(tier.remainingSupply) === 0;
        // discountPercent is out of DISCOUNT_DENOMINATOR = 200.
        const effectivePrice = BigInt(tier.price) - (BigInt(tier.price) * BigInt(tier.discountPercent)) / 200n;
        const price = formatUnits(effectivePrice, priceDecimals);
        const owned = ownedNFTs.filter(nft => nft.tierId === tier.id.toString());

        html += `
          <div class="nft-card">
            <div class="nft-image">
              ${tier.resolvedUri ? `<img src="${resolveUri(tier.resolvedUri)}" alt="Tier ${tier.id}" onerror="this.style.display='none'">` : '<div class="placeholder">NFT</div>'}
              <div class="tier-badge">Tier ${tier.id}</div>
              <div class="supply-badge ${soldOut ? 'sold-out' : ''}">${minted}/${tier.initialSupply}</div>
              ${owned.length > 0 ? `<div class="owned-badge">Owned: ${owned.length}</div>` : ''}
            </div>
            <div class="nft-info">
              <div class="nft-name">Tier ${tier.id}</div>
              <div class="nft-meta">
                <div class="nft-price">${price}</div>
                ${Number(tier.votingUnits) > 0 ? `<div>${tier.votingUnits} votes</div>` : ''}
              </div>
              <button class="mint-btn" ${soldOut ? 'disabled' : ''} onclick="mintTier(${tier.id}, '${effectivePrice}')">
                ${soldOut ? 'Sold Out' : 'Mint'}
              </button>
            </div>
          </div>`;
      });
      container.innerHTML = html + '</div>';
    }

    function renderOwnedNFTs() {
      const container = document.getElementById('galleryContainer');
      if (!connectedAddress) { container.innerHTML = '<div class="empty">Connect your wallet to view owned NFTs</div>'; return; }
      if (ownedNFTs.length === 0) { container.innerHTML = '<div class="empty">You don\'t own any NFTs from this collection</div>'; return; }

      let html = '<div class="gallery-grid">';
      ownedNFTs.forEach(nft => {
        const name = nft.metadata?.name || `Tier ${nft.tierId} #${nft.tokenId}`;
        const image = nft.metadata?.image;
        html += `
          <div class="nft-card">
            <div class="nft-image">
              ${image ? `<img src="${resolveUri(image)}" alt="${name}" onerror="this.style.display='none'">` : '<div class="placeholder">NFT</div>'}
              <div class="tier-badge">Tier ${nft.tierId}</div>
            </div>
            <div class="nft-info">
              <div class="nft-name">${name}</div>
              <div>Token ID: ${nft.tokenId}</div>
              <button class="mint-btn" onclick="transferNFT('${nft.tokenId}')">Transfer</button>
            </div>
          </div>`;
      });
      container.innerHTML = html + '</div>';
    }

    // ---- Minting: pay the terminal with JBMetadataResolver-formatted metadata ----
    // metadata id = bytes4(bytes20(METADATA_ID_TARGET) ^ bytes20(keccak256("pay"))).
    // METADATA_ID_TARGET is the 721 IMPLEMENTATION address (shared by all clones) — NOT the clone.
    function tier721MetadataId(idTarget) {
      const k = keccak256('0x706179'); // keccak256(utf8 "pay")
      const a = idTarget.slice(2, 10).toLowerCase(), b = k.slice(2, 10);
      let out = '';
      for (let i = 0; i < 8; i += 2) {
        out += (parseInt(a.substr(i, 2), 16) ^ parseInt(b.substr(i, 2), 16)).toString(16).padStart(2, '0');
      }
      return out;
    }

    // Envelope: [32B reserved][id (4B)][offset 0x02][27B pad][abi.encode(bool allowOverspending, uint16[] tierIds)]
    function buildTierMintMetadata(idTarget, tierIds) {
      const id = tier721MetadataId(idTarget);
      const data = encodeAbiParameters([{ type: 'bool' }, { type: 'uint16[]' }], [true, tierIds]);
      return '0x' + '00'.repeat(32) + id + '02' + '00'.repeat(27) + data.slice(2);
    }

    window.mintTier = async function(tierId, priceWei) {
      if (!connectedAddress) { alert('Please connect your wallet first'); return; }
      try {
        const metadata = buildTierMintMetadata(metadataIdTarget, [tierId]);
        const terminal = getContractAddress(chainId, 'JBMultiTerminal');
        const value = BigInt(priceWei);

        // Assumes an ETH-priced hook (pricingContext currency = native). For other pricing
        // currencies, convert the tier price to the payment terminal's token first.
        const hash = await walletClient.writeContract({
          address: terminal, abi: TERMINAL_ABI, functionName: 'pay',
          args: [projectId, NATIVE_TOKEN, value, connectedAddress, 0n, '', metadata],
          value,
          account: connectedAddress
        });
        alert('Mint transaction sent: ' + hash);
        await publicClient.waitForTransactionReceipt({ hash });
        alert('NFT minted!');
        await loadOwnedNFTs(connectedAddress);
      } catch (error) { console.error(error); alert('Minting failed: ' + (error.shortMessage || error.message)); }
    };

    window.transferNFT = async function(tokenId) {
      if (!connectedAddress) { alert('Please connect your wallet first'); return; }
      const recipient = prompt('Enter recipient address:');
      if (!recipient || !isAddress(recipient)) { alert('Invalid address'); return; }

      try {
        const hash = await walletClient.writeContract({
          address: hookAddress, abi: HOOK_ABI, functionName: 'transferFrom',
          args: [connectedAddress, recipient, BigInt(tokenId)], account: connectedAddress
        });
        await publicClient.waitForTransactionReceipt({ hash });
        alert('Transfer successful!');
        await loadOwnedNFTs(connectedAddress);
      } catch (error) { console.error(error); alert('Transfer failed: ' + (error.shortMessage || error.message)); }
    };

    function resolveUri(uri) {
      if (!uri) return '';
      if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
      return uri;
    }
  </script>
</body>
</html>
```

## Owned NFTs via Bendystraw (preferred)

The indexer tracks every 721-hook NFT with owner, tier, and resolved metadata — one query instead of a log scan. Keyed endpoint required (`https://bendystraw.xyz/{API_KEY}/graphql`; testnets: `https://testnet.bendystraw.xyz/{API_KEY}/graphql`).

```graphql
query($owner: String!, $hook: String!, $chainId: Int!) {
  nfts(where: { owner: $owner, hook: $hook, chainId: $chainId, version: 6 }) {
    items { tokenId tierId category tokenUri metadata createdAt }
  }
}
```

## Finding a project's 721 hook

The hook address for a project is not a fixed getter — resolution order:

1. Read `JBController.currentRulesetOf(projectId)`; if `metadata.useDataHookForPay` and `metadata.dataHook != address(0)`:
   - If `dataHook == JBOmnichainDeployer` (omnichain projects), read `JBOmnichainDeployer.tiered721HookOf(projectId, ruleset.id)` — the deployer proxies to the real hook.
   - Otherwise the `dataHook` is the 721 hook itself (verify by calling `STORE()` on it).
2. For revnets, `REVOwner.tiered721HookOf(projectId)` tracks the hook directly.

## Common mistakes

- **Assuming ERC721Enumerable** — `tokenOfOwnerByIndex` does not exist; use Bendystraw or Transfer logs.
- **`PROJECT_ID` vs `projectId`** — the hook's project getter is lowercase `projectId()`.
- **Mint metadata keyed to the clone address** — key it to `METADATA_ID_TARGET()` (the implementation). Wrong key = payment succeeds, no NFT mints.
- **Prices assumed to be ETH** — tier prices are in the hook's `pricingContext()` currency and decimals; format with those decimals and convert if the pricing currency differs from the paid token.
- **Wrong tier tuple** — V6 tiers pack flags into a nested 5-bool tuple (`allowOwnerMint, transfersPausable, cantBeRemoved, cantIncreaseDiscountPercent, cantBuyWithCredits`) and include `discountPercent` (denominator 200) and `splitPercent`. Using a flat tuple mis-decodes every tier.
- **Ignoring `discountPercent`** — the amount needed to mint is `price - price * discountPercent / 200`, not the listed price.

## Related skills

- `/jb-interact-ui` — Full pay/mint templates
- `/jb-721-tier-content` — Tier metadata and IPFS content
- `/jb-721-per-chain-config` — Per-chain tier configuration
- `/jb-bendystraw` — Indexer query reference
