import { readFileSync } from "node:fs";
import {
  decodeAddress,
  decodeBool,
  decodeBytes32,
  decodeDynamicArray,
  decodeFeeRoute,
  decodePagedUintArray,
  decodePosition,
  decodePositionsPage,
  decodeStockEntry,
  decodeString,
  decodeUint,
  encodeCall,
  formatUnits,
  jsonValue,
  normalizeAddress,
} from "./abi.mjs";
import { chainId, ethCall, getCodeHash, latestBlock } from "./chain.mjs";
import { eventTopic, selector } from "./keccak256.mjs";

export const DEPLOYMENT = JSON.parse(
  readFileSync(new URL("../../references/deployment.json", import.meta.url), "utf8"),
);

export const ADDR = Object.freeze({
  routeRegistry: DEPLOYMENT.contracts.routeRegistry.address,
  punkAMM: DEPLOYMENT.contracts.punkAMM.address,
  lockVault: DEPLOYMENT.contracts.lockVault.address,
  stockLock: DEPLOYMENT.contracts.stockLock.address,
  revenueRouter: DEPLOYMENT.contracts.revenueRouter.address,
  feeRouter: DEPLOYMENT.contracts.baseV4FeeRouter.address,
  stockAdapter: DEPLOYMENT.contracts.aerodromeStockAdapter.address,
  baes: DEPLOYMENT.tokens.baes.address,
  punks: DEPLOYMENT.tokens.punks.address,
  weth: DEPLOYMENT.tokens.weth.address,
  owner: DEPLOYMENT.owner,
});

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const PRINCIPAL = 6_000_000n * 10n ** 18n;
export const FEE = 600_000n * 10n ** 18n;
export const BUY_TOTAL = 6_600_000n * 10n ** 18n;
export const SELL_PAYOUT = 5_400_000n * 10n ** 18n;
export const MIN_CONVERT = 10n ** 15n;
export const MAX_CONVERT = 5n * 10n ** 17n;
export const MAX_BATCH = 20;
export const MAX_PAGE = 100;

export const TIERS = Object.freeze([
  { id: 0, name: "Signal", cost: 600_000n * 10n ** 18n, weight: 100 },
  { id: 1, name: "Surge", cost: 1_500_000n * 10n ** 18n, weight: 158 },
  { id: 2, name: "Riot", cost: 3_300_000n * 10n ** 18n, weight: 235 },
  { id: 3, name: "Overdrive", cost: 6_000_000n * 10n ** 18n, weight: 316 },
  { id: 4, name: "Maximum", cost: 15_000_000n * 10n ** 18n, weight: 500 },
]);

export const SIG = Object.freeze({
  // ERC-20 / ERC-721
  balanceOf: "balanceOf(address)",
  allowance: "allowance(address,address)",
  approve: "approve(address,uint256)",
  ownerOf: "ownerOf(uint256)",
  getApproved: "getApproved(uint256)",
  symbol: "symbol()",
  decimals: "decimals()",
  getTransferValidator: "getTransferValidator()",
  // Core writes
  buy: "buyNextNFT(uint256,uint256,uint256,uint256)",
  sell: "sellNFT(uint256,uint256,uint256,uint256)",
  stake: "stake(uint256,uint8,address)",
  upgrade: "upgrade(uint256,uint8)",
  unstake: "unstake(uint256)",
  unstakeTo: "unstakeTo(uint256,address)",
  settle: "settlePosition(uint256)",
  settleBatch: "settlePositions(uint256[])",
  claim: "claim(address)",
  claimTo: "claimTo(address,address)",
  claimBatch: "claimBatch(address[],address)",
  claimLossy: "claimLossy(address,address,uint256)",
  forfeit: "forfeitCredit(address,uint256)",
  convert: "convert(uint256,uint256)",
  topUpWeth: "depositTopUp(uint256,bytes32)",
  pokeBootstrap: "pokeBootstrap()",
  topUpReserve: "topUpReserve(uint256)",
  syncDonation: "syncBAESDonation()",
  evictHead: "evictUnownedHead()",
});

