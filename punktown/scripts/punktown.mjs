#!/usr/bin/env node
// Punk Town planner for Bankr. Reads Base mainnet, verifies the reviewed live
// deployment, and emits unsigned allowlisted transactions. It never signs or submits.

import {
  asciiBytes32,
  decodeCallArguments,
  decodeAddress,
  decodeBytes32,
  decodePosition,
  decodeUint,
  encodeCall,
  formatUnits,
  jsonValue,
  normalizeAddress,
  parseUnits,
  stripErc8021Suffix,
} from "./lib/abi.mjs";
import {
  estimateGas,
  ethCall,
  getBlockByHash,
  getCode,
  getCodeHash,
  getReceipt,
  getStorageAt,
  getTransaction,
  getTransactionCount,
  latestBlock,
  revertData,
  txSelector,
  unsignedTx,
} from "./lib/chain.mjs";
import {
  ECRECOVER_PRECOMPILE,
  ENTRY_POINT_V07_CODE_HASH,
  KERNEL_DELEGATION_DESIGNATOR,
  KERNEL_IMPLEMENTATION,
  KERNEL_IMPLEMENTATION_CODE_HASH,
  KERNEL_VALIDATION_STORAGE_SLOT,
  ROOT_VALIDATOR_SELECTOR,
  decodeAuthorizationAuthority,
  decodeBankrExecution,
  decodeRootValidator,
  proveKernelDelegationAtTransaction,
  sumCanonicalErc20Transfers,
  userOperationHashCall,
  verifyBankrExecutionReceipt,
} from "./lib/bankr.mjs";
import { keccak256 } from "./lib/keccak256.mjs";
import {
  ADDR,
  BUY_TOTAL,
  DEPLOYMENT,
  EVENT_BY_TOPIC,
  FEE,
  MAX_BATCH,
  MAX_CONVERT,
  MIN_CONVERT,
  SELL_PAYOUT,
  SIG,
  TIERS,
  ZERO_ADDRESS,
  allPositions,
  call,
  describeRevert,
  distributedTokens,
  inventoryPage,
  knownActionBySelector,
  protocolStatus,
  readAddress,
  readBool,
  readTokenMeta,
  readUint,
  verifyDeployment,
  walletCrew,
  walletRewards,
} from "./lib/protocol.mjs";

const [, , command, ...argv] = process.argv;
const BANKR_NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const ZERO_ROOT_VALIDATOR_RESULT = `0x${"0".repeat(64)}`;

function isNativeToken(address) {
  const normalized = normalizeAddress(address);
  return normalized === ZERO_ADDRESS || normalized === BANKR_NATIVE_TOKEN;
}

function acquisitionSource(address) {
  const normalized = normalizeAddress(address);
  if (isNativeToken(normalized)) return { token: BANKR_NATIVE_TOKEN, symbol: "ETH", decimals: 18, kind: "native" };
  if (normalized === normalizeAddress(ADDR.weth)) return { token: normalized, symbol: "WETH", decimals: 18, kind: "erc20" };
  if (normalized === BASE_USDC) return { token: normalized, symbol: "USDC", decimals: 6, kind: "erc20" };
  return null;
}

const args = {};
let argumentParseError = null;
for (let index = 0; index < argv.length; index += 1) {
  const flag = argv[index];
  if (!flag.startsWith("--")) {
    argumentParseError = `unexpected positional argument: ${flag}`;
    break;
  }
  const key = flag.slice(2);
  if (!key || Object.hasOwn(args, key)) {
    argumentParseError = !key ? "empty -- flag is not allowed" : `duplicate flag: --${key}`;
    break;
  }
  const next = argv[index + 1];
  if (next !== undefined && !next.startsWith("--")) {
    args[key] = next;
    index += 1;
  } else {
    args[key] = true;
  }
}

class GateError extends Error {
  constructor(gate, detail, extra = {}) {
    super(detail);
    this.gate = gate;
    this.extra = extra;
  }
}

function gate(condition, name, detail, extra = {}) {
  if (!condition) throw new GateError(name, detail, extra);
}

function need(name) {
  const value = args[name];
  gate(value !== undefined && value !== true, "args", `--${name} is required`);
  return value;
}

function integerArg(name, { min = 0n, max = (1n << 256n) - 1n, required = true } = {}) {
  const raw = required ? need(name) : args[name];
  if (raw === undefined) return null;
  gate(/^[0-9]+$/.test(String(raw)), "args", `--${name} must be a non-negative integer`);
  const value = BigInt(raw);
  gate(value >= min && value <= max, "args", `--${name} must be between ${min} and ${max}`);
  return value;
}

function walletArg() {
  return normalizeAddress(need("wallet"));
}

function booleanFlag(name) {
  const value = args[name];
  gate(value === undefined || value === true, "args", `--${name} is a flag and does not take a value`);
  return value === true;
}

function acquisitionSlippageBps() {
  return args["acquisition-slippage-bps"] === undefined
    ? 300n
    : integerArg("acquisition-slippage-bps", { min: 10n, max: 1000n });
}

function optionalBoundedTextArg(name, { maxLength = 256, pattern = null } = {}) {
  const value = args[name];
  if (value === undefined) return null;
  gate(value !== true && typeof value === "string", "args", `--${name} requires a value`);
  gate(value.length > 0 && value.length <= maxLength, "args", `--${name} must contain 1..${maxLength} characters`);
  gate(!/[\u0000-\u001f\u007f]/.test(value), "args", `--${name} must not contain control characters`);
  if (pattern) gate(pattern.test(value), "args", `--${name} has an invalid format`);
  return value;
}

function recipientArg(wallet) {
  return args.recipient ? normalizeAddress(args.recipient) : wallet;
}

function tokenArg(name = "token") {
  return normalizeAddress(need(name));
}

function tokenListArg() {
  const tokens = need("tokens").split(",").map((token) => normalizeAddress(token.trim()));
  const unique = [...new Set(tokens)];
  gate(unique.length > 0 && unique.length <= MAX_BATCH, "args", `--tokens must contain 1..${MAX_BATCH} unique addresses`);
  return unique;
}

function amountArg(name, decimals) {
  const value = parseUnits(need(name), decimals);
  gate(value > 0n, "args", `--${name} must be greater than zero`);
  return value;
}

function out(value, code = 0) {
  console.log(JSON.stringify(jsonValue(value), null, 2));
  process.exitCode = code;
}

async function deploymentGate() {
  const integrity = await verifyDeployment();
  gate(integrity.ok, "deployment-integrity", "live Base deployment did not match the reviewed release pin", {
    failed: integrity.failed,
  });
  return { ok: true, commit: DEPLOYMENT.release.commit, blocks: DEPLOYMENT.release.blocks };
}

async function routeGate(kind) {
  if (kind === "fee") {
    const [active, paused] = await Promise.all([
      readBool(ADDR.routeRegistry, "feeRouteActive()"),
      readBool(ADDR.routeRegistry, "feeRoutePaused()"),
    ]);
    gate(active && !paused, "fee-route", "the fee route must be active and unpaused for buy/sell");
    return { active, paused };
  }
  if (kind === "stock") {
    const paused = await readBool(ADDR.routeRegistry, "stockRoutePaused()");
    gate(!paused, "stock-route", "the stock route is paused; stake, upgrade, and convert are unavailable");
    return { paused };
  }
  return null;
}

async function simulation(tx, wallet) {
  try {
    const result = await ethCall(tx.to, tx.data, wallet);
    const gas = await estimateGas(tx.to, tx.data, wallet, "0x0");
    return { ok: true, returnData: result, gasEstimate: gas };
  } catch (error) {
    const data = revertData(error);
    throw new GateError("simulation", data ? describeRevert(data) : error.message, {
      revertSelector: data?.slice(0, 10) ?? null,
    });
  }
}

function resolveBankrExecution(transaction, wallet, gateName) {
  try {
    return decodeBankrExecution(transaction, wallet);
  } catch (error) {
    throw new GateError(gateName, error.message);
  }
}

async function proveBankrExecutionReceipt(envelope, transaction, receipt, gateName) {
  const block = receipt.blockNumber;
  gate(Boolean(block), gateName, "receipt has no mined block number");
  gate(Boolean(receipt.blockHash), gateName, "receipt has no mined block hash");
  gate(/^0x[0-9a-fA-F]{64}$/.test(transaction.hash ?? ""), gateName, "transaction has no canonical hash");
  gate(/^0x[0-9a-fA-F]{64}$/.test(receipt.transactionHash ?? ""), gateName, "receipt has no canonical transaction hash");
  gate(transaction.hash?.toLowerCase() === receipt.transactionHash?.toLowerCase(), gateName, "transaction and receipt hashes do not match");
  const blockNumber = BigInt(block);
  gate(blockNumber > 0n, gateName, "receipt block has no parent state");
  const receiptBlock = await getBlockByHash(receipt.blockHash, true);
  gate(receiptBlock?.hash?.toLowerCase() === receipt.blockHash.toLowerCase(), gateName, "receipt block hash could not be pinned");
  gate(BigInt(receiptBlock.number) === blockNumber, gateName, "receipt block number does not match its hash");
  gate(/^0x[0-9a-fA-F]{64}$/.test(receiptBlock.parentHash ?? ""), gateName, "receipt block has no canonical parent hash");
  gate(transaction.blockHash?.toLowerCase() === receiptBlock.hash.toLowerCase(), gateName, "transaction block hash does not match the receipt block");
  gate(BigInt(transaction.blockNumber) === blockNumber, gateName, "transaction block number does not match the receipt");
  const transactionIndex = Number(BigInt(transaction.transactionIndex));
  gate(Number.isSafeInteger(transactionIndex) && transactionIndex >= 0, gateName, "transaction index is outside the safe integer range");
  gate(BigInt(receipt.transactionIndex) === BigInt(transaction.transactionIndex), gateName, "transaction and receipt indexes do not match");
  gate(
    receiptBlock.transactions?.[transactionIndex]?.hash?.toLowerCase() === transaction.hash.toLowerCase(),
    gateName,
    "transaction is not a member of the pinned receipt block at its claimed index",
  );
  const receiptBlockRef = { blockHash: receiptBlock.hash, requireCanonical: true };
  const parentBlockRef = { blockHash: receiptBlock.parentHash, requireCanonical: true };
  if (envelope.mode === "direct-wallet-transaction") {
    return {
      accountKind: envelope.accountKind,
      transactionProof: {
        hash: transaction.hash.toLowerCase(),
        blockHash: receiptBlock.hash.toLowerCase(),
        blockNumber,
        transactionIndex,
      },
      userOperationEvent: null,
    };
  }
  let entryPointCodeHash;
  let expectedUserOpHash;
  let parentWalletCode;
  let parentWalletNonce;
  let walletCode;
  let implementationCodeHash;
  let endRootValidatorResult;
  try {
    [entryPointCodeHash, expectedUserOpHash, parentWalletCode, parentWalletNonce, walletCode, implementationCodeHash, endRootValidatorResult] = await Promise.all([
      getCodeHash(envelope.entryPoint, receiptBlockRef),
      ethCall(envelope.entryPoint, userOperationHashCall(envelope), null, receiptBlockRef).then(decodeBytes32),
      getCode(envelope.logicalSender, parentBlockRef),
      getTransactionCount(envelope.logicalSender, parentBlockRef),
      getCode(envelope.logicalSender, receiptBlockRef),
      getCodeHash(KERNEL_IMPLEMENTATION, receiptBlockRef),
      ethCall(envelope.logicalSender, ROOT_VALIDATOR_SELECTOR, null, receiptBlockRef),
    ]);
  } catch (error) {
    throw new GateError(gateName, `could not pin sponsored execution state by block hash: ${error.message}`);
  }
  gate(entryPointCodeHash === ENTRY_POINT_V07_CODE_HASH, gateName, "supported EntryPoint runtime hash changed", {
    entryPoint: envelope.entryPoint,
    expected: ENTRY_POINT_V07_CODE_HASH,
    actual: entryPointCodeHash,
  });
  let userOperationEvent;
  try {
    userOperationEvent = verifyBankrExecutionReceipt(envelope, receipt, expectedUserOpHash);
  } catch (error) {
    throw new GateError(gateName, error.message);
  }
  let parentRootValidator = ZERO_ROOT_VALIDATOR_RESULT;
  if (parentWalletCode === "0x") {
    let validationStorage;
    try {
      validationStorage = await getStorageAt(
        envelope.logicalSender,
        KERNEL_VALIDATION_STORAGE_SLOT,
        parentBlockRef,
      );
    } catch (error) {
      throw new GateError(gateName, `could not read first-use Bankr validation storage at the parent block: ${error.message}`);
    }
    gate(/^0x0{64}$/.test(validationStorage), gateName, "empty-code Bankr wallet retained Kernel validation state at the parent block");
  } else {
    try {
      parentRootValidator = await ethCall(
        envelope.logicalSender,
        ROOT_VALIDATOR_SELECTOR,
        null,
        parentBlockRef,
      );
    } catch (error) {
      throw new GateError(gateName, `could not read the Bankr root validator at the parent block: ${error.message}`);
    }
  }
  let delegationProof;
  try {
    delegationProof = await proveKernelDelegationAtTransaction({
      wallet: envelope.logicalSender,
      transaction,
      block: receiptBlock,
      parentWalletCode,
      parentWalletNonce,
      parentRootValidator,
      recoverAuthority: async (authorization) => decodeAuthorizationAuthority(await ethCall(
        ECRECOVER_PRECOMPILE,
        authorization.callData,
        null,
        parentBlockRef,
      )),
    });
  } catch (error) {
    throw new GateError(gateName, `could not prove transaction-time Bankr delegation: ${error.message}`);
  }
  gate(walletCode.toLowerCase() === KERNEL_DELEGATION_DESIGNATOR, gateName, "Bankr EIP-7702 wallet is not delegated to the reviewed Kernel implementation at the receipt block end", {
    wallet: envelope.logicalSender,
    observedCode: walletCode,
  });
  gate(implementationCodeHash === KERNEL_IMPLEMENTATION_CODE_HASH, gateName, "reviewed Bankr Kernel runtime hash changed", {
    expected: KERNEL_IMPLEMENTATION_CODE_HASH,
    actual: implementationCodeHash,
  });
  let endRootValidator;
  try {
    endRootValidator = decodeRootValidator(endRootValidatorResult);
  } catch (error) {
    throw new GateError(gateName, `could not decode the Bankr root validator at receipt-block end: ${error.message}`);
  }
  gate(endRootValidator === `0x${"0".repeat(42)}`, gateName, "Bankr wallet rootValidator is nonzero at receipt-block end");
  return {
    entryPoint: envelope.entryPoint,
    entryPointCodeHash,
    accountKind: envelope.accountKind,
    implementation: KERNEL_IMPLEMENTATION,
    implementationCodeHash,
    endRootValidator,
    delegationProof,
    userOperationEvent,
  };
}

function confirmationKey(action, terms) {
  return keccak256(JSON.stringify(jsonValue({ chainId: 8453, action, terms })));
}

function normalizedUintString(value, label) {
  try {
    const parsed = BigInt(value);
    gate(parsed >= 0n, "args", `${label} must be a non-negative integer`);
    return parsed.toString();
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError("args", `${label} must be a non-negative integer`);
  }
}

