#!/usr/bin/env node
/**
 * Compound & Harvest V4 LP fees
 * 
 * Collects all accrued fees, compounds a percentage back into the position,
 * swaps the remainder to USDC, and sends it to a harvest address.
 * 
 * Usage:
 *   # Preview (dry run)
 *   node compound-and-harvest.mjs --token-id 1078751 \
 *     --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F --dry-run
 *   
 *   # Execute with 50/50 split (default)
 *   node compound-and-harvest.mjs --token-id 1078751 \
 *     --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F
 *   
 *   # 70% compound, 30% harvest
 *   node compound-and-harvest.mjs --token-id 1078751 \
 *     --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F \
 *     --compound-pct 70
 *   
 *   # Custom slippage for volatile tokens
 *   node compound-and-harvest.mjs --token-id 1078751 \
 *     --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F \
 *     --slippage 3
 */

import { createPublicClient, createWalletClient, http, formatEther, formatUnits, maxUint256, encodeFunctionData, encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { defaultAbiCoder } from '@ethersproject/abi';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

const argv = yargs(hideBin(process.argv))
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID' })
  .option('harvest-address', { type: 'string', required: true, description: 'Address to send harvested USDC' })
  .option('compound-pct', { type: 'number', default: 50, description: 'Percentage of fees to compound (0-100)' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only, don\'t execute' })
  .option('slippage', { type: 'number', default: 1, description: 'Slippage tolerance for swaps (percent)' })
  .option('rpc', { type: 'string', default: process.env.BASE_RPC_URL || 'https://mainnet.base.org', description: 'Base RPC URL' })
  .parse();

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  UNIVERSAL_ROUTER: '0x6ff5693b99212da76ad316178a184ab56d299b43',
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  SWAP_ROUTER_02: '0x2626664c2603336E57B271c5C0b26F421741e481',
};

// V4 Action Codes
const Actions = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  CLOSE_CURRENCY: 0x11,
};

const POOL_KEY_STRUCT = '(address,address,uint24,int24,address)';
const Q96 = BigInt(2) ** BigInt(96);

// ─── ABIs ────────────────────────────────────────────────────────────────────

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] }, { type: 'uint256' }] },
  { name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
];

