/**
 * Juicebox V6 UI Skills - Wallet Utilities
 * Common wallet connection and chain switching helpers
 * Requires: viem (https://viem.sh)
 *
 * Install the reviewed dependency only after user approval:
 *   npm install --save-exact viem@2.55.19
 * The lockfile integrity must equal the value pinned in deployment-manifest.json.
 * Import from the installed local package; never execute wallet-adjacent CDN code.
 */

/**
 * Chain configurations for viem (all 8 supported chains).
 * Mainnet RPCs are the keyless CORS-open publicnode endpoints the production
 * webclients use for browser reads; testnets use the chains' own public nodes.
 */
const CHAIN_CONFIGS = {
  1: {
    id: 1,
    name: 'Ethereum',
    network: 'mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://ethereum-rpc.publicnode.com'] },
      public: { http: ['https://ethereum-rpc.publicnode.com'] }
    },
    blockExplorers: {
      default: { name: 'Etherscan', url: 'https://etherscan.io' }
    }
  },
  10: {
    id: 10,
    name: 'Optimism',
    network: 'optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://optimism-rpc.publicnode.com'] },
      public: { http: ['https://optimism-rpc.publicnode.com'] }
    },
    blockExplorers: {
      default: { name: 'Optimistic Etherscan', url: 'https://optimistic.etherscan.io' }
    }
  },
  8453: {
    id: 8453,
    name: 'Base',
    network: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://base-rpc.publicnode.com'] },
      public: { http: ['https://base-rpc.publicnode.com'] }
    },
    blockExplorers: {
      default: { name: 'Basescan', url: 'https://basescan.org' }
    }
  },
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    network: 'arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://arbitrum-one-rpc.publicnode.com'] },
      public: { http: ['https://arbitrum-one-rpc.publicnode.com'] }
    },
    blockExplorers: {
      default: { name: 'Arbiscan', url: 'https://arbiscan.io' }
    }
  },
  11155111: {
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] },
      public: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] }
    },
    blockExplorers: {
      default: { name: 'Sepolia Etherscan', url: 'https://sepolia.etherscan.io' }
    }
  },
  11155420: {
    id: 11155420,
    name: 'Optimism Sepolia',
    network: 'optimism-sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://sepolia.optimism.io'] },
      public: { http: ['https://sepolia.optimism.io'] }
    },
    blockExplorers: {
      default: { name: 'OP Sepolia Etherscan', url: 'https://sepolia-optimism.etherscan.io' }
    }
  },
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://sepolia.base.org'] },
      public: { http: ['https://sepolia.base.org'] }
    },
    blockExplorers: {
      default: { name: 'Base Sepolia Basescan', url: 'https://sepolia.basescan.org' }
    }
  },
  421614: {
    id: 421614,
    name: 'Arbitrum Sepolia',
    network: 'arbitrum-sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] },
      public: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] }
    },
    blockExplorers: {
      default: { name: 'Arbitrum Sepolia Arbiscan', url: 'https://sepolia.arbiscan.io' }
    }
  }
};

/**
 * Chain display info (simplified)
 */
const CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH', explorer: 'https://etherscan.io', testnet: false },
  10: { name: 'Optimism', symbol: 'ETH', explorer: 'https://optimistic.etherscan.io', testnet: false },
  8453: { name: 'Base', symbol: 'ETH', explorer: 'https://basescan.org', testnet: false },
  42161: { name: 'Arbitrum', symbol: 'ETH', explorer: 'https://arbiscan.io', testnet: false },
  11155111: { name: 'Sepolia', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io', testnet: true },
  11155420: { name: 'Optimism Sepolia', symbol: 'ETH', explorer: 'https://sepolia-optimism.etherscan.io', testnet: true },
  84532: { name: 'Base Sepolia', symbol: 'ETH', explorer: 'https://sepolia.basescan.org', testnet: true },
  421614: { name: 'Arbitrum Sepolia', symbol: 'ETH', explorer: 'https://sepolia.arbiscan.io', testnet: true }
};

/**
 * Block in which JBDirectory was deployed on each chain (deploy-all-v6/deployments/<chain>/JBDirectory.json).
 * No V6 event exists before this block; use it as the `fromBlock` floor for eth_getLogs scans.
 */