function encodeInspectionContext(action, terms) {
  const context = jsonValue({ action, terms });
  const encoded = new TextEncoder().encode(JSON.stringify(context));
  gate(encoded.length <= 65_536, "planner", "inspection context exceeds 64 KiB");
  return {
    context,
    hex: `0x${Array.from(encoded, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
  };
}

function decodeInspectionContext(value) {
  gate(typeof value === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(value), "args", "--context must be non-empty UTF-8 JSON encoded as hex");
  const hex = value.slice(2);
  gate(hex.length <= 65_536 * 2, "args", "--context exceeds 64 KiB");
  let raw;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(hex.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16))),
    );
  } catch {
    throw new GateError("args", "--context is not valid UTF-8");
  }
  let context;
  try {
    context = JSON.parse(raw);
  } catch {
    throw new GateError("args", "--context is not valid JSON");
  }
  gate(context && typeof context === "object" && !Array.isArray(context), "args", "--context must decode to an object");
  gate(typeof context.action === "string" && context.terms && typeof context.terms === "object" && !Array.isArray(context.terms), "args", "--context must contain action and terms");
  gate(JSON.stringify(context) === raw, "args", "--context JSON is not in the planner's canonical form");
  return { context, hex: `0x${hex.toLowerCase()}` };
}

function inspectionKey(wallet, tx, contextHex) {
  return keccak256(JSON.stringify({
    chainId: Number(BigInt(tx.chainId)),
    wallet: normalizeAddress(wallet),
    to: normalizeAddress(tx.to),
    data: tx.data.toLowerCase(),
    value: normalizedUintString(tx.value, "transaction value"),
    context: contextHex.toLowerCase(),
  }));
}

async function finalPlan({ action, wallet, tx, terms, report, expectedEvents, postconditions, warnings = [], reads = {}, afterSuccess = null }) {
  const preflight = await simulation(tx, wallet);
  const inspection = encodeInspectionContext(action, terms);
  return {
    ok: true,
    command,
    phase: "action",
    deployment: { commit: DEPLOYMENT.release.commit, integrity: true },
    wallet,
    reads,
    terms,
    confirmationKey: confirmationKey(action, terms),
    inspectionContext: inspection.context,
    inspectionContextHex: inspection.hex,
    inspectionKey: inspectionKey(wallet, tx, inspection.hex),
    report,
    warnings,
    txs: [tx],
    preflight: { ...preflight, returnData: preflight.returnData || "0x" },
    expectedEvents,
    postconditions,
    ...(afterSuccess ? { afterSuccess } : {}),
    submitRule: "Show the report and terms. Use an existing explicit confirmation only when it covers this exact confirmationKey and unchanged terms; otherwise obtain confirmation. Re-run immediately before submission, require the same confirmationKey, then submit this one tx with waitForConfirmation=true. Require a successful receipt and postconditions. Never replay an unknown outcome.",
  };
}

async function approvalPlan({ action, wallet, approvals, after, terms, report, warnings = [], reads = {} }) {
  gate(approvals.length === 1, "planner", "approval planner must emit exactly one transaction per fresh plan");
  gate(terms && report, "planner", "approval plan must carry the full action terms and confirmation report");
  const preflights = [];
  for (const tx of approvals) preflights.push(await simulation(tx, wallet));
  const inspection = encodeInspectionContext(action, terms);
  return {
    ok: true,
    command,
    phase: "approval",
    deployment: { commit: DEPLOYMENT.release.commit, integrity: true },
    wallet,
    reads,
    terms,
    confirmationKey: confirmationKey(action, terms),
    inspectionContext: inspection.context,
    inspectionContextHex: inspection.hex,
    report,
    warnings,
    txs: approvals,
    inspectionKey: inspectionKey(wallet, approvals[0], inspection.hex),
    preflights,
    expectedEvents: ["Approval"],
    next: `${after}. After the user confirms the full report, submit this scoped approval only, with waitForConfirmation=true. Require success, then re-run the planner from fresh chain state. Continue without another prompt only if the confirmationKey and all confirmed economic terms remain unchanged. Do not submit an action from this stale plan.`,
  };
}

async function erc20Approval(token, spender, required, wallet, label) {
  const [balance, allowance] = await Promise.all([
    readUint(token, SIG.balanceOf, ["address"], [wallet]),
    readUint(token, SIG.allowance, ["address", "address"], [wallet, spender]),
  ]);
  gate(balance >= required, "balance", `${label}: wallet balance is below the exact required amount`, {
    balance, required,
  });
  if (allowance === required) return { tx: null, balance, allowance };
  const approvalAmount = allowance === 0n ? required : 0n;
  return {
    tx: unsignedTx(
      token,
      encodeCall(SIG.approve, ["address", "uint256"], [spender, approvalAmount]),
      approvalAmount === 0n ? `reset mismatched allowance to zero: ${label}` : `exact approve: ${label}`,
    ),
    balance,
    allowance,
    approvalAmount,
  };
}

async function baesAcquisitionPlan({ action, wallet, required, maxSlippageBps, terms, report, warnings, resume }) {
  const balance = await readUint(ADDR.baes, SIG.balanceOf, ["address"], [wallet]);
  if (balance >= required) return { emitted: false, balance };

  const deficit = required - balance;
  const targetConfirmationKey = confirmationKey(action, terms);
  const acquisitionTerms = {
    chainId: 8453,
    wallet,
    targetAction: action,
    targetConfirmationKey,
    outputToken: normalizeAddress(ADDR.baes),
    startingBalance: balance,
    requiredBalance: required,
    minimumOutput: deficit,
    maxSlippageBps,
  };
  const requestContext = encodeInspectionContext("acquire-baes-request", acquisitionTerms);
  const requestKey = confirmationKey("acquire-baes-request", acquisitionTerms);
  out({
    ok: true,
    command,
    phase: "acquire-baes",
    deployment: { commit: DEPLOYMENT.release.commit, integrity: true },
    wallet,
    reads: { baesBalance: balance, requiredBaesBalance: required, baesDeficit: deficit },
    terms,
    confirmationKey: targetConfirmationKey,
    acquisitionRequestContext: requestContext.context,
    acquisitionRequestContextHex: requestContext.hex,
    acquisitionRequestKey: requestKey,
    report,
    warnings,
    txs: [],
    acquisition: {
      provider: "Bankr",
      operation: "bankr-native-same-chain-exact-output",
      fromChain: "base",
      toChain: "base",
      chainId: 8453,
      outputToken: {
        symbol: "BAES",
        address: normalizeAddress(ADDR.baes),
        decimals: 18,
      },
      currentBalance: balance,
      requiredBalance: required,
      requestedOutput: deficit,
      requestedOutputHuman: formatUnits(deficit, 18),
      requestedOutputMode: "exact-output",
      maxSlippageBps,
      sourcePolicy: "Use only sufficient native ETH, WETH, or official Base USDC and preserve native ETH needed for gas. If the user names any other asset, explain that this verifier cannot prove its debit semantics and ask them to swap it to ETH, WETH, or Base USDC first. Never auto-sell a tokenized stock, NFT, Crew reward credit, or unrelated asset. Never use another chain, wallet, recipient, or Punk Town's one-way fee adapter.",
      primaryRule: `Use Bankr's native same-chain exact-output swap action for exactly ${formatUnits(deficit, 18)} BAES at the pinned contract address on Base. Invoke the current agent's native swap capability directly; do not recursively call /agent/prompt. Require Bankr's fresh preview to show the source asset, maximum source spend, fees, price impact, exact BAES output, and slippage. Run bind-acquisition in bankr-native-exact-output mode, then obtain explicit confirmation for its concrete acquisitionAuthorizationKey plus the unchanged targetConfirmationKey.`,
      requestBindingRule: `The acquisitionRequestKey ${requestKey} binds the wallet, Base, BAES deficit, slippage ceiling, and target Punk Town plan. It is an integrity request only; it cannot authorize a source asset or spend amount that Bankr has not yet quoted.`,
      fallbackRule: "If native exact-output is unavailable but direct Wallet API access exists, use POST /wallet/swap-quote with exact source amounts until minBuyAmount covers the deficit, then run bind-acquisition in wallet-api-exact-input mode with this request context/key and the fresh quote. Confirm its acquisitionAuthorizationKey before one exact-input POST /wallet/swap. Never treat an estimated output as a floor.",
      executionRule: "Never use /wallet/submit or hand-built DEX calldata for BAES acquisition. Never execute a swap whose concrete source token and maximum source spend were not shown and confirmed.",
      successRule: `Accept one acquisition attempt only after Bankr reports a successful mined swap and a fresh Base balanceOf read proves at least ${required} BAES base units. A hash, pending response, HTTP 2xx, or quoted output is not success.`,
      unknownOutcomeRule: "Never blind-retry a timeout, 504, ambiguous 502, pending transaction, or missing confirmation. Recover the original hash/outcome from Bankr activity and Base before any new swap.",
    },
    next: `After one confirmed Bankr BAES acquisition, run exactly: ${resume}. Continue only if the fresh planner no longer returns acquire-baes. If the balance is still short, stop and obtain a new concrete quote and confirmation; do not buy twice under the old authorization.`,
  });
  return { emitted: true, balance };
}

async function bindAcquisition() {
  const wallet = walletArg();
  const parsedContext = decodeInspectionContext(need("request-context"));
  const suppliedRequestKey = need("request-key").toLowerCase();
  gate(/^0x[0-9a-f]{64}$/.test(suppliedRequestKey), "args", "--request-key must be the 32-byte acquisitionRequestKey from a fresh planner");
  gate(parsedContext.context.action === "acquire-baes-request", "acquisition-binding", "request context is not a BAES acquisition request");
  const request = parsedContext.context.terms;
  const computedRequestKey = confirmationKey("acquire-baes-request", request);
  gate(computedRequestKey === suppliedRequestKey, "acquisition-binding", "request context does not match acquisitionRequestKey", {
    suppliedRequestKey,
    computedRequestKey,
  });
  gate(Number(request.chainId) === 8453, "acquisition-binding", "acquisition request must stay on Base 8453");
  gate(normalizeAddress(request.wallet) === wallet, "acquisition-binding", "active wallet does not match the acquisition request");
  gate(normalizeAddress(request.outputToken) === normalizeAddress(ADDR.baes), "acquisition-binding", "acquisition output is not the pinned BAES token");
  const minimumOutput = BigInt(request.minimumOutput);
  gate(minimumOutput > 0n, "acquisition-binding", "acquisition minimum output must be positive");
  const maxSlippageBps = BigInt(request.maxSlippageBps);
  gate(maxSlippageBps >= 10n && maxSlippageBps <= 1000n, "acquisition-binding", "acquisition slippage is outside the planner bound");

  const mode = need("mode");
  gate(
    mode === "bankr-native-exact-output" || mode === "wallet-api-exact-input",
    "args",
    "--mode must be bankr-native-exact-output or wallet-api-exact-input",
  );
  const requestedSourceToken = normalizeAddress(need("source-token"));
  // Bankr surfaces both the zero address and 0xEeee... for Base ETH. Bind
  // either spelling to one canonical API/receipt representation so the same
  // preview cannot produce different authorization keys.
  const sourceToken = isNativeToken(requestedSourceToken) ? BANKR_NATIVE_TOKEN : requestedSourceToken;
  const source = acquisitionSource(sourceToken);
  gate(source, "acquisition-quote", "source token must be native ETH, WETH, or official Base USDC on Base");
  const suppliedSourceSymbol = optionalBoundedTextArg("source-symbol", { maxLength: 32, pattern: /^[A-Za-z0-9._+\- ]+$/ });
  if (suppliedSourceSymbol !== null) {
    gate(suppliedSourceSymbol.toUpperCase() === source.symbol, "acquisition-quote", `source symbol must match ${source.symbol} for the bound address`);
  }
  const sourceSymbol = source.symbol;
  const sourceDecimals = Number(integerArg("source-decimals", { min: 0n, max: 255n }));
  gate(sourceDecimals === source.decimals, "acquisition-quote", `${source.symbol} must use ${source.decimals} decimals`);
  const sourceAmount = amountArg("source-amount", sourceDecimals);
  const minBaesOut = amountArg("min-baes-out", 18);
  if (mode === "bankr-native-exact-output") {
    gate(minBaesOut === minimumOutput, "acquisition-quote", "Bankr exact-output preview must equal the requested BAES deficit", {
      minBaesOut,
      requiredExactBaesOut: minimumOutput,
    });
  } else {
    gate(minBaesOut >= minimumOutput, "acquisition-quote", "Bankr quote minBuyAmount does not cover the BAES deficit", {
      minBaesOut,
      requiredMinBaesOut: minimumOutput,
    });
  }
  const idempotencyKey = optionalBoundedTextArg("idempotency-key", {
    maxLength: 36,
    pattern: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
  });
  if (mode === "wallet-api-exact-input") {
    gate(idempotencyKey, "args", "--idempotency-key is required for wallet-api-exact-input");
  } else {
    gate(idempotencyKey === null, "args", "--idempotency-key applies only to wallet-api-exact-input");
  }
  const quoteId = optionalBoundedTextArg("quote-id", { maxLength: 256 });
  const feeBps = integerArg("fee-bps", { min: 0n, max: 10_000n, required: false });
  const priceImpactBps = integerArg("price-impact-bps", { min: 0n, max: 1_000_000n, required: false });
  const swapImpactBps = integerArg("swap-impact-bps", { min: 0n, max: 1_000_000n, required: false });
  const maxPriceImpactBps = integerArg("max-price-impact-bps", { min: 0n, max: 1_000_000n, required: false });
  const networkCostsUsd = optionalBoundedTextArg("network-costs-usd", {
    maxLength: 64,
    pattern: /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/,
  });
  const canonicalSourceAmount = formatUnits(sourceAmount, sourceDecimals);
  const canonicalMinBaesOut = formatUnits(minBaesOut, 18);
  const execution = mode === "wallet-api-exact-input"
    ? {
        endpoint: "/wallet/swap",
        request: {
          fromChain: "base",
          fromToken: sourceToken,
          toChain: "base",
          toToken: normalizeAddress(ADDR.baes),
          amount: canonicalSourceAmount,
          minBuyAmount: canonicalMinBaesOut,
          slippageBps: Number(maxSlippageBps),
          ...(quoteId ? { quoteId } : {}),
          idempotencyKey: idempotencyKey.toLowerCase(),
        },
      }
    : {
        capability: "Bankr native same-chain exact-output swap",
        intent: {
          fromChain: "base",
          fromToken: sourceToken,
          toChain: "base",
          toToken: normalizeAddress(ADDR.baes),
          exactOutput: formatUnits(minimumOutput, 18),
          maxSourceAmount: canonicalSourceAmount,
          slippageBps: Number(maxSlippageBps),
          ...(quoteId ? { quoteId } : {}),
        },
      };
  const authorizationTerms = {
    chainId: 8453,
    wallet,
    mode,
    acquisitionRequestKey: suppliedRequestKey,
    targetAction: request.targetAction,
    targetConfirmationKey: request.targetConfirmationKey,
    startingBaesBalance: BigInt(request.startingBalance),
    requiredBaesBalance: BigInt(request.requiredBalance),
    quote: {
      sourceToken,
      sourceSymbol,
      sourceDecimals,
      sourceAmountMode: mode === "wallet-api-exact-input" ? "exact-input" : "maximum-input",
      sourceAmount,
      sourceAmountHuman: canonicalSourceAmount,
      outputToken: normalizeAddress(ADDR.baes),
      minBaesOut,
      minBaesOutHuman: canonicalMinBaesOut,
      requestedMinimumBaesOut: minimumOutput,
      requestedMinimumBaesOutHuman: formatUnits(minimumOutput, 18),
      slippageBps: maxSlippageBps,
      feeBps,
      priceImpactBps,
      swapImpactBps,
      maxPriceImpactBps,
      networkCostsUsd,
      quoteId,
      idempotencyKey: idempotencyKey?.toLowerCase() ?? null,
    },
    execution,
  };
  const acquisitionAuthorizationKey = confirmationKey("authorize-baes-acquisition", authorizationTerms);
  const authorizationContext = encodeInspectionContext("authorize-baes-acquisition", authorizationTerms);
  // Symbols are caller-supplied display metadata. Always pair them with the
  // canonical address so a misleading symbol cannot hide the asset being sold.
  const sourceLabel = `${sourceSymbol} (${sourceToken})`;
  const optionalCosts = [
    feeBps === null ? null : `Bankr fee ${feeBps} bps`,
    priceImpactBps === null ? null : `display price impact ${priceImpactBps} bps`,
    swapImpactBps === null ? null : `fee-exclusive swap impact ${swapImpactBps} bps`,
    maxPriceImpactBps === null ? null : `wallet max price-impact protection ${maxPriceImpactBps} bps`,
    networkCostsUsd === null ? null : `estimated network cost $${networkCostsUsd}`,
  ].filter(Boolean);
  out({
    ok: true,
    command,
    phase: "acquisition-authorization",
    wallet,
    acquisitionRequestKey: suppliedRequestKey,
    targetAction: request.targetAction,
    targetConfirmationKey: request.targetConfirmationKey,
    authorizationTerms,
    authorizationContext: authorizationContext.context,
    authorizationContextHex: authorizationContext.hex,
    acquisitionAuthorizationKey,
    report: `On Base, spend ${mode === "wallet-api-exact-input" ? "exactly" : "at most"} ${canonicalSourceAmount} ${sourceLabel} for at least ${canonicalMinBaesOut} BAES, with ${maxSlippageBps} bps quoted slippage${optionalCosts.length ? `, ${optionalCosts.join(", ")}` : ""}; then continue only the separately bound ${request.targetAction} plan?`,
    execution,
    confirmationRule: "Show this report plus the target Punk Town plan. Obtain one explicit confirmation for this exact acquisitionAuthorizationKey and unchanged targetConfirmationKey. Any source token, source amount, minimum BAES output, fee/impact, quote, slippage, wallet, chain, idempotency key, or target-plan change requires a new binding and confirmation.",
    submitRule: mode === "wallet-api-exact-input"
      ? "POST exactly execution.request to Bankr /wallet/swap once. A stale quoteId may be repriced, but the exact source amount and minBuyAmount remain hard bounds."
      : "Invoke the current Bankr agent's native exact-output swap capability once with execution.intent. Do not recursively call /agent/prompt. The source spend may not exceed maxSourceAmount.",
    verifyRule: "Require Bankr success:true and a mined hash, then run verify-acquisition with this authorizationContextHex and acquisitionAuthorizationKey. Never pass this object to /wallet/submit or inspect-calldata.",
  });
}

