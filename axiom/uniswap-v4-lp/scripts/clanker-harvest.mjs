#!/usr/bin/env node
/**
 * 🌾 Clanker Harvest — Modular fee management for Clanker-launched tokens
 * 
 * Fully configurable pipeline — pick what you need:
 * 
 *   CLAIM ONLY:
 *     node clanker-harvest.mjs --token 0xTOKEN
 * 
 *   CLAIM + COMPOUND (all fees back into LP):
 *     node clanker-harvest.mjs --token 0xTOKEN --token-id 1078751 --compound-pct 100
 * 
 *   CLAIM + HARVEST (all fees swapped to USDC → vault):
 *     node clanker-harvest.mjs --token 0xTOKEN --harvest-address 0xVAULT --compound-pct 0
 * 
 *   CLAIM + COMPOUND + HARVEST (split fees):
 *     node clanker-harvest.mjs --token 0xTOKEN --token-id 1078751 \
 *       --harvest-address 0xVAULT --compound-pct 50
 * 
 *   WITH THRESHOLDS (only act if fees exceed $X):
 *     node clanker-harvest.mjs --token 0xTOKEN --token-id 1078751 \
 *       --harvest-address 0xVAULT --compound-pct 50 --min-usd 10
 * 
 *   WITH CONFIG FILE:
 *     node clanker-harvest.mjs --config harvest-config.json
 * 
 * Works for ANY Clanker token with a V4 LP position on Base.
 */

import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseAbi, maxUint256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';

// ─── CLI / Config ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const hasFlag = (name) => args.includes('--' + name);

// Load config file if provided, CLI args override
let config = {};
const configPath = getArg('config', null);
if (configPath && fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const cfg = {
  token:          getArg('token', config.token || null),
  tokenId:        getArg('token-id', config.tokenId || null),
  harvestAddress: getArg('harvest-address', config.harvestAddress || null),
  compoundPct:    parseInt(getArg('compound-pct', config.compoundPct ?? '100')),
  minUsd:         parseFloat(getArg('min-usd', config.minUsd ?? '0')),
  slippage:       parseFloat(getArg('slippage', config.slippage ?? '1')),
  feeContract:    getArg('fee-contract', config.feeContract || '0xf3622742b1e446d92e45e22923ef11c2fcd55d68'),
  dryRun:         hasFlag('dry-run') || config.dryRun === true,
  skipClaim:      hasFlag('skip-claim') || config.skipClaim === true,
  skipLp:         hasFlag('skip-lp') || config.skipLp === true,
};

const harvestPct = 100 - cfg.compoundPct;
const wantCompound = cfg.compoundPct > 0 && cfg.tokenId;
const wantHarvest = harvestPct > 0 && cfg.harvestAddress;

if (!cfg.token) {
  console.log(`
🌾 Clanker Harvest — Modular fee management for Clanker tokens

Usage:
  node clanker-harvest.mjs --token <TOKEN> [options]

Required:
  --token              Clanker token address

Pipeline options (mix & match):
  --token-id <ID>      LP position NFT ID (needed for compound/LP collection)
  --harvest-address    Where to send harvested USDC (needed for harvest)
  --compound-pct <N>   % to compound back into LP (default: 100 if token-id set, else 0)
                       0 = harvest everything, 100 = compound everything

Thresholds:
  --min-usd <N>        Minimum fee value (USD) to act (default: 0 = always act)

Advanced:
  --fee-contract       Clanker fee storage contract (default: 0xf362...)
  --slippage <N>       Swap slippage % (default: 1)
  --skip-claim         Skip Clanker fee claim (only do LP fees)
  --skip-lp            Skip LP fee collection (only do Clanker fees)
  --config <file>      Load config from JSON file
  --dry-run            Simulate without executing

Examples:
  # Just claim Clanker protocol fees
  node clanker-harvest.mjs --token 0xf3Ce5...

  # Claim + compound 100% into LP
  node clanker-harvest.mjs --token 0xf3Ce5... --token-id 1078751 --compound-pct 100

  # Claim + harvest 100% as USDC
  node clanker-harvest.mjs --token 0xf3Ce5... --harvest-address 0xVAULT --compound-pct 0

  # 50/50 split
  node clanker-harvest.mjs --token 0xf3Ce5... --token-id 1078751 \\
    --harvest-address 0xVAULT --compound-pct 50

  # 80% compound / 20% harvest, only if > $10 accumulated
  node clanker-harvest.mjs --token 0xf3Ce5... --token-id 1078751 \\
    --harvest-address 0xVAULT --compound-pct 80 --min-usd 10

  # Config file for cron
  node clanker-harvest.mjs --config my-agent.json
  `);
  process.exit(1);
}

// ─── Contracts ───────────────────────────────────────────────────────────────
const C = {
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  SWAP_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',
};

// ─── ABIs ────────────────────────────────────────────────────────────────────
const CLANKER_ABI = parseAbi([
  'function claim(address feeOwner, address token) external',
  'function availableFees(address feeOwner, address token) external view returns (uint256)',
]);

const PM_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] }, { type: 'uint256' }] },
  { name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
];

