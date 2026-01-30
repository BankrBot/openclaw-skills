#!/usr/bin/env node
/**
 * Monitor V4 LP position - check if in range
 * Usage: node monitor-position.mjs --token-id 1078344
 */

import { createPublicClient, http, formatEther, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('token-id', { type: 'number', required: true, description: 'LP NFT token ID' })
  .option('json', { type: 'boolean', default: false, description: 'JSON output' })
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

// Decode packed PositionInfo (uint256 with packed poolId, tickUpper, tickLower, hasSubscriber)
// Layout: poolId (200 bits) | tickUpper (24 bits) | tickLower (24 bits) | hasSubscriber (8 bits)
function decodePositionInfo(posInfo) {
  const tickLowerRaw = Number((posInfo >> 8n) & 0xFFFFFFn);
  const tickUpperRaw = Number((posInfo >> 32n) & 0xFFFFFFn);
  
  // Convert from uint24 to int24
  const toInt24 = (val) => val > 0x7FFFFF ? val - 0x1000000 : val;
  
  return {
    tickLower: toInt24(tickLowerRaw),
    tickUpper: toInt24(tickUpperRaw),
  };
}

async function main() {
  const tokenId = argv.tokenId;

  // Get pool key and position info
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

  // Decode position ticks
  const { tickLower, tickUpper } = decodePositionInfo(posInfo);

  // Get pool ID
  const poolId = keccak256(encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  ));

  // Get current pool state
  const [sqrtPriceX96, currentTick, , lpFee] = await publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: [{ name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] }],
    functionName: 'getSlot0',
    args: [poolId],
  });

  // Get liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: [{ name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] }],
    functionName: 'getPositionLiquidity',
    args: [tokenId],
  });

  // Calculate status
  const inRange = currentTick >= tickLower && currentTick < tickUpper;
  const distanceToLower = currentTick - tickLower;
  const distanceToUpper = tickUpper - currentTick;
  const rangeWidth = tickUpper - tickLower;
  const positionInRange = ((currentTick - tickLower) / rangeWidth * 100).toFixed(1);

  // Calculate price from sqrtPriceX96
  const Q96 = 2n ** 96n;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice ** 2;

  const result = {
    tokenId,
    inRange,
    currentTick,
    tickLower,
    tickUpper,
    positionInRange: `${positionInRange}%`,
    distanceToLower,
    distanceToUpper,
    price: price.toExponential(4),
    liquidity: liquidity.toString(),
    alert: !inRange ? 'OUT_OF_RANGE' : (distanceToLower < rangeWidth * 0.1 || distanceToUpper < rangeWidth * 0.1) ? 'NEAR_EDGE' : 'OK',
  };

  if (argv.json) {
    console.log(JSON.stringify(result));
  } else {
    const status = inRange ? '✅ IN RANGE' : '🚨 OUT OF RANGE';
    console.log(`Position #${tokenId}: ${status}`);
    console.log(`  Current tick: ${currentTick}`);
    console.log(`  Range: ${tickLower} → ${tickUpper}`);
    console.log(`  Position in range: ${positionInRange}%`);
    console.log(`  Distance to edges: -${distanceToLower} / +${distanceToUpper} ticks`);
    console.log(`  Price: ${price.toExponential(4)} AXIOM/WETH`);
    
    if (!inRange) {
      console.log('\n⚠️  Position is OUT OF RANGE - not earning fees!');
    } else if (result.alert === 'NEAR_EDGE') {
      console.log('\n⚠️  Position near edge of range - consider rebalancing');
    }
  }
}

main().catch(console.error);
