// hood-stock-lp: canonical addresses and market table (Robinhood Chain, 4663).
// This file is the source of truth; the SKILL.md table is human reference.
// Addresses cross-verified on-chain Aug 2026 (Midpoint/rheo engine, real money).
// usdgIs0: USDG sorts as token0/currency0 — flips swap direction, mint sides,
// and tick orientation. Verified per-pool via factory ordering + Initialize
// events 2026-08-09. circuitPct: per-market daily-move breaker (a 5% brake
// fits GME; SPCX is a young listing swinging 9-16% day-over-day — braking it
// at 5% means permanently frozen).

export const CHAIN_ID = 4663;

export const RPCS = [
  "https://rpc.mainnet.chain.robinhood.com",
  "https://robinhood-rpc.publicnode.com",
];

export const GECKO_NETWORK = "robinhood"; // GT indexes v4 pools by poolId too

export const MULTICALL3 = "0xcA11bde05977B3631167028862bE2a173976CA11";

export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"; // 6 dec — the cash asset
export const STOCK_DECIMALS = 18; // every Robinhood tokenized stock is 18 dec

// ---- Uniswap v3 (fork) ----
export const NPM_V3 = "0x73991a25c818bf1f1128deaab1492d45638de0d3"; // shared by EVERY v3 pool
export const ROUTER_V3 = "0xcaf681a66d020601342297493863e78c959e5cb2"; // SwapRouter02 shape (no deadline in struct)

// ---- Uniswap v4 (fork) — official Robinhood Chain deployments ----
export const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
export const POSM = "0x58daec3116aae6d93017baaea7749052e8a04fa7"; // PositionManager (ERC-721)
export const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
export const QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
export const UNIVERSAL_ROUTER = "0x8876789976decbfcbbbe364623c63652db8c0904";
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const HOOKS_NONE = "0x0000000000000000000000000000000000000000";

// venue v3: pool is an address. venue v4: pool is a PoolManager poolId (bytes32).
// fee is in pips of 1e6 (3000 = 0.3%).
export const MARKETS = {
  GME:   { venue: "v3", token: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E", pool: "0xe9713f453adb9245b19559790c96f470a18f2fdf", fee: 10000, tickSpacing: 200, usdgIs0: false, circuitPct: 5 },
  SPCX:  { venue: "v4", token: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", pool: "0xcb6ffbcc84359535c2cc0a5688c0a76520ea6e0a4820fddd3ac8d7880e576370", fee: 10000, tickSpacing: 200, usdgIs0: false, circuitPct: 15 },
  SPY:   { venue: "v4", token: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", pool: "0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907", fee: 500, tickSpacing: 5, usdgIs0: false, circuitPct: 5 },
  TSLA:  { venue: "v4", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", pool: "0x8517f8071ae5b831b738052f12125e8e3d6c158b78728aa44ce3b25e5104d32e", fee: 3000, tickSpacing: 60, usdgIs0: false, circuitPct: 8 },
  GOOGL: { venue: "v4", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", pool: "0xd4ecb79fdc521d7725d22b33ed43cb4e47aa96bfad76aa29577e3151f723ac5e", fee: 3000, tickSpacing: 60, usdgIs0: false, circuitPct: 8 },
  CRCL:  { venue: "v4", token: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5", pool: "0x628c98ab436ee34a6a7decd606242890582591bdf7c9a35d90e0d08021c31ea0", fee: 3000, tickSpacing: 30, usdgIs0: true, circuitPct: 10 },
  MSFT:  { venue: "v3", token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", pool: "0xeb60bcd1d920ad6e102690ccfc6fb488899e1510", fee: 3000, tickSpacing: 60, usdgIs0: true, circuitPct: 5 },
  AAPL:  { venue: "v4", token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", pool: "0xc748f4671a867db48b552f6b7650bf3255e05f80f00e3f7aad1b17ccb7898fdb", fee: 3000, tickSpacing: 60, usdgIs0: true, circuitPct: 5 },
  USO:   { venue: "v3", token: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344", pool: "0x02175608f1b5e6b5ed221ccfdc7be197d111d915", fee: 3000, tickSpacing: 60, usdgIs0: true, circuitPct: 8 },
  NFLX:  { venue: "v3", token: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8", pool: "0x59895c0302f41aeaa129d2fa2442cec01e7ef45e", fee: 3000, tickSpacing: 60, usdgIs0: true, circuitPct: 8 },
  NVDA:  { venue: "v3", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", pool: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3", fee: 500, tickSpacing: 10, usdgIs0: true, circuitPct: 8 },
  INTC:  { venue: "v3", token: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681", pool: "0x2e5a92f5013a64661a49312111be2e8abd33f56a", fee: 3000, tickSpacing: 60, usdgIs0: true, circuitPct: 8 },
};

// Selectors — every one computed with viem toFunctionSelector and, where it
// matters, cross-checked against the deployed fork (selftest.mjs holds the
// byte-for-byte calldata vectors).
export const SEL = {
  // shared ERC20 / ERC721
  approve: "0x095ea7b3",
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",
  decimals: "0x313ce567",
  ownerOf: "0x6352211e",
  tokenOfOwnerByIndex: "0x2f745c59",
  // v3 pool
  slot0: "0x3850c7bd",
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  feeCall: "0xddca3f43",
  liquidity: "0x1a686502",
  feeGrowthGlobal0: "0xf3058399",
  feeGrowthGlobal1: "0x46141319",
  ticks: "0xf30dba93",
  // v3 NPM
  positions: "0x99fbab88",
  mintV3: "0x88316456", // 11-word static tuple (fee, NOT tickSpacing — this is stock Uniswap, not Slipstream)
  decreaseLiquidity: "0x0c49ccbe",
  collect: "0xfc6f7865",
  burnV3: "0x42966c68",
  npmMulticall: "0xac9650d8", // multicall(bytes[]) — decrease+collect+burn in ONE tx
  // v3 router (SwapRouter02 shape — 7-word struct, no deadline)
  exactInputSingle: "0x04e45aaf",
  // v4 StateView
  getSlot0: "0xc815641c",
  getLiquidity: "0xfa6793d5",
  getPositionInfo: "0xdacf1d2f", // (poolId, owner, tickLower, tickUpper, salt)
  getFeeGrowthInside: "0x53e9c1fb",
  // v4 POSM
  getPoolAndPositionInfo: "0x7ba03aad",
  getPositionLiquidity: "0x1efeed33",
  modifyLiquidities: "0xdd46508f",
  nextTokenId: "0x75794a3c",
  // v4 Quoter
  quoteExactInputSingle: "0xaa9d21cb",
  // UniversalRouter
  urExecute: "0x3593564c",
  // Permit2
  permit2Approve: "0x87517c45", // approve(address token, address spender, uint160, uint48)
  permit2Allowance: "0x927da105", // allowance(address owner, address token, address spender)
};

export const ERC721_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;
export const MAX_UINT128 = (1n << 128n) - 1n;

export function getMarket(name) {
  const M = MARKETS[String(name || "").toUpperCase()];
  if (!M) {
    throw new Error(
      `unknown market "${name}" — known: ${Object.keys(MARKETS).join(", ")}`
    );
  }
  return { symbol: String(name).toUpperCase(), ...M };
}
