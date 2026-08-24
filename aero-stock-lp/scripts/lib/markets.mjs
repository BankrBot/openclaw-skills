// aero-stock-lp: canonical addresses and market table (Base mainnet, 8453).
// This file is the source of truth; the SKILL.md table is human reference.
// All addresses verified on-chain Aug 2026.

export const CHAIN_ID = 8453;

export const RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
];

export const MULTICALL3 = "0xcA11bde05977B3631167028862bE2a173976CA11";

export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // 6 dec, token0 in every pool here
export const AERO = "0x940181a94A35A4569E4529A3CDfB74e38FD98631"; // 18 dec

// Position NFT managers are PER-POOL-FAMILY, not global.
export const NPM_EQUITY = "0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53"; // CL10 equity pools
export const NPM_AERO = "0x827922686190790b37229fd06084350E74485b72"; // CL200 AERO pool

export const ROUTER_EQUITY = "0x698cb2b6dd822994581fea6ea4fc755d1363a92f";
export const ROUTER_MAIN = "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5"; // sell AERO -> USDC

export const CL_GAUGE_FACTORY = "0x385293CaE378C813F16f0C1334d774AdDDf56AbB";
export const CL_FACTORIES = [
  "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
  "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
  "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
];

export const MARKETS = {
  NVDA: {
    token: "0xb20000000000000000000078ee7ce2fE4908108C",
    decimals: 8,
    pool: "0x853f5f1b92b16714fe6cda67caad0856b83c7ab9",
    gauge: "0x30d1E5Af5CE39863E6F69a1F73ffb0e1AC9771A8",
    tickSpacing: 10,
    fee: 0.0005,
    npm: NPM_EQUITY,
    router: ROUTER_EQUITY,
    kind: "equity",
  },
  AAPL: {
    token: "0xb200000000000000000000C2e324d24d7eEcd1fb",
    decimals: 8,
    pool: "0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0",
    gauge: "0x43021fBbD01b967704aB2379F6e90E2d367042F3",
    tickSpacing: 10,
    fee: 0.0005,
    npm: NPM_EQUITY,
    router: ROUTER_EQUITY,
    kind: "equity",
  },
  GOOGL: {
    token: "0xb2000000000000000000002D0BA3164cc74f58B7",
    decimals: 8,
    pool: "0xb1987cad1682841b4b641d50e520777ec5ab5542",
    gauge: "0x225fc4369972420683dA720F6cb39C5547C4a74e",
    tickSpacing: 10,
    fee: 0.0005,
    npm: NPM_EQUITY,
    router: ROUTER_EQUITY,
    kind: "equity",
  },
  META: {
    token: "0xb2000000000000000000008bC8786B856E61707C",
    decimals: 8,
    pool: "0xeaf57753bc382e0324a1d43f72e7027705a2273e",
    gauge: "0x536DF7362915337ddc86C9b57D322905CA819d65",
    tickSpacing: 10,
    fee: 0.0005,
    npm: NPM_EQUITY,
    router: ROUTER_EQUITY,
    kind: "equity",
  },
  AERO: {
    token: AERO,
    decimals: 18,
    pool: "0xCCd9cC53b63662088c738B8BC06E9078Fb8D9ad4",
    gauge: "0x491300eC768Cf28B13A8d3BbFd87713dD728b0AD",
    tickSpacing: 200,
    fee: 0.003,
    npm: NPM_AERO,
    router: ROUTER_MAIN,
    kind: "crypto",
  },
};

export const SEL = {
  // pool
  slot0: "0x3850c7bd",
  liquidity: "0x1a686502",
  stakedLiquidity: "0x3ab04b20",
  unstakedFee: "0xb64cc67b",
  gauge: "0xa6f19c84",
  tickSpacingCall: "0xd0c93a7c",
  // gauge
  rewardRate: "0x7b0a47ee",
  earned: "0x3e491d47", // earned(address,uint256)
  stakedValues: "0x4b937763", // stakedValues(address) -> uint256[]
  rewardToken: "0xf7c618c1",
  gaugeDeposit: "0xb6b55f25", // deposit(uint256 tokenId)
  gaugeWithdraw: "0x2e1a7d4d", // withdraw(uint256 tokenId)
  getReward: "0x1c4b774b", // getReward(uint256 tokenId)
  // gauge factory
  minStakeTimes: "0xe782453b", // minStakeTimes(address pool)
  // NPM
  positions: "0x99fbab88",
  ownerOf: "0x6352211e",
  tokenOfOwnerByIndex: "0x2f745c59",
  mint: "0xb5007d1f", // 12-word static tuple (Slipstream: tickSpacing + trailing sqrtPriceX96)
  decreaseLiquidity: "0x0c49ccbe",
  collect: "0xfc6f7865",
  burn: "0x42966c68",
  // router
  exactInputSingle: "0xa026383e", // 8-word static tuple (tickSpacing, not fee)
  // ERC20 / ERC721
  balanceOf: "0x70a08231",
  allowance: "0xdd62ed3e",
  approve: "0x095ea7b3",
  // factory
  getPool: "0x28af8d0b", // getPool(address,address,int24)
};

export const ERC721_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT128 = (1n << 128n) - 1n;

export function getMarket(name) {
  const m = MARKETS[String(name || "").toUpperCase()];
  if (!m) {
    throw new Error(
      `unknown market "${name}" — known: ${Object.keys(MARKETS).join(", ")}`
    );
  }
  return m;
}