async function verifyAcquisition() {
  await deploymentGate();
  const wallet = walletArg();
  const parsedContext = decodeInspectionContext(need("authorization-context"));
  const suppliedAuthorizationKey = need("authorization-key").toLowerCase();
  gate(/^0x[0-9a-f]{64}$/.test(suppliedAuthorizationKey), "args", "--authorization-key must be the 32-byte acquisitionAuthorizationKey");
  gate(parsedContext.context.action === "authorize-baes-acquisition", "acquisition-binding", "authorization context is not a BAES acquisition authorization");
  const authorization = parsedContext.context.terms;
  const computedAuthorizationKey = confirmationKey("authorize-baes-acquisition", authorization);
  gate(computedAuthorizationKey === suppliedAuthorizationKey, "acquisition-binding", "authorization context does not match acquisitionAuthorizationKey", {
    suppliedAuthorizationKey,
    computedAuthorizationKey,
  });
  gate(Number(authorization.chainId) === 8453, "acquisition-binding", "acquisition authorization must stay on Base 8453");
  gate(normalizeAddress(authorization.wallet) === wallet, "acquisition-binding", "active wallet does not match the acquisition authorization");
  gate(
    authorization.mode === "bankr-native-exact-output" || authorization.mode === "wallet-api-exact-input",
    "acquisition-binding",
    "acquisition authorization mode is unsupported",
  );

  const hash = need("tx").toLowerCase();
  gate(/^0x[0-9a-f]{64}$/.test(hash), "args", "--tx must be a 32-byte transaction hash");
  const [transaction, receipt] = await Promise.all([getTransaction(hash), getReceipt(hash)]);
  gate(transaction && receipt, "acquisition-pending", "acquisition transaction is pending or unavailable; do not retry", { hash });
  gate(transaction.hash?.toLowerCase() === hash && receipt.transactionHash?.toLowerCase() === hash, "acquisition-receipt", "RPC transaction or receipt does not match the requested hash", { hash });
  const actualChainId = Number(BigInt(transaction.chainId));
  gate(actualChainId === 8453, "acquisition-receipt", "acquisition transaction is not on Base chainId 8453", { actualChainId });
  gate(BigInt(receipt.status) === 1n, "acquisition-receipt", "acquisition transaction mined with a reverted status", { hash });
  const executionEnvelope = resolveBankrExecution(transaction, wallet, "acquisition-receipt");
  const executionProof = await proveBankrExecutionReceipt(executionEnvelope, transaction, receipt, "acquisition-receipt");
  const logicalLogRange = executionProof?.userOperationEvent?.receiptLogRange ?? null;
  const logicalReceiptLogs = logicalLogRange
    ? receipt.logs.slice(logicalLogRange.start, logicalLogRange.end)
    : receipt.logs;

  const quote = authorization.quote;
  const sourceToken = normalizeAddress(quote.sourceToken);
  const source = acquisitionSource(sourceToken);
  gate(source, "acquisition-binding", "authorized source token is not native ETH, WETH, or official Base USDC on Base");
  gate(Number(quote.sourceDecimals) === source.decimals, "acquisition-binding", "authorized source token decimals do not match the verified source");
  gate(String(quote.sourceSymbol).toUpperCase() === source.symbol, "acquisition-binding", "authorized source symbol does not match the verified source");
  gate(normalizeAddress(quote.outputToken) === normalizeAddress(ADDR.baes), "acquisition-binding", "authorized output token is not pinned BAES");
  const sourceLimit = BigInt(quote.sourceAmount);
  const minBaesOut = BigInt(quote.minBaesOut);
  gate(sourceLimit > 0n && minBaesOut > 0n, "acquisition-binding", "authorized source and output bounds must be positive");
  const expectedSourceAmountMode = authorization.mode === "wallet-api-exact-input" ? "exact-input" : "maximum-input";
  gate(quote.sourceAmountMode === expectedSourceAmountMode, "acquisition-binding", "authorized source amount mode does not match the acquisition mode");
  const requestedMinimumBaesOut = BigInt(quote.requestedMinimumBaesOut);
  gate(requestedMinimumBaesOut > 0n, "acquisition-binding", "requested BAES output must be positive");
  if (authorization.mode === "bankr-native-exact-output") {
    gate(minBaesOut === requestedMinimumBaesOut, "acquisition-binding", "native exact-output authorization does not bind the requested BAES amount exactly");
    gate(quote.idempotencyKey === null, "acquisition-binding", "native exact-output authorization must not carry a Wallet API idempotency key");
  } else {
    gate(minBaesOut >= requestedMinimumBaesOut, "acquisition-binding", "Wallet API authorization minimum does not cover the requested BAES amount");
    gate(typeof quote.idempotencyKey === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(quote.idempotencyKey), "acquisition-binding", "Wallet API authorization has no canonical UUID idempotency key");
  }
  let baesReceived;
  let sourceAmountObserved;
  try {
    const baesIncoming = sumCanonicalErc20Transfers(logicalReceiptLogs, ADDR.baes, "to", wallet);
    const baesOutgoing = sumCanonicalErc20Transfers(logicalReceiptLogs, ADDR.baes, "from", wallet);
    gate(baesIncoming >= baesOutgoing, "acquisition-receipt", "acquisition has no positive net BAES transfer to the wallet", {
      baesIncoming,
      baesOutgoing,
    });
    baesReceived = baesIncoming - baesOutgoing;
    if (source.kind === "native") {
      sourceAmountObserved = executionEnvelope.logicalCall.value;
    } else {
      const sourceOutgoing = sumCanonicalErc20Transfers(logicalReceiptLogs, sourceToken, "from", wallet);
      const sourceIncoming = sumCanonicalErc20Transfers(logicalReceiptLogs, sourceToken, "to", wallet);
      gate(sourceOutgoing >= sourceIncoming, "acquisition-receipt", "acquisition has no positive net source-token debit", {
        sourceOutgoing,
        sourceIncoming,
      });
      sourceAmountObserved = sourceOutgoing - sourceIncoming;
    }
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError("acquisition-receipt", `receipt transfer proof is malformed: ${error.message}`);
  }
  const nativeSource = isNativeToken(sourceToken);
  gate(sourceAmountObserved > 0n, "acquisition-receipt", "acquisition receipt does not prove any bound source input");
  gate(sourceAmountObserved <= sourceLimit, "acquisition-receipt", "acquisition source input exceeded the confirmed bound", {
    sourceAmountObserved,
    sourceLimit,
  });
  if (authorization.mode === "wallet-api-exact-input") {
    gate(sourceAmountObserved === sourceLimit, "acquisition-receipt", "Wallet API exact-input source debit or native value does not equal the confirmed input", {
      sourceAmountObserved,
      expected: sourceLimit,
    });
  }
  gate(baesReceived >= minBaesOut, "acquisition-receipt", "acquisition BAES receipt is below the confirmed minimum", {
    baesReceived,
    minBaesOut,
  });
  const currentBaesBalance = await readUint(ADDR.baes, SIG.balanceOf, ["address"], [wallet]);
  const requiredBaesBalance = BigInt(authorization.requiredBaesBalance);
  gate(currentBaesBalance >= requiredBaesBalance, "acquisition-balance", "fresh BAES balance is still below the target action requirement", {
    currentBaesBalance,
    requiredBaesBalance,
  });

  out({
    ok: true,
    command,
    phase: "acquisition-verified",
    hash,
    blockNumber: BigInt(receipt.blockNumber),
    wallet,
    mode: authorization.mode,
    executionMode: executionEnvelope.mode,
    logicalTarget: executionEnvelope.logicalCall.target,
    outerFrom: executionEnvelope.outer.from,
    outerTarget: executionEnvelope.outer.target,
    executionProof,
    logicalReceiptLogRange: logicalLogRange,
    sourceToken,
    sourceAmountObserved,
    sourceObservation: nativeSource
      ? executionEnvelope.mode === "direct-wallet-transaction"
        ? "native-transaction-value-sent"
        : "native-logical-call-value-sent"
      : "erc20-net-transfer-debit",
    sourceLimit,
    baesReceived,
    minBaesOut,
    currentBaesBalance,
    requiredBaesBalance,
    acquisitionAuthorizationKey: computedAuthorizationKey,
    targetAction: authorization.targetAction,
    targetConfirmationKey: authorization.targetConfirmationKey,
    proofScope: "Exactly one supported Bankr wallet execution, its successful EntryPoint user operation when sponsored, canonical ERC-20 net debit or logical-call native-value bound, net BAES transfer floor, and fresh balance; no local DEX target, router calldata, approval, native refund, or exact native net-spend claim",
    next: "Run the exact resume planner command from the original acquire-baes output. Continue only if it no longer requests acquisition and its targetConfirmationKey remains unchanged.",
  });
}

async function nftApproval(spender, tokenId, wallet, label) {
  let owner;
  try {
    owner = await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [tokenId]);
  } catch {
    throw new GateError("ownership", `Bario Punk #${tokenId} does not exist or ownerOf reverted`);
  }
  gate(owner === wallet, "ownership", `Bario Punk #${tokenId} is not owned by the active Bankr wallet`, { owner, wallet });
  const approved = await readAddress(ADDR.punks, SIG.getApproved, ["uint256"], [tokenId]);
  if (approved === normalizeAddress(spender)) return { tx: null, owner, approved };
  return {
    tx: unsignedTx(ADDR.punks, encodeCall(SIG.approve, ["address", "uint256"], [spender, tokenId]), `token-specific approve: ${label}`),
    owner,
    approved,
  };
}

async function feeQuote(wallet) {
  const slippageBps = args["slippage-bps"] === undefined ? 300n : integerArg("slippage-bps", { min: 1n, max: 1000n });
  const quote = decodeUint(await call(ADDR.feeRouter, "quoteExactBAESForWETH(uint256)", ["uint256"], [FEE], wallet));
  gate(quote > 0n, "quote", "fee adapter returned a zero WETH quote");
  const minWethOut = quote * (10_000n - slippageBps) / 10_000n;
  gate(minWethOut > 0n, "quote", "computed minWethOut is zero");
  const block = await latestBlock();
  return { quote, minWethOut, slippageBps, deadline: block.timestamp + 600n, quoteBlock: block.number };
}

async function getPosition(positionId) {
  const position = decodePosition(await call(ADDR.lockVault, "positions(uint256)", ["uint256"], [positionId]));
  gate(position.beneficiary !== ZERO_ADDRESS, "position", `position ${positionId} does not exist`);
  return { id: positionId, ...position };
}

async function requireLifetimeToken(token) {
  gate(token !== normalizeAddress(ADDR.weth), "token", "WETH is not claimable stock credit");
  const tokens = await distributedTokens();
  gate(tokens.includes(token), "token", "token is not in StockLock's lifetime distributed-token list");
  return tokens;
}

async function commandVerify() {
  const result = await verifyDeployment();
  out({ ok: result.ok, command, ...result }, result.ok ? 0 : 1);
}

async function commandStatus() {
  const deployment = await deploymentGate();
  out({ ok: true, command, deployment, status: await protocolStatus() });
}

async function commandInventory() {
  const deployment = await deploymentGate();
  const cursor = args.cursor === undefined ? 0n : integerArg("cursor");
  const limit = args.limit === undefined ? 100n : integerArg("limit", { min: 1n, max: 100n });
  out({ ok: true, command, deployment, inventory: await inventoryPage(cursor, limit) });
}

async function commandPunk() {
  const deployment = await deploymentGate();
  const wallet = walletArg();
  const tokenId = integerArg("token-id", { min: 1n });
  const [owner, approved, transferValidator] = await Promise.all([
    readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [tokenId]),
    readAddress(ADDR.punks, SIG.getApproved, ["uint256"], [tokenId]),
    readAddress(ADDR.punks, SIG.getTransferValidator).catch(() => null),
  ]);
  out({ ok: true, command, deployment, wallet, tokenId, owner, ownedByWallet: owner === wallet, approved, transferValidator });
}

async function commandCrew() {
  const deployment = await deploymentGate();
  const wallet = walletArg();
  out({ ok: true, command, deployment, wallet, positions: await walletCrew(wallet), tiers: TIERS });
}

async function commandRewards() {
  const deployment = await deploymentGate();
  const wallet = walletArg();
  out({ ok: true, command, deployment, wallet, rewards: await walletRewards(wallet) });
}

async function planBuy() {
  await deploymentGate();
  await routeGate("fee");
  const wallet = walletArg();
  const joinCrew = booleanFlag("join");
  const maxAcquisitionSlippageBps = acquisitionSlippageBps();
  const inventoryCount = await readUint(ADDR.punkAMM, "inventoryCount()");
  gate(inventoryCount > 0n, "inventory", "Punk Town desk inventory is empty");
  const tokenId = await readUint(ADDR.punkAMM, "fifoHead()");
  let headOwner;
  try {
    headOwner = await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [tokenId]);
  } catch {
    throw new GateError("fifo-custody", `FIFO head #${tokenId} ownerOf reverted; use the proven broken-head repair flow instead of buy`);
  }
  gate(headOwner === normalizeAddress(ADDR.punkAMM), "fifo-custody", `PunkAMM no longer owns FIFO head #${tokenId}; do not submit buy`, { headOwner });
  if (args["expected-token-id"] !== undefined) {
    const expected = integerArg("expected-token-id", { min: 1n });
    gate(tokenId === expected, "fifo-head", `FIFO head changed from #${expected} to #${tokenId}; do not buy a different Punk silently`, {
      expected, actual: tokenId,
    });
  }
  const quote = await feeQuote(wallet);
  const codeBearingWallet = (await getCode(wallet)) !== "0x";
  const terms = {
    tokenId,
    maxBaesIn: BUY_TOTAL,
    slippageBps: quote.slippageBps,
    recipient: wallet,
    joinCrew,
    funding: {
      token: normalizeAddress(ADDR.baes),
      requiredBaes: BUY_TOTAL,
      acquireIfShort: true,
      maxSlippageBps: maxAcquisitionSlippageBps,
    },
    approval: { token: normalizeAddress(ADDR.baes), spender: normalizeAddress(ADDR.punkAMM), exactAmount: BUY_TOTAL },
  };
  const report = joinCrew
    ? `Buy FIFO head Bario Punk #${tokenId} for exactly ${formatUnits(BUY_TOTAL, 18)} BAES max, using at most ${quote.slippageBps} bps WETH fee-conversion slippage and an exact PunkAMM BAES approval if needed; after verified ownership, ask which Crew tier to enter before spending any tier BAES?`
    : `Buy FIFO head Bario Punk #${tokenId} for exactly ${formatUnits(BUY_TOTAL, 18)} BAES max, using at most ${quote.slippageBps} bps WETH fee-conversion slippage and an exact PunkAMM BAES approval if needed?`;
  const warnings = codeBearingWallet
    ? ["The wallet has bytecode. The successful preflight is required evidence that the current ERC721-C validator/receiver path accepts this wallet."]
    : [];
  const resume = `node scripts/punktown.mjs plan-buy --wallet ${wallet} --expected-token-id ${tokenId} --slippage-bps ${quote.slippageBps} --acquisition-slippage-bps ${maxAcquisitionSlippageBps}${joinCrew ? " --join" : ""}`;
  const acquisition = await baesAcquisitionPlan({
    action: "buy",
    wallet,
    required: BUY_TOTAL,
    maxSlippageBps: maxAcquisitionSlippageBps,
    terms,
    report,
    warnings,
    resume,
  });
  if (acquisition.emitted) return;
  const approval = await erc20Approval(ADDR.baes, ADDR.punkAMM, BUY_TOTAL, wallet, "6,600,000 BAES for PunkAMM buy");
  if (approval.tx) {
    out(await approvalPlan({
      action: "buy",
      wallet,
      approvals: [approval.tx],
      after: resume,
      terms,
      report,
      warnings,
      reads: {
        fifoHead: tokenId, headOwner, baesBalance: approval.balance, currentAllowance: approval.allowance,
        exactAllowance: BUY_TOTAL, quoteWethOut: quote.quote, minWethOut: quote.minWethOut,
        quoteBlock: quote.quoteBlock, deadline: quote.deadline,
      },
    }));
    return;
  }
  const tx = unsignedTx(
    ADDR.punkAMM,
    encodeCall(SIG.buy, ["uint256", "uint256", "uint256", "uint256"], [tokenId, BUY_TOTAL, quote.minWethOut, quote.deadline]),
    `buy FIFO head Bario Punk #${tokenId}`,
  );
  out(await finalPlan({
    action: "buy",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["NFTBought", "ConversionFeeSwapped", "RevenueDeposited"],
    postconditions: [`BarioPunks.ownerOf(${tokenId}) == ${wallet}`, "NFTBought.baesIn == 6600000e18", "receipt.status == success"],
    warnings,
    reads: { fifoHead: tokenId, headOwner, inventoryCount, quoteWethOut: quote.quote, minWethOut: quote.minWethOut, quoteBlock: quote.quoteBlock, deadline: quote.deadline },
    afterSuccess: joinCrew ? {
      action: "ask-crew-tier",
      tokenId,
      instruction: "Only after the receipt proof and fresh ownerOf read pass, tell the user the Punk is in their wallet and ask which Crew tier they want. Do not select or buy tier BAES before they answer.",
      choices: TIERS.map((tier) => ({ id: tier.id, name: tier.name, costBaes: formatUnits(tier.cost, 18), costRaw: tier.cost, weight: tier.weight })),
    } : null,
  }));
}

async function planSell() {
  await deploymentGate();
  await routeGate("fee");
  const wallet = walletArg();
  const tokenId = integerArg("token-id", { min: 1n });
  const sellCapacity = await readUint(ADDR.punkAMM, "sellCapacity()");
  gate(sellCapacity > 0n, "reserve", "Punk Town desk does not currently have principal capacity for a sell");
  const [deskTracked, vaultTracked] = await Promise.all([
    readBool(ADDR.punkAMM, "trackedToken(uint256)", ["uint256"], [tokenId]),
    readBool(ADDR.lockVault, "trackedNFT(uint256)", ["uint256"], [tokenId]),
  ]);
  gate(!deskTracked && !vaultTracked, "tracking", `Bario Punk #${tokenId} is already tracked by a protocol custody surface`, { deskTracked, vaultTracked });
  const quote = await feeQuote(wallet);
  const terms = {
    tokenId,
    exactBaesOut: SELL_PAYOUT,
    slippageBps: quote.slippageBps,
    recipient: wallet,
    approval: { token: normalizeAddress(ADDR.punks), spender: normalizeAddress(ADDR.punkAMM), tokenId },
  };
  const report = `Sell Bario Punk #${tokenId} to Punk Town and receive exactly ${formatUnits(SELL_PAYOUT, 18)} BAES, using at most ${quote.slippageBps} bps WETH fee-conversion slippage and a token-specific PunkAMM approval if needed?`;
  const warnings = ["The Bario Punks external ERC721-C validator is mutable outside Punk Town. The live simulation must succeed immediately before submission."];
  const approval = await nftApproval(ADDR.punkAMM, tokenId, wallet, `Bario Punk #${tokenId} -> PunkAMM`);
  if (approval.tx) {
    out(await approvalPlan({
      action: "sell",
      wallet,
      approvals: [approval.tx],
      after: `node scripts/punktown.mjs plan-sell --wallet ${wallet} --token-id ${tokenId} --slippage-bps ${quote.slippageBps}`,
      terms,
      report,
      warnings,
      reads: {
        owner: approval.owner, currentApproved: approval.approved, exactSpender: ADDR.punkAMM,
        sellCapacity, quoteWethOut: quote.quote, minWethOut: quote.minWethOut,
        quoteBlock: quote.quoteBlock, deadline: quote.deadline,
      },
    }));
    return;
  }
  const tx = unsignedTx(
    ADDR.punkAMM,
    encodeCall(SIG.sell, ["uint256", "uint256", "uint256", "uint256"], [tokenId, SELL_PAYOUT, quote.minWethOut, quote.deadline]),
    `sell Bario Punk #${tokenId} to Punk Town`,
  );
  out(await finalPlan({
    action: "sell",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["NFTSold", "ConversionFeeSwapped", "RevenueDeposited"],
    postconditions: [`BarioPunks.ownerOf(${tokenId}) == ${ADDR.punkAMM.toLowerCase()}`, "wallet BAES increase == 5400000e18", "receipt.status == success"],
    warnings,
    reads: { sellCapacity, quoteWethOut: quote.quote, minWethOut: quote.minWethOut, quoteBlock: quote.quoteBlock, deadline: quote.deadline },
  }));
}