const ERC20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function transfer(address,uint256) returns (bool)',
]);

const SWAP_ABI = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256)',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pad32 = (hex) => hex.replace('0x', '').padStart(64, '0');

async function retry(fn, n = 3) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (i === n - 1) throw e; await sleep(2000); }
  }
}

async function getEthPrice() {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006');
    const d = await r.json();
    const p = d.pairs?.find(p => p.chainId === 'base' && p.quoteToken?.symbol === 'USDC');
    if (p) return parseFloat(p.priceUsd);
  } catch {} return 2700;
}

async function getTokenPrice(token) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
    const d = await r.json();
    const p = d.pairs?.[0];
    if (p) return parseFloat(p.priceUsd);
  } catch {} return 0;
}

function tickToSqrtPriceX96(tick) {
  const Q96 = 2n ** 96n;
  const absTick = Math.abs(tick);
  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : (1n << 128n);
  const tickBits = [
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
  for (const [bit, val] of tickBits) {
    if ((absTick & bit) !== 0) ratio = (ratio * val) >> 128n;
  }
  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const pk = process.env.NET_PRIVATE_KEY;
  if (!pk) { console.error('❌ NET_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk);
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const transport = http(rpcUrl);
  const pub = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ chain: base, transport, account });

  // Token info
  let symbol = 'TOKEN';
  try { symbol = await pub.readContract({ address: cfg.token, abi: ERC20, functionName: 'symbol' }); } catch {}

  // Determine mode string
  const steps = [];
  if (!cfg.skipClaim) steps.push('claim');
  if (!cfg.skipLp && cfg.tokenId) steps.push('collect-lp');
  if (wantCompound) steps.push(`compound(${cfg.compoundPct}%)`);
  if (wantHarvest) steps.push(`harvest(${harvestPct}%)→USDC`);

  console.log(`
🌾 Clanker Harvest
═══════════════════════════════════════════════════
🪙  Token: ${symbol} (${cfg.token})
📋  Pipeline: ${steps.join(' → ')}
${cfg.tokenId ? `📊  Position: #${cfg.tokenId}\n` : ''}${cfg.harvestAddress ? `📬  Vault: ${cfg.harvestAddress}\n` : ''}${cfg.minUsd > 0 ? `⚙️   Min threshold: $${cfg.minUsd}\n` : ''}👛  Wallet: ${account.address}
${cfg.dryRun ? '🔮  DRY RUN' : '🔥  LIVE'}
═══════════════════════════════════════════════════`);

  // Get prices for threshold check & reporting
  const [ethPrice, tokenPrice] = await Promise.all([getEthPrice(), getTokenPrice(cfg.token)]);
  console.log(`📈 Prices: ETH $${ethPrice.toFixed(0)} | ${symbol} $${tokenPrice.toFixed(10)}`);

  // Track total claimed amounts
  let claimedWeth = 0n;
  let claimedToken = 0n;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Claim Clanker protocol fees
  // ═══════════════════════════════════════════════════════════════════════════
  if (!cfg.skipClaim) {
    console.log(`\n📌 Step: Claim Clanker fees`);

    const [availWeth, availToken] = await Promise.all([
      retry(() => pub.readContract({ address: cfg.feeContract, abi: CLANKER_ABI, functionName: 'availableFees', args: [account.address, C.WETH] })),
      retry(() => pub.readContract({ address: cfg.feeContract, abi: CLANKER_ABI, functionName: 'availableFees', args: [account.address, cfg.token] })),
    ]);

    const wethUsd = parseFloat(formatEther(availWeth)) * ethPrice;
    const tokenUsd = parseFloat(formatEther(availToken)) * tokenPrice;
    console.log(`   WETH:  ${formatEther(availWeth)} (~$${wethUsd.toFixed(2)})`);
    console.log(`   ${symbol}: ${formatEther(availToken)} (~$${tokenUsd.toFixed(2)})`);
    console.log(`   Total: $${(wethUsd + tokenUsd).toFixed(2)}`);

    if (availWeth === 0n && availToken === 0n) {
      console.log(`   → Nothing to claim`);
    } else if (cfg.dryRun) {
      console.log(`   🔮 Would claim`);
      claimedWeth = availWeth;
      claimedToken = availToken;
    } else {
      if (availToken > 0n) {
        console.log(`   Claiming ${symbol}...`);
        const tx = await wallet.writeContract({ address: cfg.feeContract, abi: CLANKER_ABI, functionName: 'claim', args: [account.address, cfg.token] });
        await pub.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ TX: ${tx.slice(0, 20)}...`);
        claimedToken = availToken;
        await sleep(2000);
      }
      if (availWeth > 0n) {
        console.log(`   Claiming WETH...`);
        const tx = await wallet.writeContract({ address: cfg.feeContract, abi: CLANKER_ABI, functionName: 'claim', args: [account.address, C.WETH] });
        await pub.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ TX: ${tx.slice(0, 20)}...`);
        claimedWeth = availWeth;
        await sleep(1000);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Collect LP position fees
  // ═══════════════════════════════════════════════════════════════════════════
  let lpWeth = 0n;
  let lpToken = 0n;
  let poolKey = null;

  if (!cfg.skipLp && cfg.tokenId) {
    console.log(`\n📌 Step: Collect LP fees (#${cfg.tokenId})`);

    const tokenId = BigInt(cfg.tokenId);
    const [pk_result, posInfo] = await retry(() => pub.readContract({
      address: C.POSITION_MANAGER, abi: PM_ABI,
      functionName: 'getPoolAndPositionInfo', args: [tokenId],
    }));
    poolKey = pk_result;

    // Snapshot balances before collect
    const [wethBefore, tokenBefore] = await Promise.all([
      pub.readContract({ address: C.WETH, abi: ERC20, functionName: 'balanceOf', args: [account.address] }),
      pub.readContract({ address: cfg.token, abi: ERC20, functionName: 'balanceOf', args: [account.address] }),
    ]);

    if (cfg.dryRun) {
      console.log(`   🔮 Would collect LP fees`);
    } else {
      // Approve Permit2 if needed
      for (const addr of [poolKey.currency0, poolKey.currency1]) {
        const allow = await pub.readContract({ address: addr, abi: ERC20, functionName: 'allowance', args: [account.address, C.PERMIT2] });
        if (allow < BigInt('0xffffffffffffffffffffffff')) {
          console.log(`   Approving ${addr.slice(0, 10)}... to Permit2...`);
          const tx = await wallet.writeContract({ address: addr, abi: ERC20, functionName: 'approve', args: [C.PERMIT2, maxUint256] });
          await pub.waitForTransactionReceipt({ hash: tx });
          await sleep(500);
        }
      }

      // DECREASE(0x01) with 0 liquidity + CLOSE_CURRENCY(0x11) x2
      const collectActions = '0x0111';
      const decreaseParams = '0x' +
        pad32('0x' + tokenId.toString(16)) +
        '0'.padStart(64, '0') +
        '0'.padStart(64, '0') +
        '0'.padStart(64, '0') +
        (5 * 32).toString(16).padStart(64, '0') +
        '0'.padStart(64, '0');

      const closeParams = '0x' +
        pad32(poolKey.currency0) +
        pad32(poolKey.currency1) +
        pad32(account.address);

      const collectData = encodeAbiParameters(
        parseAbiParameters('bytes, bytes[]'),
        [collectActions, [decreaseParams, closeParams]]
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const tx = await wallet.writeContract({
        address: C.POSITION_MANAGER, abi: PM_ABI,
        functionName: 'modifyLiquidities', args: [collectData, deadline],
      });
      await pub.waitForTransactionReceipt({ hash: tx });
      console.log(`   ✅ Collected: ${tx.slice(0, 20)}...`);
      await sleep(1000);

      // Measure what we got
      const [wethAfter, tokenAfter] = await Promise.all([
        pub.readContract({ address: C.WETH, abi: ERC20, functionName: 'balanceOf', args: [account.address] }),
        pub.readContract({ address: cfg.token, abi: ERC20, functionName: 'balanceOf', args: [account.address] }),
      ]);
      lpWeth = wethAfter - wethBefore;
      lpToken = tokenAfter - tokenBefore;
    }

    const lpWethUsd = parseFloat(formatEther(lpWeth)) * ethPrice;
    const lpTokenUsd = parseFloat(formatEther(lpToken)) * tokenPrice;
    console.log(`   WETH:  ${formatEther(lpWeth)} (~$${lpWethUsd.toFixed(2)})`);
    console.log(`   ${symbol}: ${formatEther(lpToken)} (~$${lpTokenUsd.toFixed(2)})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOTAL & THRESHOLD CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  const totalWeth = claimedWeth + lpWeth;
  const totalToken = claimedToken + lpToken;
  const totalUsd = parseFloat(formatEther(totalWeth)) * ethPrice + parseFloat(formatEther(totalToken)) * tokenPrice;

  console.log(`\n💰 Total fees: $${totalUsd.toFixed(2)}`);
  console.log(`   WETH:  ${formatEther(totalWeth)}`);
  console.log(`   ${symbol}: ${formatEther(totalToken)}`);

  if (totalWeth === 0n && totalToken === 0n) {
    console.log(`\n✅ Nothing to process. Done.`);
    return { totalUsd: 0, compounded: 0, harvested: 0 };
  }

  if (cfg.minUsd > 0 && totalUsd < cfg.minUsd) {
    console.log(`\n⏸️  Below threshold ($${totalUsd.toFixed(2)} < $${cfg.minUsd}). Fees stay in wallet.`);
    return { totalUsd, compounded: 0, harvested: 0, belowThreshold: true };
  }

  // Split
  const compoundWeth = totalWeth * BigInt(cfg.compoundPct) / 100n;
  const compoundToken = totalToken * BigInt(cfg.compoundPct) / 100n;
  const harvestWeth = totalWeth - compoundWeth;
  const harvestToken = totalToken - compoundToken;

  console.log(`\n📊 Split: ${cfg.compoundPct}% compound / ${harvestPct}% harvest`);
  if (wantCompound) console.log(`   Compound: ${formatEther(compoundWeth)} WETH + ${formatEther(compoundToken)} ${symbol}`);
  if (wantHarvest) console.log(`   Harvest:  ${formatEther(harvestWeth)} WETH + ${formatEther(harvestToken)} ${symbol}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Compound into LP
  // ═══════════════════════════════════════════════════════════════════════════
  if (wantCompound && (compoundWeth > 0n || compoundToken > 0n)) {
    console.log(`\n📌 Step: Compound ${cfg.compoundPct}% → LP #${cfg.tokenId}`);

    if (cfg.dryRun) {
      console.log(`   🔮 Would compound`);
    } else {
      try {
        if (!poolKey) {
          const [pk_result] = await retry(() => pub.readContract({
            address: C.POSITION_MANAGER, abi: PM_ABI,
            functionName: 'getPoolAndPositionInfo', args: [BigInt(cfg.tokenId)],
          }));
          poolKey = pk_result;
        }

        const tokenId = BigInt(cfg.tokenId);

        // Read current tick for liquidity calculation
        const { keccak256, encodePacked } = await import('viem');
        const poolId = keccak256(encodeAbiParameters(
          parseAbiParameters('address, address, uint24, int24, address'),
          [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        ));
        const stateViewAbi = [{ name: 'getSlot0', type: 'function', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint160' }, { type: 'int24' }, { type: 'uint24' }, { type: 'uint24' }] }];
        const [sqrtPriceX96, currentTick] = await retry(() => pub.readContract({
          address: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', abi: stateViewAbi,
          functionName: 'getSlot0', args: [poolId],
        }));

        // Read position tick range from posInfo
        const [, posInfo] = await retry(() => pub.readContract({
          address: C.POSITION_MANAGER, abi: PM_ABI,
          functionName: 'getPoolAndPositionInfo', args: [tokenId],
        }));
        const rawLower = Number(BigInt(posInfo) >> 232n);
        const rawUpper = Number((BigInt(posInfo) >> 208n) & BigInt(0xFFFFFF));
        const tL = rawLower > 0x7FFFFF ? rawLower - 0x1000000 : rawLower;
        const tU = rawUpper > 0x7FFFFF ? rawUpper - 0x1000000 : rawUpper;
        const tickLower = Math.min(tL, tU);
        const tickUpper = Math.max(tL, tU);

        // Calculate liquidity from amounts
        const sqrtLower = tickToSqrtPriceX96(tickLower);
        const sqrtUpper = tickToSqrtPriceX96(tickUpper);
        const Q96 = 2n ** 96n;

        let liquidity;
        const isWethCurrency0 = poolKey.currency0.toLowerCase() === C.WETH.toLowerCase();
        const amount0 = isWethCurrency0 ? compoundWeth : compoundToken;
        const amount1 = isWethCurrency0 ? compoundToken : compoundWeth;

        if (sqrtPriceX96 <= sqrtLower) {
          liquidity = amount0 * sqrtLower * sqrtUpper / ((sqrtUpper - sqrtLower) * Q96);
        } else if (sqrtPriceX96 >= sqrtUpper) {
          liquidity = amount1 * Q96 / (sqrtUpper - sqrtLower);
        } else {
          const liq0 = amount0 * sqrtPriceX96 * sqrtUpper / ((sqrtUpper - sqrtPriceX96) * Q96);
          const liq1 = amount1 * Q96 / (sqrtPriceX96 - sqrtLower);
          liquidity = liq0 < liq1 ? liq0 : liq1;
        }

        if (liquidity <= 0n) {
          console.log(`   ⚠️ Computed liquidity = 0, skipping compound`);
        } else {
          // Slippage buffer on max amounts
          const slippageMul = BigInt(Math.floor((100 + cfg.slippage * 2) * 100));
          const amount0Max = amount0 * slippageMul / 10000n;
          const amount1Max = amount1 * slippageMul / 10000n;

          // INCREASE(0x00) + SETTLE_PAIR(0x0d)
          const addActions = '0x000d';
          const { defaultAbiCoder } = await import('./node_modules/@ethersproject/abi/lib/index.js');
          const increaseParams = defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint128', 'uint128', 'bytes'],
            [tokenId.toString(), liquidity.toString(), amount0Max.toString(), amount1Max.toString(), '0x']
          );
          const settleParams = defaultAbiCoder.encode(
            ['address', 'address'],
            [poolKey.currency0, poolKey.currency1]
          );
          const addData = encodeAbiParameters(
            parseAbiParameters('bytes, bytes[]'),
            [addActions, [increaseParams, settleParams]]
          );

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
          const tx = await wallet.writeContract({
            address: C.POSITION_MANAGER, abi: PM_ABI,
            functionName: 'modifyLiquidities', args: [addData, deadline],
          });
          await pub.waitForTransactionReceipt({ hash: tx });
          console.log(`   ✅ Compounded! TX: ${tx.slice(0, 20)}...`);
          await sleep(1000);
        }
      } catch (err) {
        console.log(`   ⚠️ Compound failed: ${err.shortMessage || err.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Swap harvest portion to USDC
  // ═══════════════════════════════════════════════════════════════════════════
  let harvestedUsdc = 0n;

  if (wantHarvest && (harvestWeth > 0n || harvestToken > 0n)) {
    console.log(`\n📌 Step: Swap ${harvestPct}% → USDC`);

    const usdcBefore = await pub.readContract({ address: C.USDC, abi: ERC20, functionName: 'balanceOf', args: [account.address] });

    if (cfg.dryRun) {
      const est = parseFloat(formatEther(harvestWeth)) * ethPrice + parseFloat(formatEther(harvestToken)) * tokenPrice;
      console.log(`   🔮 Would swap ~$${est.toFixed(2)} to USDC`);
    } else {
      // Swap WETH → USDC
      if (harvestWeth > 0n) {
        try {
          console.log(`   Swapping ${formatEther(harvestWeth)} WETH → USDC...`);
          const allow = await pub.readContract({ address: C.WETH, abi: ERC20, functionName: 'allowance', args: [account.address, C.SWAP_ROUTER] });
          if (allow < harvestWeth) {
            const tx = await wallet.writeContract({ address: C.WETH, abi: ERC20, functionName: 'approve', args: [C.SWAP_ROUTER, maxUint256] });
            await pub.waitForTransactionReceipt({ hash: tx });
            await sleep(500);
          }
          const tx = await wallet.writeContract({
            address: C.SWAP_ROUTER, abi: SWAP_ABI,
            functionName: 'exactInputSingle',
            args: [{ tokenIn: C.WETH, tokenOut: C.USDC, fee: 500, recipient: account.address, amountIn: harvestWeth, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
          });
          await pub.waitForTransactionReceipt({ hash: tx });
          console.log(`   ✅ WETH → USDC: ${tx.slice(0, 20)}...`);
          await sleep(1000);
        } catch (err) {
          console.log(`   ❌ WETH swap failed: ${err.shortMessage || err.message}`);
        }
      }

      // TODO: Token → WETH → USDC via V4 Universal Router
      if (harvestToken > 0n) {
        console.log(`   ⚠️ ${symbol} → USDC swap not yet implemented (stays in wallet)`);
      }

      // Measure USDC gained
      await sleep(1000);
      const usdcAfter = await pub.readContract({ address: C.USDC, abi: ERC20, functionName: 'balanceOf', args: [account.address] });
      harvestedUsdc = usdcAfter - usdcBefore;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Transfer USDC to vault
    // ═══════════════════════════════════════════════════════════════════════════
    if (harvestedUsdc > 0n) {
      console.log(`\n📌 Step: Transfer USDC → vault`);
      console.log(`   Amount: ${formatUnits(harvestedUsdc, 6)} USDC`);

      if (cfg.dryRun) {
        console.log(`   🔮 Would transfer to ${cfg.harvestAddress}`);
      } else {
        const tx = await wallet.writeContract({
          address: C.USDC, abi: ERC20, functionName: 'transfer',
          args: [cfg.harvestAddress, harvestedUsdc],
        });
        await pub.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ Sent! TX: https://basescan.org/tx/${tx}`);
      }
    } else if (!cfg.dryRun && harvestWeth > 0n) {
      console.log(`   ⚠️ No USDC to transfer`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`
═══════════════════════════════════════════════════
✅ Clanker Harvest Complete
═══════════════════════════════════════════════════
   Total fees:     $${totalUsd.toFixed(2)}
   Clanker fees:   ${formatEther(claimedWeth)} WETH + ${formatEther(claimedToken)} ${symbol}
   LP fees:        ${formatEther(lpWeth)} WETH + ${formatEther(lpToken)} ${symbol}
   Compounded:     ${cfg.compoundPct}% → LP #${cfg.tokenId || 'N/A'}
   Harvested:      ${harvestPct}% → ${harvestedUsdc > 0n ? formatUnits(harvestedUsdc, 6) + ' USDC' : 'pending'}
═══════════════════════════════════════════════════`);

  return { totalUsd, compounded: cfg.compoundPct, harvested: parseFloat(formatUnits(harvestedUsdc, 6)) };
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