export const EVENTS = Object.freeze({
  Approval: "Approval(address,address,uint256)",
  Transfer: "Transfer(address,address,uint256)",
  NFTSold: "NFTSold(address,uint256,uint256,uint256)",
  NFTBought: "NFTBought(address,uint256,uint256,uint256)",
  ReserveToppedUp: "ReserveToppedUp(address,uint256)",
  DonationSynced: "DonationSynced(uint256)",
  HeadEvicted: "HeadEvicted(uint256)",
  PositionOpened: "PositionOpened(uint256,uint256,address,uint8,uint16)",
  PositionUpgraded: "PositionUpgraded(uint256,uint8,uint16)",
  PositionClosed: "PositionClosed(uint256)",
  ConversionFeeSwapped: "ConversionFeeSwapped(bytes32,address,uint256,uint256,bytes32)",
  RevenueDeposited: "RevenueDeposited(bytes32,uint256,bool)",
  BootstrapReleased: "BootstrapReleased(uint256,uint256)",
  Converted: "Converted(address,address,uint256,uint256,uint256)",
  CreditWritten: "CreditWritten(uint256,address,address,uint256)",
  Claimed: "Claimed(address,address,address,uint256)",
  ClaimedLossy: "ClaimedLossy(address,address,address,uint256,uint256)",
  CreditForfeited: "CreditForfeited(address,address,uint256)",
});

export const EVENT_BY_TOPIC = new Map(
  Object.entries(EVENTS).map(([name, signature]) => [eventTopic(signature).toLowerCase(), { name, signature }]),
);

const ERROR_SIGNATURES = [
  "Unauthorized()", "ZeroAddress()", "AlreadyWired()", "AlreadyOpen()", "SystemClosed()",
  "InvalidTier()", "InvalidPosition()", "NotDepositor()", "NotUpgrade()", "ActiveLimit()",
  "UnexpectedBalanceDelta()", "DirectNFTTransfer()", "InvalidPage()", "DeadlineExpired()",
  "InvalidConvertAmount()", "ConvertRateLimited()", "NoStakedWeight()", "TokenLimitReached()",
  "NothingToClaim()", "BatchTooLarge()", "NativeETHRejected()", "SlippageExceeded()",
  "WethNotClaimable()", "EmptyInventory()", "UnexpectedHead()", "InsufficientReserve()",
  "HeadStillHeld()", "FeeRoutePaused()", "InvalidMaxInput()", "InvalidMinOutput()",
  "InvalidConfig()", "NoEnabledStock()", "InvalidSlot()",
];

export const ERROR_BY_SELECTOR = new Map(
  ERROR_SIGNATURES.map((signature) => [selector(signature).toLowerCase(), signature]),
);

export function describeRevert(data) {
  if (!data || data.length < 10) return "execution reverted without decodable data";
  const key = data.slice(0, 10).toLowerCase();
  return ERROR_BY_SELECTOR.get(key) ?? `unknown custom error ${key}`;
}

export async function call(to, signature, types = [], values = [], from) {
  return await ethCall(to, encodeCall(signature, types, values), from);
}

export async function readUint(to, signature, types = [], values = []) {
  return decodeUint(await call(to, signature, types, values));
}

export async function readAddress(to, signature, types = [], values = []) {
  return decodeAddress(await call(to, signature, types, values));
}

export async function readBool(to, signature, types = [], values = []) {
  return decodeBool(await call(to, signature, types, values));
}

