#!/usr/bin/env node
/**
 * Add liquidity to Uniswap V4 pool on Base - using SDK-style ABI encoding
 * Usage: node add-liquidity-v2.mjs --amount 20 --range 25
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeAbiParameters, parseAbiParameters, maxUint256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { defaultAbiCoder } from '@ethersproject/abi';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

const argv = yargs(hideBin(process.argv))
  .option('amount', { type: 'number', default: 20, description: 'USD amount to add' })
  .option('range', { type: 'number', default: 25, description: 'Range percentage (±%)' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .option('skip-approvals', { type: 'boolean', default: false, description: 'Skip approval checks' })
  .parse();

// Constants
const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
  AXIOM: '0xf3Ce5dDAAb6C133F9875a4a46C55cf0b58111B07',
};

const AXIOM_POOL = {
  poolId: '0x10a0b8eba9d4e0f772c8c47968ee819bb4609ef4454409157961570cdce9a735',
  fee: 0x800000, // DYNAMIC_FEE_FLAG - hook controls the fee
  tickSpacing: 200,
  hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc',
};

// Actions
const Actions = {
  MINT_POSITION: 0x02,
  SETTLE_PAIR: 0x0d,
};

// Math
const Q96 = BigInt(2) ** BigInt(96);

function tickToSqrtPriceX96(tick) {
  const sqrtRatio = Math.sqrt(Math.pow(1.0001, tick));
  return BigInt(Math.floor(sqrtRatio * Number(Q96)));
}

function getLiquidityForAmount0(sqrtPriceA, sqrtPriceB, amount0) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  const intermediate = (sqrtPriceA * sqrtPriceB) / Q96;
  return (amount0 * intermediate) / (sqrtPriceB - sqrtPriceA);
}

function getLiquidityForAmount1(sqrtPriceA, sqrtPriceB, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  return (amount1 * Q96) / (sqrtPriceB - sqrtPriceA);
}

function getLiquidityForAmounts(sqrtPriceX96, sqrtPriceA, sqrtPriceB, amount0, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  
  if (sqrtPriceX96 <= sqrtPriceA) {
    return getLiquidityForAmount0(sqrtPriceA, sqrtPriceB, amount0);
  } else if (sqrtPriceX96 < sqrtPriceB) {
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceB, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtPriceA, sqrtPriceX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    return getLiquidityForAmount1(sqrtPriceA, sqrtPriceB, amount1);
  }
}

// ABIs
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const STATE_VIEW_ABI = [
  { name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
];

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
];

// ABI type strings (matching SDK)
const POOL_KEY_STRUCT = '(address,address,uint24,int24,address)';
const MINT_PARAMS_TYPE = `(${POOL_KEY_STRUCT},int24,int24,uint256,uint128,uint128,address,bytes)`;
const SETTLE_PAIR_TYPE = '(address,address)';

async function main() {
  console.log('🦄 Uniswap V4 LP - Add Liquidity v2');
  console.log('====================================');
  console.log(`Amount: $${argv.amount}`);
  console.log(`Range: ±${argv.range}%`);
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

  // Get pool state
  console.log('\n📊 Fetching pool state...');
  const [sqrtPriceX96, currentTick] = await publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [AXIOM_POOL.poolId],
  });

  console.log(`Current tick: ${currentTick}`);
  console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

  // Calculate tick range
  const tickRange = Math.floor((argv.range / 100) * 46054);
  const tickLower = Math.floor((currentTick - tickRange) / AXIOM_POOL.tickSpacing) * AXIOM_POOL.tickSpacing;
  const tickUpper = Math.ceil((currentTick + tickRange) / AXIOM_POOL.tickSpacing) * AXIOM_POOL.tickSpacing;

  console.log(`Tick range: ${tickLower} to ${tickUpper}`);

  // Check balances
  const [wethBalance, axiomBalance] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: CONTRACTS.AXIOM, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
  ]);

  console.log(`\n💰 Balances: WETH: ${formatEther(wethBalance)}, AXIOM: ${formatEther(axiomBalance)}`);

  // Calculate amounts
  const ETH_PRICE = 2750;
  const wethAmount = parseEther(String((argv.amount / 2) / ETH_PRICE));
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  const axiomAmount = BigInt(Math.floor(Number(wethAmount) * price));

  console.log(`\n📦 Position: WETH: ${formatEther(wethAmount)}, AXIOM: ${formatEther(axiomAmount)}`);

  // Calculate liquidity
  const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);
  const liquidity = getLiquidityForAmounts(sqrtPriceX96, sqrtPriceLower, sqrtPriceUpper, wethAmount, axiomAmount);

  console.log(`Calculated liquidity: ${liquidity}`);

  if (liquidity === 0n) {
    console.error('❌ Liquidity is 0');
    process.exit(1);
  }

  if (argv.dryRun) {
    console.log('\n✅ Dry run complete');
    return;
  }

  console.log('\n🚀 Building transaction...');

  // Build actions bytes
  const actionsHex = '0x' + Actions.MINT_POSITION.toString(16).padStart(2, '0') + Actions.SETTLE_PAIR.toString(16).padStart(2, '0');

  // Add 50% slippage buffer to max amounts
  const amount0Max = wethAmount * 150n / 100n;
  const amount1Max = axiomAmount * 150n / 100n;
  
  console.log(`Amount0Max (WETH): ${formatEther(amount0Max)}`);
  console.log(`Amount1Max (AXIOM): ${formatEther(amount1Max)}`);
  console.log(`Tick lower: ${tickLower}, Tick upper: ${tickUpper}`);
  console.log(`Liquidity (hex): 0x${liquidity.toString(16)}`);

  // Ensure liquidity fits in uint128
  const maxUint128 = 2n ** 128n - 1n;
  if (liquidity > maxUint128) {
    console.error('❌ Liquidity exceeds uint128');
    process.exit(1);
  }

  // Encode MINT_POSITION params - FLAT, not nested (SDK style)
  const mintParams = defaultAbiCoder.encode(
    [POOL_KEY_STRUCT, 'int24', 'int24', 'uint256', 'uint128', 'uint128', 'address', 'bytes'],
    [
      [CONTRACTS.WETH, CONTRACTS.AXIOM, AXIOM_POOL.fee, AXIOM_POOL.tickSpacing, AXIOM_POOL.hooks], // PoolKey
      tickLower,
      tickUpper,
      liquidity.toString(),
      amount0Max.toString(), // amount0Max with slippage
      amount1Max.toString(), // amount1Max with slippage
      '0x0000000000000000000000000000000000000001', // owner = MSG_SENDER
      '0x', // hookData
    ]
  );

  // Encode SETTLE_PAIR params
  const settleParams = defaultAbiCoder.encode(
    ['address', 'address'],
    [CONTRACTS.WETH, CONTRACTS.AXIOM]
  );

  console.log('Mint params length:', mintParams.length);
  console.log('Settle params length:', settleParams.length);

  // Build unlockData: (bytes actions, bytes[] params)
  const unlockData = defaultAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [actionsHex, [mintParams, settleParams]]
  );

  console.log('UnlockData:', unlockData.slice(0, 200) + '...');

  const deadline = Math.floor(Date.now() / 1000) + 1800;

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline],
    });

    console.log(`\n⏳ Tx sent: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ Liquidity added!`);
      console.log(`https://basescan.org/tx/${hash}`);
    } else {
      console.error('❌ Transaction failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.shortMessage || error.message);
    if (error.signature) {
      console.error('Error signature:', error.signature);
    }
  }
}

main().catch(console.error);
