#!/usr/bin/env node
/**
 * Check Uniswap V4 LP position details
 * Usage: node check-position.mjs --token-id 1078344
 */

import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID' })
  .option('address', { type: 'string', description: 'Wallet address to check' })
  .parse();

const CONTRACTS = {
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  WETH: '0x4200000000000000000000000000000000000006',
};

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function main() {
  const tokenId = argv.tokenId;
  console.log(`\n🔍 Checking V4 Position #${tokenId}\n`);

  // Get owner
  const owner = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: [{ name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] }],
    functionName: 'ownerOf',
    args: [tokenId],
  });
  console.log(`Owner: ${owner}`);

  // Get liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: [{ name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] }],
    functionName: 'getPositionLiquidity',
    args: [tokenId],
  });
  console.log(`Liquidity: ${liquidity.toString()}`);

  // Get pool and position info
  const [poolKey, posInfo] = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: [{
      name: 'getPoolAndPositionInfo',
      type: 'function',
      inputs: [{ type: 'uint256' }],
      outputs: [
        { type: 'tuple', components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]},
        { type: 'uint256' }
      ]
    }],
    functionName: 'getPoolAndPositionInfo',
    args: [tokenId],
  });

  console.log(`\n📊 Pool Details:`);
  console.log(`  Token0: ${poolKey.currency0}${poolKey.currency0 === CONTRACTS.WETH ? ' (WETH)' : ''}`);
  console.log(`  Token1: ${poolKey.currency1}`);
  console.log(`  Fee: ${poolKey.fee}${poolKey.fee === 0x800000 ? ' (DYNAMIC)' : ''}`);
  console.log(`  Tick Spacing: ${poolKey.tickSpacing}`);
  console.log(`  Hooks: ${poolKey.hooks}`);

  // Check if in range by getting current tick
  const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
  const poolId = keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  ));

  const [sqrtPriceX96, currentTick] = await publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: [{ name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] }],
    functionName: 'getSlot0',
    args: [poolId],
  });

  console.log(`\n📈 Current Pool State:`);
  console.log(`  Current Tick: ${currentTick}`);
  console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);

  if (liquidity > 0n) {
    console.log(`\n✅ Position is ACTIVE with liquidity`);
  } else {
    console.log(`\n⚠️ Position has 0 liquidity (possibly withdrawn)`);
  }
}

main().catch(console.error);