export function sanitizeTokenSymbol(value, fallback = "TOKEN") {
  if (typeof value !== "string") return fallback;
  const printable = [...value.normalize("NFC")]
    .map((character) => {
      const codepoint = character.codePointAt(0);
      if (/\s/u.test(character)) return " ";
      return codepoint >= 0x20 && codepoint <= 0x7e ? character : "?";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return [...printable].slice(0, 32).join("") || fallback;
}

export async function readTokenMeta(token) {
  const [symbolResult, decimalsResult] = await Promise.allSettled([
    call(token, SIG.symbol),
    call(token, SIG.decimals),
  ]);
  const fallbackSymbol = `${token.slice(0, 6)}...${token.slice(-4)}`;
  let symbol = fallbackSymbol;
  if (symbolResult.status === "fulfilled") {
    try {
      const raw = symbolResult.value;
      if (typeof raw !== "string" || !/^0x[0-9a-fA-F]*$/.test(raw) || raw.length > 514) {
        throw new Error("unsafe token symbol response");
      }
      if (raw.length === 66) {
        const bytes = decodeBytes32(raw).slice(2).replace(/(?:00)+$/, "");
        symbol = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(bytes.match(/.{2}/g)?.map((entry) => Number.parseInt(entry, 16)) ?? []),
        );
      } else {
        symbol = decodeString(raw);
      }
      symbol = sanitizeTokenSymbol(symbol, fallbackSymbol);
    } catch { /* keep bounded fallback */ }
  }
  let decimals = null;
  if (decimalsResult.status === "fulfilled") {
    try {
      const rawDecimals = decodeUint(decimalsResult.value);
      if (rawDecimals <= 36n) decimals = Number(rawDecimals);
    } catch { /* raw amount display remains available */ }
  }
  return { address: normalizeAddress(token), symbol, decimals };
}

function compare(actual, expected) {
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

export async function verifyDeployment() {
  const checks = [];
  const add = (name, actual, expected) => checks.push({ name, pass: compare(actual, expected), actual, expected });
  const network = await chainId();
  add("chainId", network, DEPLOYMENT.chainId);

  const identities = [
    ...Object.entries(DEPLOYMENT.contracts),
    ...Object.entries(DEPLOYMENT.tokens),
  ];
  for (const [name, identity] of identities) {
    const actualHash = await getCodeHash(identity.address);
    add(`${name}.runtimeCodeHash`, actualHash, identity.codeHash);
  }

  const expectedOwner = ADDR.owner;
  for (const [name, address] of [
    ["routeRegistry", ADDR.routeRegistry], ["punkAMM", ADDR.punkAMM],
    ["lockVault", ADDR.lockVault], ["stockLock", ADDR.stockLock],
    ["revenueRouter", ADDR.revenueRouter], ["stockAdapter", ADDR.stockAdapter],
  ]) {
    add(`${name}.owner`, await readAddress(address, "owner()"), expectedOwner);
  }

  for (const [name, address] of [
    ["punkAMM", ADDR.punkAMM], ["lockVault", ADDR.lockVault],
    ["stockLock", ADDR.stockLock], ["revenueRouter", ADDR.revenueRouter],
  ]) {
    add(`${name}.peersLocked`, await readBool(address, "peersLocked()"), true);
    add(`${name}.systemOpen`, await readBool(address, "systemOpen()"), true);
  }

  const wiring = [
    ["punkAMM.baes", ADDR.punkAMM, "baes()", ADDR.baes],
    ["punkAMM.punks", ADDR.punkAMM, "punks()", ADDR.punks],
    ["punkAMM.registry", ADDR.punkAMM, "registry()", ADDR.routeRegistry],
    ["punkAMM.lockVault", ADDR.punkAMM, "lockVault()", ADDR.lockVault],
    ["punkAMM.revenueRouter", ADDR.punkAMM, "revenueRouter()", ADDR.revenueRouter],
    ["lockVault.baes", ADDR.lockVault, "baes()", ADDR.baes],
    ["lockVault.punks", ADDR.lockVault, "punks()", ADDR.punks],
    ["lockVault.registry", ADDR.lockVault, "registry()", ADDR.routeRegistry],
    ["lockVault.punkAMM", ADDR.lockVault, "punkAMM()", ADDR.punkAMM],
    ["lockVault.stockLock", ADDR.lockVault, "stockLock()", ADDR.stockLock],
    ["stockLock.weth", ADDR.stockLock, "weth()", ADDR.weth],
    ["stockLock.registry", ADDR.stockLock, "registry()", ADDR.routeRegistry],
    ["stockLock.lockVault", ADDR.stockLock, "lockVault()", ADDR.lockVault],
    ["stockLock.revenueRouter", ADDR.stockLock, "revenueRouter()", ADDR.revenueRouter],
    ["stockLock.stockAdapter(discovered)", ADDR.stockLock, "stockAdapter()", ADDR.stockAdapter],
    ["revenueRouter.baes", ADDR.revenueRouter, "baes()", ADDR.baes],
    ["revenueRouter.weth", ADDR.revenueRouter, "weth()", ADDR.weth],
    ["revenueRouter.registry", ADDR.revenueRouter, "registry()", ADDR.routeRegistry],
    ["revenueRouter.punkAMM", ADDR.revenueRouter, "punkAMM()", ADDR.punkAMM],
    ["revenueRouter.stockLock", ADDR.revenueRouter, "stockLock()", ADDR.stockLock],
    ["revenueRouter.feeAdapter", ADDR.revenueRouter, "feeAdapter()", ADDR.feeRouter],
    ["feeRouter.revenueRouter", ADDR.feeRouter, "revenueRouter()", ADDR.revenueRouter],
    ["feeRouter.baes", ADDR.feeRouter, "baes()", ADDR.baes],
    ["feeRouter.weth", ADDR.feeRouter, "weth()", ADDR.weth],
    ["stockAdapter.stockLock", ADDR.stockAdapter, "stockLock()", ADDR.stockLock],
    ["stockAdapter.weth", ADDR.stockAdapter, "weth()", ADDR.weth],
  ];
  for (const [name, address, signature, expected] of wiring) {
    add(name, await readAddress(address, signature), expected);
  }

  const feeRoute = decodeFeeRoute(await call(ADDR.routeRegistry, "feeRoute()"));
  for (const key of ["router", "tokenIn", "tokenOut", "poolId", "recipient", "selector", "routeHash", "feeTier", "stable"]) {
    add(`feeRoute.${key}`, feeRoute[key], DEPLOYMENT.feeRoute[key]);
  }

  const constants = [
    ["PunkAMM.PRINCIPAL", ADDR.punkAMM, "PRINCIPAL()", PRINCIPAL],
    ["PunkAMM.FEE", ADDR.punkAMM, "FEE()", FEE],
    ["PunkAMM.BUY_TOTAL", ADDR.punkAMM, "BUY_TOTAL()", BUY_TOTAL],
    ["PunkAMM.SELL_PAYOUT", ADDR.punkAMM, "SELL_PAYOUT()", SELL_PAYOUT],
    ["StockLock.MIN_CONVERT", ADDR.stockLock, "MIN_CONVERT()", MIN_CONVERT],
    ["StockLock.MAX_CONVERT", ADDR.stockLock, "MAX_CONVERT()", MAX_CONVERT],
    ["StockLock.MAX_BATCH", ADDR.stockLock, "MAX_BATCH()", BigInt(MAX_BATCH)],
  ];
  for (const [name, address, signature, expected] of constants) {
    add(name, await readUint(address, signature), expected);
  }

  const failed = checks.filter((check) => !check.pass);
  return {
    ok: failed.length === 0,
    release: DEPLOYMENT.release,
    checks,
    failed: failed.map((check) => check.name),
  };
}

export async function protocolStatus() {
  const block = await latestBlock();
  const [
    feeRouteActive, feeRoutePaused, stockRoutePaused, inventoryCount, sellCapacity,
    trackedBAES, activeCount, totalWeight, wethPot, bootstrapLocked,
    distributedTokenCount, rotationCursor, lastConvertBlock, stockCount, transferValidator,
  ] = await Promise.all([
    readBool(ADDR.routeRegistry, "feeRouteActive()"),
    readBool(ADDR.routeRegistry, "feeRoutePaused()"),
    readBool(ADDR.routeRegistry, "stockRoutePaused()"),
    readUint(ADDR.punkAMM, "inventoryCount()"),
    readUint(ADDR.punkAMM, "sellCapacity()"),
    readUint(ADDR.punkAMM, "trackedBAES()"),
    readUint(ADDR.lockVault, "activeCount()"),
    readUint(ADDR.lockVault, "totalWeight()"),
    readUint(ADDR.stockLock, "wethPot()"),
    readUint(ADDR.stockLock, "bootstrapLocked()"),
    readUint(ADDR.stockLock, "distributedTokenCount()"),
    readUint(ADDR.stockLock, "rotationCursor()"),
    readUint(ADDR.stockLock, "lastConvertBlock()"),
    readUint(ADDR.stockAdapter, "stockCount()"),
    readAddress(ADDR.punks, SIG.getTransferValidator).catch(() => null),
  ]);

  const roster = [];
  for (let slot = 0n; slot < stockCount; slot += 1n) {
    const entry = decodeStockEntry(await call(ADDR.stockAdapter, "stockAt(uint256)", ["uint256"], [slot]));
    const metadata = entry.token === ZERO_ADDRESS ? null : await readTokenMeta(entry.token);
    roster.push({ slot, ...entry, symbol: metadata?.symbol ?? null });
  }

  return jsonValue({
    block,
    routes: { feeRouteActive, feeRoutePaused, stockRoutePaused },
    desk: { inventoryCount, sellCapacity, trackedBAES, trackedBAESFormatted: formatUnits(trackedBAES, 18) },
    crew: { activeCount, totalWeight },
    stock: {
      wethPot, wethPotFormatted: formatUnits(wethPot, 18), bootstrapLocked,
      bootstrapLockedFormatted: formatUnits(bootstrapLocked, 18), distributedTokenCount,
      rotationCursor, lastConvertBlock, conversionAvailableThisBlock: block.number !== lastConvertBlock,
    },
    roster,
    punkTransferValidator: transferValidator,
  });
}

export async function inventoryPage(cursor = 0n, limit = 100n) {
  if (limit < 1n || limit > 100n) throw new Error("inventory limit must be 1..100");
  const decoded = decodePagedUintArray(
    await call(ADDR.punkAMM, "fifoPage(uint256,uint256)", ["uint256", "uint256"], [cursor, limit]),
  );
  return jsonValue(decoded);
}

export async function allPositions() {
  const nextPositionId = await readUint(ADDR.lockVault, "nextPositionId()");
  const positions = [];
  let cursor = 1n;
  while (cursor < nextPositionId) {
    const page = decodePositionsPage(
      await call(ADDR.lockVault, "positionsPage(uint256,uint256)", ["uint256", "uint256"], [cursor, 100n]),
      cursor,
    );
    positions.push(...page.positions);
    if (page.nextCursor <= cursor) throw new Error("positionsPage cursor did not advance");
    cursor = page.nextCursor;
  }
  return positions;
}

export async function distributedTokens() {
  const count = await readUint(ADDR.stockLock, "distributedTokenCount()");
  const tokens = [];
  for (let index = 0n; index < count; index += 1n) {
    tokens.push(await readAddress(ADDR.stockLock, "distributedTokens(uint256)", ["uint256"], [index]));
  }
  return tokens;
}

export async function walletCrew(wallet) {
  const normalized = normalizeAddress(wallet);
  const positions = await allPositions();
  return positions
    .filter((position) => position.depositor === normalized || position.beneficiary === normalized)
    .map((position) => ({
      ...position,
      canManage: position.depositor === normalized,
      earnsForWallet: position.beneficiary === normalized,
    }));
}

export async function walletRewards(wallet) {
  const normalized = normalizeAddress(wallet);
  const [positions, tokens] = await Promise.all([allPositions(), distributedTokens()]);
  const beneficiaryPositions = positions.filter((position) => position.beneficiary === normalized);
  const tokenMeta = new Map();
  for (const token of tokens) tokenMeta.set(token, await readTokenMeta(token));

  const credits = [];
  for (const token of tokens) {
    const credit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, normalized]);
    const metadata = tokenMeta.get(token);
    credits.push({
      token,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      amount: credit,
      formatted: metadata.decimals === null ? null : formatUnits(credit, metadata.decimals),
    });
  }

  const pending = [];
  for (const position of beneficiaryPositions) {
    for (const token of tokens) {
      const amount = await readUint(
        ADDR.stockLock,
        "pendingStock(uint256,address)",
        ["uint256", "address"],
        [position.id, token],
      );
      if (amount === 0n) continue;
      const metadata = tokenMeta.get(token);
      pending.push({
        positionId: position.id,
        token,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        amount,
        formatted: metadata.decimals === null ? null : formatUnits(amount, metadata.decimals),
      });
    }
  }

  return jsonValue({ positions: beneficiaryPositions, lifetimeTokens: [...tokenMeta.values()], credits, pending });
}

