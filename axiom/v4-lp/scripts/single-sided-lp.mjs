#!/usr/bin/env node
/**
 * Single-sided LP on Uniswap V4 — deposit one token only
 * 
 * Creates a range order that sells token as price moves through the range.
 * 
 * Usage:
 *   # Sell all AXIOM as price rises toward $3M mcap
 *   node single-sided-lp.mjs --token axiom --amount all --target-mcap 3000000
 *   
 *   # Sell specific amount with custom tick range
 *   node single-sided-lp.mjs --token axiom --amount 500000000 --tick-lower 183000 --tick-upper 211800
 *   
 *   # Single-sided WETH (buy AXIOM as price drops)
 *   node single-sided-lp.mjs --token weth --amount 0.5 --range-below 50
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
  .option('token', { type: 'string', demandOption: true, choices: ['weth', 'axiom'], description: 'Which token to deposit (single-sided)' })
  .option('amount', { type: 'string', default: 'all', description: 'Amount to deposit ("all" or number)' })
  .option('tick-lower', { type: 'number', description: 'Custom tick lower bound' })
  .option('tick-upper', { type: 'number', description: 'Custom tick upper bound' })
  .option('target-mcap', { type: 'number', description: 'Target mcap in USD (calculates tick automatically)' })
  .option('range-below', { type: 'number', description: 'Percentage below current price (for WETH single-sided)' })
  .option('range-above', { type: 'number', description: 'Percentage above current price (for AXIOM single-sided)' })
  .option('eth-price', { type: 'number', default: 2700, description: 'ETH price in USD for mcap calculations' })
  .option('total-supply', { type: 'number', default: 100_000_000_000, description: 'Token total supply' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only, do not send tx' })
  .example('$0 --token axiom --amount all --target-mcap 3000000', 'Sell all AXIOM up to $3M mcap')
  .example('$0 --token weth --amount 0.5 --range-below 50', 'Buy AXIOM with 0.5 WETH if price drops 50%')
  .parse();

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
  AXIOM: '0xf3Ce5dDAAb6C133F9875a4a46C55cf0b58111B07',
};

const POOL = {
  poolId: '0x10a0b8eba9d4e0f772c8c47968ee819bb4609ef4454409157961570cdce9a735',
  fee: 0x800000,
  tickSpacing: 200,
  hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc',
};

const Actions = { MINT_POSITION: 0x02, SETTLE_PAIR: 0x0d };
const Q96 = 2n ** 96n;

// ─── ABIs ────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: '', type: 'address' }, { name: '', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

const STATE_VIEW_ABI = [
  { name: 'getSlot0', type: 'function', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
];

const PM_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
];

const POOL_KEY_STRUCT = '(address,address,uint24,int24,address)';

// ─── Tick Math ───────────────────────────────────────────────────────────────

function tickToSqrtPriceX96(tick) {
  const absTick = Math.abs(tick);
  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : (1n << 128n);
  const bits = [
    [0x2, 0xfff97272373d413259a46990580e213an], [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
    [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n], [0x10, 0xffcb9843d60f6159c9db58835c926644n],
    [0x20, 0xff973b41fa98c081472e6896dfb254c0n], [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
    [0x80, 0xfe5dee046a99a2a811c461f1969c3053n], [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [0x200, 0xf987a7253ac413176f2b074cf7815e54n], [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
    [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n], [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
    [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n], [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
    [0x8000, 0x31be135f97d08fd981231505542fcfa6n], [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [0x20000, 0x5d6af8dedb81196699c329225ee604n], [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
    [0x80000, 0x48a170391f7dc42444e8fa2n],
  ];
  for (const [bit, val] of bits) if ((absTick & bit) !== 0) ratio = (ratio * val) >> 128n;
  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

function mcapToTick(mcapUsd, ethPrice, totalSupply) {
  const priceUsd = mcapUsd / totalSupply;
  const wethPerToken = priceUsd / ethPrice;
  const tokensPerWeth = 1 / wethPerToken;
  return Math.log(tokensPerWeth) / Math.log(1.0001);
}

function alignTick(tick, spacing, direction) {
  if (direction === 'down') return Math.floor(tick / spacing) * spacing;
  return Math.ceil(tick / spacing) * spacing;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🦄 Uniswap V4 — Single-Sided LP');
  console.log('================================');
  console.log(`Token: ${argv.token.toUpperCase()}`);
  console.log(`Amount: ${argv.amount}`);
  console.log('');

  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) { console.error('❌ No private key found'); process.exit(1); }

  const account = privateKeyToAccount(privateKey);
  const transport = http(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const pub = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  // ─── Get pool state ─────────────────────────────────────────────────────
  const [sqrtPriceX96, currentTick] = await pub.readContract({
    address: CONTRACTS.STATE_VIEW, abi: STATE_VIEW_ABI,
    functionName: 'getSlot0', args: [POOL.poolId],
  });

  const sqrtP = Number(sqrtPriceX96) / Number(Q96);
  const axiomPerWeth = sqrtP * sqrtP;
  const wethPerAxiom = 1 / axiomPerWeth;
  const axiomPriceUsd = wethPerAxiom * argv.ethPrice;
  const currentMcap = argv.totalSupply * axiomPriceUsd;

  console.log(`📊 Current tick: ${currentTick}`);
  console.log(`   AXIOM price: $${axiomPriceUsd.toExponential(4)}`);
  console.log(`   Current mcap: $${currentMcap.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

  // ─── Get token balance ──────────────────────────────────────────────────
  const tokenAddress = argv.token === 'weth' ? CONTRACTS.WETH : CONTRACTS.AXIOM;
  const tokenBal = await pub.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] });
  const depositAmount = argv.amount === 'all' ? tokenBal : parseEther(argv.amount);

  if (depositAmount === 0n) { console.error('❌ No tokens to deposit'); process.exit(1); }
  if (depositAmount > tokenBal) { console.error(`❌ Insufficient balance: have ${formatEther(tokenBal)}, need ${formatEther(depositAmount)}`); process.exit(1); }

  console.log(`\n💰 Depositing: ${formatEther(depositAmount)} ${argv.token.toUpperCase()}`);

  // ─── Calculate tick range ───────────────────────────────────────────────
  let tickLower, tickUpper;

  if (argv.tickLower != null && argv.tickUpper != null) {
    tickLower = argv.tickLower;
    tickUpper = argv.tickUpper;
  } else if (argv.targetMcap) {
    const targetTick = mcapToTick(argv.targetMcap, argv.ethPrice, argv.totalSupply);
    if (argv.token === 'axiom') {
      // Sell AXIOM as price rises: range BELOW current tick
      tickLower = alignTick(targetTick, POOL.tickSpacing, 'down');
      tickUpper = alignTick(currentTick, POOL.tickSpacing, 'down');
    } else {
      // Buy AXIOM as price drops: range ABOVE current tick  
      tickLower = alignTick(currentTick, POOL.tickSpacing, 'up');
      tickUpper = alignTick(targetTick, POOL.tickSpacing, 'up');
    }
  } else if (argv.rangeBelow) {
    // WETH single-sided: buy AXIOM if price drops X%
    const factor = 1 + argv.rangeBelow / 100;
    const targetAxiomPerWeth = axiomPerWeth * factor;
    const targetTick = Math.log(targetAxiomPerWeth) / Math.log(1.0001);
    tickLower = alignTick(currentTick, POOL.tickSpacing, 'up');
    tickUpper = alignTick(targetTick, POOL.tickSpacing, 'up');
  } else if (argv.rangeAbove) {
    // AXIOM single-sided: sell AXIOM if price rises X%
    const factor = 1 - argv.rangeAbove / 100;
    const targetAxiomPerWeth = axiomPerWeth * factor;
    const targetTick = Math.log(targetAxiomPerWeth) / Math.log(1.0001);
    tickLower = alignTick(targetTick, POOL.tickSpacing, 'down');
    tickUpper = alignTick(currentTick, POOL.tickSpacing, 'down');
  } else {
    console.error('❌ Must specify --tick-lower/--tick-upper, --target-mcap, --range-below, or --range-above');
    process.exit(1);
  }

  // Validate single-sided range
  if (argv.token === 'axiom' && tickUpper >= currentTick) {
    console.error(`❌ For AXIOM single-sided, tickUpper (${tickUpper}) must be below current tick (${currentTick})`);
    process.exit(1);
  }
  if (argv.token === 'weth' && tickLower <= currentTick) {
    console.error(`❌ For WETH single-sided, tickLower (${tickLower}) must be above current tick (${currentTick})`);
    process.exit(1);
  }

  const sqrtLower = tickToSqrtPriceX96(tickLower);
  const sqrtUpper = tickToSqrtPriceX96(tickUpper);

  // Calculate liquidity from single-sided amount
  let liquidity;
  if (argv.token === 'axiom') {
    // Token1 only: L = amount1 * Q96 / (sqrtUpper - sqrtLower)
    liquidity = depositAmount * Q96 / (sqrtUpper - sqrtLower);
  } else {
    // Token0 only: L = amount0 * sqrtA * sqrtB / (Q96 * (sqrtB - sqrtA))
    liquidity = (depositAmount * sqrtLower * sqrtUpper) / (Q96 * (sqrtUpper - sqrtLower));
  }

  const maxU128 = 2n ** 128n - 1n;
  if (liquidity > maxU128) liquidity = maxU128;
  if (liquidity === 0n) { console.error('❌ Liquidity is 0'); process.exit(1); }

  // Show summary
  const lowerMcap = argv.totalSupply * (1 / Math.pow(1.0001, tickLower)) * argv.ethPrice;  // wrong direction but close enough
  const upperMcap = argv.totalSupply * (1 / Math.pow(1.0001, tickUpper)) * argv.ethPrice;

  console.log(`\n📐 Range:`);
  console.log(`   tickLower: ${tickLower}`);
  console.log(`   tickUpper: ${tickUpper}`);
  console.log(`   Liquidity: ${liquidity.toString()}`);
  console.log(`\n🎯 Behavior:`);
  if (argv.token === 'axiom') {
    console.log(`   Sells AXIOM → WETH as price rises through range`);
    console.log(`   Acts as a distributed limit sell order`);
  } else {
    console.log(`   Buys AXIOM with WETH as price drops through range`);
    console.log(`   Acts as a distributed limit buy order`);
  }

  if (argv.dryRun) { console.log('\n✅ Dry run complete'); return; }

  // ─── Approvals ──────────────────────────────────────────────────────────
  console.log('\n🔑 Checking approvals...');
  for (const token of [CONTRACTS.WETH, CONTRACTS.AXIOM]) {
    const allow = await pub.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, CONTRACTS.PERMIT2] });
    if (allow < depositAmount) {
      console.log(`   Approving ${token === CONTRACTS.WETH ? 'WETH' : 'AXIOM'} to Permit2...`);
      const tx = await wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.PERMIT2, maxUint256] });
      await pub.waitForTransactionReceipt({ hash: tx });
    }
  }

  // ─── Build & send transaction ───────────────────────────────────────────
  console.log('\n🚀 Minting single-sided position...');

  const actionsHex = '0x' + Actions.MINT_POSITION.toString(16).padStart(2, '0') + Actions.SETTLE_PAIR.toString(16).padStart(2, '0');

  const amount0Max = argv.token === 'weth' ? depositAmount : 0n;
  const amount1Max = argv.token === 'axiom' ? depositAmount : 0n;

  const mintParams = defaultAbiCoder.encode(
    [POOL_KEY_STRUCT, 'int24', 'int24', 'uint256', 'uint128', 'uint128', 'address', 'bytes'],
    [
      [CONTRACTS.WETH, CONTRACTS.AXIOM, POOL.fee, POOL.tickSpacing, POOL.hooks],
      tickLower, tickUpper,
      liquidity.toString(),
      amount0Max.toString(),
      amount1Max.toString(),
      '0x0000000000000000000000000000000000000001', // MSG_SENDER
      '0x',
    ]
  );

  const settleParams = defaultAbiCoder.encode(['address', 'address'], [CONTRACTS.WETH, CONTRACTS.AXIOM]);
  const unlockData = defaultAbiCoder.encode(['bytes', 'bytes[]'], [actionsHex, [mintParams, settleParams]]);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  try {
    const hash = await wallet.writeContract({
      address: CONTRACTS.POSITION_MANAGER, abi: PM_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, BigInt(deadline)],
    });

    console.log(`⏳ TX sent: ${hash}`);
    const receipt = await pub.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ Single-sided LP created!`);
      console.log(`🔗 https://basescan.org/tx/${hash}`);
    } else {
      console.error('❌ Transaction failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.shortMessage || error.message);
    if (error.signature) console.error('Error signature:', error.signature);
    process.exit(1);
  }
}

main().catch(console.error);