async function planStake() {
  await deploymentGate();
  await routeGate("stock");
  const wallet = walletArg();
  const maxAcquisitionSlippageBps = acquisitionSlippageBps();
  const tokenId = integerArg("token-id", { min: 1n });
  const tierId = Number(integerArg("tier", { min: 0n, max: 4n }));
  const tier = TIERS[tierId];
  const beneficiary = args.beneficiary ? normalizeAddress(args.beneficiary) : wallet;
  gate(beneficiary !== ZERO_ADDRESS, "beneficiary", "beneficiary cannot be zero");
  const activeCount = await readUint(ADDR.lockVault, "activeCount()");
  gate(activeCount < 3333n, "crew-cap", "Crew active-position cap is full");
  const [deskTracked, vaultTracked] = await Promise.all([
    readBool(ADDR.punkAMM, "trackedToken(uint256)", ["uint256"], [tokenId]),
    readBool(ADDR.lockVault, "trackedNFT(uint256)", ["uint256"], [tokenId]),
  ]);
  gate(!deskTracked && !vaultTracked, "tracking", `Bario Punk #${tokenId} is already tracked by a protocol custody surface`, { deskTracked, vaultTracked });
  const terms = {
    tokenId,
    tier: tierId,
    tierName: tier.name,
    baesCost: tier.cost,
    weight: tier.weight,
    beneficiary,
    funding: {
      token: normalizeAddress(ADDR.baes),
      requiredBaes: tier.cost,
      acquireIfShort: true,
      maxSlippageBps: maxAcquisitionSlippageBps,
    },
    approvals: [
      { token: normalizeAddress(ADDR.baes), spender: normalizeAddress(ADDR.lockVault), exactAmount: tier.cost },
      { token: normalizeAddress(ADDR.punks), spender: normalizeAddress(ADDR.lockVault), tokenId },
    ],
  };
  const report = `Add Bario Punk #${tokenId} to Crew at ${tier.name} tier for ${formatUnits(tier.cost, 18)} non-refundable BAES, beneficiary ${beneficiary}, using exact BAES and token-specific NFT approvals if needed?`;
  const warnings = [
    "Tier payment is never refunded on unstake; half burns and half enters the desk reserve.",
    ...(beneficiary !== wallet ? ["Beneficiary differs from depositor permanently: this wallet manages/unstakes the Punk, while the beneficiary owns reward claims."] : []),
  ];
  // Prove current ownership before asking Bankr to acquire non-refundable tier BAES.
  const punkApproval = await nftApproval(ADDR.lockVault, tokenId, wallet, `Bario Punk #${tokenId} -> LockVault`);
  const resume = `node scripts/punktown.mjs plan-stake --wallet ${wallet} --token-id ${tokenId} --tier ${tierId} --beneficiary ${beneficiary} --acquisition-slippage-bps ${maxAcquisitionSlippageBps}`;
  const acquisition = await baesAcquisitionPlan({
    action: "stake",
    wallet,
    required: tier.cost,
    maxSlippageBps: maxAcquisitionSlippageBps,
    terms,
    report,
    warnings,
    resume,
  });
  if (acquisition.emitted) return;
  const baesApproval = await erc20Approval(ADDR.baes, ADDR.lockVault, tier.cost, wallet, `${formatUnits(tier.cost, 18)} BAES for ${tier.name} stake`);
  const nextApproval = [baesApproval.tx, punkApproval.tx].find(Boolean);
  if (nextApproval) {
    out(await approvalPlan({
      action: "stake",
      wallet,
      approvals: [nextApproval],
      after: resume,
      terms,
      report,
      warnings,
      reads: { activeCount, baesBalance: baesApproval.balance, baesAllowance: baesApproval.allowance, punkApproved: punkApproval.approved },
    }));
    return;
  }
  const tx = unsignedTx(
    ADDR.lockVault,
    encodeCall(SIG.stake, ["uint256", "uint8", "address"], [tokenId, tierId, beneficiary]),
    `stake Bario Punk #${tokenId} in ${tier.name}`,
  );
  out(await finalPlan({
    action: "stake",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["PositionOpened"],
    postconditions: ["PositionOpened identifies the new positionId and tokenId", `BarioPunks.ownerOf(${tokenId}) == ${ADDR.lockVault.toLowerCase()}`, "receipt.status == success"],
    warnings,
    reads: { activeCount },
  }));
}

async function planUpgrade() {
  await deploymentGate();
  await routeGate("stock");
  const wallet = walletArg();
  const maxAcquisitionSlippageBps = acquisitionSlippageBps();
  const positionId = integerArg("position-id", { min: 1n });
  const newTierId = Number(integerArg("new-tier", { min: 0n, max: 4n }));
  const position = await getPosition(positionId);
  gate(position.active, "position", `position ${positionId} is not active`);
  gate(position.depositor === wallet, "depositor", "only the recorded depositor can upgrade this position", { depositor: position.depositor });
  gate(newTierId > position.tier, "tier", "Crew upgrades are upward-only");
  const oldTier = TIERS[position.tier];
  const newTier = TIERS[newTierId];
  const delta = newTier.cost - oldTier.cost;
  const terms = {
    positionId,
    fromTier: position.tier,
    toTier: newTierId,
    baesDelta: delta,
    newWeight: newTier.weight,
    funding: {
      token: normalizeAddress(ADDR.baes),
      requiredBaes: delta,
      acquireIfShort: true,
      maxSlippageBps: maxAcquisitionSlippageBps,
    },
    approval: { token: normalizeAddress(ADDR.baes), spender: normalizeAddress(ADDR.lockVault), exactAmount: delta },
  };
  const report = `Upgrade Crew position ${positionId} from ${oldTier.name} to ${newTier.name} for ${formatUnits(delta, 18)} additional non-refundable BAES, using an exact LockVault approval if needed?`;
  const warnings = ["The old weight settles first; the new weight never earns past conversions. Upgrade BAES is non-refundable."];
  const resume = `node scripts/punktown.mjs plan-upgrade --wallet ${wallet} --position-id ${positionId} --new-tier ${newTierId} --acquisition-slippage-bps ${maxAcquisitionSlippageBps}`;
  const acquisition = await baesAcquisitionPlan({
    action: "upgrade",
    wallet,
    required: delta,
    maxSlippageBps: maxAcquisitionSlippageBps,
    terms,
    report,
    warnings,
    resume,
  });
  if (acquisition.emitted) return;
  const approval = await erc20Approval(ADDR.baes, ADDR.lockVault, delta, wallet, `${formatUnits(delta, 18)} BAES upgrade delta`);
  if (approval.tx) {
    out(await approvalPlan({
      action: "upgrade",
      wallet,
      approvals: [approval.tx],
      after: resume,
      terms,
      report,
      warnings,
      reads: { position, delta, baesBalance: approval.balance, currentAllowance: approval.allowance },
    }));
    return;
  }
  const tx = unsignedTx(ADDR.lockVault, encodeCall(SIG.upgrade, ["uint256", "uint8"], [positionId, newTierId]), `upgrade Crew position ${positionId} to ${newTier.name}`);
  out(await finalPlan({
    action: "upgrade",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["PositionUpgraded", "CreditWritten only when nonzero old-weight rewards settle"],
    postconditions: [`positions(${positionId}).tier == ${newTierId}`, `positions(${positionId}).weight == ${newTier.weight}`, "receipt.status == success"],
    warnings,
    reads: { position },
  }));
}

async function planUnstake() {
  await deploymentGate();
  const wallet = walletArg();
  const positionId = integerArg("position-id", { min: 1n });
  const position = await getPosition(positionId);
  gate(position.active, "position", `position ${positionId} is not active`);
  gate(position.depositor === wallet, "depositor", "only the recorded depositor can unstake this position", { depositor: position.depositor });
  const [vaultTracked, currentOwner] = await Promise.all([
    readBool(ADDR.lockVault, "trackedNFT(uint256)", ["uint256"], [position.tokenId]),
    readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [position.tokenId]),
  ]);
  gate(vaultTracked && currentOwner === normalizeAddress(ADDR.lockVault), "custody", "active position NFT custody does not match LockVault tracking", { vaultTracked, currentOwner });
  const recipient = recipientArg(wallet);
  gate(recipient !== ZERO_ADDRESS, "recipient", "unstake recipient cannot be zero");
  const direct = recipient === wallet;
  const tx = unsignedTx(
    ADDR.lockVault,
    direct
      ? encodeCall(SIG.unstake, ["uint256"], [positionId])
      : encodeCall(SIG.unstakeTo, ["uint256", "address"], [positionId, recipient]),
    `unstake Crew position ${positionId} to ${recipient}`,
  );
  out(await finalPlan({
    action: "unstake",
    wallet,
    tx,
    terms: { positionId, tokenId: position.tokenId, recipient, beneficiary: position.beneficiary },
    report: `Close Crew position ${positionId} and send Bario Punk #${position.tokenId} to ${recipient}?`,
    expectedEvents: ["PositionClosed", "CreditWritten only when nonzero rewards settle"],
    postconditions: [`positions(${positionId}).active == false`, `BarioPunks.ownerOf(${position.tokenId}) == ${recipient}`, "receipt.status == success"],
    warnings: [
      "Unstake returns only the NFT; tier BAES is not refunded. Accrued stock credit remains owned by the recorded beneficiary.",
      "Route pauses do not block this exit, but the external Bario Punks ERC721-C validator can still block a transfer outside Punk Town's control.",
    ],
    reads: { position },
  }));
}

async function pendingForPosition(positionId) {
  const tokens = await distributedTokens();
  const pending = [];
  for (const token of tokens) {
    const amount = await readUint(ADDR.stockLock, "pendingStock(uint256,address)", ["uint256", "address"], [positionId, token]);
    if (amount > 0n) pending.push({ token, amount });
  }
  return pending;
}

async function planSettle() {
  await deploymentGate();
  const wallet = walletArg();
  const positionId = integerArg("position-id", { min: 1n });
  const position = await getPosition(positionId);
  const pending = await pendingForPosition(positionId);
  gate(pending.length > 0, "pending", `position ${positionId} has no nonzero unsettled stock at current state`);
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.settle, ["uint256"], [positionId]), `settle Crew position ${positionId}`);
  out(await finalPlan({
    action: "settle",
    wallet,
    tx,
    terms: { positionIds: [positionId], beneficiary: position.beneficiary, pendingByPosition: [{ positionId, pending }] },
    report: `Settle Crew position ${positionId} to beneficiary credit ${position.beneficiary}: ${pending.map(({ token, amount }) => `${token}=${amount}`).join("; ")}?`,
    expectedEvents: ["CreditWritten"],
    postconditions: pending.map(({ token }) => `pendingStock(${positionId}, ${token}) == 0 after receipt`),
    reads: { position, pending },
  }));
}

async function planSettleAll() {
  await deploymentGate();
  const wallet = walletArg();
  const positions = (await allPositions()).filter((position) => position.beneficiary === wallet);
  const settleable = [];
  const pendingByPosition = [];
  for (const position of positions) {
    const pending = await pendingForPosition(position.id);
    if (pending.length > 0) {
      settleable.push(position.id);
      pendingByPosition.push({ positionId: position.id, pending });
    }
    if (settleable.length === MAX_BATCH) break;
  }
  gate(settleable.length > 0, "pending", "no beneficiary-owned Crew position currently has unsettled stock");
  const signature = settleable.length === 1 ? SIG.settle : SIG.settleBatch;
  const types = settleable.length === 1 ? ["uint256"] : ["uint256[]"];
  const values = settleable.length === 1 ? [settleable[0]] : [settleable];
  const tx = unsignedTx(ADDR.stockLock, encodeCall(signature, types, values), `settle ${settleable.length} beneficiary position(s)`);
  out(await finalPlan({
    action: "settle-all",
    wallet,
    tx,
    terms: { positionIds: settleable, beneficiary: wallet, pendingByPosition },
    report: `Settle the next ${settleable.length} position(s) with these current pending rewards for ${wallet}: ${pendingByPosition.map(({ positionId, pending }) => `position ${positionId} [${pending.map(({ token, amount }) => `${token}=${amount}`).join(", ")}]`).join("; ")}?`,
    expectedEvents: ["CreditWritten"],
    postconditions: ["All listed positions' current pending rewards become stockCredit for the wallet", "receipt.status == success"],
    reads: { pendingByPosition, maxBatch: MAX_BATCH },
  }));
}

async function claimState(token, wallet) {
  await requireLifetimeToken(token);
  const [credit, metadata] = await Promise.all([
    readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, wallet]),
    readTokenMeta(token),
  ]);
  gate(credit > 0n, "credit", `wallet has no claimable ${metadata.symbol} credit`);
  return { credit, metadata };
}

async function planClaim() {
  await deploymentGate();
  const wallet = walletArg();
  const token = tokenArg();
  const recipient = recipientArg(wallet);
  const { credit, metadata } = await claimState(token, wallet);
  const direct = recipient === wallet;
  const tx = unsignedTx(
    ADDR.stockLock,
    direct ? encodeCall(SIG.claim, ["address"], [token]) : encodeCall(SIG.claimTo, ["address", "address"], [token, recipient]),
    `claim ${metadata.symbol} credit to ${recipient}`,
  );
  out(await finalPlan({
    action: "claim",
    wallet,
    tx,
    terms: { token, symbol: metadata.symbol, amount: credit, recipient },
    report: `Strict-claim ${metadata.decimals === null ? credit : formatUnits(credit, metadata.decimals)} ${metadata.symbol} to ${recipient}?`,
    expectedEvents: ["Claimed"],
    postconditions: [`stockCredit(${token}, ${wallet}) == 0`, "recipient receives the exact credited amount", "receipt.status == success"],
    reads: { credit, metadata },
  }));
}

async function planClaimBatch() {
  await deploymentGate();
  const wallet = walletArg();
  const tokens = tokenListArg();
  const recipient = recipientArg(wallet);
  const lifetime = await distributedTokens();
  for (const token of tokens) {
    gate(token !== normalizeAddress(ADDR.weth) && lifetime.includes(token), "token", `${token} is not a claimable lifetime stock token`);
  }
  const credits = [];
  for (const token of tokens) {
    const credit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, wallet]);
    const metadata = await readTokenMeta(token);
    credits.push({ token, credit, metadata });
  }
  gate(credits.some(({ credit }) => credit > 0n), "credit", "none of the requested tokens has claimable credit");
  const claims = credits.map(({ token, credit, metadata }) => ({ token, symbol: metadata.symbol, amount: credit }));
  const claimLines = claims.map(({ token, symbol, amount }) => `${symbol} (${token}): ${amount}`).join("; ");
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.claimBatch, ["address[]", "address"], [tokens, recipient]), `strict batch claim ${tokens.length} stock token(s)`);
  out(await finalPlan({
    action: "claim-batch",
    wallet,
    tx,
    terms: { claims, recipient },
    report: `Strict batch-claim these exact current credits to ${recipient}: ${claimLines}?`,
    expectedEvents: ["Claimed"],
    postconditions: ["Every nonzero listed credit becomes zero", "Every transfer delivers exactly its credit", "receipt.status == success"],
    warnings: ["Strict batch claim is atomic: if one token rejects or short-delivers, every token in the batch reverts. Use plan-claim-all for isolated per-token claims."],
    reads: { credits },
  }));
}

async function planClaimAll() {
  await deploymentGate();
  const wallet = walletArg();
  const recipient = recipientArg(wallet);
  const tokens = await distributedTokens();
  const claims = [];
  for (const token of tokens) {
    if (token === normalizeAddress(ADDR.weth)) continue;
    const credit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, wallet]);
    if (credit === 0n) continue;
    const metadata = await readTokenMeta(token);
    claims.push({ token, credit, metadata });
  }
  gate(claims.length > 0, "credit", "wallet has no claimable stock credit across the lifetime token list");
  const selected = claims[0];
  const tx = unsignedTx(
    ADDR.stockLock,
    encodeCall(SIG.claimTo, ["address", "address"], [selected.token, recipient]),
    `strict claim ${selected.metadata.symbol} to ${recipient}`,
  );
  const plan = await finalPlan({
    action: "claim-all-step",
    wallet,
    tx,
    terms: {
      recipient,
      selected: { token: selected.token, amount: selected.credit, symbol: selected.metadata.symbol },
      remainingTokenCountIncludingThis: claims.length,
    },
    report: `Claim-all step 1/${claims.length}: strict-claim ${selected.metadata.decimals === null ? selected.credit : formatUnits(selected.credit, selected.metadata.decimals)} ${selected.metadata.symbol} to ${recipient}?`,
    expectedEvents: ["Claimed"],
    postconditions: [`stockCredit(${selected.token}, ${wallet}) == 0`, "recipient receives the exact credited amount", "receipt.status == success"],
    warnings: ["Claim-all is deliberately one transaction per fresh plan. Stop on a failed/unknown receipt and never fall back to lossy claim automatically."],
    reads: { allCurrentClaims: claims },
  });
  plan.next = `After a successful receipt and postcondition check, re-run plan-claim-all --wallet ${wallet} --recipient ${recipient}. It will choose the next nonzero lifetime token, or report that none remain.`;
  out(plan);
}

