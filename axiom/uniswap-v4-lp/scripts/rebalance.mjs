#!/usr/bin/env node
/**
 * Rebalance V4 LP position - remove liquidity and re-add at new range
 * Usage: node rebalance.mjs --token-id 1078344 --range 25
 */

import { createPublicClient, createWalletClient, http, formatEther, encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

const argv = yargs(hideBin(process.argv))
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID to rebalance' })
  .option('range', { type: 'number', default: 25, description: 'New range percentage (±%)' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .parse();

const CONTRACTS = {
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }]}, { type: 'uint256' }] },
  { name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
  { name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'nextTokenId', type: 'function', inputs: [], outputs: [{ type: 'uint256' }] },
];

const STATE_VIEW_ABI = [
  { name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
];

const Q96 = 2n ** 96n;

function tickToSqrtPriceX96(tick) {
  const sqrtRatio = Math.sqrt(Math.pow(1.0001, tick));
  return BigInt(Math.floor(sqrtRatio * Number(Q96)));
}

function getLiquidityForAmounts(sqrtPriceX96, sqrtPriceA, sqrtPriceB, amount0, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  
  if (sqrtPriceX96 <= sqrtPriceA) {
    const intermediate = (sqrtPriceA * sqrtPriceB) / Q96;
    return (amount0 * intermediate) / (sqrtPriceB - sqrtPriceA);
  } else if (sqrtPriceX96 < sqrtPriceB) {
    const intermediate0 = (sqrtPriceX96 * sqrtPriceB) / Q96;
    const liquidity0 = (amount0 * intermediate0) / (sqrtPriceB - sqrtPriceX96);
    const liquidity1 = (amount1 * Q96) / (sqrtPriceX96 - sqrtPriceA);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    return (amount1 * Q96) / (sqrtPriceB - sqrtPriceA);
  }
}

// Calculate amounts from liquidity (for when we remove)
function getAmountsFromLiquidity(liquidity, sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper) {
  let amount0 = 0n, amount1 = 0n;
  
  if (sqrtPriceX96 <= sqrtPriceLower) {
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPriceLower)) / (sqrtPriceLower * sqrtPriceUpper);
  } else if (sqrtPriceX96 < sqrtPriceUpper) {
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPriceX96)) / (sqrtPriceX96 * sqrtPriceUpper);
    amount1 = (liquidity * (sqrtPriceX96 - sqrtPriceLower)) / Q96;
  } else {
    amount1 = (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  }
  
  return { amount0, amount1 };
}

// Decode position info to get ticks
function decodePositionInfo(posInfo) {
  const tickLowerRaw = Number((posInfo >> 8n) & 0xFFFFFFn);
  const tickUpperRaw = Number((posInfo >> 32n) & 0xFFFFFFn);
  const toInt24 = (val) => val > 0x7FFFFF ? val - 0x1000000 : val;
  return { tickLower: toInt24(tickLowerRaw), tickUpper: toInt24(tickUpperRaw) };
}

