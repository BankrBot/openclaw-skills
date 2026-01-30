#!/usr/bin/env node
/**
 * Auto-compound V4 LP fees: collect → re-add as liquidity
 * 
 * Two strategies:
 *   DOLLAR (default) — only compound when fees exceed a USD threshold
 *   TIME             — compound on a fixed schedule, skip only if gas > fees
 * 
 * Usage:
 *   # One-shot (dollar strategy, default $5 min)
 *   node auto-compound.mjs --token-id 1078751
 *   
 *   # One-shot with custom threshold
 *   node auto-compound.mjs --token-id 1078751 --min-usd 20
 *   
 *   # Time-based loop: compound every 4 hours regardless of amount
 *   node auto-compound.mjs --token-id 1078751 --strategy time --loop --interval 14400
 *   
 *   # Dollar-based loop: check hourly, only compound when fees > $50
 *   node auto-compound.mjs --token-id 1078751 --strategy dollar --loop --interval 3600 --min-usd 50
 *   
 *   # Preview without executing
 *   node auto-compound.mjs --token-id 1078751 --dry-run
 * 
 * Gas-aware: both strategies skip if fees < gas cost (no burning money).
 * Dollar strategy adds a configurable USD floor on top.
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther, maxUint256 } from 'viem';
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
  .option('strategy', { type: 'string', choices: ['dollar', 'time'], default: 'dollar', description: 'Compound strategy' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Preview fees without executing' })
  .option('loop', { type: 'boolean', default: false, description: 'Run continuously' })
  .option('interval', { type: 'number', default: 3600, description: 'Seconds between checks (loop mode)' })
  .option('min-usd', { type: 'number', default: 5, description: '[dollar] Min USD value to trigger compound' })
  .option('min-gas-multiple', { type: 'number', default: 3, description: '[both] Fees must exceed Nx gas cost' })
  .option('force', { type: 'boolean', default: false, description: 'Skip all profitability checks' })
  .option('rpc', { type: 'string', default: 'https://mainnet.base.org', description: 'Base RPC URL' })
  .parse();

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
};

// V4 Action Codes — canonical from Actions.sol
const Actions = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  BURN_POSITION: 0x03,
  SETTLE_PAIR: 0x0d,
  TAKE_PAIR: 0x0e,
  SETTLE: 0x0f,
  TAKE: 0x10,
  CLOSE_CURRENCY: 0x11,
  SWEEP: 0x13,
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

// ─── Core: Collect Fees ──────────────────────────────────────────────────────

async function collectFees(publicClient, walletClient, account, tokenId, poolKey) {
  // Proven pattern: DECREASE(0x01) + CLOSE_CURRENCY(0x11)
  // Verified on-chain: single CLOSE_CURRENCY resolves both token deltas
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

  const { encodeAbiParameters, parseAbiParameters } = await import('viem');
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

// ─── Core: Add Liquidity ─────────────────────────────────────────────────────

async function addFeesAsLiquidity(publicClient, walletClient, account, tokenId, poolKey, feesWeth, feesToken1, sqrtPriceX96, tickLower, tickUpper, deadline) {
  // Calculate liquidity from fee amounts
  const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);
  const newLiquidity = getLiquidityForAmounts(sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, feesWeth, feesToken1);

  if (newLiquidity <= 0n) return { success: false, reason: 'zero-liquidity' };

  console.log(`   Liquidity to add: ${newLiquidity}`);

  // Ensure tokens approved to Permit2 (V4 uses Permit2 for token transfers)
  if (feesWeth > 0n) {
    const allowance = await publicClient.readContract({
      address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'allowance',
      args: [account.address, CONTRACTS.PERMIT2],
    });
    if (allowance < feesWeth) {
      console.log('   Approving WETH to Permit2...');
      const tx = await walletClient.writeContract({
        address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.PERMIT2, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  }

  if (feesToken1 > 0n) {
    await sleep(1000);
    const allowance = await publicClient.readContract({
      address: poolKey.currency1, abi: ERC20_ABI, functionName: 'allowance',
      args: [account.address, CONTRACTS.PERMIT2],
    });
    if (allowance < feesToken1) {
      console.log('   Approving Token1 to Permit2...');
      const tx = await walletClient.writeContract({
        address: poolKey.currency1, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.PERMIT2, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  }

  await sleep(1000);

  // Proven pattern: INCREASE(0x00) + CLOSE_CURRENCY(0x11) — 2 actions
  // CLOSE_CURRENCY safely handles settlement (pays negative deltas, takes positive ones)
  // Verified on-chain: tx 0xa2f8...04f9 increased liquidity successfully
  const addActionsHex = '0x0011';

  const amount0Max = feesWeth > 0n ? feesWeth * 150n / 100n : 0n;
  const amount1Max = feesToken1 > 0n ? feesToken1 * 150n / 100n : 0n;

  // INCREASE_LIQUIDITY: tokenId, liquidity, amount0Max, amount1Max, hookData
  const increaseParams = '0x' +
    pad32('0x' + tokenId.toString(16)) +
    pad32('0x' + newLiquidity.toString(16)) +
    pad32('0x' + amount0Max.toString(16)) +
    pad32('0x' + amount1Max.toString(16)) +
    (5 * 32).toString(16).padStart(64, '0') +
    '0'.padStart(64, '0');

  // CLOSE_CURRENCY: both currencies + recipient
  const closeParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    pad32(account.address);

  const { encodeAbiParameters, parseAbiParameters } = await import('viem');
  const addData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [addActionsHex, [increaseParams, closeParams]]
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

// ─── Core: Compound ──────────────────────────────────────────────────────────

async function compound(publicClient, walletClient, account) {
  const tokenId = BigInt(argv.tokenId);
  const strategy = argv.strategy;

  console.log(`\n🔄 Auto-Compound — Position #${argv.tokenId}`);
  console.log(`📋 Strategy: ${strategy.toUpperCase()}`);
  console.log('═'.repeat(50));
  console.log(`Time: ${new Date().toISOString()}`);

  // 1. Position info
  const [poolKey, posInfo] = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [tokenId],
  }));
  await sleep(800);

  const liquidity = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionLiquidity',
    args: [tokenId],
  }));

  console.log(`\n📊 Position:`);
  console.log(`   Pool: ${poolKey.currency0.slice(0,10)}... / ${poolKey.currency1.slice(0,10)}...`);
  console.log(`   Fee: ${poolKey.fee === 8388608 ? 'DYNAMIC' : poolKey.fee}`);
  console.log(`   Liquidity: ${liquidity.toString()}`);

  if (liquidity === 0n) {
    console.log('⚠️  No liquidity');
    return { compounded: false, reason: 'no-liquidity' };
  }

  // 2. Pool state (for price + tick range extraction)
  const poolId = defaultAbiCoder.encode(
    [POOL_KEY_STRUCT],
    [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]]
  );
  const { keccak256 } = await import('viem');
  const poolIdHash = keccak256(poolId);
  
  await sleep(800);
  const [sqrtPriceX96, currentTick] = await retry(() => publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [poolIdHash],
  }));

  // Extract tick range from posInfo
  // V4 packs: poolId(25B) | tickLower(3B) | tickUpper(3B) | salt(1B) = 32B total
  const posInfoBN = BigInt(posInfo);
  const toInt24 = (v) => v >= 0x800000 ? v - 0x1000000 : v;
  const rawA = toInt24(Number((posInfoBN >> 32n) & 0xFFFFFFn));
  const rawB = toInt24(Number((posInfoBN >> 8n) & 0xFFFFFFn));
  // Ensure tickLower < tickUpper (V4 invariant)
  const tickLower = Math.min(rawA, rawB);
  const tickUpper = Math.max(rawA, rawB);
  console.log(`   Range: tick ${tickLower} → ${tickUpper} (current: ${currentTick})`);

  // 3. Wallet balances before
  await sleep(500);
  const wethBefore = await retry(() => publicClient.readContract({
    address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));
  await sleep(500);
  const token1Before = await retry(() => publicClient.readContract({
    address: poolKey.currency1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));

  console.log(`\n💰 Wallet: WETH ${formatEther(wethBefore)} | Token1 ${formatEther(token1Before)}`);

  if (argv.dryRun) {
    console.log('\n✅ Dry run — would collect fees and re-add as liquidity');
    return { compounded: false, reason: 'dry-run' };
  }

  // ─── Step 1: Collect fees ────────────────────────────────────────────────
  console.log('\n⏳ Collecting fees...');
  const { hash: collectHash, receipt: collectReceipt, deadline } = await collectFees(
    publicClient, walletClient, account, tokenId, poolKey
  );
  console.log(`   TX: ${collectHash}`);

  if (collectReceipt.status !== 'success') {
    console.error('❌ Fee collection reverted');
    return { compounded: false, reason: 'collect-failed' };
  }
  console.log('   ✅ Collected!');
  await sleep(3000);

  // ─── Step 2: Measure fees ────────────────────────────────────────────────
  const wethAfter = await retry(() => publicClient.readContract({
    address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));
  await sleep(500);
  const token1After = await retry(() => publicClient.readContract({
    address: poolKey.currency1, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  }));

  const feesWeth = wethAfter - wethBefore;
  const feesToken1 = token1After - token1Before;

  console.log(`\n💸 Fees: WETH ${formatEther(feesWeth)} | Token1 ${formatEther(feesToken1)}`);

  if (feesWeth <= 0n && feesToken1 <= 0n) {
    console.log('⚠️  No fees accrued');
    return { compounded: false, reason: 'no-fees', collectTx: collectHash };
  }

  // ─── Step 3: Strategy decision ───────────────────────────────────────────
  const [ethPrice, token1Price] = await Promise.all([getEthPrice(), getTokenPrice(poolKey.currency1)]);
  const gasPrice = await retry(() => publicClient.getGasPrice());
  const gasCostUsd = (Number(gasPrice * 350000n) / 1e18) * ethPrice;
  const feesWethUsd = (Number(feesWeth) / 1e18) * ethPrice;
  const feesToken1Usd = (Number(feesToken1) / 1e18) * token1Price;
  const feesUsd = feesWethUsd + feesToken1Usd;

  console.log(`\n📊 Economics:`);
  console.log(`   ETH:    $${ethPrice.toFixed(0)} | Token1: $${token1Price.toFixed(8)}`);
  console.log(`   Fees:   $${feesUsd.toFixed(4)} (WETH $${feesWethUsd.toFixed(4)} + Token1 $${feesToken1Usd.toFixed(4)})`);
  console.log(`   Gas:    ~$${gasCostUsd.toFixed(4)}`);
  console.log(`   Strategy: ${strategy.toUpperCase()}`);

  let shouldCompound = argv.force;

  if (!argv.force) {
    // Both strategies: always skip if fees < gas cost × multiplier
    const gasFloor = gasCostUsd * argv.minGasMultiple;
    if (feesUsd < gasFloor) {
      console.log(`\n⛽ Fees ($${feesUsd.toFixed(4)}) < ${argv.minGasMultiple}x gas ($${gasFloor.toFixed(4)}). Not worth it.`);
      console.log('   Fees remain in wallet for next run.');
      return { compounded: false, reason: 'below-gas-floor', feesUsd, collectTx: collectHash };
    }

    if (strategy === 'dollar') {
      // Dollar strategy: also require min USD threshold
      if (feesUsd < argv.minUsd) {
        console.log(`\n💵 Fees ($${feesUsd.toFixed(4)}) < threshold ($${argv.minUsd}). Waiting for more.`);
        console.log('   Fees remain in wallet — will compound when threshold is met.');
        return { compounded: false, reason: 'below-usd-threshold', feesUsd, collectTx: collectHash };
      }
      console.log(`\n✅ DOLLAR: Fees ($${feesUsd.toFixed(2)}) ≥ $${argv.minUsd} threshold — compounding!`);
      shouldCompound = true;

    } else if (strategy === 'time') {
      // Time strategy: compound if fees > gas floor (already checked above)
      console.log(`\n✅ TIME: Fees ($${feesUsd.toFixed(4)}) > gas floor ($${gasFloor.toFixed(4)}) — compounding!`);
      shouldCompound = true;
    }
  }

  if (!shouldCompound) {
    return { compounded: false, reason: 'strategy-skip', feesUsd, collectTx: collectHash };
  }

  // ─── Step 4: Re-add as liquidity ─────────────────────────────────────────
  console.log('\n⏳ Re-adding fees as liquidity...');

  const result = await addFeesAsLiquidity(
    publicClient, walletClient, account, tokenId, poolKey,
    feesWeth, feesToken1, sqrtPriceX96, tickLower, tickUpper, deadline
  );

  if (!result.success) {
    if (result.reason === 'zero-liquidity') {
      console.log('⚠️  Liquidity calc returned 0 — fees too small or position out of range');
      console.log('   Fees remain in wallet.');
    } else {
      console.error(`❌ Add liquidity failed: ${result.hash || 'no tx'}`);
    }
    return { compounded: false, reason: result.reason, feesUsd, collectTx: collectHash };
  }

  const totalGas = collectReceipt.gasUsed + result.receipt.gasUsed;
  console.log(`\n✅ Auto-compound complete!`);
  console.log(`   WETH: ${formatEther(feesWeth)} | Token1: ${formatEther(feesToken1)}`);
  console.log(`   Value: ~$${feesUsd.toFixed(4)}`);
  console.log(`   Gas: ${totalGas} (~$${((Number(totalGas * gasPrice) / 1e18) * ethPrice).toFixed(4)})`);
  console.log(`   https://basescan.org/tx/${result.hash}`);

  return { compounded: true, feesUsd, collectTx: collectHash, addTx: result.hash, gas: totalGas };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) { console.error('❌ No private key in ~/.axiom/wallet.env'); process.exit(1); }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http(argv.rpc) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(argv.rpc) });

  console.log(`Wallet: ${account.address}`);
  console.log(`Strategy: ${argv.strategy.toUpperCase()}`);

  // Verify ownership
  const owner = await retry(() => publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'ownerOf',
    args: [BigInt(argv.tokenId)],
  }));

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ Not your position (owner: ${owner})`);
    process.exit(1);
  }

  if (argv.loop) {
    const stratDesc = argv.strategy === 'dollar'
      ? `compound when fees ≥ $${argv.minUsd} AND ≥ ${argv.minGasMultiple}x gas`
      : `compound every ${argv.interval}s if fees ≥ ${argv.minGasMultiple}x gas`;

    console.log(`\n🔁 Loop mode — checking every ${argv.interval}s`);
    console.log(`   ${stratDesc}`);
    console.log(`   Ctrl+C to stop\n`);

    let runs = 0, compounds = 0, totalFeesUsd = 0;

    while (true) {
      runs++;
      console.log(`\n${'━'.repeat(50)}\n  Run #${runs} | ${new Date().toLocaleString()}\n${'━'.repeat(50)}`);
      try {
        const result = await compound(publicClient, walletClient, account);
        if (result.compounded) {
          compounds++;
          totalFeesUsd += result.feesUsd || 0;
        }
        console.log(`\n📈 ${compounds}/${runs} compounded | ~$${totalFeesUsd.toFixed(2)} total`);
      } catch (err) {
        console.error(`\n❌ Error: ${err.message}`);
      }
      console.log(`⏰ Next: ${new Date(Date.now() + argv.interval * 1000).toLocaleTimeString()}`);
      await sleep(argv.interval * 1000);
    }
  } else {
    try {
      const result = await compound(publicClient, walletClient, account);
      if (!result.compounded) console.log(`\nResult: ${result.reason}`);
    } catch (err) {
      console.error(`\n❌ Fatal: ${err.message}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);
