#!/usr/bin/env node
/**
 * Collect fees from V4 LP position without removing liquidity
 * Usage: node collect-fees.mjs --token-id 1078344
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
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .parse();

const CONTRACTS = {
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  WETH: '0x4200000000000000000000000000000000000006',
};

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }]}, { type: 'uint256' }] },
  { name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
];

// Action codes
const Actions = {
  DECREASE_LIQUIDITY: 0x03,
  TAKE_PAIR: 0x0e,
};

async function main() {
  console.log('🦄 Uniswap V4 LP - Collect Fees');
  console.log('================================');
  console.log(`Token ID: ${argv.tokenId}`);
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
    console.error(`❌ You don't own this position (owner: ${owner})`);
    process.exit(1);
  }

  // Get pool info
  const [poolKey] = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [argv.tokenId],
  });

  console.log(`\n📊 Pool: ${poolKey.currency0} / ${poolKey.currency1}`);

  if (argv.dryRun) {
    console.log('\n✅ Dry run complete - would collect fees');
    return;
  }

  // Build collect fees transaction
  // DECREASE_LIQUIDITY with 0 liquidity delta = collect fees only
  console.log('\n💰 Collecting fees...');

  const actions = '0x030e'; // DECREASE_LIQUIDITY + TAKE_PAIR

  // Pad to 32 bytes
  const pad32 = (hex) => hex.slice(2).padStart(64, '0');

  // DECREASE_LIQUIDITY params: tokenId, liquidityDelta, amount0Min, amount1Min, hookData
  const decreaseParams = '0x' +
    argv.tokenId.toString(16).padStart(64, '0') +  // tokenId
    '0'.padStart(64, '0') +                         // liquidity = 0 (fees only)
    '0'.padStart(64, '0') +                         // amount0Min = 0
    '0'.padStart(64, '0') +                         // amount1Min = 0
    (5 * 32).toString(16).padStart(64, '0') +       // hookData offset
    '0'.padStart(64, '0');                          // hookData length = 0

  // TAKE_PAIR params: currency0, currency1, recipient
  const takeParams = '0x' +
    pad32(poolKey.currency0) +
    pad32(poolKey.currency1) +
    pad32(account.address);

  const unlockData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [decreaseParams, takeParams]]
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
      console.log(`\n✅ Fees collected successfully!`);
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
