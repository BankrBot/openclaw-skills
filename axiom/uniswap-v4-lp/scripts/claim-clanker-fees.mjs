#!/usr/bin/env node
/**
 * Claim Clanker protocol fees (separate from LP position fees)
 * 
 * Clanker tokens have a fee contract that stores protocol fees for the token creator/LP.
 * This script claims both WETH and token fees from the Clanker fee storage contract.
 * 
 * Usage:
 *   node claim-clanker-fees.mjs --token 0xf3Ce5dDAAb6C133F9875a4a46C55cf0b58111B07
 *   node claim-clanker-fees.mjs --token 0xf3Ce5... --dry-run
 *   node claim-clanker-fees.mjs --token 0xf3Ce5... --fee-contract 0xf362...
 */

import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const hasFlag = (name) => args.includes('--' + name);

const TOKEN = getArg('token', null);
const FEE_CONTRACT = getArg('fee-contract', '0xf3622742b1e446d92e45e22923ef11c2fcd55d68');
const DRY_RUN = hasFlag('dry-run');

if (!TOKEN) {
  console.log('Usage: node claim-clanker-fees.mjs --token <TOKEN_ADDRESS> [--fee-contract <ADDRESS>] [--dry-run]');
  process.exit(1);
}

const WETH = '0x4200000000000000000000000000000000000006';

const CLANKER_FEE_ABI = parseAbi([
  'function claim(address feeOwner, address token) external',
  'function availableFees(address feeOwner, address token) external view returns (uint256)',
  'function feesToClaim(address feeOwner, address token) external view returns (uint256)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

async function main() {
  const pk = process.env.NET_PRIVATE_KEY;
  if (!pk) { console.error('NET_PRIVATE_KEY not set'); process.exit(1); }

  const account = privateKeyToAccount(pk);
  const transport = http('https://mainnet.base.org');
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ chain: base, transport, account });

  console.log(`🏦 Clanker Fee Claim`);
  console.log(`📋 Fee Contract: ${FEE_CONTRACT}`);
  console.log(`🪙 Token: ${TOKEN}`);
  console.log(`👛 Wallet: ${account.address}`);
  if (DRY_RUN) console.log(`🔮 DRY RUN — no transactions`);
  console.log('═'.repeat(50));

  // Get token info
  let tokenSymbol = 'TOKEN';
  let tokenDecimals = 18;
  try {
    tokenSymbol = await publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'symbol' });
    tokenDecimals = await publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'decimals' });
  } catch (e) {}

  // Check available fees
  let wethFees, tokenFees;
  try {
    wethFees = await publicClient.readContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'availableFees',
      args: [account.address, WETH],
    });
  } catch (e) {
    // Try feesToClaim
    wethFees = await publicClient.readContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'feesToClaim',
      args: [account.address, WETH],
    });
  }

  try {
    tokenFees = await publicClient.readContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'availableFees',
      args: [account.address, TOKEN],
    });
  } catch (e) {
    tokenFees = await publicClient.readContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'feesToClaim',
      args: [account.address, TOKEN],
    });
  }

  console.log(`\n💰 Available Clanker Fees:`);
  console.log(`   WETH: ${formatEther(wethFees)}`);
  console.log(`   ${tokenSymbol}: ${formatUnits(tokenFees, tokenDecimals)}`);

  if (wethFees === 0n && tokenFees === 0n) {
    console.log(`\n⚠️  No fees to claim`);
    return;
  }

  if (DRY_RUN) {
    console.log(`\n🔮 Dry run — would claim:`);
    if (wethFees > 0n) console.log(`   WETH: ${formatEther(wethFees)}`);
    if (tokenFees > 0n) console.log(`   ${tokenSymbol}: ${formatUnits(tokenFees, tokenDecimals)}`);
    console.log(`\n✅ Dry run complete`);
    return;
  }

  // Claim token fees first
  if (tokenFees > 0n) {
    console.log(`\n⏳ Claiming ${tokenSymbol} fees...`);
    const tx = await walletClient.writeContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'claim',
      args: [account.address, TOKEN],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`   ✅ TX: https://basescan.org/tx/${tx}`);
    console.log(`   Status: ${receipt.status}`);
  }

  // Claim WETH fees
  if (wethFees > 0n) {
    console.log(`\n⏳ Claiming WETH fees...`);
    const tx = await walletClient.writeContract({
      address: FEE_CONTRACT, abi: CLANKER_FEE_ABI, functionName: 'claim',
      args: [account.address, WETH],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`   ✅ TX: https://basescan.org/tx/${tx}`);
    console.log(`   Status: ${receipt.status}`);
  }

  // Final balances
  const wethBal = await publicClient.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] });
  const tokenBal = await publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] });

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ Clanker Fees Claimed!`);
  console.log(`   WETH claimed: ${formatEther(wethFees)}`);
  console.log(`   ${tokenSymbol} claimed: ${formatUnits(tokenFees, tokenDecimals)}`);
  console.log(`\n💰 Wallet After:`);
  console.log(`   WETH: ${formatEther(wethBal)}`);
  console.log(`   ${tokenSymbol}: ${formatUnits(tokenBal, tokenDecimals)}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