async function main() {
  console.log('🦄 Uniswap V4 LP - Rebalance Position');
  console.log('======================================');
  console.log(`Token ID: ${argv.tokenId}`);
  console.log(`New range: ±${argv.range}%`);
  console.log(`Dry run: ${argv.dryRun}`);
  console.log('');

  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ No private key found');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`Wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  // Verify ownership
  const owner = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'ownerOf',
    args: [argv.tokenId],
  });

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ You don't own this position`);
    process.exit(1);
  }

  // Get position info
  const [poolKey, posInfo] = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [argv.tokenId],
  });

  const { tickLower: oldTickLower, tickUpper: oldTickUpper } = decodePositionInfo(posInfo);
  console.log(`Old range: ${oldTickLower} → ${oldTickUpper}`);

  // Get liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionLiquidity',
    args: [argv.tokenId],
  });

  if (liquidity === 0n) {
    console.error('❌ Position has no liquidity');
    process.exit(1);
  }

  // Get current price
  const poolId = keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  ));

  const [sqrtPriceX96, currentTick] = await publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [poolId],
  });

  console.log(`Current tick: ${currentTick}`);

  // Calculate new tick range
  const tickRange = Math.floor((argv.range / 100) * 46054);
  const newTickLower = Math.floor((currentTick - tickRange) / poolKey.tickSpacing) * poolKey.tickSpacing;
  const newTickUpper = Math.ceil((currentTick + tickRange) / poolKey.tickSpacing) * poolKey.tickSpacing;

  console.log(`New range: ${newTickLower} → ${newTickUpper}`);

  // Calculate expected amounts from old position
  const sqrtPriceLower = tickToSqrtPriceX96(oldTickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(oldTickUpper);
  const { amount0, amount1 } = getAmountsFromLiquidity(liquidity, sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper);

  console.log(`\nExpected tokens back:`);
  console.log(`  Token0: ${formatEther(amount0)}`);
  console.log(`  Token1: ${formatEther(amount1)}`);

  // Calculate new liquidity
  const newSqrtPriceLower = tickToSqrtPriceX96(newTickLower);
  const newSqrtPriceUpper = tickToSqrtPriceX96(newTickUpper);
  const newLiquidity = getLiquidityForAmounts(sqrtPriceX96, newSqrtPriceLower, newSqrtPriceUpper, amount0, amount1);

  console.log(`New liquidity: ${newLiquidity}`);

  if (argv.dryRun) {
    console.log('\n✅ Dry run complete');
    console.log('Would: 1) Remove all liquidity, 2) Add to new range');
    return;
  }

  // STEP 1: Remove liquidity
  console.log('\n📤 Step 1: Removing old position...');

  const removeActions = '0x03040e'; // DECREASE + BURN + TAKE_PAIR
  const pad32 = (hex) => hex.slice(2).padStart(64, '0');

  const decreaseParams = '0x' +
    argv.tokenId.toString(16).padStart(64, '0') +
    liquidity.toString(16).padStart(64, '0') +
    '0'.padStart(64, '0') +
    '0'.padStart(64, '0') +
    (5 * 32).toString(16).padStart(64, '0') +
    '0'.padStart(64, '0');

  const burnParams = '0x' + argv.tokenId.toString(16).padStart(64, '0');

  const takeParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    pad32(account.address);

  const removeData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [removeActions, [decreaseParams, burnParams, takeParams]]
  );

  const deadline = Math.floor(Date.now() / 1000) + 1800;

  try {
    const removeHash = await walletClient.writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'modifyLiquidities',
      args: [removeData, deadline],
    });

    console.log(`Transaction: ${removeHash}`);
    const removeReceipt = await publicClient.waitForTransactionReceipt({ hash: removeHash });

    if (removeReceipt.status !== 'success') {
      console.error('❌ Remove failed');
      process.exit(1);
    }
    console.log('✅ Old position removed');

  } catch (error) {
    console.error('❌ Remove error:', error.message);
    process.exit(1);
  }

  // STEP 2: Add new position
  console.log('\n📥 Step 2: Adding new position...');

  // Get next token ID
  const nextTokenId = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'nextTokenId',
    args: [],
  });

  const addActions = '0x020d'; // MINT_POSITION + SETTLE_PAIR

  const toInt24Hex = (n) => {
    const val = n < 0 ? (0x1000000 + n) : n;
    return val.toString(16).padStart(64, '0');
  };

  const mintParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    poolKey.fee.toString(16).padStart(64, '0') +
    poolKey.tickSpacing.toString(16).padStart(64, '0') +
    pad32(poolKey.hooks) +
    toInt24Hex(newTickLower) +
    toInt24Hex(newTickUpper) +
    newLiquidity.toString(16).padStart(64, '0') +
    amount0.toString(16).padStart(64, '0') +
    amount1.toString(16).padStart(64, '0') +
    '0000000000000000000000000000000000000000000000000000000000000001' +
    (12 * 32).toString(16).padStart(64, '0') +
    '0'.padStart(64, '0');

  const settleParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1);

  const addData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [addActions, [mintParams, settleParams]]
  );

  try {
    const addHash = await walletClient.writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'modifyLiquidities',
      args: [addData, deadline],
    });

    console.log(`Transaction: ${addHash}`);
    const addReceipt = await publicClient.waitForTransactionReceipt({ hash: addHash });

    if (addReceipt.status === 'success') {
      console.log(`\n✅ Rebalance complete!`);
      console.log(`New position token ID: ${nextTokenId}`);
      console.log(`New range: ${newTickLower} → ${newTickUpper}`);
      console.log(`\nView on BaseScan: https://basescan.org/tx/${addHash}`);
    } else {
      console.error('❌ Add position failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Add error:', error.message);
    console.log('⚠️  Old position was removed but new position failed to create');
    console.log('Tokens should be back in your wallet');
    process.exit(1);
  }
}

main().catch(console.error);