async function planClaimLossy() {
  await deploymentGate();
  const wallet = walletArg();
  const token = tokenArg();
  const recipient = recipientArg(wallet);
  const { credit, metadata } = await claimState(token, wallet);
  gate(metadata.decimals !== null && metadata.decimals <= 36, "token-metadata", "token decimals are unavailable or unsafe to parse");
  const minReceived = amountArg("min-received", metadata.decimals);
  gate(minReceived > 0n && minReceived <= credit, "min-received", "lossy minimum must be positive and cannot exceed the full credit");
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.claimLossy, ["address", "address", "uint256"], [token, recipient, minReceived]), `LOSSY claim ${metadata.symbol} to ${recipient}`);
  out(await finalPlan({
    action: "claim-lossy",
    wallet,
    tx,
    terms: {
      token,
      symbol: metadata.symbol,
      fullCreditDebited: credit,
      executionDebitRule: "full-current-credit-at-execution",
      minReceived,
      recipient,
    },
    report: `LOSSY claim: irreversibly debit the full ${formatUnits(credit, metadata.decimals)} ${metadata.symbol} credit currently recorded while accepting as little as ${formatUnits(minReceived, metadata.decimals)} to ${recipient}? The contract debits the full credit at execution, which can increase if someone settles more rewards first.`,
    expectedEvents: ["ClaimedLossy"],
    postconditions: [`stockCredit(${token}, ${wallet}) == 0`, "delivered >= minReceived", "receipt.status == success"],
    warnings: [
      "DESTRUCTIVE DELIVERY CHOICE: the full credit is debited even if the token delivers less. Use only after a strict claim is proven stuck; never automate this fallback.",
      "The contract has no max-debit argument. A permissionless settlement mined between inspection and execution can increase the amount debited; the receipt proof will flag any drift but cannot undo it.",
    ],
    reads: { credit, metadata },
  }));
}

async function planForfeit() {
  await deploymentGate();
  const wallet = walletArg();
  const token = tokenArg();
  const { credit, metadata } = await claimState(token, wallet);
  gate(metadata.decimals !== null && metadata.decimals <= 36, "token-metadata", "token decimals are unavailable or unsafe to parse");
  const amount = amountArg("amount", metadata.decimals);
  gate(amount <= credit, "amount", "forfeit amount exceeds wallet credit");
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.forfeit, ["address", "uint256"], [token, amount]), `FORFEIT ${metadata.symbol} credit`);
  out(await finalPlan({
    action: "forfeit",
    wallet,
    tx,
    terms: { token, symbol: metadata.symbol, amount },
    report: `PERMANENTLY FORFEIT ${formatUnits(amount, metadata.decimals)} ${metadata.symbol} credit without receiving any tokens?`,
    expectedEvents: ["CreditForfeited"],
    postconditions: [`stockCredit decreases by exactly ${amount}`, "no token transfer occurs", "receipt.status == success"],
    warnings: ["DESTRUCTIVE AND IRREVERSIBLE: this burns claim credit for zero payment. Never suggest or execute it as normal cleanup."],
    reads: { credit, metadata },
  }));
}

async function planConvert() {
  await deploymentGate();
  await routeGate("stock");
  const wallet = walletArg();
  const amountIn = amountArg("amount-weth", 18);
  gate(amountIn >= MIN_CONVERT && amountIn <= MAX_CONVERT, "amount", `conversion must be between ${formatUnits(MIN_CONVERT, 18)} and ${formatUnits(MAX_CONVERT, 18)} WETH`);
  const [wethPot, totalWeight, rotationCursor, lastConvertBlock, block, distributedCount, bootstrapLocked, bootstrapRemainingSeconds, lastBootstrapAccrual] = await Promise.all([
    readUint(ADDR.stockLock, "wethPot()"),
    readUint(ADDR.lockVault, "totalWeight()"),
    readUint(ADDR.stockLock, "rotationCursor()"),
    readUint(ADDR.stockLock, "lastConvertBlock()"),
    latestBlock(),
    readUint(ADDR.stockLock, "distributedTokenCount()"),
    readUint(ADDR.stockLock, "bootstrapLocked()"),
    readUint(ADDR.stockLock, "bootstrapRemainingSeconds()"),
    readUint(ADDR.stockLock, "lastBootstrapAccrual()"),
  ]);
  gate(totalWeight > 0n, "weight", "no active Crew weight exists");
  let releasableBootstrap = 0n;
  if (bootstrapLocked > 0n && bootstrapRemainingSeconds > 0n && lastBootstrapAccrual > 0n && block.timestamp > lastBootstrapAccrual) {
    const elapsed = block.timestamp - lastBootstrapAccrual > bootstrapRemainingSeconds
      ? bootstrapRemainingSeconds
      : block.timestamp - lastBootstrapAccrual;
    releasableBootstrap = bootstrapLocked * elapsed / bootstrapRemainingSeconds;
  }
  const effectivePot = wethPot + releasableBootstrap;
  gate(amountIn <= effectivePot, "pot", "requested conversion exceeds the pot available after current bootstrap accrual", { wethPot, releasableBootstrap, effectivePot, amountIn });
  gate(lastConvertBlock !== block.number, "rate-limit", "a conversion already occurred in the latest block; retry on the next block");
  const next = await call(ADDR.stockAdapter, "nextEnabledFrom(uint256)", ["uint256"], [rotationCursor]);
  const slot = decodeUint(next, 0);
  const token = decodeAddress(next, 1);
  const alreadyDistributed = await readBool(ADDR.stockLock, "isDistributedToken(address)", ["address"], [token]);
  gate(alreadyDistributed || distributedCount < 16n, "token-cap", "next roster token would be a seventeenth lifetime distributed token; conversion is currently blocked");
  const bounty = amountIn / 100n;
  const swapIn = amountIn - bounty;
  let indicativeQuote = null;
  try {
    indicativeQuote = decodeUint(await call(ADDR.stockAdapter, "quoteWethToStock(address,uint256)", ["address", "uint256"], [token, swapIn], wallet));
  } catch { /* conversion has no quote gate by design; simulation remains authoritative */ }
  const metadata = await readTokenMeta(token);
  const deadline = block.timestamp + 300n;
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.convert, ["uint256", "uint256"], [amountIn, deadline]), `permissionless convert ${formatUnits(amountIn, 18)} WETH into next roster stock ${metadata.symbol}`);
  out(await finalPlan({
    action: "convert",
    wallet,
    tx,
    terms: {
      amountIn,
      currentObservedSlot: slot,
      currentObservedToken: token,
      currentObservedSymbol: metadata.symbol,
      executionTokenRule: "next-enabled-roster-token-at-execution",
      bounty,
      noPriceFloor: true,
    },
    report: `Permissionlessly convert ${formatUnits(amountIn, 18)} WETH from the pot into the next enabled roster token at execution (currently ${metadata.symbol}); caller bounty ${formatUnits(bounty, 18)} WETH? The token can rotate if another conversion lands first.`,
    expectedEvents: ["Converted"],
    postconditions: ["Converted.token is the contract-selected enabled roster token at execution", `Converted.bountyPaid == ${bounty}`, "stock output is nonzero", "receipt.status == success"],
    warnings: [
      "Stock conversion intentionally has minOut=0 and no oracle/TWAP price floor. The skill does not add a same-transaction quote gate; exposure is bounded by 0.5 WETH max and one conversion per block.",
      "The token observation is informational, not calldata-bound. A prior conversion can advance rotation before this transaction executes.",
    ],
    reads: { block: block.number, wethPot, releasableBootstrap, effectivePot, totalWeight, rotationCursor, slot, token, swapIn, indicativeQuote, deadline },
  }));
}

function sourceIdArg() {
  const value = args["source-id"] ?? "BANKR-PUNKTOWN";
  let sourceId;
  try {
    sourceId = typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
      ? value.toLowerCase()
      : asciiBytes32(String(value));
  } catch (error) {
    throw new GateError("args", `--source-id is invalid: ${error.message}`);
  }
  gate(sourceId !== `0x${"0".repeat(64)}`, "args", "--source-id cannot be zero");
  return sourceId;
}

async function planWethTopup() {
  await deploymentGate();
  const wallet = walletArg();
  const amount = amountArg("amount-weth", 18);
  const sourceId = sourceIdArg();
  const totalWeight = await readUint(ADDR.lockVault, "totalWeight()");
  const terms = {
    amount,
    sourceId,
    destinationAccounting: totalWeight === 0n ? "bootstrapLocked" : "wethPot",
    executionDestinationRule: "bootstrapLocked-if-zero-weight-else-wethPot",
    approval: { token: normalizeAddress(ADDR.weth), spender: normalizeAddress(ADDR.stockLock), exactAmount: amount },
  };
  const report = `Irreversibly top up StockLock with ${formatUnits(amount, 18)} WETH via depositTopUp (not a raw transfer), using an exact StockLock approval if needed? Current accounting destination: ${terms.destinationAccounting}; execution uses Crew weight at that time.`;
  const warnings = [
    "This is an irreversible donation. sourceId is only a label, not authentication.",
    "The accounting destination is selected at execution: zero Crew weight routes to bootstrapLocked; positive weight routes to wethPot.",
  ];
  const approval = await erc20Approval(ADDR.weth, ADDR.stockLock, amount, wallet, `${formatUnits(amount, 18)} WETH StockLock top-up`);
  if (approval.tx) {
    out(await approvalPlan({
      action: "weth-topup",
      wallet,
      approvals: [approval.tx],
      after: `node scripts/punktown.mjs plan-weth-topup --wallet ${wallet} --amount-weth ${args["amount-weth"]} --source-id ${sourceId}`,
      terms,
      report,
      warnings,
      reads: { balance: approval.balance, currentAllowance: approval.allowance, exactAllowance: amount, totalWeight },
    }));
    return;
  }
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.topUpWeth, ["uint256", "bytes32"], [amount, sourceId]), `deposit ${formatUnits(amount, 18)} WETH into StockLock accounting`);
  out(await finalPlan({
    action: "weth-topup",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["RevenueDeposited"],
    postconditions: [`RevenueDeposited.amount == ${amount}`, "RevenueDeposited.bootstrap reports zero/positive Crew weight at execution", "receipt.status == success"],
    warnings,
    reads: { totalWeight },
  }));
}

async function planReserveTopup() {
  await deploymentGate();
  const wallet = walletArg();
  const amount = amountArg("amount-baes", 18);
  const terms = {
    amount,
    approval: { token: normalizeAddress(ADDR.baes), spender: normalizeAddress(ADDR.punkAMM), exactAmount: amount },
  };
  const report = `Irreversibly add ${formatUnits(amount, 18)} BAES to the tracked PunkAMM reserve, using an exact PunkAMM approval if needed?`;
  const warnings = ["This is an irreversible reserve donation, not a deposit with withdrawal rights."];
  const approval = await erc20Approval(ADDR.baes, ADDR.punkAMM, amount, wallet, `${formatUnits(amount, 18)} BAES reserve top-up`);
  if (approval.tx) {
    out(await approvalPlan({
      action: "reserve-topup",
      wallet,
      approvals: [approval.tx],
      after: `node scripts/punktown.mjs plan-reserve-topup --wallet ${wallet} --amount-baes ${args["amount-baes"]}`,
      terms,
      report,
      warnings,
      reads: { balance: approval.balance, currentAllowance: approval.allowance, exactAllowance: amount },
    }));
    return;
  }
  const tx = unsignedTx(ADDR.punkAMM, encodeCall(SIG.topUpReserve, ["uint256"], [amount]), `top up PunkAMM reserve by ${formatUnits(amount, 18)} BAES`);
  out(await finalPlan({
    action: "reserve-topup",
    wallet,
    tx,
    terms,
    report,
    expectedEvents: ["ReserveToppedUp"],
    postconditions: [`trackedBAES increases by ${amount}`, "receipt.status == success"],
    warnings,
  }));
}

async function planSyncDonation() {
  await deploymentGate();
  const wallet = walletArg();
  const [rawBalance, trackedBAES] = await Promise.all([
    readUint(ADDR.baes, SIG.balanceOf, ["address"], [ADDR.punkAMM]),
    readUint(ADDR.punkAMM, "trackedBAES()"),
  ]);
  gate(rawBalance >= trackedBAES, "accounting", "raw PunkAMM BAES balance is below trackedBAES");
  const donation = rawBalance - trackedBAES;
  gate(donation > 0n, "donation", "there is no unsynchronized BAES donation");
  const tx = unsignedTx(ADDR.punkAMM, encodeCall(SIG.syncDonation), `sync ${formatUnits(donation, 18)} donated BAES into tracked reserve`);
  out(await finalPlan({
    action: "sync-donation",
    wallet,
    tx,
    terms: { donation, executionRule: "all-unsynchronized-baes-at-execution" },
    report: `Permissionlessly reconcile all unsynchronized BAES into the tracked PunkAMM reserve (currently ${formatUnits(donation, 18)} BAES)? The amount can increase if another donation arrives first.`,
    expectedEvents: ["DonationSynced"],
    postconditions: ["DonationSynced reports the full execution-time surplus (at least the freshly inspected amount)", "receipt.status == success"],
    warnings: ["The no-argument function reconciles the full donation surplus at execution; the current observed amount is not calldata-bound."],
    reads: { rawBalance, trackedBAES, donation },
  }));
}

async function planEvictHead() {
  await deploymentGate();
  const wallet = walletArg();
  const inventoryCount = await readUint(ADDR.punkAMM, "inventoryCount()");
  gate(inventoryCount > 0n, "inventory", "desk inventory is empty");
  const tokenId = await readUint(ADDR.punkAMM, "fifoHead()");
  let owner = null;
  let ownerOfReverted = false;
  try {
    owner = await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [tokenId]);
  } catch {
    ownerOfReverted = true;
  }
  gate(ownerOfReverted || owner !== normalizeAddress(ADDR.punkAMM), "head", "FIFO head is still held by PunkAMM and cannot be evicted", { tokenId, owner });
  const tx = unsignedTx(ADDR.punkAMM, encodeCall(SIG.evictHead), `evict proven-unowned FIFO head Bario Punk #${tokenId}`);
  out(await finalPlan({
    action: "evict-head",
    wallet,
    tx,
    terms: { tokenId, observedOwner: owner, ownerOfReverted, executionRule: "broken-fifo-head-at-execution" },
    report: `Permissionlessly remove the broken FIFO head at execution (currently #${tokenId}, which PunkAMM provably does not own)?`,
    expectedEvents: ["HeadEvicted"],
    postconditions: ["HeadEvicted names the execution-time FIFO head that was still proven unowned", "receipt.status == success"],
    warnings: [
      "This is maintenance for a proven broken head, not a normal buy retry.",
      "The function has no tokenId argument. If the FIFO changes before mining, the contract can only evict whichever execution-time head is still proven unowned.",
    ],
    reads: { inventoryCount, tokenId, owner, ownerOfReverted },
  }));
}

async function planPokeBootstrap() {
  await deploymentGate();
  const wallet = walletArg();
  const [bootstrapLocked, remainingSeconds, totalWeight, lastAccrual, wethPot] = await Promise.all([
    readUint(ADDR.stockLock, "bootstrapLocked()"),
    readUint(ADDR.stockLock, "bootstrapRemainingSeconds()"),
    readUint(ADDR.lockVault, "totalWeight()"),
    readUint(ADDR.stockLock, "lastBootstrapAccrual()"),
    readUint(ADDR.stockLock, "wethPot()"),
  ]);
  const canReleaseBootstrap = totalWeight > 0n && bootstrapLocked > 0n;
  const canRelockStrandedPot = totalWeight === 0n && wethPot > 0n;
  const canResetEmptyVaultAnchor = totalWeight === 0n && lastAccrual > 0n;
  gate(canReleaseBootstrap || canRelockStrandedPot || canResetEmptyVaultAnchor, "bootstrap", "pokeBootstrap would be a no-op at the current state");
  const mode = canRelockStrandedPot
    ? "relock-empty-vault-pot"
    : canResetEmptyVaultAnchor
      ? "reset-empty-vault-anchor"
      : "start-or-release-bootstrap";
  const tx = unsignedTx(ADDR.stockLock, encodeCall(SIG.pokeBootstrap), "permissionlessly advance bootstrap release accounting");
  out(await finalPlan({
    action: "poke-bootstrap",
    wallet,
    tx,
    terms: { bootstrapLocked, wethPot, remainingSeconds, totalWeight, lastAccrual, mode },
    report: canRelockStrandedPot
      ? `Reconcile the empty Crew vault by moving ${formatUnits(wethPot, 18)} stranded WETH pot back into bootstrap hold-back?`
      : canResetEmptyVaultAnchor
        ? "Reset the stale bootstrap accrual anchor now that Crew weight is zero?"
        : `Start or advance bootstrap accounting for ${formatUnits(bootstrapLocked, 18)} locked WETH while Crew weight is active?`,
    expectedEvents: ["BootstrapReleased (only if an amount accrues; first poke may only set the anchor)"],
    postconditions: ["bootstrap accounting remains conserved", "receipt.status == success"],
    warnings: ["If this is the first active poke it may only set an accrual anchor and emit no BootstrapReleased event."],
    reads: { bootstrapLocked, wethPot, remainingSeconds, totalWeight, lastAccrual },
  }));
}

