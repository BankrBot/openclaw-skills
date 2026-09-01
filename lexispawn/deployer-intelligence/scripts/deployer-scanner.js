#!/usr/bin/env node
/**
 * deployer-scanner.js
 * Deployer intelligence scoring for Base tokens.
 * See references/scoring-methodology.md for the full scoring spec.
 */

const API_BASE = 'https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/token-pairs/v1/base';
const FETCH_TIMEOUT_MS = 10000;
const DEXSCREENER_DELAY_MS = 300;

function getApiKey() {
  const key = process.env.ROUTESCAN_API_KEY;
  if (!key) throw new Error('ROUTESCAN_API_KEY environment variable not set');
  return key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        if (attempt === maxRetries - 1) throw new Error(`HTTP ${response.status}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === maxRetries - 1) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// Resolve token contract → deployer wallet
async function getDeployerAddress(tokenCA, apiKey) {
  const url = `${API_BASE}?module=contract&action=getcontractcreation&contractaddresses=${tokenCA}&apikey=${apiKey}`;
  const data = await fetchWithRetry(url);

  if (data.status === '1' && data.result?.[0]?.contractCreator) {
    return data.result[0].contractCreator;
  }

  // Fallback: earliest transaction sender
  console.error('  getcontractcreation empty, trying txlist fallback...');
  const txUrl = `${API_BASE}?module=account&action=txlist&address=${tokenCA}&startblock=0&endblock=99999999&sort=asc&page=1&offset=10&apikey=${apiKey}`;
  const txData = await fetchWithRetry(txUrl);

  if (txData.status === '1' && txData.result?.length > 0) {
    return txData.result[0].from;
  }

  throw new Error(`Could not determine deployer for ${tokenCA}`);
}

// Pull all contracts created by a deployer wallet
async function getDeployerContracts(deployerAddress, apiKey) {
  const url = `${API_BASE}?module=account&action=txlistinternal&address=${deployerAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`;
  const data = await fetchWithRetry(url);

  if (data.status !== '1' || !data.result) return [];

  return data.result.filter(tx =>
    tx.contractAddress &&
    tx.contractAddress !== '' &&
    (tx.type === 'create' || tx.type === 'create2')
  );
}

// Fetch token market data from DexScreener
async function getTokenInfo(contractAddress) {
  try {
    await sleep(DEXSCREENER_DELAY_MS);
    const data = await fetchWithRetry(`${DEXSCREENER_BASE}/${contractAddress}`);

    if (!Array.isArray(data) || data.length === 0) return null;

    const pair = data[0];
    const isBase = pair.baseToken.address.toLowerCase() === contractAddress.toLowerCase();
    const token = isBase ? pair.baseToken : pair.quoteToken;

    const mcap = pair.fdv || pair.marketCap || 0;
    const volume24h = pair.volume?.h24 || 0;
    const priceUsd = parseFloat(pair.priceUsd || 0);
    const liquidity = pair.liquidity?.usd || 0;

    const pairCreatedAt = new Date(pair.pairCreatedAt || Date.now());
    const daysOld = Math.floor((Date.now() - pairCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

    let status;
    if (liquidity === 0 || mcap === 0 || priceUsd === 0) {
      status = 'dead';
    } else if (liquidity > 1000) {
      status = 'active';
    } else {
      status = 'low_liquidity';
    }

    return {
      ca: contractAddress,
      name: token.name || 'Unknown',
      symbol: token.symbol || '???',
      currentMcap: mcap,
      peakMcap: mcap, // Current mcap at scan time — historical peak not available via API
      volume24h,
      liquidity,
      status,
      daysOld,
      priceUsd
    };
  } catch {
    return null;
  }
}

// Score deployer track record. See references/scoring-methodology.md
function calculateDeployerScore(tokensWithData, totalContractsCreated) {
  let score = 50;

  const survived7d = tokensWithData.filter(t => t.daysOld >= 7 && t.status === 'active').length;
  const survived30d = tokensWithData.filter(t => t.daysOld >= 30 && t.status === 'active').length;
  const deadUnder72h = tokensWithData.filter(t => t.daysOld < 3 && t.status === 'dead').length;

  const mcaps = tokensWithData.filter(t => t.peakMcap > 0).map(t => t.peakMcap);
  const avgPeakMcap = mcaps.length > 0 ? mcaps.reduce((a, b) => a + b, 0) / mcaps.length : 0;

  // Positive: survival signals
  if (survived30d > 0) score += 10;                          // #1: 30-day survivor exists
  score += Math.min(survived7d * 5, 20);                     // #2: each 7-day survivor
  if (avgPeakMcap > 500000) score += 10;                     // #3: avg mcap > $500K

  // Negative: failure patterns
  score -= Math.min(deadUnder72h * 10, 30);                  // #4: tokens dead within 72h
  if (totalContractsCreated > 5 && survived7d === 0) {
    score -= 20;                                              // #5: serial deployer, zero survivors
  }

  const dataRate = totalContractsCreated > 0
    ? tokensWithData.length / totalContractsCreated : 0;
  if (totalContractsCreated >= 10 && dataRate < 0.3) {
    score -= 15;                                              // #6: high deploy volume, no follow-through
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    totalTokens: totalContractsCreated,
    tokensWithMarketData: tokensWithData.length,
    survived7Days: survived7d,
    survived30Days: survived30d,
    deadUnder72h,
    avgPeakMcap: Math.round(avgPeakMcap),
    dataRate: Math.round(dataRate * 100)
  };
}

async function scanDeployer(tokenCA) {
  const apiKey = getApiKey();

  console.error(`\nScanning deployer for token: ${tokenCA}`);

  console.error('Step 1: Fetching deployer address...');
  const deployerAddress = await getDeployerAddress(tokenCA, apiKey);
  console.error(`  Deployer: ${deployerAddress}`);

  console.error('Step 2: Fetching deployer contract creations...');
  const contracts = await getDeployerContracts(deployerAddress, apiKey);
  console.error(`  Found ${contracts.length} contract creations`);

  console.error('Step 3: Fetching token info from DexScreener...');
  const previousTokens = [];

  for (const tx of contracts) {
    // Skip the target token — don't score against itself
    if (tx.contractAddress.toLowerCase() === tokenCA.toLowerCase()) continue;

    const info = await getTokenInfo(tx.contractAddress);
    if (info) previousTokens.push(info);
  }

  console.error(`  Market data for ${previousTokens.length}/${contracts.length} contracts`);

  const scoreData = calculateDeployerScore(previousTokens, contracts.length);

  // Fetch current token metadata for output
  let tokenName = 'Unknown';
  let tokenSymbol = '???';
  try {
    const current = await getTokenInfo(tokenCA);
    if (current) {
      tokenName = current.name;
      tokenSymbol = current.symbol;
    }
  } catch {
    console.error('  Warning: Could not fetch current token info');
  }

  return {
    token: tokenSymbol,
    tokenName,
    ca: tokenCA,
    deployer: deployerAddress,
    deployerHistory: {
      totalContractsCreated: scoreData.totalTokens,
      tokensWithMarketData: scoreData.tokensWithMarketData,
      dataRate: scoreData.dataRate,
      survivedPast7Days: scoreData.survived7Days,
      survivedPast30Days: scoreData.survived30Days,
      avgPeakMcap: scoreData.avgPeakMcap,
      previousTokens: previousTokens.map(t => ({
        ca: t.ca, name: t.name, symbol: t.symbol,
        currentMcap: t.currentMcap, peakMcap: t.peakMcap,
        volume24h: t.volume24h, liquidity: t.liquidity,
        status: t.status, daysOld: t.daysOld, priceUsd: t.priceUsd
      }))
    },
    deployerScore: scoreData.score,
    timestamp: new Date().toISOString()
  };
}

// Standalone: node deployer-scanner.js <TOKEN_CONTRACT_ADDRESS>
if (import.meta.url === `file://${process.argv[1]}`) {
  const tokenCA = process.argv[2];

  if (!tokenCA) {
    console.error('Usage: node deployer-scanner.js <TOKEN_CONTRACT_ADDRESS>');
    console.error('Env:   ROUTESCAN_API_KEY (required)');
    process.exit(1);
  }

  scanDeployer(tokenCA)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {
      console.error(`\nERROR: ${error.message}`);
      process.exit(1);
    });
}

export { scanDeployer };
