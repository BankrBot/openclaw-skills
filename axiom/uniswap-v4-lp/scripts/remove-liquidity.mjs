#!/usr/bin/env node
/**
 * Remove liquidity from V4 LP position
 * Usage: node remove-liquidity.mjs --token-id 1078344 --percent 100
 */

import { createPublicClient, createWalletClient, http, formatEther, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

const argv = yargs(hideBin(process.argv))
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID' })
  .option('percent', { type: 'number', default: 100, description: 'Percentage to remove (1-100)' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .parse();

const CONTRACTS = {
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
};

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }]}, { type: 'uint256' }] },
  { name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
  { name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
];

// Action codes
const Actions = {
  DECREASE_LIQUIDITY: 0x03,
  BURN_POSITION: 0x04,
  TAKE_PAIR: 0x0e,
};

async function main() {
  console.log('🦄 Uniswap V4 LP - Remove Liquidity');
  console.log('====================================');
  console.log(`Token ID: ${argv.tokenId}`);
  console.log(`Percent: ${argv.percent}%`);
  console.log(`Dry run: ${argv.dryRun}`);
  console.log('');

  if (argv.percent < 1 || argv.percent > 100) {
    console.error('❌ Percent must be between 1 and 100');
    process.exit(1);
  }

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
    console.error(`❌ You don't own this position (owner: ${owner})`);
    process.exit(1);
  }

  // Get current liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionLiquidity',
    args: [argv.tokenId],
  });

  console.log(`Current liquidity: ${liquidity.toString()}`);

  if (liquidity === 0n) {
    console.error('❌ Position has no liquidity');
    process.exit(1);
  }

  // Calculate liquidity to remove
  const liquidityToRemove = (liquidity * BigInt(argv.percent)) / 100n;
  console.log(`Removing: ${liquidityToRemove.toString()} (${argv.percent}%)`);

  // Get pool info
  const [poolKey] = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [argv.tokenId],
  });

  if (argv.dryRun) {
    console.log('\n✅ Dry run complete');
    return;
  }

  console.log('\n🔥 Removing liquidity...');

  // Build transaction
  // If 100%, also burn the NFT
  const burnPosition = argv.percent === 100;
  const actions = burnPosition ? '0x03040e' : '0x030e'; // DECREASE + (BURN?) + TAKE_PAIR

  const pad32 = (hex) => hex.slice(2).padStart(64, '0');

  // DECREASE_LIQUIDITY params
  const decreaseParams = '0x' +
    argv.tokenId.toString(16).padStart(64, '0') +
    liquidityToRemove.toString(16).padStart(64, '0') +
    '0'.padStart(64, '0') +  // amount0Min (0 for simplicity, add slippage protection in production)
    '0'.padStart(64, '0') +  // amount1Min
    (5 * 32).toString(16).padStart(64, '0') +
    '0'.padStart(64, '0');   // hookData length

  // BURN_POSITION params (if burning)
  const burnParams = burnPosition ? ('0x' + argv.tokenId.toString(16).padStart(64, '0')) : null;

  // TAKE_PAIR params
  const takeParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    pad32(account.address);

  const paramsArray = burnPosition
    ? [decreaseParams, burnParams, takeParams]
    : [decreaseParams, takeParams];

  const unlockData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, paramsArray]
  );

  const deadline = Math.floor(Date.now() / 1000) + 1800;

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline],
    });

    console.log(`\n⏳ Transaction sent: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ Liquidity removed successfully!`);
      if (burnPosition) {
        console.log('🔥 Position NFT burned');
      }
      console.log(`Gas used: ${receipt.gasUsed}`);
      console.log(`\nView on BaseScan: https://basescan.org/tx/${hash}`);
    } else {
      console.error('❌ Transaction failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