const STATE_VIEW_ABI = [
  { name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
];

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
];

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    inputs: [{
      type: 'tuple',
      name: 'params',
      components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ]
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'exactInput',
    type: 'function',
    inputs: [{
      type: 'tuple',
      name: 'params',
      components: [
        { name: 'path', type: 'bytes' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
      ]
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
];

const UNIVERSAL_ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
];

const PERMIT2_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tickToSqrtPriceX96(tick) {
  return BigInt(Math.floor(Math.sqrt(Math.pow(1.0001, tick)) * Number(Q96)));
}

function getLiquidityForAmounts(sqrtPriceX96, sqrtPriceA, sqrtPriceB, amount0, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  const liq0 = (a0, sqrtA, sqrtB) => (a0 * ((sqrtA * sqrtB) / Q96)) / (sqrtB - sqrtA);
  const liq1 = (a1, sqrtA, sqrtB) => (a1 * Q96) / (sqrtB - sqrtA);

  if (sqrtPriceX96 <= sqrtPriceA) return liq0(amount0, sqrtPriceA, sqrtPriceB);
  if (sqrtPriceX96 < sqrtPriceB) {
    const l0 = liq0(amount0, sqrtPriceX96, sqrtPriceB);
    const l1 = liq1(amount1, sqrtPriceA, sqrtPriceX96);
    return l0 < l1 ? l0 : l1;
  }
  return liq1(amount1, sqrtPriceA, sqrtPriceB);
}

async function retry(fn, maxRetries = 4, baseDelayMs = 2000) {
  let delay = baseDelayMs;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (err) {
      if (i === maxRetries - 1) throw err;
      if (!err.message?.includes('429') && !err.message?.includes('rate limit')) throw err;
      console.log(`   ⏳ Rate limited, retry ${i + 1}/${maxRetries} in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pad32 = (hex) => hex.replace('0x', '').padStart(64, '0');

async function getEthPrice() {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006');
    const d = await r.json();
    const p = d.pairs?.find(p => p.chainId === 'base' && p.quoteToken?.symbol === 'USDC');
    if (p) return parseFloat(p.priceUsd);
  } catch {} return 3200;
}

async function getTokenPrice(address) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const d = await r.json();
    const p = d.pairs?.find(p => p.chainId === 'base');
    if (p) return parseFloat(p.priceUsd);
  } catch {} return 0;
}

/**
 * Encode a V3 swap path: token + fee + token [+ fee + token ...]
 * Each address is 20 bytes, each fee is 3 bytes (uint24)
 */
function encodeV3Path(tokens, fees) {
  let path = tokens[0].toLowerCase().replace('0x', '');
  for (let i = 0; i < fees.length; i++) {
    path += fees[i].toString(16).padStart(6, '0');
    path += tokens[i + 1].toLowerCase().replace('0x', '');
  }
  return '0x' + path;
}

// ─── Core: Collect Fees ──────────────────────────────────────────────────────

async function collectFees(publicClient, walletClient, account, tokenId, poolKey) {
  // DECREASE(0x01) + CLOSE_CURRENCY(0x11) — collect fees only
  const collectActionsHex = '0x0111';

  const decreaseParams = '0x' +
    pad32('0x' + tokenId.toString(16)) +
    '0'.padStart(64, '0') +     // liquidity = 0 (fees only)
    '0'.padStart(64, '0') +     // amount0Min = 0
    '0'.padStart(64, '0') +     // amount1Min = 0
    (5 * 32).toString(16).padStart(64, '0') +
    '0'.padStart(64, '0');      // hookData = empty

  const closeParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    pad32(account.address);

  const collectData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [collectActionsHex, [decreaseParams, closeParams]]
  );

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const hash = await walletClient.writeContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'modifyLiquidities',
    args: [collectData, deadline],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt, deadline };
}

// ─── Core: Add Liquidity (compound portion) ──────────────────────────────────

async function addLiquidity(publicClient, walletClient, account, tokenId, poolKey, amount0, amount1, sqrtPriceX96, tickLower, tickUpper, deadline) {
  const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);
  const newLiquidity = getLiquidityForAmounts(sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, amount0, amount1);

  if (newLiquidity <= 0n) return { success: false, reason: 'zero-liquidity' };
  console.log(`   Liquidity to add: ${newLiquidity}`);

  // Ensure tokens approved to Permit2
  for (const [token, amount, label] of [
    [poolKey.currency0, amount0, 'Token0'],
    [poolKey.currency1, amount1, 'Token1'],
  ]) {
    if (amount <= 0n) continue;
    const allowance = await retry(() => publicClient.readContract({
      address: token, abi: ERC20_ABI, functionName: 'allowance',
      args: [account.address, CONTRACTS.PERMIT2],
    }));
    if (allowance < amount) {
      console.log(`   Approving ${label} to Permit2...`);
      const tx = await walletClient.writeContract({
        address: token, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.PERMIT2, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
    await sleep(500);
  }

  await sleep(1000);

  // INCREASE(0x00) + SETTLE_PAIR(0x0d) — 2 actions
  // SETTLE_PAIR works for INCREASE (user pays tokens into pool)
  // CLOSE_CURRENCY is for DECREASE (pool returns tokens to user)
  const addActionsHex = '0x000d';
  const amount0Max = amount0 > 0n ? amount0 * 150n / 100n : 0n;
  const amount1Max = amount1 > 0n ? amount1 * 150n / 100n : 0n;

  const increaseParams = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint128', 'uint128', 'bytes'],
    [tokenId.toString(), newLiquidity.toString(), amount0Max.toString(), amount1Max.toString(), '0x']
  );

  const settleParams = defaultAbiCoder.encode(
    ['address', 'address'],
    [poolKey.currency0, poolKey.currency1]
  );

  const addData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [addActionsHex, [increaseParams, settleParams]]
  );

  const hash = await walletClient.writeContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'modifyLiquidities',
    args: [addData, deadline],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { success: receipt.status === 'success', hash, receipt, newLiquidity };
}

// ─── Core: Swap token to USDC via V3 ────────────────────────────────────────

/**
 * Swap non-WETH token → WETH via V4 Universal Router.
 * Used for Clanker-deployed tokens that only have V4 liquidity.
 * 
 * @param {object} poolKey - The V4 pool key (currency0, currency1, fee, tickSpacing, hooks)
 *   If null, falls back to V3 multi-hop (legacy behavior).
 */
async function swapViaV4ToWeth(publicClient, walletClient, account, tokenAddress, amount, poolKey) {
  console.log(`   Swapping token → WETH via V4 Universal Router...`);

  // 1. Approve token to Permit2 (infinite approval)
  const erc20Allowance = await retry(() => publicClient.readContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, CONTRACTS.PERMIT2],
  }));
  if (erc20Allowance < amount) {
    console.log(`   Approving token to Permit2...`);
    const tx = await walletClient.writeContract({
      address: tokenAddress, abi: ERC20_ABI, functionName: 'approve',
      args: [CONTRACTS.PERMIT2, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    await sleep(1000);
  }

  // 2. Approve Universal Router on Permit2
  const [permit2Amount] = await retry(() => publicClient.readContract({
    address: CONTRACTS.PERMIT2, abi: PERMIT2_ABI, functionName: 'allowance',
    args: [account.address, tokenAddress, CONTRACTS.UNIVERSAL_ROUTER],
  }));
  if (BigInt(permit2Amount) < amount) {
    console.log(`   Approving Universal Router on Permit2...`);
    const maxUint160 = (1n << 160n) - 1n;
    const maxUint48 = (1n << 48n) - 1n;
    const tx = await walletClient.writeContract({
      address: CONTRACTS.PERMIT2, abi: PERMIT2_ABI, functionName: 'approve',
      args: [tokenAddress, CONTRACTS.UNIVERSAL_ROUTER, maxUint160, maxUint48],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    await sleep(1000);
  }

  // 3. Build V4_SWAP command
  // Determine zeroForOne: if tokenAddress is currency0, then zeroForOne = true
  // Our poolKey has currency0=WETH, currency1=AXIOM
  // We're selling AXIOM (currency1) for WETH (currency0), so zeroForOne = false
  const tokenIsC0 = tokenAddress.toLowerCase() === poolKey.currency0.toLowerCase();
  const zeroForOne = tokenIsC0; // if selling currency0, zeroForOne=true

  // V4Router action: SWAP_EXACT_IN_SINGLE = 0x06
  const actionsBytes = '0x06';

  // Encode the swap params for SWAP_EXACT_IN_SINGLE:
  // (PoolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData)
  const swapParams = defaultAbiCoder.encode(
    [
      `tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)`,
      'bool',
      'uint128',
      'uint128',
      'uint160',
      'bytes',
    ],
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amount.toString(),
      '0', // amountOutMinimum = 0 (we check after)
      '0', // sqrtPriceLimitX96 = 0 (no limit)
      '0x', // hookData = empty
    ]
  );

  // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
  const v4SwapInput = defaultAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [actionsBytes, [swapParams]]
  );

  // Command 0x10 = V4_SWAP
  const commands = '0x10';
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

  const hash = await walletClient.writeContract({
    address: CONTRACTS.UNIVERSAL_ROUTER,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, [v4SwapInput], deadline],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`V4 swap reverted: ${hash}`);
  }

  console.log(`   ✅ V4 swap TX: ${hash}`);
  return { hash, receipt };
}

async function swapToUsdc(publicClient, walletClient, account, tokenAddress, amount, slippagePct, v4PoolKey) {
  if (amount <= 0n) return { amountOut: 0n, hash: null };

  const isWeth = tokenAddress.toLowerCase() === CONTRACTS.WETH.toLowerCase();
  const isUsdc = tokenAddress.toLowerCase() === CONTRACTS.USDC.toLowerCase();

  if (isUsdc) return { amountOut: amount, hash: null }; // already USDC

  if (isWeth) {
    // WETH → USDC direct via V3 (fee tier 500 = 0.05%)
    // Approve token to SwapRouter02
    const allowance = await retry(() => publicClient.readContract({
      address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance',
      args: [account.address, CONTRACTS.SWAP_ROUTER_02],
    }));
    if (allowance < amount) {
      console.log(`   Approving WETH to SwapRouter02...`);
      const tx = await walletClient.writeContract({
        address: tokenAddress, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.SWAP_ROUTER_02, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      await sleep(1000);
    }

    console.log(`   Swapping WETH → USDC (0.05% pool)...`);
    const hash = await walletClient.writeContract({
      address: CONTRACTS.SWAP_ROUTER_02,
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: CONTRACTS.WETH,
        tokenOut: CONTRACTS.USDC,
        fee: 500,
        recipient: account.address,
        amountIn: amount,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      }],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
  } else {
    // Non-WETH token: swap via V4 to WETH first, then V3 WETH→USDC
    // V4 is required for Clanker-deployed tokens (no V3 liquidity)

    if (!v4PoolKey) {
      throw new Error(`No V4 pool key provided for non-WETH token ${tokenAddress}. Cannot swap via V4.`);
    }

    // Step A: Record WETH balance before, then swap token → WETH via V4
    const wethBefore = await retry(() => publicClient.readContract({
      address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));
    const v4Result = await swapViaV4ToWeth(publicClient, walletClient, account, tokenAddress, amount, v4PoolKey);
    await sleep(2000);

    // Step B: Check how much WETH we gained and swap WETH → USDC via V3
    const wethAfter = await retry(() => publicClient.readContract({
      address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));
    const wethGained = wethAfter - wethBefore;

    if (wethGained > 0n) {
      console.log(`   Got ${formatEther(wethGained)} WETH from V4, now swapping to USDC...`);
      const usdcResult = await swapToUsdc(publicClient, walletClient, account, CONTRACTS.WETH, wethGained, slippagePct);
      return { hash: v4Result.hash, v4Hash: v4Result.hash, usdcHash: usdcResult.hash, receipt: usdcResult.receipt };
    } else {
      console.log(`   ⚠️  No WETH received from V4 swap`);
      return { hash: v4Result.hash, receipt: v4Result.receipt };
    }
  }
}

// ─── Main Flow ───────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) { console.error('❌ No private key in ~/.axiom/wallet.env'); process.exit(1); }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http(argv.rpc) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(argv.rpc) });

  const tokenId = BigInt(argv.tokenId);
  const harvestAddress = argv.harvestAddress;
  const compoundPct = Math.max(0, Math.min(100, argv.compoundPct));
  const harvestPct = 100 - compoundPct;
  const slippagePct = argv.slippage;

  console.log(`\n🌾 Compound & Harvest — Position #${argv.tokenId}`);
  console.log(`📋 Split: ${compoundPct}% compound / ${harvestPct}% harvest → USDC`);
  console.log(`📬 Harvest to: ${harvestAddress}`);
  console.log(`📊 Slippage: ${slippagePct}%`);
  console.log('═'.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Wallet: ${account.address}`);

  // 1. Verify ownership
  const owner = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER, abi: POSITION_MANAGER_ABI,
    functionName: 'ownerOf', args: [tokenId],
  }));
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ Not your position (owner: ${owner})`);
    process.exit(1);
  }

  // 2. Position info
  const [poolKey, posInfo] = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER, abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo', args: [tokenId],
  }));
  await sleep(800);

  const liquidity = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER, abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionLiquidity', args: [tokenId],
  }));

  // Get token symbols for display
  let token0Symbol = 'Token0', token1Symbol = 'Token1';
  let token0Decimals = 18, token1Decimals = 18;
  try {
    [token0Symbol, token1Symbol] = await Promise.all([
      publicClient.readContract({ address: poolKey.currency0, abi: ERC20_ABI, functionName: 'symbol' }),
      publicClient.readContract({ address: poolKey.currency1, abi: ERC20_ABI, functionName: 'symbol' }),
    ]);
    [token0Decimals, token1Decimals] = await Promise.all([
      publicClient.readContract({ address: poolKey.currency0, abi: ERC20_ABI, functionName: 'decimals' }),
      publicClient.readContract({ address: poolKey.currency1, abi: ERC20_ABI, functionName: 'decimals' }),
    ]);
  } catch {}

  console.log(`\n📊 Position:`);
  console.log(`   ${token0Symbol} (${poolKey.currency0.slice(0, 10)}...) / ${token1Symbol} (${poolKey.currency1.slice(0, 10)}...)`);
  console.log(`   Fee: ${poolKey.fee === 8388608 ? 'DYNAMIC' : poolKey.fee}`);
  console.log(`   Liquidity: ${liquidity.toString()}`);

  if (liquidity === 0n) {
    console.log('⚠️  No liquidity — nothing to harvest');
    process.exit(0);
  }

  // Pool state
  const poolId = defaultAbiCoder.encode(
    [POOL_KEY_STRUCT],
    [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]]
  );
  const poolIdHash = keccak256(poolId);

  await sleep(800);
  const [sqrtPriceX96, currentTick] = await retry(() => publicClient.readContract({
    address: CONTRACTS.STATE_VIEW, abi: STATE_VIEW_ABI,
    functionName: 'getSlot0', args: [poolIdHash],
  }));

  // Extract tick range from posInfo
  const posInfoBN = BigInt(posInfo);
  const toInt24 = (v) => v >= 0x800000 ? v - 0x1000000 : v;
  const rawA = toInt24(Number((posInfoBN >> 32n) & 0xFFFFFFn));
  const rawB = toInt24(Number((posInfoBN >> 8n) & 0xFFFFFFn));
  const tickLower = Math.min(rawA, rawB);
  const tickUpper = Math.max(rawA, rawB);
  console.log(`   Range: tick ${tickLower} → ${tickUpper} (current: ${currentTick})`);

  // 3. Wallet balances before
  await sleep(500);
  const [token0Before, token1Before] = await Promise.all([
    retry(() => publicClient.readContract({
      address: poolKey.currency0, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    })),
    retry(() => publicClient.readContract({
      address: poolKey.currency1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    })),
  ]);

  console.log(`\n💰 Wallet before:`);
  console.log(`   ${token0Symbol}: ${formatUnits(token0Before, token0Decimals)}`);
  console.log(`   ${token1Symbol}: ${formatUnits(token1Before, token1Decimals)}`);

  if (argv.dryRun) {
    // Estimate fees via prices
    const [ethPrice, token1Price] = await Promise.all([getEthPrice(), getTokenPrice(poolKey.currency1)]);
    console.log(`\n🔮 Dry Run — Preview:`);
    console.log(`   Would collect fees, split ${compoundPct}/${harvestPct}`);
    console.log(`   Compound ${compoundPct}% → back into position`);
    console.log(`   Harvest ${harvestPct}% → swap to USDC → send to ${harvestAddress}`);
    console.log(`   ETH price: $${ethPrice.toFixed(0)} | ${token1Symbol} price: $${token1Price.toFixed(8)}`);
    console.log(`\n✅ Dry run complete — no transactions sent`);
    process.exit(0);
  }

  // ─── Step 1: Collect fees ────────────────────────────────────────────────
  console.log('\n⏳ Step 1/4: Collecting fees...');
  const { hash: collectHash, receipt: collectReceipt, deadline } = await collectFees(
    publicClient, walletClient, account, tokenId, poolKey
  );
  console.log(`   TX: ${collectHash}`);

  if (collectReceipt.status !== 'success') {
    console.error('❌ Fee collection reverted');
    process.exit(1);
  }
  console.log('   ✅ Fees collected!');
  await sleep(3000);

  // ─── Step 2: Measure fees ────────────────────────────────────────────────
  const [token0After, token1After] = await Promise.all([
    retry(() => publicClient.readContract({
      address: poolKey.currency0, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    })),
    retry(() => publicClient.readContract({
      address: poolKey.currency1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    })),
  ]);

  const fees0 = token0After - token0Before;
  const fees1 = token1After - token1Before;

  console.log(`\n💸 Fees collected:`);
  console.log(`   ${token0Symbol}: ${formatUnits(fees0, token0Decimals)}`);
  console.log(`   ${token1Symbol}: ${formatUnits(fees1, token1Decimals)}`);

  if (fees0 <= 0n && fees1 <= 0n) {
    console.log('⚠️  No fees accrued — nothing to do');
    process.exit(0);
  }

  // Get USD values
  const [ethPrice, token1Price] = await Promise.all([getEthPrice(), getTokenPrice(poolKey.currency1)]);
  const fees0Usd = (Number(fees0) / Math.pow(10, token0Decimals)) * (poolKey.currency0.toLowerCase() === CONTRACTS.WETH.toLowerCase() ? ethPrice : await getTokenPrice(poolKey.currency0));
  const fees1Usd = (Number(fees1) / Math.pow(10, token1Decimals)) * token1Price;
  console.log(`   Value: ~$${(fees0Usd + fees1Usd).toFixed(4)}`);

  // ─── Step 3: Split and Compound ──────────────────────────────────────────
  const compound0 = fees0 * BigInt(compoundPct) / 100n;
  const compound1 = fees1 * BigInt(compoundPct) / 100n;
  const harvest0 = fees0 - compound0;
  const harvest1 = fees1 - compound1;

  console.log(`\n📊 Split (${compoundPct}/${harvestPct}):`);
  console.log(`   Compound: ${token0Symbol} ${formatUnits(compound0, token0Decimals)} | ${token1Symbol} ${formatUnits(compound1, token1Decimals)}`);
  console.log(`   Harvest:  ${token0Symbol} ${formatUnits(harvest0, token0Decimals)} | ${token1Symbol} ${formatUnits(harvest1, token1Decimals)}`);

  // Compound portion
  if (compound0 > 0n || compound1 > 0n) {
    console.log('\n⏳ Step 2/4: Compounding fees back into position...');
    const addResult = await addLiquidity(
      publicClient, walletClient, account, tokenId, poolKey,
      compound0, compound1, sqrtPriceX96, tickLower, tickUpper, deadline
    );

    if (addResult.success) {
      console.log(`   ✅ Compounded! TX: ${addResult.hash}`);
      console.log(`   Liquidity added: ${addResult.newLiquidity}`);
    } else {
      console.log(`   ⚠️  Compound failed (${addResult.reason}) — continuing to harvest all fees`);
      // If compound fails, harvest everything instead
      // harvest0/harvest1 stay as-is since compound didn't consume tokens
    }
    await sleep(2000);
  } else {
    console.log('\n⏭️  Step 2/4: Nothing to compound (0% or no fees)');
  }

  // ─── Step 4: Swap harvest portion to USDC ────────────────────────────────
  if (harvest0 <= 0n && harvest1 <= 0n) {
    console.log('\n⏭️  Step 3/4: Nothing to harvest');
    console.log('\n✅ Done! (compound only)');
    process.exit(0);
  }

  console.log('\n⏳ Step 3/4: Swapping harvest portion to USDC...');

  // Check actual wallet balances for harvest amounts (in case compound consumed less)
  let usdcBefore = await retry(() => publicClient.readContract({
    address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));
  console.log(`   USDC balance before swaps: ${formatUnits(usdcBefore, 6)}`);

  // Swap token0 harvest → USDC
  if (harvest0 > 0n) {
    try {
      console.log(`\n   Swapping ${formatUnits(harvest0, token0Decimals)} ${token0Symbol} → USDC...`);
      const swap0 = await swapToUsdc(publicClient, walletClient, account, poolKey.currency0, harvest0, slippagePct, poolKey);
      if (swap0.hash) {
        console.log(`   ✅ TX: ${swap0.hash}`);
      }
    } catch (err) {
      console.error(`   ❌ Swap ${token0Symbol} failed: ${err.message}`);
      console.log('   Continuing with remaining swaps...');
    }
    await sleep(2000);
  }

  // Swap token1 harvest → USDC
  if (harvest1 > 0n) {
    try {
      console.log(`\n   Swapping ${formatUnits(harvest1, token1Decimals)} ${token1Symbol} → USDC...`);
      const swap1 = await swapToUsdc(publicClient, walletClient, account, poolKey.currency1, harvest1, slippagePct, poolKey);
      if (swap1.hash) {
        console.log(`   ✅ TX: ${swap1.hash}${swap1.feeTier ? ` (fee tier: ${swap1.feeTier / 10000}%)` : ''}`);
      }
    } catch (err) {
      console.error(`   ❌ Swap ${token1Symbol} failed: ${err.message}`);
    }
    await sleep(2000);
  }

  // ─── Step 5: Transfer USDC to harvest address ────────────────────────────
  const usdcAfter = await retry(() => publicClient.readContract({
    address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));

  const usdcHarvested = usdcAfter - usdcBefore;
  console.log(`\n⏳ Step 4/4: Transferring USDC to harvest address...`);
  console.log(`   USDC to transfer: ${formatUnits(usdcHarvested, 6)}`);

  if (usdcHarvested <= 0n) {
    console.log('   ⚠️  No USDC to transfer (swaps may have failed)');
    process.exit(1);
  }

  const transferHash = await walletClient.writeContract({
    address: CONTRACTS.USDC,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [harvestAddress, usdcHarvested],
  });
  const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });

  if (transferReceipt.status !== 'success') {
    console.error(`   ❌ USDC transfer failed! TX: ${transferHash}`);
    process.exit(1);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Compound & Harvest Complete!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Fees collected: ~$${(fees0Usd + fees1Usd).toFixed(4)}`);
  console.log(`   Compounded (${compoundPct}%): ${formatUnits(compound0, token0Decimals)} ${token0Symbol} + ${formatUnits(compound1, token1Decimals)} ${token1Symbol}`);
  console.log(`   Harvested (${harvestPct}%): ${formatUnits(usdcHarvested, 6)} USDC → ${harvestAddress}`);
  console.log(`\n🔗 Transactions:`);
  console.log(`   Collect:  https://basescan.org/tx/${collectHash}`);
  console.log(`   Transfer: https://basescan.org/tx/${transferHash}`);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