export function knownActionBySelector(target, dataSelector) {
  const normalizedTarget = normalizeAddress(target);
  const candidates = [];
  if ([ADDR.baes, ADDR.weth, ADDR.punks].map(normalizeAddress).includes(normalizedTarget)) {
    candidates.push({ name: "approve", signature: SIG.approve });
  }
  if (normalizedTarget === normalizeAddress(ADDR.punkAMM)) {
    candidates.push(
      { name: "buy", signature: SIG.buy }, { name: "sell", signature: SIG.sell },
      { name: "reserve-topup", signature: SIG.topUpReserve },
      { name: "sync-donation", signature: SIG.syncDonation }, { name: "evict-head", signature: SIG.evictHead },
    );
  }
  if (normalizedTarget === normalizeAddress(ADDR.lockVault)) {
    candidates.push(
      { name: "stake", signature: SIG.stake }, { name: "upgrade", signature: SIG.upgrade },
      { name: "unstake", signature: SIG.unstake }, { name: "unstake-to", signature: SIG.unstakeTo },
    );
  }
  if (normalizedTarget === normalizeAddress(ADDR.stockLock)) {
    candidates.push(
      { name: "settle", signature: SIG.settle }, { name: "settle-batch", signature: SIG.settleBatch },
      { name: "claim", signature: SIG.claim }, { name: "claim-to", signature: SIG.claimTo },
      { name: "claim-batch", signature: SIG.claimBatch }, { name: "claim-lossy", signature: SIG.claimLossy },
      { name: "forfeit", signature: SIG.forfeit }, { name: "convert", signature: SIG.convert },
      { name: "weth-topup", signature: SIG.topUpWeth }, { name: "poke-bootstrap", signature: SIG.pokeBootstrap },
    );
  }
  return candidates.find((candidate) => selector(candidate.signature).toLowerCase() === dataSelector?.toLowerCase()) ?? null;
}