function decodeRecognizedLog(log) {
  const topic = log.topics?.[0]?.toLowerCase();
  const event = EVENT_BY_TOPIC.get(topic);
  if (!event) return null;
  return {
    name: event.name,
    signature: event.signature,
    emitter: log.address,
    indexed: (log.topics ?? []).slice(1),
    data: log.data,
    logIndex: log.logIndex ? BigInt(log.logIndex) : null,
  };
}

const ACTION_INPUTS = Object.freeze({
  approve: ["address", "uint256"],
  buy: ["uint256", "uint256", "uint256", "uint256"],
  sell: ["uint256", "uint256", "uint256", "uint256"],
  "reserve-topup": ["uint256"],
  "sync-donation": [],
  "evict-head": [],
  stake: ["uint256", "uint8", "address"],
  upgrade: ["uint256", "uint8"],
  unstake: ["uint256"],
  "unstake-to": ["uint256", "address"],
  settle: ["uint256"],
  "settle-batch": ["uint256[]"],
  claim: ["address"],
  "claim-to": ["address", "address"],
  "claim-batch": ["address[]", "address"],
  "claim-lossy": ["address", "address", "uint256"],
  forfeit: ["address", "uint256"],
  convert: ["uint256", "uint256"],
  "weth-topup": ["uint256", "bytes32"],
  "poke-bootstrap": [],
});

function decodeKnownAction(action, data) {
  const inputTypes = ACTION_INPUTS[action.name];
  gate(inputTypes !== undefined, "allowlist", "recognized selector has no argument schema");
  try {
    return decodeCallArguments(inputTypes, data);
  } catch (error) {
    throw new GateError("calldata", error.message);
  }
}

function contextUint(value, label) {
  gate(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value), "plan-context", `${label} must be a canonical uint string`);
  return BigInt(value);
}

function contextAddress(value, label) {
  try {
    return normalizeAddress(value);
  } catch {
    throw new GateError("plan-context", `${label} must be a canonical address`);
  }
}

function contextNumber(value, label, min, max) {
  gate(Number.isInteger(value) && value >= min && value <= max, "plan-context", `${label} must be an integer between ${min} and ${max}`);
  return value;
}

function sameUint(actual, expected, label) {
  gate(actual === expected, "plan-context", `${label} does not match the confirmed planner context`, { actual, expected });
}

function sameAddress(actual, expected, label) {
  gate(normalizeAddress(actual) === normalizeAddress(expected), "plan-context", `${label} does not match the confirmed planner context`, { actual, expected });
}

async function requireExactErc20ActionApproval(token, spender, exactAmount, wallet, label) {
  const allowance = await readUint(token, SIG.allowance, ["address", "address"], [wallet, spender]);
  sameUint(allowance, exactAmount, `${label} allowance`);
  return allowance;
}

async function requireExactNftActionApproval(spender, tokenId, label) {
  const approved = await readAddress(ADDR.punks, SIG.getApproved, ["uint256"], [tokenId]);
  sameAddress(approved, spender, `${label} token-specific approval`);
  return approved;
}

async function validateApprovalContext(target, decodedArgs, wallet, context) {
  const { action: intent, terms } = context;
  const [spender, actualAmount] = decodedArgs;
  let token;
  let exactAmount;
  let tokenId;
  let expectedSpender;

  if (intent === "buy") {
    token = normalizeAddress(ADDR.baes);
    expectedSpender = normalizeAddress(ADDR.punkAMM);
    exactAmount = BUY_TOTAL;
    sameUint(contextUint(terms.maxBaesIn, "buy maxBaesIn"), BUY_TOTAL, "buy maxBaesIn");
  } else if (intent === "sell") {
    token = normalizeAddress(ADDR.punks);
    expectedSpender = normalizeAddress(ADDR.punkAMM);
    tokenId = contextUint(terms.tokenId, "sell tokenId");
  } else if (intent === "stake") {
    const tier = contextNumber(terms.tier, "stake tier", 0, 4);
    tokenId = contextUint(terms.tokenId, "stake tokenId");
    expectedSpender = normalizeAddress(ADDR.lockVault);
    if (target === normalizeAddress(ADDR.baes)) {
      token = normalizeAddress(ADDR.baes);
      exactAmount = TIERS[tier].cost;
      sameUint(contextUint(terms.baesCost, "stake baesCost"), exactAmount, "stake baesCost");
    } else {
      token = normalizeAddress(ADDR.punks);
    }
  } else if (intent === "upgrade") {
    const fromTier = contextNumber(terms.fromTier, "upgrade fromTier", 0, 4);
    const toTier = contextNumber(terms.toTier, "upgrade toTier", 0, 4);
    gate(toTier > fromTier, "plan-context", "upgrade context is not upward-only");
    token = normalizeAddress(ADDR.baes);
    expectedSpender = normalizeAddress(ADDR.lockVault);
    exactAmount = TIERS[toTier].cost - TIERS[fromTier].cost;
    sameUint(contextUint(terms.baesDelta, "upgrade baesDelta"), exactAmount, "upgrade baesDelta");
  } else if (intent === "weth-topup") {
    token = normalizeAddress(ADDR.weth);
    expectedSpender = normalizeAddress(ADDR.stockLock);
    exactAmount = contextUint(terms.amount, "WETH top-up amount");
  } else if (intent === "reserve-topup") {
    token = normalizeAddress(ADDR.baes);
    expectedSpender = normalizeAddress(ADDR.punkAMM);
    exactAmount = contextUint(terms.amount, "reserve top-up amount");
  } else {
    throw new GateError("plan-context", `approval is not valid for planner intent ${intent}`);
  }

  sameAddress(target, token, "approval token");
  sameAddress(spender, expectedSpender, "approval spender");
  if (token === normalizeAddress(ADDR.punks)) {
    sameUint(actualAmount, tokenId, "ERC721 tokenId");
    const [owner, approved] = await Promise.all([
      readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [tokenId]),
      readAddress(ADDR.punks, SIG.getApproved, ["uint256"], [tokenId]),
    ]);
    gate(owner === wallet, "ownership", "active wallet no longer owns the approval Punk", { owner, wallet, tokenId });
    gate(approved !== expectedSpender, "stale-plan", "token is already approved; re-run the planner for the action transaction");
    return { intent, tokenKind: "ERC721", token, spender, tokenId, owner, currentApproved: approved };
  }

  gate(exactAmount > 0n, "plan-context", "exact ERC20 approval amount must be nonzero");
  const [balance, allowance] = await Promise.all([
    readUint(token, SIG.balanceOf, ["address"], [wallet]),
    readUint(token, SIG.allowance, ["address", "address"], [wallet, spender]),
  ]);
  gate(balance >= exactAmount, "balance", "wallet balance is below the context-bound exact approval amount", { balance, exactAmount });
  if (actualAmount === 0n) {
    gate(allowance > 0n && allowance !== exactAmount, "approval-amount", "zero approval is allowed only to reset a current mismatched nonzero allowance", { allowance, exactAmount });
  } else {
    sameUint(actualAmount, exactAmount, "ERC20 approval amount");
    gate(allowance === 0n, "stale-plan", "exact approval is valid only from zero allowance; re-run the planner", { allowance });
  }
  return { intent, tokenKind: "ERC20", token, spender, exactAmount, submittedAmount: actualAmount, balance, currentAllowance: allowance };
}

const CONTEXT_ACTIONS = Object.freeze({
  buy: ["buy"],
  sell: ["sell"],
  stake: ["stake"],
  upgrade: ["upgrade"],
  unstake: ["unstake", "unstake-to"],
  settle: ["settle"],
  "settle-all": ["settle", "settle-batch"],
  claim: ["claim", "claim-to"],
  "claim-batch": ["claim-batch"],
  "claim-all-step": ["claim-to"],
  "claim-lossy": ["claim-lossy"],
  forfeit: ["forfeit"],
  convert: ["convert"],
  "weth-topup": ["weth-topup"],
  "reserve-topup": ["reserve-topup"],
  "sync-donation": ["sync-donation"],
  "evict-head": ["evict-head"],
  "poke-bootstrap": ["poke-bootstrap"],
});

async function validateActionContext(target, action, decodedArgs, wallet, context) {
  const { action: intent, terms } = context;
  const allowed = CONTEXT_ACTIONS[intent];
  gate(allowed?.includes(action.name), "plan-context", `selector ${action.name} does not match planner intent ${intent}`);

  if (intent === "buy" || intent === "sell") {
    sameUint(decodedArgs[0], contextUint(terms.tokenId, `${intent} tokenId`), `${intent} tokenId`);
    sameAddress(terms.recipient, wallet, `${intent} recipient`);
    const slippageBps = contextUint(terms.slippageBps, `${intent} slippageBps`);
    gate(slippageBps >= 1n && slippageBps <= 1000n, "plan-context", `${intent} slippageBps is outside 1..1000`);
    sameUint(decodedArgs[1], intent === "buy" ? BUY_TOTAL : SELL_PAYOUT, `${intent} fixed BAES amount`);
    if (intent === "buy") {
      await requireExactErc20ActionApproval(ADDR.baes, ADDR.punkAMM, BUY_TOTAL, wallet, "buy");
    } else {
      await requireExactNftActionApproval(ADDR.punkAMM, decodedArgs[0], "sell");
    }
  } else if (intent === "stake") {
    const tier = contextNumber(terms.tier, "stake tier", 0, 4);
    sameUint(decodedArgs[0], contextUint(terms.tokenId, "stake tokenId"), "stake tokenId");
    sameUint(decodedArgs[1], BigInt(tier), "stake tier");
    sameAddress(decodedArgs[2], contextAddress(terms.beneficiary, "stake beneficiary"), "stake beneficiary");
    sameUint(contextUint(terms.baesCost, "stake baesCost"), TIERS[tier].cost, "stake tier cost");
    await Promise.all([
      requireExactErc20ActionApproval(ADDR.baes, ADDR.lockVault, TIERS[tier].cost, wallet, "stake"),
      requireExactNftActionApproval(ADDR.lockVault, decodedArgs[0], "stake"),
    ]);
  } else if (intent === "upgrade") {
    const fromTier = contextNumber(terms.fromTier, "upgrade fromTier", 0, 4);
    const toTier = contextNumber(terms.toTier, "upgrade toTier", 0, 4);
    gate(toTier > fromTier, "plan-context", "upgrade context is not upward-only");
    sameUint(decodedArgs[0], contextUint(terms.positionId, "upgrade positionId"), "upgrade positionId");
    sameUint(decodedArgs[1], BigInt(toTier), "upgrade toTier");
    sameUint(contextUint(terms.baesDelta, "upgrade baesDelta"), TIERS[toTier].cost - TIERS[fromTier].cost, "upgrade BAES delta");
    const position = await getPosition(decodedArgs[0]);
    gate(position.active && position.depositor === wallet && position.tier === fromTier, "stale-plan", "upgrade position state changed; re-run planner", { position });
    await requireExactErc20ActionApproval(ADDR.baes, ADDR.lockVault, TIERS[toTier].cost - TIERS[fromTier].cost, wallet, "upgrade");
  } else if (intent === "unstake") {
    sameUint(decodedArgs[0], contextUint(terms.positionId, "unstake positionId"), "unstake positionId");
    const recipient = action.name === "unstake" ? wallet : decodedArgs[1];
    sameAddress(recipient, contextAddress(terms.recipient, "unstake recipient"), "unstake recipient");
    const position = await getPosition(decodedArgs[0]);
    sameUint(position.tokenId, contextUint(terms.tokenId, "unstake tokenId"), "unstake tokenId");
    gate(position.active && position.depositor === wallet, "stale-plan", "unstake position state changed; re-run planner", { position });
  } else if (intent === "settle" || intent === "settle-all") {
    const ids = terms.positionIds;
    gate(Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_BATCH, "plan-context", "settle context positionIds must contain 1..20 entries");
    const expected = ids.map((id, index) => contextUint(id, `settle positionIds[${index}]`));
    const actual = action.name === "settle" ? [decodedArgs[0]] : decodedArgs[0];
    gate(actual.length === expected.length && actual.every((id, index) => id === expected[index]), "plan-context", "settle position list does not match planner context", { actual, expected });
    gate(Array.isArray(terms.pendingByPosition) && terms.pendingByPosition.length === expected.length, "plan-context", "settle context must include pending amounts for every position");
    for (let index = 0; index < expected.length; index += 1) {
      const entry = terms.pendingByPosition[index];
      sameUint(contextUint(entry.positionId, `pendingByPosition[${index}].positionId`), expected[index], "settle pending positionId");
      gate(Array.isArray(entry.pending) && entry.pending.length > 0, "plan-context", "settle context pending list must be nonempty");
      const fresh = await pendingForPosition(expected[index]);
      gate(fresh.length === entry.pending.length, "stale-plan", `pending token count changed for position ${expected[index]}`);
      for (let pendingIndex = 0; pendingIndex < fresh.length; pendingIndex += 1) {
        sameAddress(fresh[pendingIndex].token, contextAddress(entry.pending[pendingIndex].token, "settle pending token"), "settle pending token");
        sameUint(fresh[pendingIndex].amount, contextUint(entry.pending[pendingIndex].amount, "settle pending amount"), "settle pending amount");
      }
    }
  } else if (intent === "claim" || intent === "claim-all-step") {
    const selected = intent === "claim" ? terms : terms.selected;
    const token = contextAddress(selected.token, "claim token");
    const amount = contextUint(selected.amount, "claim amount");
    sameAddress(decodedArgs[0], token, "claim token");
    const recipient = action.name === "claim" ? wallet : decodedArgs[1];
    sameAddress(recipient, contextAddress(terms.recipient, "claim recipient"), "claim recipient");
    const freshCredit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, wallet]);
    sameUint(freshCredit, amount, "current strict-claim credit");
  } else if (intent === "claim-batch") {
    gate(Array.isArray(terms.claims) && terms.claims.length > 0 && terms.claims.length <= MAX_BATCH, "plan-context", "claim batch context must include 1..20 claim amounts");
    const expectedTokens = terms.claims.map((claim, index) => contextAddress(claim.token, `claims[${index}].token`));
    gate(decodedArgs[0].length === expectedTokens.length && decodedArgs[0].every((token, index) => token === expectedTokens[index]), "plan-context", "claim batch tokens do not match planner context");
    sameAddress(decodedArgs[1], contextAddress(terms.recipient, "claim batch recipient"), "claim batch recipient");
    for (let index = 0; index < terms.claims.length; index += 1) {
      const expectedAmount = contextUint(terms.claims[index].amount, `claims[${index}].amount`);
      const freshCredit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [expectedTokens[index], wallet]);
      sameUint(freshCredit, expectedAmount, `current batch credit ${expectedTokens[index]}`);
    }
  } else if (intent === "claim-lossy") {
    const token = contextAddress(terms.token, "lossy claim token");
    sameAddress(decodedArgs[0], token, "lossy claim token");
    sameAddress(decodedArgs[1], contextAddress(terms.recipient, "lossy claim recipient"), "lossy claim recipient");
    sameUint(decodedArgs[2], contextUint(terms.minReceived, "lossy minReceived"), "lossy minReceived");
    gate(terms.executionDebitRule === "full-current-credit-at-execution", "plan-context", "lossy claim execution debit rule is missing or altered");
    const expectedCredit = contextUint(terms.fullCreditDebited, "lossy fullCreditDebited");
    const freshCredit = await readUint(ADDR.stockLock, "stockCredit(address,address)", ["address", "address"], [token, wallet]);
    sameUint(freshCredit, expectedCredit, "current lossy full credit");
  } else if (intent === "forfeit") {
    sameAddress(decodedArgs[0], contextAddress(terms.token, "forfeit token"), "forfeit token");
    sameUint(decodedArgs[1], contextUint(terms.amount, "forfeit amount"), "forfeit amount");
  } else if (intent === "convert") {
    const amount = contextUint(terms.amountIn, "convert amountIn");
    sameUint(decodedArgs[0], amount, "convert amountIn");
    gate(terms.executionTokenRule === "next-enabled-roster-token-at-execution" && terms.noPriceFloor === true, "plan-context", "convert execution semantics are missing or altered");
    const cursor = await readUint(ADDR.stockLock, "rotationCursor()");
    const next = await call(ADDR.stockAdapter, "nextEnabledFrom(uint256)", ["uint256"], [cursor]);
    sameUint(decodeUint(next, 0), contextUint(terms.currentObservedSlot, "convert observed slot"), "currently observed convert slot");
    sameAddress(decodeAddress(next, 1), contextAddress(terms.currentObservedToken, "convert observed token"), "currently observed convert token");
  } else if (intent === "weth-topup") {
    sameUint(decodedArgs[0], contextUint(terms.amount, "WETH top-up amount"), "WETH top-up amount");
    gate(typeof terms.sourceId === "string" && /^0x[0-9a-f]{64}$/.test(terms.sourceId), "plan-context", "WETH top-up sourceId is invalid");
    gate(decodedArgs[1].toLowerCase() === terms.sourceId, "plan-context", "WETH top-up sourceId does not match planner context");
    gate(terms.executionDestinationRule === "bootstrapLocked-if-zero-weight-else-wethPot", "plan-context", "WETH top-up execution destination rule is missing or altered");
    const totalWeight = await readUint(ADDR.lockVault, "totalWeight()");
    const destination = totalWeight === 0n ? "bootstrapLocked" : "wethPot";
    gate(terms.destinationAccounting === destination, "stale-plan", "WETH top-up accounting destination changed; re-run planner", { expected: terms.destinationAccounting, current: destination });
    await requireExactErc20ActionApproval(ADDR.weth, ADDR.stockLock, decodedArgs[0], wallet, "WETH top-up");
  } else if (intent === "reserve-topup") {
    sameUint(decodedArgs[0], contextUint(terms.amount, "reserve top-up amount"), "reserve top-up amount");
    await requireExactErc20ActionApproval(ADDR.baes, ADDR.punkAMM, decodedArgs[0], wallet, "reserve top-up");
  } else if (intent === "sync-donation") {
    gate(terms.executionRule === "all-unsynchronized-baes-at-execution", "plan-context", "sync donation execution rule is missing or altered");
    const [raw, tracked] = await Promise.all([
      readUint(ADDR.baes, SIG.balanceOf, ["address"], [ADDR.punkAMM]),
      readUint(ADDR.punkAMM, "trackedBAES()"),
    ]);
    sameUint(raw - tracked, contextUint(terms.donation, "sync donation"), "current unsynchronized donation");
  } else if (intent === "evict-head") {
    gate(terms.executionRule === "broken-fifo-head-at-execution", "plan-context", "evict-head execution rule is missing or altered");
    const freshHead = await readUint(ADDR.punkAMM, "fifoHead()");
    sameUint(freshHead, contextUint(terms.tokenId, "evict tokenId"), "current FIFO head");
  } else if (intent === "poke-bootstrap") {
    const [locked, pot, weight, anchor] = await Promise.all([
      readUint(ADDR.stockLock, "bootstrapLocked()"),
      readUint(ADDR.stockLock, "wethPot()"),
      readUint(ADDR.lockVault, "totalWeight()"),
      readUint(ADDR.stockLock, "lastBootstrapAccrual()"),
    ]);
    sameUint(locked, contextUint(terms.bootstrapLocked, "poke bootstrapLocked"), "current bootstrapLocked");
    sameUint(pot, contextUint(terms.wethPot, "poke wethPot"), "current wethPot");
    sameUint(weight, contextUint(terms.totalWeight, "poke totalWeight"), "current totalWeight");
    sameUint(anchor, contextUint(terms.lastAccrual, "poke lastAccrual"), "current lastBootstrapAccrual");
    const currentMode = weight === 0n && pot > 0n
      ? "relock-empty-vault-pot"
      : weight === 0n && anchor > 0n
        ? "reset-empty-vault-anchor"
        : weight > 0n && locked > 0n
          ? "start-or-release-bootstrap"
          : null;
    gate(currentMode && terms.mode === currentMode, "stale-plan", "pokeBootstrap usefulness/mode changed; re-run planner", { expected: terms.mode, current: currentMode });
  }
  return { intent };
}