const DEPLOY_BLOCKS = {
  1: 25327949n,
  10: 152994072n,
  8453: 47398796n,
  42161: 473988207n,
  11155111: 11070541n,
  11155420: 44892064n,
  84532: 42909187n,
  421614: 277724223n
};

/**
 * JBWallet - Wallet connection manager using viem + window.ethereum
 * For React apps, use wagmi instead: https://wagmi.sh
 */
class JBWallet {
  constructor() {
    this.client = null;
    this.walletClient = null;
    this.address = null;
    this.chainId = null;
    this.onAccountChange = null;
    this.onChainChange = null;
  }

  /**
   * Check if a wallet is available
   */
  isAvailable() {
    return typeof window !== 'undefined' && window.ethereum;
  }

  /**
   * Connect to wallet and optionally switch to target chain
   * @param {number} targetChainId - Optional chain ID to switch to
   * @param {object} viem - Pass viem module for ES module support
   * @returns {Promise<{address: string, chainId: number}>}
   */
  async connect(targetChainId = 1, viem = null) {
    if (!this.isAvailable()) {
      throw new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
    }

    if (!viem) {
      throw new Error('Pass the locally installed viem@2.55.19 module. Dynamic remote imports are forbidden.');
    }

    const { createWalletClient, createPublicClient, custom, http } = viem;

    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.address = accounts[0];

    // Switch chain if needed
    if (targetChainId) {
      await this.switchChain(targetChainId);
    }

    // Get current chain
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    this.chainId = parseInt(chainIdHex, 16);

    // Create clients
    const chain = CHAIN_CONFIGS[this.chainId] || CHAIN_CONFIGS[1];

    this.walletClient = createWalletClient({
      account: this.address,
      chain,
      transport: custom(window.ethereum)
    });

    this.client = createPublicClient({
      chain,
      transport: http()
    });

    // Set up listeners
    this._setupListeners();

    return {
      address: this.address,
      chainId: this.chainId
    };
  }

  /**
   * Switch to a different chain
   * @param {number} chainId - Target chain ID
   */
  async switchChain(chainId) {
    const hexChainId = '0x' + chainId.toString(16);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }]
      });
    } catch (error) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        await this.addChain(chainId);
      } else {
        throw error;
      }
    }
    this.chainId = chainId;
  }

  /**
   * Add a chain to the wallet
   * @param {number} chainId - Chain ID to add
   */
  async addChain(chainId) {
    const chain = CHAIN_CONFIGS[chainId];
    if (!chain) {
      throw new Error(`Unknown chain ID: ${chainId}`);
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x' + chainId.toString(16),
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls.default.http,
        blockExplorerUrls: [chain.blockExplorers.default.url]
      }]
    });
  }

  /**
   * Disconnect wallet (clear local state)
   */
  disconnect() {
    this.client = null;
    this.walletClient = null;
    this.address = null;
    this.chainId = null;
    this._removeListeners();
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this.address !== null;
  }

  /**
   * Format address for display
   */
  formatAddress(address = this.address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  _setupListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.address = accounts[0];
      }
      if (this.onAccountChange) this.onAccountChange(accounts);
    });

    window.ethereum.on('chainChanged', (chainId) => {
      this.chainId = parseInt(chainId, 16);
      if (this.onChainChange) this.onChainChange(this.chainId);
    });
  }

  _removeListeners() {
    if (!window.ethereum) return;
    window.ethereum.removeAllListeners?.('accountsChanged');
    window.ethereum.removeAllListeners?.('chainChanged');
  }
}

/**
 * Get explorer URL for a transaction
 */