async function validateKnownAction(target, action, decodedArgs, wallet = null, context = null) {
  let approval = null;
  let freshFeeQuote = null;
  gate(context, "plan-context", "planner context is required for every write inspection");
  const nonzeroAddress = (value, label) => gate(value !== ZERO_ADDRESS, "calldata", `${label} cannot be zero`);
  const requireFutureDeadline = async (deadline, maxAhead) => {
    const block = await latestBlock();
    gate(deadline > block.timestamp && deadline <= block.timestamp + BigInt(maxAhead), "deadline", "deadline is expired or farther ahead than the planner permits", {
      chainTimestamp: block.timestamp,
      deadline,
      maxAhead,
    });
  };

  if (action.name === "approve") {
    const [spender, amountOrTokenId] = decodedArgs;
    const allowedSpenders = target === normalizeAddress(ADDR.baes)
      ? [normalizeAddress(ADDR.punkAMM), normalizeAddress(ADDR.lockVault)]
      : target === normalizeAddress(ADDR.weth)
        ? [normalizeAddress(ADDR.stockLock)]
        : [normalizeAddress(ADDR.punkAMM), normalizeAddress(ADDR.lockVault)];
    gate(allowedSpenders.includes(spender), "approval-spender", "approval spender is outside the target token's allowlist", { spender });
    approval = await validateApprovalContext(target, decodedArgs, wallet, context);
  } else if (action.name === "buy") {
    gate(decodedArgs[0] > 0n, "calldata", "buy expectedHeadTokenId must be nonzero");
    gate(decodedArgs[1] === BUY_TOTAL, "calldata", "buy maxBAESIn must equal live BUY_TOTAL");
    gate(decodedArgs[2] > 0n, "calldata", "buy minWethOut must be nonzero");
    await requireFutureDeadline(decodedArgs[3], 600);
    freshFeeQuote = decodeUint(await call(ADDR.feeRouter, "quoteExactBAESForWETH(uint256)", ["uint256"], [FEE], wallet));
    const slippageBps = contextUint(context.terms.slippageBps, "buy slippageBps");
    const floor = freshFeeQuote * (10_000n - slippageBps) / 10_000n;
    gate(decodedArgs[2] >= floor, "slippage", "buy minWethOut is looser than the confirmed slippage tolerance", {
      minWethOut: decodedArgs[2], freshFeeQuote,
    });
    const freshHead = await readUint(ADDR.punkAMM, "fifoHead()");
    gate(decodedArgs[0] === freshHead, "fifo-head", "buy calldata no longer names the fresh FIFO head", { encoded: decodedArgs[0], freshHead });
    const owner = await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [freshHead]);
    gate(owner === normalizeAddress(ADDR.punkAMM), "fifo-custody", "PunkAMM no longer owns the encoded FIFO head", { owner });
  } else if (action.name === "sell") {
    gate(decodedArgs[0] > 0n, "calldata", "sell tokenId must be nonzero");
    gate(decodedArgs[1] === SELL_PAYOUT, "calldata", "sell minBAESOut must equal live SELL_PAYOUT");
    gate(decodedArgs[2] > 0n, "calldata", "sell minWethOut must be nonzero");
    await requireFutureDeadline(decodedArgs[3], 600);
    freshFeeQuote = decodeUint(await call(ADDR.feeRouter, "quoteExactBAESForWETH(uint256)", ["uint256"], [FEE], wallet));
    const slippageBps = contextUint(context.terms.slippageBps, "sell slippageBps");
    const floor = freshFeeQuote * (10_000n - slippageBps) / 10_000n;
    gate(decodedArgs[2] >= floor, "slippage", "sell minWethOut is looser than the confirmed slippage tolerance", {
      minWethOut: decodedArgs[2], freshFeeQuote,
    });
    if (wallet) gate(await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [decodedArgs[0]]) === wallet, "ownership", "active wallet no longer owns the sell token");
  } else if (action.name === "stake") {
    gate(decodedArgs[0] > 0n && decodedArgs[1] <= 4n, "calldata", "stake tokenId/tier is invalid");
    nonzeroAddress(decodedArgs[2], "beneficiary");
    if (wallet) gate(await readAddress(ADDR.punks, SIG.ownerOf, ["uint256"], [decodedArgs[0]]) === wallet, "ownership", "active wallet no longer owns the stake token");
  } else if (action.name === "upgrade") {
    gate(decodedArgs[0] > 0n && decodedArgs[1] <= 4n, "calldata", "upgrade position/tier is invalid");
  } else if (action.name === "unstake") {
    gate(decodedArgs[0] > 0n, "calldata", "unstake positionId must be nonzero");
  } else if (action.name === "unstake-to") {
    gate(decodedArgs[0] > 0n, "calldata", "unstake positionId must be nonzero");
    nonzeroAddress(decodedArgs[1], "unstake recipient");
  } else if (action.name === "settle") {
    gate(decodedArgs[0] > 0n, "calldata", "settle positionId must be nonzero");
  } else if (action.name === "settle-batch") {
    gate(decodedArgs[0].length > 0 && decodedArgs[0].length <= MAX_BATCH, "calldata", "settle batch must contain 1..20 positions");
    gate(decodedArgs[0].every((id) => id > 0n), "calldata", "settle batch position IDs must be nonzero");
  } else if (action.name === "claim") {
    nonzeroAddress(decodedArgs[0], "claim token");
  } else if (action.name === "claim-to") {
    nonzeroAddress(decodedArgs[0], "claim token");
    nonzeroAddress(decodedArgs[1], "claim recipient");
  } else if (action.name === "claim-batch") {
    gate(decodedArgs[0].length > 0 && decodedArgs[0].length <= MAX_BATCH, "calldata", "claim batch must contain 1..20 tokens");
    decodedArgs[0].forEach((token) => nonzeroAddress(token, "claim token"));
    gate(new Set(decodedArgs[0]).size === decodedArgs[0].length, "calldata", "claim batch token list contains duplicates");
    nonzeroAddress(decodedArgs[1], "claim recipient");
  } else if (action.name === "claim-lossy") {
    nonzeroAddress(decodedArgs[0], "claim token");
    nonzeroAddress(decodedArgs[1], "claim recipient");
    gate(decodedArgs[2] > 0n, "calldata", "lossy minReceived must be nonzero");
  } else if (action.name === "forfeit") {
    nonzeroAddress(decodedArgs[0], "forfeit token");
    gate(decodedArgs[1] > 0n, "calldata", "forfeit amount must be nonzero");
  } else if (action.name === "convert") {
    gate(decodedArgs[0] >= MIN_CONVERT && decodedArgs[0] <= MAX_CONVERT, "calldata", "convert amount is outside protocol bounds");
    await requireFutureDeadline(decodedArgs[1], 600);
  } else if (action.name === "weth-topup") {
    gate(decodedArgs[0] > 0n, "calldata", "WETH top-up amount must be nonzero");
    gate(decodedArgs[1] !== `0x${"0".repeat(64)}`, "calldata", "WETH top-up sourceId must be nonzero");
  } else if (action.name === "reserve-topup") {
    gate(decodedArgs[0] > 0n, "calldata", "reserve top-up amount must be nonzero");
  }

  if (["claim", "claim-to", "claim-lossy", "forfeit"].includes(action.name)) {
    await requireLifetimeToken(decodedArgs[0]);
  } else if (action.name === "claim-batch") {
    const lifetime = await distributedTokens();
    gate(decodedArgs[0].every((token) => token !== normalizeAddress(ADDR.weth) && lifetime.includes(token)), "token", "claim batch contains a token outside StockLock's lifetime list");
  }
  const contextValidation = action.name === "approve"
    ? { intent: context.action }
    : await validateActionContext(target, action, decodedArgs, wallet, context);
  return { approval, freshFeeQuote, context: contextValidation };
}

function expectedEmitter(action, target) {
  if (action.name === "approve") return target;
  if (["buy", "sell", "reserve-topup", "sync-donation", "evict-head"].includes(action.name)) return normalizeAddress(ADDR.punkAMM);
  if (["stake", "upgrade", "unstake", "unstake-to"].includes(action.name)) return normalizeAddress(ADDR.lockVault);
  return normalizeAddress(ADDR.stockLock);
}