function getTxUrl(chainId, txHash) {
  const chain = CHAINS[chainId];
  if (!chain) return null;
  return `${chain.explorer}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 */
function getAddressUrl(chainId, address) {
  const chain = CHAINS[chainId];
  if (!chain) return null;
  return `${chain.explorer}/address/${address}`;
}

/**
 * Formatting utilities
 */
function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEth(wei) {
  if (!wei) return '0';
  // Handle both bigint and number
  const value = typeof wei === 'bigint' ? wei : BigInt(wei);
  return (Number(value) / 1e18).toFixed(4);
}

function formatNumber(n) {
  if (!n) return '0';
  return Number(n).toLocaleString();
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor(Date.now() / 1000 - Number(timestamp));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

/**
 * Create a read-only public client for a chain
 * @param {number} chainId - Chain ID
 * @param {object} viem - Pass viem module for ES module support
 */
async function createReadClient(chainId, viem = null) {
  if (!viem) {
    throw new Error('Pass the locally installed viem@2.55.19 module. Dynamic remote imports are forbidden.');
  }

  const { createPublicClient, http } = viem;
  const chain = CHAIN_CONFIGS[chainId];

  if (!chain) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http()
  });
}

/**
 * Load an ABI by contract name
 * @param {string} contractName - Contract name (e.g., 'JBController', 'REVDeployer')
 * @returns {Promise<Array>} ABI array
 */
async function loadABI(contractName) {
  const paths = [
    `/shared/abis/${contractName}.json`,
    `./abis/${contractName}.json`,
    new URL(`./abis/${contractName}.json`, import.meta.url).href
  ];

  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (res.ok) return res.json();
    } catch (e) {
      continue;
    }
  }
  throw new Error(`ABI not found: ${contractName}`);
}

/**
 * Load chain configuration from shared config.
 * This is descriptive data only. Never use it as write-target authority.
 */
async function loadChainConfig() {
  for (const url of [new URL('./chain-config.json', import.meta.url), '/shared/chain-config.json']) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch (e) { /* try next */ }
  }
  throw new Error('chain-config.json could not be loaded. Refusing to fall back to inline addresses.');
}

let deploymentManifestPromise;

/**
 * Load the reviewed write-target manifest. Module-relative first; no network fallback.
 */
async function loadDeploymentManifest() {
  if (!deploymentManifestPromise) {
    deploymentManifestPromise = (async () => {
      const res = await fetch(new URL('./deployment-manifest.json', import.meta.url), { cache: 'no-store' });
      if (!res.ok) throw new Error(`deployment-manifest.json unavailable (${res.status}). Writes are disabled.`);
      const manifest = await res.json();
      if (manifest.schemaVersion !== 1 || manifest.protocol !== 'juicebox-v6') {
        throw new Error('Unrecognized deployment manifest. Writes are disabled.');
      }
      return manifest;
    })();
  }
  return deploymentManifestPromise;
}

/**
 * Resolve an address from the reviewed manifest. Unknown or non-write-enabled entries fail closed.
 */
async function getContractAddress(chainId, contractName, { write = false } = {}) {
  const manifest = await loadDeploymentManifest();
  const entry = manifest.chains?.[String(chainId)]?.contracts?.[contractName];
  if (!entry?.address) throw new Error(`${contractName} is not pinned for chain ${chainId}.`);
  if (write && !entry.writeEnabled) throw new Error(`${contractName} is not approved as a write target on chain ${chainId}.`);
  return entry.address;
}

/**
 * Verify chain, bytecode, selector and clone/proxy pins immediately before a write.
 * @param {object} publicClient viem public client
 * @param {string} contractName manifest contract name
 * @param {{selector:string, keccak256:function}} options
 */
async function verifyWriteTarget(publicClient, contractName, { selector, keccak256 }) {
  const chainId = await publicClient.getChainId();
  const manifest = await loadDeploymentManifest();
  if (!manifest.policy.supportedChainIds.includes(chainId)) throw new Error(`Unsupported chain ${chainId}.`);
  const entry = manifest.chains?.[String(chainId)]?.contracts?.[contractName];
  if (!entry?.writeEnabled) throw new Error(`${contractName} is not an allowed write target on chain ${chainId}.`);
  const code = await publicClient.getCode({ address: entry.address });
  if (!code || code === '0x') throw new Error(`No code at ${entry.address} on chain ${chainId}.`);
  const liveHash = keccak256(code).toLowerCase();
  if (liveHash !== entry.runtimeCodeHash) throw new Error(`Runtime code mismatch for ${contractName} on chain ${chainId}.`);
  const allowed = manifest.abis?.[entry.abi]?.allowedWrites || [];
  if (!selector || !allowed.some((item) => item.selector === selector.toLowerCase())) {
    throw new Error(`Selector ${selector || '<missing>'} is not approved for ${contractName}.`);
  }
  if (entry.proxy.kind === 'minimal-clone' && !entry.proxy.implementationAddress) {
    throw new Error(`Unpinned clone implementation for ${contractName}.`);
  }
  return { chainId, entry };
}

const DIRECTORY_ABI = [
  { name: 'primaryTerminalOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }] }
];
const ACCOUNTING_CONTEXT_ABI = [
  { name: 'accountingContextForTokenOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }, { name: 'token', type: 'address' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'token', type: 'address' }, { name: 'decimals', type: 'uint8' }, { name: 'currency', type: 'uint32' }
    ] }] }
];

/**
 * Resolve the terminal a project accepts `token` through. Never hardcode JBMultiTerminal:
 * projects can use custom terminals, and a project whose accounting context is USDC rejects
 * native ETH on the multi terminal (`JBMultiTerminal_TokenNotAccepted`).
 * @param {object} publicClient - viem public client
 * @param {bigint} projectId
 * @param {`0x${string}`} token - NATIVE_TOKEN (0x...EEEe) or an ERC-20
 * @returns {Promise<{terminal: string, context: {token: string, decimals: number, currency: number}}>}
 */
async function resolveTerminal(publicClient, projectId, token) {
  const chainId = publicClient.chain?.id ?? await publicClient.getChainId();
  const directory = await getContractAddress(chainId, 'JBDirectory');
  const terminal = await publicClient.readContract({
    address: directory, abi: DIRECTORY_ABI,
    functionName: 'primaryTerminalOf', args: [projectId, token]
  });
  if (!terminal || /^0x0{40}$/.test(terminal)) throw new Error(`Project ${projectId} has no terminal accepting ${token}`);
  const context = await publicClient.readContract({
    address: terminal, abi: ACCOUNTING_CONTEXT_ABI, functionName: 'accountingContextForTokenOf', args: [projectId, token]
  });
  if (/^0x0{40}$/.test(context.token)) throw new Error(`Terminal ${terminal} has no accounting context for ${token}`);
  return { terminal, context };
}

/**
 * Wait for a receipt and require it to have succeeded.
 * A mined transaction can still have reverted; never report success on a bare receipt.
 * @param {object} publicClient - viem public client
 * @param {`0x${string}`} hash - Transaction hash
 * @param {{prove:function}} options - Operation-specific event/post-state verifier
 * @returns {Promise<object>} The successful, independently proven receipt
 */
async function waitForSuccess(publicClient, hash, { prove } = {}) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Transaction reverted on-chain: ${hash}`);
  if (typeof prove !== 'function') {
    throw new Error(`Transaction mined but completion proof was not configured: ${hash}. State is uncertain; do not retry.`);
  }
  const evidence = await prove(receipt);
  if (!evidence) {
    throw new Error(`Transaction mined but expected event/post-state proof failed: ${hash}. State is uncertain; do not retry.`);
  }
  return receipt;
}

// Export for ES modules
export {
  JBWallet,
  CHAINS,
  CHAIN_CONFIGS,
  DEPLOY_BLOCKS,
  getTxUrl,
  getAddressUrl,
  truncateAddress,
  formatEth,
  formatNumber,
  formatTimeAgo,
  formatDate,
  createReadClient,
  loadChainConfig,
  loadDeploymentManifest,
  loadABI,
  getContractAddress,
  verifyWriteTarget,
  resolveTerminal,
  waitForSuccess
};

// Also expose on window for script tag usage
if (typeof window !== 'undefined') {
  window.JBWalletUtils = {
    JBWallet,
    CHAINS,
    CHAIN_CONFIGS,
    DEPLOY_BLOCKS,
    getTxUrl,
    getAddressUrl,
    truncateAddress,
    formatEth,
    formatNumber,
    formatTimeAgo,
    formatDate,
    createReadClient,
    loadChainConfig,
    loadDeploymentManifest,
    loadABI,
    getContractAddress,
    verifyWriteTarget,
    resolveTerminal,
    waitForSuccess
  };
}