function tradeSourceId(label, tokenId) {
  const labelBytes = new TextEncoder().encode(label);
  const tokenWord = BigInt(tokenId).toString(16).padStart(64, "0");
  const tokenBytes = Uint8Array.from(tokenWord.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
  const packed = new Uint8Array(labelBytes.length + tokenBytes.length);
  packed.set(labelBytes);
  packed.set(tokenBytes, labelBytes.length);
  return keccak256(packed).toLowerCase();
}

async function durableReceiptProof(action, target, decodedArgs, from, receipt, recognizedEvents, context) {
  const checks = [];
  const add = (name, pass, actual = null, expected = null) => checks.push({ name, pass: Boolean(pass), actual, expected });
  const topicAddress = (event, index) => decodeAddress(event.indexed[index]);
  const topicUint = (event, index) => decodeUint(event.indexed[index]);
  const emitter = expectedEmitter(action, target);
  const events = (name, address = emitter) => recognizedEvents.filter((event) =>
    event.name === name && normalizeAddress(event.emitter) === normalizeAddress(address));
  const transfers = events("Transfer", ADDR.punks);
  const hasPunkTransfer = (source, destination, tokenId) => transfers.some((event) =>
    event.indexed.length === 3
    && topicAddress(event, 0) === normalizeAddress(source)
    && topicAddress(event, 1) === normalizeAddress(destination)
    && topicUint(event, 2) === tokenId);

  if (action.name === "approve") {
    const [spender, amountOrTokenId] = decodedArgs;
    const approvals = events("Approval", target);
    const exact = target === normalizeAddress(ADDR.punks)
      ? approvals.some((event) => event.indexed.length === 3
        && topicAddress(event, 0) === from
        && topicAddress(event, 1) === spender
        && topicUint(event, 2) === amountOrTokenId)
      : approvals.some((event) => event.indexed.length === 2
        && topicAddress(event, 0) === from
        && topicAddress(event, 1) === spender
        && decodeUint(event.data, 0) === amountOrTokenId);
    add("Approval exact receipt event", exact);
  } else if (action.name === "buy") {
    const exact = events("NFTBought").find((event) => topicAddress(event, 0) === from
      && topicUint(event, 1) === decodedArgs[0]
      && decodeUint(event.data, 0) === BUY_TOTAL
      && decodeUint(event.data, 1) >= decodedArgs[2]);
    add("NFTBought exact receipt event", Boolean(exact));
    add("Bario Punk transfer desk to buyer", hasPunkTransfer(ADDR.punkAMM, from, decodedArgs[0]));
    const expectedSource = tradeSourceId("NFT_BUY", decodedArgs[0]);
    const fee = exact ? events("ConversionFeeSwapped", ADDR.revenueRouter).find((event) =>
      event.indexed.length === 2
      && event.indexed[0]?.toLowerCase() === expectedSource
      && topicAddress(event, 1) === normalizeAddress(ADDR.punkAMM)
      && decodeUint(event.data, 0) === FEE
      && decodeUint(event.data, 1) === decodeUint(exact.data, 1)
      && decodeBytes32(event.data, 2) === DEPLOYMENT.feeRoute.routeHash.toLowerCase()) : null;
    add("ConversionFeeSwapped exact buy fee/source/route", Boolean(fee));
    const revenue = fee ? events("RevenueDeposited", ADDR.stockLock).find((event) =>
      event.indexed[0]?.toLowerCase() === fee.indexed[0]?.toLowerCase()
      && decodeUint(event.data, 0) === decodeUint(fee.data, 1)
      && [0n, 1n].includes(decodeUint(event.data, 1))) : null;
    add("RevenueDeposited matches buy fee output/source", Boolean(revenue));
  } else if (action.name === "sell") {
    const exact = events("NFTSold").find((event) => topicAddress(event, 0) === from
      && topicUint(event, 1) === decodedArgs[0]
      && decodeUint(event.data, 0) === SELL_PAYOUT
      && decodeUint(event.data, 1) >= decodedArgs[2]);
    add("NFTSold exact receipt event", Boolean(exact));
    add("Bario Punk transfer seller to desk", hasPunkTransfer(from, ADDR.punkAMM, decodedArgs[0]));
    const expectedSource = tradeSourceId("NFT_SELL", decodedArgs[0]);
    const fee = exact ? events("ConversionFeeSwapped", ADDR.revenueRouter).find((event) =>
      event.indexed.length === 2
      && event.indexed[0]?.toLowerCase() === expectedSource
      && topicAddress(event, 1) === normalizeAddress(ADDR.punkAMM)
      && decodeUint(event.data, 0) === FEE
      && decodeUint(event.data, 1) === decodeUint(exact.data, 1)
      && decodeBytes32(event.data, 2) === DEPLOYMENT.feeRoute.routeHash.toLowerCase()) : null;
    add("ConversionFeeSwapped exact sell fee/source/route", Boolean(fee));
    const revenue = fee ? events("RevenueDeposited", ADDR.stockLock).find((event) =>
      event.indexed[0]?.toLowerCase() === fee.indexed[0]?.toLowerCase()
      && decodeUint(event.data, 0) === decodeUint(fee.data, 1)
      && [0n, 1n].includes(decodeUint(event.data, 1))) : null;
    add("RevenueDeposited matches sell fee output/source", Boolean(revenue));
  } else if (action.name === "reserve-topup") {
    add("ReserveToppedUp exact receipt event", events("ReserveToppedUp").some((event) =>
      topicAddress(event, 0) === from && decodeUint(event.data, 0) === decodedArgs[0]));
  } else if (action.name === "sync-donation") {
    const observed = contextUint(context.terms.donation, "sync donation");
    const matched = events("DonationSynced").find((event) => event.indexed.length === 0 && decodeUint(event.data, 0) >= observed);
    add("DonationSynced receipt event", Boolean(matched), matched ? decodeUint(matched.data, 0) : null, `>= ${observed}`);
  } else if (action.name === "evict-head") {
    const matched = events("HeadEvicted").find((event) => event.indexed.length === 1);
    add("HeadEvicted receipt event", Boolean(matched), matched ? topicUint(matched, 0) : null, "broken FIFO head at execution");
  } else if (action.name === "stake") {
    const tier = Number(decodedArgs[1]);
    const exact = events("PositionOpened").find((event) => topicUint(event, 1) === decodedArgs[0]
      && topicAddress(event, 2) === decodedArgs[2]
      && decodeUint(event.data, 0) === decodedArgs[1]
      && decodeUint(event.data, 1) === BigInt(TIERS[tier].weight));
    add("PositionOpened exact receipt event", Boolean(exact));
    add("Bario Punk transfer depositor to LockVault", hasPunkTransfer(from, ADDR.lockVault, decodedArgs[0]));
  } else if (action.name === "upgrade") {
    add("PositionUpgraded exact receipt event", events("PositionUpgraded").some((event) =>
      topicUint(event, 0) === decodedArgs[0]
      && decodeUint(event.data, 0) === decodedArgs[1]
      && decodeUint(event.data, 1) === BigInt(TIERS[Number(decodedArgs[1])].weight)));
  } else if (action.name === "unstake" || action.name === "unstake-to") {
    const recipient = action.name === "unstake" ? from : decodedArgs[1];
    const tokenId = contextUint(context.terms.tokenId, "unstake tokenId");
    add("PositionClosed exact receipt event", events("PositionClosed").some((event) => topicUint(event, 0) === decodedArgs[0]));
    add("Bario Punk transfer LockVault to recipient", hasPunkTransfer(ADDR.lockVault, recipient, tokenId));
  } else if (action.name === "settle" || action.name === "settle-batch") {
    const creditEvents = events("CreditWritten");
    const beneficiary = contextAddress(context.terms.beneficiary, "settle receipt beneficiary");
    for (const entry of context.terms.pendingByPosition) {
      const positionId = contextUint(entry.positionId, "settle receipt positionId");
      for (const pending of entry.pending) {
        const token = contextAddress(pending.token, "settle receipt token");
        const amount = contextUint(pending.amount, "settle receipt amount");
        add(`CreditWritten position ${positionId} token ${token}`, creditEvents.some((event) =>
          topicUint(event, 0) === positionId
          && topicAddress(event, 1) === token
          && topicAddress(event, 2) === beneficiary
          && decodeUint(event.data, 0) >= amount));
      }
    }
  } else if (action.name === "claim" || action.name === "claim-to") {
    const recipient = action.name === "claim" ? from : decodedArgs[1];
    const selected = context.action === "claim" ? context.terms : context.terms.selected;
    const expectedAmount = contextUint(selected.amount, "strict claim receipt amount");
    const matched = events("Claimed").find((event) => topicAddress(event, 0) === from
      && topicAddress(event, 1) === decodedArgs[0]
      && topicAddress(event, 2) === recipient
      && decodeUint(event.data, 0) >= expectedAmount);
    add("Claimed exact actors/token and at least confirmed credit", Boolean(matched), matched ? decodeUint(matched.data, 0) : null, `>= ${expectedAmount}`);
  } else if (action.name === "claim-batch") {
    const claimEvents = events("Claimed");
    for (const claim of context.terms.claims) {
      const token = contextAddress(claim.token, "batch receipt token");
      const expectedAmount = contextUint(claim.amount, "batch receipt amount");
      if (expectedAmount === 0n) continue;
      const matched = claimEvents.find((event) => topicAddress(event, 0) === from
        && topicAddress(event, 1) === token
        && topicAddress(event, 2) === decodedArgs[1]
        && decodeUint(event.data, 0) >= expectedAmount);
      add(`Claimed batch token ${token}`, Boolean(matched), matched ? decodeUint(matched.data, 0) : null, `>= ${expectedAmount}`);
    }
  } else if (action.name === "claim-lossy") {
    const expectedDebit = contextUint(context.terms.fullCreditDebited, "lossy receipt debit");
    const matched = events("ClaimedLossy").find((event) => topicAddress(event, 0) === from
      && topicAddress(event, 1) === decodedArgs[0]
      && topicAddress(event, 2) === decodedArgs[1]
      && decodeUint(event.data, 0) === expectedDebit
      && decodeUint(event.data, 1) >= decodedArgs[2]);
    add("ClaimedLossy exact confirmed debit and minimum", Boolean(matched));
  } else if (action.name === "forfeit") {
    add("CreditForfeited exact receipt event", events("CreditForfeited").some((event) =>
      topicAddress(event, 0) === from
      && topicAddress(event, 1) === decodedArgs[0]
      && decodeUint(event.data, 0) === decodedArgs[1]));
  } else if (action.name === "convert") {
    const bounty = decodedArgs[0] / 100n;
    const matched = events("Converted").find((event) => topicAddress(event, 1) === from
      && decodeUint(event.data, 0) === decodedArgs[0] - bounty
      && decodeUint(event.data, 1) > 0n
      && decodeUint(event.data, 2) === bounty);
    add("Converted exact keeper/amounts receipt event", Boolean(matched), matched ? topicAddress(matched, 0) : null, "automatic enabled token at execution");
  } else if (action.name === "weth-topup") {
    const matched = events("RevenueDeposited").find((event) =>
      event.indexed[0]?.toLowerCase() === decodedArgs[1].toLowerCase()
      && decodeUint(event.data, 0) === decodedArgs[0]
      && [0n, 1n].includes(decodeUint(event.data, 1)));
    add("RevenueDeposited exact source/amount receipt event", Boolean(matched), matched ? decodeUint(matched.data, 1) === 1n : null, "bootstrap flag reports execution-time Crew state");
  } else if (action.name === "poke-bootstrap") {
    const releases = events("BootstrapReleased");
    add("successful poke receipt; BootstrapReleased is optional", true, releases.length, ">=0");
  } else {
    add("recognized operation has a durable receipt proof", false, action.name, "implemented proof branch");
  }

  add("receipt block is fixed", Boolean(receipt.blockHash && receipt.blockNumber), receipt.blockNumber, "mined receipt");
  return checks;
}

async function inspectTx() {
  await deploymentGate();
  const wallet = walletArg();
  const hash = need("tx");
  const parsedContext = decodeInspectionContext(need("context"));
  const suppliedInspectionKey = need("plan-key").toLowerCase();
  gate(/^0x[0-9a-f]{64}$/.test(suppliedInspectionKey), "args", "--plan-key must be the 32-byte inspectionKey from the fresh planner output");
  gate(/^0x[0-9a-fA-F]{64}$/.test(hash), "args", "--tx must be a 32-byte transaction hash");
  const [tx, receipt] = await Promise.all([getTransaction(hash), getReceipt(hash)]);
  gate(tx, "transaction", "transaction was not found on Base");
  gate(tx.hash?.toLowerCase() === hash.toLowerCase(), "transaction", "RPC transaction does not match the requested hash");
  if (receipt) {
    gate(receipt.transactionHash?.toLowerCase() === hash.toLowerCase(), "transaction", "RPC receipt does not match the requested hash");
  }
  const actualChainId = Number(BigInt(tx.chainId));
  gate(actualChainId === 8453, "chain", "submitted transaction is not on Base chainId 8453", { actualChainId });
  const executionEnvelope = resolveBankrExecution(tx, wallet, "execution-envelope");
  const target = executionEnvelope.logicalCall.target;
  let receiptInput;
  try {
    receiptInput = stripErc8021Suffix(executionEnvelope.logicalCall.data);
  } catch (error) {
    throw new GateError("calldata-suffix", error.message);
  }
  gate(!(executionEnvelope.attribution && receiptInput.attribution), "calldata-suffix", "multiple ERC-8021 attribution suffixes make the logical call ambiguous");
  const attribution = executionEnvelope.attribution ?? receiptInput.attribution;
  const dataSelector = txSelector(receiptInput.calldata);
  const action = target ? knownActionBySelector(target, dataSelector) : null;
  gate(action, "allowlist", "transaction target/selector is not a recognized Punk Town user operation", { target, selector: dataSelector });
  const decodedArgs = decodeKnownAction(action, receiptInput.calldata);
  const from = executionEnvelope.logicalSender;
  const actualValue = normalizedUintString(executionEnvelope.logicalCall.value, "logical call value");
  gate(actualValue === "0", "value", "Punk Town write transactions must carry zero native value", { actualValue });
  const computedInspectionKey = inspectionKey(wallet, {
    to: target,
    data: receiptInput.calldata,
    value: actualValue,
    chainId: actualChainId,
  }, parsedContext.hex);
  gate(computedInspectionKey === suppliedInspectionKey, "plan-binding", "mined transaction envelope or context does not match the fresh planner inspectionKey", {
    suppliedInspectionKey, computedInspectionKey,
  });
  if (action.name === "approve") {
    gate(["buy", "sell", "stake", "upgrade", "weth-topup", "reserve-topup"].includes(parsedContext.context.action), "plan-context", "approval receipt context has an invalid planner intent");
  } else {
    gate(CONTEXT_ACTIONS[parsedContext.context.action]?.includes(action.name), "plan-context", "receipt selector does not match the planner context action", {
      contextAction: parsedContext.context.action,
      receiptAction: action.name,
    });
  }
  if (!receipt) {
    out({
      ok: false,
      command,
      state: "pending-or-unavailable",
      hash,
      target,
      action,
      selector: dataSelector,
      from,
      executionMode: executionEnvelope.mode,
      outerFrom: executionEnvelope.outer.from,
      outerTarget: executionEnvelope.outer.target,
      decodedArgs,
      inspectionContext: parsedContext.context,
      inspectionKey: computedInspectionKey,
      attribution,
      next: "This is not completion. Do not submit another write or replay the intent; wait for this exact hash to reach a confirmed receipt.",
    }, 1);
    return;
  }
  const success = BigInt(receipt.status) === 1n;
  let recognizedEvents = [];
  let logicalReceiptLogRange = null;
  let postconditions = [];
  let executionProof = null;
  if (success) {
    try {
      executionProof = await proveBankrExecutionReceipt(executionEnvelope, tx, receipt, "execution-receipt");
      logicalReceiptLogRange = executionProof?.userOperationEvent?.receiptLogRange ?? null;
      const logicalReceiptLogs = logicalReceiptLogRange
        ? receipt.logs.slice(logicalReceiptLogRange.start, logicalReceiptLogRange.end)
        : receipt.logs;
      recognizedEvents = logicalReceiptLogs.map(decodeRecognizedLog).filter(Boolean);
      postconditions.push({
        name: executionEnvelope.mode === "direct-wallet-transaction"
          ? "direct wallet sender envelope"
          : "Bankr EntryPoint user operation succeeded",
        pass: true,
        actual: executionEnvelope.mode,
        expected: "supported single logical wallet call",
      });
    } catch (error) {
      postconditions.push({
        name: "Bankr logical execution receipt",
        pass: false,
        actual: error.message,
        expected: "supported single logical wallet call with a successful sponsored UserOperationEvent",
      });
    }
    if (postconditions.every((check) => check.pass)) {
      try {
        postconditions.push(...await durableReceiptProof(
          action,
          target,
          decodedArgs,
          from,
          receipt,
          recognizedEvents,
          parsedContext.context,
        ));
      } catch (error) {
        postconditions.push({ name: "durable receipt proof", pass: false, actual: error.message, expected: "all bound events decodable" });
      }
    }
  }
  const proven = success && postconditions.every((check) => check.pass);
  out({
    ok: proven,
    command,
    state: !success ? "confirmed-revert" : proven ? "confirmed-and-receipt-proven" : "mined-success-proof-incomplete",
    hash,
    blockNumber: BigInt(receipt.blockNumber),
    target,
    action,
    selector: dataSelector,
    from,
    executionMode: executionEnvelope.mode,
    outerFrom: executionEnvelope.outer.from,
    outerTarget: executionEnvelope.outer.target,
    executionProof,
    logicalReceiptLogRange,
    decodedArgs,
    inspectionContext: parsedContext.context,
    inspectionKey: computedInspectionKey,
    attribution,
    recognizedEvents,
    postconditions,
    proofScope: "supported single Bankr wallet execution, successful sponsored user operation when applicable, and durable Punk Town receipt events; operation-specific fresh state read remains required",
    receiptStatus: receipt.status,
    next: proven ? "Durable receipt envelope and expected events passed. Run the operation-specific fresh read command before reporting full completion or starting a dependent write." : success ? "Do not call this complete or submit another write; inspect the failed receipt proof and recover from fresh chain state." : "Do not replay automatically. Re-plan from current chain state and diagnose the revert.",
  }, proven ? 0 : 1);
}

async function inspectCalldata() {
  await deploymentGate();
  const wallet = walletArg();
  const target = normalizeAddress(need("to"));
  const data = need("data");
  const chainId = Number(integerArg("chain-id", { min: 1n, max: 0xffff_ffffn }));
  const value = normalizedUintString(need("value"), "--value");
  const parsedContext = decodeInspectionContext(need("context"));
  const suppliedInspectionKey = need("plan-key").toLowerCase();
  gate(/^0x[0-9a-f]{64}$/.test(suppliedInspectionKey), "args", "--plan-key must be the 32-byte inspectionKey from the fresh planner output");
  gate(chainId === 8453, "chain", "--chain-id must be Base 8453", { chainId });
  gate(value === "0", "value", "--value must be zero for every Punk Town write", { value });
  gate(/^0x[0-9a-fA-F]{8}([0-9a-fA-F]{64})*$/.test(data), "args", "--data must be canonical ABI calldata (selector plus whole words)");
  const computedInspectionKey = inspectionKey(wallet, { to: target, data, value, chainId }, parsedContext.hex);
  gate(computedInspectionKey === suppliedInspectionKey, "plan-binding", "chain, value, target, calldata, wallet, or context does not match the fresh planner inspectionKey", {
    suppliedInspectionKey, computedInspectionKey,
  });
  const dataSelector = txSelector(data);
  const action = knownActionBySelector(target, dataSelector);
  gate(action, "allowlist", "target/selector is not a recognized Punk Town user operation", { target, selector: dataSelector });
  const decodedArgs = decodeKnownAction(action, data);
  const validation = await validateKnownAction(target, action, decodedArgs, wallet, parsedContext.context);
  const preflight = await simulation({ to: target, data }, wallet);

  out({
    ok: true,
    command,
    chainId,
    target,
    selector: dataSelector,
    action,
    wallet,
    inspectionKey: computedInspectionKey,
    inspectionContext: parsedContext.context,
    decodedArgs,
    validation,
    preflight,
    valueRequired: value,
    next: "The allowlist, canonical ABI arguments, signer-sensitive ownership, fresh FIFO/deadline constraints, and approval spender passed. Submit only the matching fresh planner output through Bankr after explicit confirmation.",
  });
}

const COMMANDS = {
  verify: commandVerify,
  status: commandStatus,
  inventory: commandInventory,
  punk: commandPunk,
  crew: commandCrew,
  rewards: commandRewards,
  "plan-buy": planBuy,
  "plan-sell": planSell,
  "plan-stake": planStake,
  "plan-upgrade": planUpgrade,
  "plan-unstake": planUnstake,
  "plan-settle": planSettle,
  "plan-settle-all": planSettleAll,
  "plan-claim": planClaim,
  "plan-claim-batch": planClaimBatch,
  "plan-claim-all": planClaimAll,
  "plan-claim-lossy": planClaimLossy,
  "plan-forfeit": planForfeit,
  "plan-convert": planConvert,
  "plan-weth-topup": planWethTopup,
  "plan-reserve-topup": planReserveTopup,
  "plan-sync-donation": planSyncDonation,
  "plan-evict-head": planEvictHead,
  "plan-poke-bootstrap": planPokeBootstrap,
  "bind-acquisition": bindAcquisition,
  "verify-acquisition": verifyAcquisition,
  "inspect-calldata": inspectCalldata,
  "inspect-tx": inspectTx,
};

const COMMAND_FLAGS = Object.freeze({
  verify: ["wallet"],
  status: ["wallet"],
  inventory: ["wallet", "cursor", "limit"],
  punk: ["wallet", "token-id"],
  crew: ["wallet"],
  rewards: ["wallet"],
  "plan-buy": ["wallet", "expected-token-id", "slippage-bps", "acquisition-slippage-bps", "join"],
  "plan-sell": ["wallet", "token-id", "slippage-bps"],
  "plan-stake": ["wallet", "token-id", "tier", "beneficiary", "acquisition-slippage-bps"],
  "plan-upgrade": ["wallet", "position-id", "new-tier", "acquisition-slippage-bps"],
  "plan-unstake": ["wallet", "position-id", "recipient"],
  "plan-settle": ["wallet", "position-id"],
  "plan-settle-all": ["wallet"],
  "plan-claim": ["wallet", "token", "recipient"],
  "plan-claim-batch": ["wallet", "tokens", "recipient"],
  "plan-claim-all": ["wallet", "recipient"],
  "plan-claim-lossy": ["wallet", "token", "min-received", "recipient"],
  "plan-forfeit": ["wallet", "token", "amount"],
  "plan-convert": ["wallet", "amount-weth"],
  "plan-weth-topup": ["wallet", "amount-weth", "source-id"],
  "plan-reserve-topup": ["wallet", "amount-baes"],
  "plan-sync-donation": ["wallet"],
  "plan-evict-head": ["wallet"],
  "plan-poke-bootstrap": ["wallet"],
  "bind-acquisition": [
    "wallet", "request-context", "request-key", "mode", "source-token", "source-symbol",
    "source-decimals", "source-amount", "min-baes-out", "idempotency-key", "quote-id",
    "fee-bps", "price-impact-bps", "swap-impact-bps", "max-price-impact-bps", "network-costs-usd",
  ],
  "verify-acquisition": ["wallet", "tx", "authorization-context", "authorization-key"],
  "inspect-calldata": ["wallet", "to", "data", "chain-id", "value", "context", "plan-key"],
  "inspect-tx": ["wallet", "tx", "context", "plan-key"],
});

async function main() {
  gate(!argumentParseError, "args", argumentParseError ?? "invalid arguments");
  gate(command && COMMANDS[command], "command", `unknown command. Available: ${Object.keys(COMMANDS).join(", ")}`);
  const allowedFlags = new Set(COMMAND_FLAGS[command]);
  const unknownFlags = Object.keys(args).filter((flag) => !allowedFlags.has(flag));
  gate(unknownFlags.length === 0, "args", `unknown flag(s) for ${command}: ${unknownFlags.map((flag) => `--${flag}`).join(", ")}`);
  await COMMANDS[command]();
}

try {
  await main();
} catch (error) {
  if (error instanceof GateError) {
    out({ ok: false, command: command ?? null, gate: error.gate, detail: error.message, ...error.extra }, 1);
  } else {
    const data = revertData(error);
    out({
      ok: false,
      command: command ?? null,
      gate: data ? "rpc-revert" : "unexpected",
      detail: data ? describeRevert(data) : error.message,
      revertSelector: data?.slice(0, 10) ?? null,
    }, 1);
  }
}
