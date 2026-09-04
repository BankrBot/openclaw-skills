#!/usr/bin/env node
// Offline ABI/policy tests. Add --live for read-only Base deployment checks.

import { readFileSync, statSync } from "node:fs";
import {
  asciiBytes32,
  decodeBytes32,
  decodeCallArguments,
  decodePositionsPage,
  decodeStockEntry,
  encodeAddress,
  encodeCall,
  encodeUint,
  formatUnits,
  parseUnits,
  strip0x,
  stripErc8021Suffix,
} from "./lib/abi.mjs";
import {
  BEFORE_EXECUTION_EVENT_TOPIC,
  ENTRY_POINT_V07,
  ENTRY_POINT_V07_CODE_HASH,
  ECRECOVER_PRECOMPILE,
  HANDLE_OPS_SELECTOR,
  KERNEL_DELEGATION_DESIGNATOR,
  KERNEL_EXECUTE_SELECTOR,
  KERNEL_IMPLEMENTATION,
  KERNEL_VALIDATION_STORAGE_SLOT,
  ROOT_VALIDATOR_SELECTOR,
  USER_OPERATION_EVENT_TOPIC,
  authorizationRecoveryCall,
  decodeAuthorizationAuthority,
  decodeBankrExecution,
  decodeRootValidator,
  proveKernelDelegationAtTransaction,
  sumCanonicalErc20Transfers,
  userOperationHashCall,
  verifyBankrExecutionReceipt,
} from "./lib/bankr.mjs";
import {
  ethCall,
  getBlockByHash,
  getCode,
  getCodeHash,
  getReceipt,
  getStorageAt,
  getTransaction,
  getTransactionCount,
} from "./lib/chain.mjs";
import { eventTopic, keccak256, selector } from "./lib/keccak256.mjs";
import {
  ADDR,
  BUY_TOTAL,
  DEPLOYMENT,
  SIG,
  inventoryPage,
  protocolStatus,
  sanitizeTokenSymbol,
  verifyDeployment,
} from "./lib/protocol.mjs";

const allowlist = JSON.parse(readFileSync(new URL("../references/signing-allowlist.json", import.meta.url), "utf8"));
const bankrExecution = JSON.parse(readFileSync(new URL("../references/bankr-execution.json", import.meta.url), "utf8"));
let catalog = null;
try {
  catalog = JSON.parse(readFileSync(new URL("../catalog.json", import.meta.url), "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const skillMarkdown = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const results = [];

function check(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail });
}

function equal(name, actual, expected) {
  check(name, actual === expected, actual === expected ? "" : `actual=${actual} expected=${expected}`);
}

function rejects(name, fn, expectedMessage) {
  try {
    fn();
    check(name, false, "did not reject");
  } catch (error) {
    check(name, String(error.message).includes(expectedMessage), error.message);
  }
}

async function rejectsAsync(name, fn, expectedMessage) {
  try {
    await fn();
    check(name, false, "did not reject");
  } catch (error) {
    check(name, String(error.message).includes(expectedMessage), error.message);
  }
}

function encodeDynamicBytes(value) {
  const body = strip0x(value);
  if (!/^[0-9a-fA-F]*$/.test(body) || body.length % 2 !== 0) throw new Error("test bytes must be even-length hex");
  return encodeUint(body.length / 2) + body.toLowerCase().padEnd(Math.ceil(body.length / 64) * 64, "0");
}

function kernelExecute(target, value, data, mode = 0n) {
  const packed = `${strip0x(target)}${encodeUint(value)}${strip0x(data)}`;
  return `${KERNEL_EXECUTE_SELECTOR}${encodeUint(mode)}${encodeUint(64n)}${encodeDynamicBytes(`0x${packed}`)}`;
}

function userOperationTuple(sender, nonce, callData, { paymaster = "0x" } = {}) {
  const headWords = 9;
  const initCode = encodeDynamicBytes("0x");
  const encodedCallData = encodeDynamicBytes(callData);
  const paymasterAndData = encodeDynamicBytes(paymaster);
  const signature = encodeDynamicBytes("0x5678");
  const initCodeOffset = headWords * 32;
  const callDataOffset = initCodeOffset + initCode.length / 2;
  const paymasterOffset = callDataOffset + encodedCallData.length / 2;
  const signatureOffset = paymasterOffset + paymasterAndData.length / 2;
  const dynamicTail = `${initCode}${encodedCallData}${paymasterAndData}${signature}`;
  return `${encodeAddress(sender)}${encodeUint(nonce)}${encodeUint(initCodeOffset)}${encodeUint(callDataOffset)}`
    + `${encodeUint(0n)}${encodeUint(100_000n)}${encodeUint(0n)}${encodeUint(paymasterOffset)}${encodeUint(signatureOffset)}`
    + dynamicTail;
}

function handleOpsMany(tuples) {
  if (!Array.isArray(tuples) || tuples.length < 1) throw new Error("test handleOps requires at least one tuple");
  const beneficiary = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  let offset = tuples.length * 32;
  let offsets = "";
  for (const tuple of tuples) {
    offsets += encodeUint(offset);
    offset += tuple.length / 2;
  }
  return `${HANDLE_OPS_SELECTOR}${encodeUint(64n)}${encodeAddress(beneficiary)}${encodeUint(tuples.length)}${offsets}${tuples.join("")}`;
}

function handleOps(sender, nonce, callData) {
  return handleOpsMany([userOperationTuple(sender, nonce, callData)]);
}

function userOperationEvent(entryPoint, sender, nonce, userOpHash, success = true) {
  return {
    address: entryPoint,
    topics: [
      USER_OPERATION_EVENT_TOPIC,
      userOpHash,
      `0x${encodeAddress(sender)}`,
      `0x${encodeAddress("0xcccccccccccccccccccccccccccccccccccccccc")}`,
    ],
    data: `0x${encodeUint(nonce)}${encodeUint(success ? 1n : 0n)}${encodeUint(123n)}${encodeUint(456n)}`,
  };
}

function beforeExecutionEvent(entryPoint) {
  return { address: entryPoint, topics: [BEFORE_EXECUTION_EVENT_TOPIC], data: "0x" };
}

// Keccak and selectors: Ethereum Keccak, not NIST SHA3.
equal("keccak empty vector", keccak256(""), "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
equal("ERC20 transfer selector", selector("transfer(address,uint256)"), "0xa9059cbb");
equal("approve selector", selector(SIG.approve), "0x095ea7b3");
equal("PunkAMM buy selector", selector(SIG.buy), "0x8828735d");
equal("StockLock settle batch selector", selector(SIG.settleBatch), "0x8e28fc9e");
equal("NFTBought topic", eventTopic("NFTBought(address,uint256,uint256,uint256)"), "0x8c68226ed6c7256cb4dc9d9d1d0d84141ffb9ff4cac6ca9fa08dc46ad0a08936");
equal("token symbol strips control characters", sanitizeTokenSymbol("A\n\u001b[31mB"), "A ?[31mB");
equal("token symbol caps untrusted display length", sanitizeTokenSymbol("X".repeat(40)), "X".repeat(32));
equal("token symbol uses safe fallback", sanitizeTokenSymbol("\n\t", "0x1234...abcd"), "0x1234...abcd");

// Static and dynamic ABI encoding.
const wallet = "0x1111111111111111111111111111111111111111";
const buy = encodeCall(SIG.buy, ["uint256", "uint256", "uint256", "uint256"], [123n, BUY_TOTAL, 99n, 456n]);
equal("buy calldata byte length", (buy.length - 2) / 2, 4 + 4 * 32);
equal("buy selector prefix", buy.slice(0, 10), "0x8828735d");
const decodedBuy = decodeCallArguments(["uint256", "uint256", "uint256", "uint256"], buy);
equal("buy decoded token", decodedBuy[0], 123n);
equal("buy decoded exact amount", decodedBuy[1], BUY_TOTAL);
equal("buy decoded deadline", decodedBuy[3], 456n);

const settleBatch = encodeCall(SIG.settleBatch, ["uint256[]"], [[1n, 2n]]);
const expectedSettleBatch =
  "0x8e28fc9e" + encodeUint(32n) + encodeUint(2n) + encodeUint(1n) + encodeUint(2n);
equal("dynamic uint array calldata", settleBatch, expectedSettleBatch);
const decodedSettleBatch = decodeCallArguments(["uint256[]"], settleBatch);
equal("dynamic uint array decoded length", decodedSettleBatch[0].length, 2);
equal("dynamic uint array decoded item", decodedSettleBatch[0][1], 2n);

const claimBatch = encodeCall(SIG.claimBatch, ["address[]", "address"], [[ADDR.baes, ADDR.weth], wallet]);
const expectedClaimBatch =
  "0x02dc3020" + encodeUint(64n) + encodeAddress(wallet) + encodeUint(2n) + encodeAddress(ADDR.baes) + encodeAddress(ADDR.weth);
equal("dynamic address array with static tail", claimBatch, expectedClaimBatch);
const decodedClaimBatch = decodeCallArguments(["address[]", "address"], claimBatch);
equal("dynamic address array decoded item", decodedClaimBatch[0][1], ADDR.weth.toLowerCase());
equal("dynamic static tail decoded", decodedClaimBatch[1], wallet);

const attributedBuy = `${buy}62635f73336a35766637680b0080218021802180218021802180218021`;
const strippedBuy = stripErc8021Suffix(attributedBuy);
equal("ERC-8021 suffix stripped to canonical call", strippedBuy.calldata, buy);
equal("ERC-8021 builder code decoded", strippedBuy.attribution.codes[0], "bc_s3j5vf7h");
const schema1Buy = `${buy}${"cc".repeat(20)}210502626173656170702c6d6f7270686f0e0180218021802180218021802180218021`;
const strippedSchema1 = stripErc8021Suffix(schema1Buy);
equal("ERC-8021 schema 1 stripped to canonical call", strippedSchema1.calldata, buy);
equal("ERC-8021 schema 1 registry address", strippedSchema1.attribution.codeRegistry.address, `0x${"cc".repeat(20)}`);
equal("ERC-8021 schema 1 registry chain", strippedSchema1.attribution.codeRegistry.chainId, 8453);
equal("ERC-8021 schema 1 codes", strippedSchema1.attribution.codes.join(","), "baseapp,morpho");
const schema2Buy = `${buy}a161616762617365617070000b0280218021802180218021802180218021`;
const strippedSchema2 = stripErc8021Suffix(schema2Buy);
equal("ERC-8021 schema 2 stripped to canonical call", strippedSchema2.calldata, buy);
equal("ERC-8021 schema 2 is reported opaque", strippedSchema2.attribution.opaque, true);
equal("ERC-8021 schema 2 byte length", strippedSchema2.attribution.cborBytes, 11);
rejects(
  "reject malformed ERC-8021 builder code",
  () => stripErc8021Suffix(`${buy}612c2c62040080218021802180218021802180218021`),
  "invalid ERC-8021 builder codes",
);

// Bankr execution envelopes. The receipt verifier accepts a direct wallet tx
// or Bankr's evidence-backed sponsored Kernel/EntryPoint v0.7 path. A bundler
// may include other users, but the active wallet gets exactly one fail-on-error
// logical call and only that operation's receipt-log window is trusted.
const relayer = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const logicalTarget = ADDR.punkAMM;
const directEnvelope = decodeBankrExecution({
  from: wallet,
  to: logicalTarget,
  input: buy,
  value: "0x0",
}, wallet);
equal("direct Bankr execution mode", directEnvelope.mode, "direct-wallet-transaction");
equal("direct Bankr logical sender", directEnvelope.logicalSender, wallet);
equal("direct Bankr logical calldata", directEnvelope.logicalCall.data, buy);
rejects(
  "reject direct Bankr type-4 authorization side effect",
  () => decodeBankrExecution({
    from: wallet,
    to: logicalTarget,
    input: buy,
    value: "0x0",
    type: "0x4",
    authorizationList: [{ address: KERNEL_IMPLEMENTATION }],
  }, wallet),
  "must not carry EIP-7702 authorizations",
);
rejects(
  "reject direct Bankr wallet self-call",
  () => decodeBankrExecution({ from: wallet, to: wallet, input: buy, value: "0x0" }, wallet),
  "must not target the active wallet itself",
);

const v07Nonce = 17n;
const v07KernelCall = kernelExecute(logicalTarget, 123n, buy);
const v07HandleOps = handleOps(wallet, v07Nonce, v07KernelCall);
const v07Envelope = decodeBankrExecution({
  from: relayer,
  to: ENTRY_POINT_V07,
  input: v07HandleOps,
  value: "0x0",
}, wallet);
equal("Bankr v0.7 sponsored mode", v07Envelope.mode, "bankr-entrypoint-kernel-single");
equal("Bankr v0.7 logical sender", v07Envelope.logicalSender, wallet);
equal("Bankr v0.7 logical target", v07Envelope.logicalCall.target, logicalTarget.toLowerCase());
equal("Bankr v0.7 logical native value", v07Envelope.logicalCall.value, 123n);
equal("Bankr v0.7 logical calldata", v07Envelope.logicalCall.data, buy);
equal("Bankr v0.7 native validation mode", v07Envelope.validation.mode, 0);
equal("Bankr v0.7 native validation type", v07Envelope.validation.type, 0);
equal("Bankr v0.7 exact userOp hash call selector", userOperationHashCall(v07Envelope).slice(0, 10), selector("getUserOpHash((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes))"));
equal("Kernel v3.3 validation storage slot pin", KERNEL_VALIDATION_STORAGE_SLOT, "0x7bcaa2ced2a71450ed5a9a1b4848e8e5206dbc3f06011e595f7f55428cc6f84f");
rejects(
  "reject non-native Kernel validation mode",
  () => decodeBankrExecution({
    from: relayer,
    to: ENTRY_POINT_V07,
    input: handleOps(wallet, 1n << 248n, v07KernelCall),
    value: "0x0",
  }, wallet),
  "validation mode/type 0x00/0x00",
);
rejects(
  "reject non-native Kernel validation type",
  () => decodeBankrExecution({
    from: relayer,
    to: ENTRY_POINT_V07,
    input: handleOps(wallet, 1n << 240n, v07KernelCall),
    value: "0x0",
  }, wallet),
  "validation mode/type 0x00/0x00",
);
rejects(
  "reject sponsored Kernel paymaster side effects",
  () => decodeBankrExecution({
    from: relayer,
    to: ENTRY_POINT_V07,
    input: handleOpsMany([userOperationTuple(wallet, v07Nonce, v07KernelCall, { paymaster: "0x1234" })]),
    value: "0x0",
  }, wallet),
  "must not use a paymaster",
);
rejects(
  "reject sponsored Kernel wallet self-call",
  () => decodeBankrExecution({
    from: relayer,
    to: ENTRY_POINT_V07,
    input: handleOps(wallet, v07Nonce, kernelExecute(wallet, 0n, buy)),
    value: "0x0",
  }, wallet),
  "must not target the active wallet itself",
);

equal(
  "zero rootValidator ABI result decodes",
  decodeRootValidator(`0x${"0".repeat(64)}`),
  `0x${"0".repeat(42)}`,
);
rejects(
  "reject malformed rootValidator ABI result",
  () => decodeRootValidator(`0x${"1".repeat(42)}${"1".repeat(22)}`),
  "canonical ABI bytes21",
);

const transferTopic = eventTopic("Transfer(address,address,uint256)");
const transferLog = {
  address: ADDR.baes,
  topics: [transferTopic, `0x${encodeAddress(relayer)}`, `0x${encodeAddress(wallet)}`],
  data: `0x${encodeUint(123n)}`,
};
equal("canonical ERC-20 transfer proof sums receipts", sumCanonicalErc20Transfers([transferLog], ADDR.baes, "to", wallet), 123n);
const selfTransferLog = {
  ...transferLog,
  topics: [transferTopic, `0x${encodeAddress(wallet)}`, `0x${encodeAddress(wallet)}`],
};
equal("ERC-20 self-transfer is not an incoming proof", sumCanonicalErc20Transfers([selfTransferLog], ADDR.baes, "to", wallet), 0n);
equal("ERC-20 self-transfer is not an outgoing proof", sumCanonicalErc20Transfers([selfTransferLog], ADDR.baes, "from", wallet), 0n);
rejects(
  "reject non-canonical ERC-20 indexed address",
  () => sumCanonicalErc20Transfers([{ ...transferLog, topics: [transferTopic, `0x${"f".repeat(64)}`, transferLog.topics[2]] }], ADDR.baes, "to", wallet),
  "canonical indexed address",
);
rejects(
  "reject malformed ERC-20 transfer data",
  () => sumCanonicalErc20Transfers([{ ...transferLog, data: "0x01" }], ADDR.baes, "to", wallet),
  "one uint256 word",
);

const v07UserOpHash = keccak256("punktown-v07-userop");
const v07Event = userOperationEvent(ENTRY_POINT_V07, wallet, v07Nonce, v07UserOpHash);
const v07Boundary = beforeExecutionEvent(ENTRY_POINT_V07);
const v07ReceiptProof = verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Boundary, v07Event] }, v07UserOpHash);
check("Bankr v0.7 successful user operation", v07ReceiptProof.success);
equal("Bankr v0.7 receipt sender", v07ReceiptProof.sender, wallet);
equal("Bankr v0.7 receipt gas-used metric", v07ReceiptProof.actualGasUsed, 456n);

function syntheticAuthorization(target, nonce = 0n) {
  return {
    chainId: "0x2105",
    address: target,
    nonce: `0x${nonce.toString(16)}`,
    yParity: "0x0",
    r: "0x1",
    s: "0x1",
  };
}

function syntheticTransaction(index, {
  type = "0x2",
  from = relayer,
  to = null,
  input = "0x",
  authorizations,
} = {}) {
  return {
    hash: keccak256(`delegation-tx-${index}-${type}-${authorizations?.length ?? 0}`),
    transactionIndex: `0x${index.toString(16)}`,
    type,
    from,
    to,
    input,
    ...(authorizations ? { authorizationList: authorizations } : {}),
  };
}

const zeroRootValidatorResult = `0x${"0".repeat(64)}`;
const persistentTargetTx = syntheticTransaction(0);
const persistentDelegationProof = await proveKernelDelegationAtTransaction({
  wallet,
  transaction: persistentTargetTx,
  block: { transactions: [persistentTargetTx] },
  parentWalletCode: KERNEL_DELEGATION_DESIGNATOR,
  parentWalletNonce: 7n,
  parentRootValidator: zeroRootValidatorResult,
  recoverAuthority: async () => wallet,
});
equal("persistent Bankr delegation source", persistentDelegationProof.parentState, "reviewed-kernel");
equal("persistent Bankr delegation transaction index", persistentDelegationProof.targetTransactionIndex, 0);

const firstUseAuthorization = syntheticAuthorization(KERNEL_IMPLEMENTATION);
const firstUseTargetTx = syntheticTransaction(0, { type: "0x4", authorizations: [firstUseAuthorization] });
const firstUseDelegationProof = await proveKernelDelegationAtTransaction({
  wallet,
  transaction: firstUseTargetTx,
  block: { transactions: [firstUseTargetTx] },
  parentWalletCode: "0x",
  parentWalletNonce: 0n,
  parentRootValidator: zeroRootValidatorResult,
  recoverAuthority: async () => wallet,
});
equal("first-use Bankr delegation source", firstUseDelegationProof.parentState, "empty");
equal("first-use Bankr authorization authority", firstUseDelegationProof.observedWalletAuthorizations[0].authority, wallet);
equal("first-use Bankr authorization target", firstUseDelegationProof.observedWalletAuthorizations[0].target, KERNEL_IMPLEMENTATION);

const maliciousImplementation = "0x3333333333333333333333333333333333333333";
const maliciousDelegationTx = syntheticTransaction(0, {
  type: "0x4",
  authorizations: [syntheticAuthorization(maliciousImplementation, 7n)],
});
const attackedTargetTx = syntheticTransaction(1);
const restoreDelegationTx = syntheticTransaction(2, {
  type: "0x4",
  authorizations: [syntheticAuthorization(KERNEL_IMPLEMENTATION, 9n)],
});
await rejectsAsync(
  "reject wrong delegate during target transaction even when restored later in block",
  () => proveKernelDelegationAtTransaction({
    wallet,
    transaction: attackedTargetTx,
    block: { transactions: [maliciousDelegationTx, attackedTargetTx, restoreDelegationTx] },
    parentWalletCode: KERNEL_DELEGATION_DESIGNATOR,
    parentWalletNonce: 7n,
    parentRootValidator: zeroRootValidatorResult,
    recoverAuthority: async () => wallet,
  }),
  "non-reviewed EIP-7702 authorization",
);
const wrongNonceFirstUseTx = syntheticTransaction(0, {
  type: "0x4",
  authorizations: [syntheticAuthorization(KERNEL_IMPLEMENTATION, 1n)],
});
await rejectsAsync(
  "reject first-use Bankr authorization with wrong transaction-order nonce",
  () => proveKernelDelegationAtTransaction({
    wallet,
    transaction: wrongNonceFirstUseTx,
    block: { transactions: [wrongNonceFirstUseTx] },
    parentWalletCode: "0x",
    parentWalletNonce: 0n,
    parentRootValidator: zeroRootValidatorResult,
    recoverAuthority: async () => wallet,
  }),
  "authorization nonce",
);
await rejectsAsync(
  "reject nonzero Kernel root validator at transaction boundary",
  () => proveKernelDelegationAtTransaction({
    wallet,
    transaction: persistentTargetTx,
    block: { transactions: [persistentTargetTx] },
    parentWalletCode: KERNEL_DELEGATION_DESIGNATOR,
    parentWalletNonce: 7n,
    parentRootValidator: `0x01${"0".repeat(62)}`,
    recoverAuthority: async () => wallet,
  }),
  "rootValidator was nonzero",
);
const priorWalletUserOpTx = syntheticTransaction(0, {
  to: ENTRY_POINT_V07,
  input: handleOps(wallet, v07Nonce, v07KernelCall),
});
const afterPriorWalletUserOpTx = syntheticTransaction(1);
await rejectsAsync(
  "reject prior same-block active-wallet user operation",
  () => proveKernelDelegationAtTransaction({
    wallet,
    transaction: afterPriorWalletUserOpTx,
    block: { transactions: [priorWalletUserOpTx, afterPriorWalletUserOpTx] },
    parentWalletCode: KERNEL_DELEGATION_DESIGNATOR,
    parentWalletNonce: 7n,
    parentRootValidator: zeroRootValidatorResult,
    recoverAuthority: async () => wallet,
  }),
  "prior same-block user operation",
);
const priorWalletSelfCallTx = syntheticTransaction(0, { from: wallet, to: wallet, input: "0x12345678" });
const afterPriorWalletSelfCallTx = syntheticTransaction(1);
await rejectsAsync(
  "reject prior same-block active-wallet self-call",
  () => proveKernelDelegationAtTransaction({
    wallet,
    transaction: afterPriorWalletSelfCallTx,
    block: { transactions: [priorWalletSelfCallTx, afterPriorWalletSelfCallTx] },
    parentWalletCode: KERNEL_DELEGATION_DESIGNATOR,
    parentWalletNonce: 7n,
    parentRootValidator: zeroRootValidatorResult,
    recoverAuthority: async () => wallet,
  }),
  "prior same-block self-call",
);

rejects(
  "reject sponsored userOp for another wallet",
  () => decodeBankrExecution({ from: relayer, to: ENTRY_POINT_V07, input: v07HandleOps, value: "0x0" }, relayer),
  "exactly one user operation for the active Bankr wallet",
);
const otherWallet = "0x2222222222222222222222222222222222222222";
const otherTuple = userOperationTuple(otherWallet, 3n, kernelExecute(logicalTarget, 0n, buy));
const walletTuple = userOperationTuple(wallet, v07Nonce, v07KernelCall);
const bundledHandleOps = handleOpsMany([otherTuple, walletTuple]);
const bundledEnvelope = decodeBankrExecution({
  from: relayer,
  to: ENTRY_POINT_V07,
  input: bundledHandleOps,
  value: "0x0",
}, wallet);
equal("Bankr selects active wallet from multi-user bundle", bundledEnvelope.userOperation.index, 1);
equal("Bankr reports multi-user bundle size", bundledEnvelope.userOperationCount, 2);
const otherUserOpHash = keccak256("other-userop");
const priorProtocolLog = { address: logicalTarget, topics: [eventTopic("UnrelatedProof(uint256)")], data: `0x${encodeUint(1n)}` };
const bundledProof = verifyBankrExecutionReceipt(bundledEnvelope, {
  logs: [
    v07Boundary,
    priorProtocolLog,
    userOperationEvent(ENTRY_POINT_V07, otherWallet, 3n, otherUserOpHash),
    v07Event,
  ],
}, v07UserOpHash);
equal("Bankr scopes selected userOp logs after prior operation", bundledProof.receiptLogRange.start, 3);
equal("Bankr scopes selected userOp logs before its event", bundledProof.receiptLogRange.end, 3);
rejects(
  "reject bundle with multiple active-wallet userOps",
  () => decodeBankrExecution({ from: relayer, to: ENTRY_POINT_V07, input: handleOpsMany([walletTuple, walletTuple]), value: "0x0" }, wallet),
  "exactly one user operation for the active Bankr wallet",
);
rejects(
  "reject Kernel non-default execution mode",
  () => decodeBankrExecution({ from: relayer, to: ENTRY_POINT_V07, input: handleOps(wallet, v07Nonce, kernelExecute(logicalTarget, 0n, buy, 1n)), value: "0x0" }, wallet),
  "single-call default mode",
);
rejects(
  "reject sponsored envelope trailing ABI data",
  () => decodeBankrExecution({ from: relayer, to: ENTRY_POINT_V07, input: `${v07HandleOps}${encodeUint(0n)}`, value: "0x0" }, wallet),
  "trailing or overlapping",
);
rejects(
  "reject sponsored outer native value",
  () => decodeBankrExecution({ from: relayer, to: ENTRY_POINT_V07, input: v07HandleOps, value: "0x1" }, wallet),
  "outer transaction must carry zero native value",
);
rejects(
  "reject missing EntryPoint userOp event",
  () => verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Boundary] }, v07UserOpHash),
  "exactly one matching EntryPoint UserOperationEvent",
);
rejects(
  "reject wrong-emitter userOp event",
  () => verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Boundary, { ...v07Event, address: relayer }] }, v07UserOpHash),
  "exactly one matching EntryPoint UserOperationEvent",
);
rejects(
  "reject mismatched userOp hash event",
  () => verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Boundary, v07Event] }, keccak256("different-userop")),
  "exactly one matching EntryPoint UserOperationEvent",
);
rejects(
  "reject failed logical userOp",
  () => verifyBankrExecutionReceipt(
    v07Envelope,
    { logs: [v07Boundary, userOperationEvent(ENTRY_POINT_V07, wallet, v07Nonce, v07UserOpHash, false)] },
    v07UserOpHash,
  ),
  "logical call reverted",
);
rejects(
  "reject duplicate EntryPoint userOp events",
  () => verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Boundary, v07Event, v07Event] }, v07UserOpHash),
  "exactly one matching EntryPoint UserOperationEvent",
);
rejects(
  "reject missing EntryPoint execution boundary",
  () => verifyBankrExecutionReceipt(v07Envelope, { logs: [v07Event] }, v07UserOpHash),
  "one EntryPoint BeforeExecution boundary",
);

rejects(
  "reject calldata trailing word",
  () => decodeCallArguments(["uint256", "uint256", "uint256", "uint256"], `${buy}${"0".repeat(64)}`),
  "non-canonical trailing",
);
rejects(
  "reject overlapping dynamic offset",
  () => decodeCallArguments(["uint256[]"], `0x8e28fc9e${encodeUint(0n)}`),
  "invalid dynamic offset",
);
const gappedSettleBatch =
  `0x8e28fc9e${encodeUint(64n)}${encodeUint(0xdeadn)}${encodeUint(2n)}${encodeUint(1n)}${encodeUint(2n)}`;
rejects(
  "reject gapped non-canonical dynamic calldata",
  () => decodeCallArguments(["uint256[]"], gappedSettleBatch),
  "canonical ABI re-encoding",
);
const nonCanonicalApproval = `0x095ea7b3${"01"}${"0".repeat(22)}${"11".repeat(20)}${encodeUint(1n)}`;
rejects(
  "reject non-canonical address word",
  () => decodeCallArguments(["address", "uint256"], nonCanonicalApproval),
  "non-canonical ABI address",
);

equal("ASCII bytes32", asciiBytes32("BANKR-PUNKTOWN"), "0x42414e4b522d50554e4b544f574e000000000000000000000000000000000000");
equal("parse BAES units", parseUnits("6600000", 18), BUY_TOTAL);
equal("format tiny WETH", formatUnits(81750413962n, 18), "0.000000081750413962");

// Position[] page: head(offset=64,nextCursor=2), array length=1, six static tuple words.
const fakePage =
  "0x" +
  encodeUint(64n) + encodeUint(2n) + encodeUint(1n) +
  encodeUint(44n) + encodeAddress(wallet) + encodeAddress(ADDR.owner) +
  encodeUint(158n) + encodeUint(1n) + encodeUint(1n);
const decodedPage = decodePositionsPage(fakePage, 1n);
equal("position page id", decodedPage.positions[0].id, 1n);
equal("position page token", decodedPage.positions[0].tokenId, 44n);
equal("position page beneficiary", decodedPage.positions[0].beneficiary, ADDR.owner.toLowerCase());
equal("position page next cursor", decodedPage.nextCursor, 2n);

// Dynamic stock tuple: top-level tuple offset, token, path offset, decimals, enabled, empty path.
const fakeStock =
  "0x" + encodeUint(32n) + encodeAddress(ADDR.baes) + encodeUint(128n) +
  encodeUint(8n) + encodeUint(1n) + encodeUint(0n);
const decodedStock = decodeStockEntry(fakeStock);
equal("stock tuple token", decodedStock.token, ADDR.baes.toLowerCase());
equal("stock tuple decimals", decodedStock.decimals, 8);
check("stock tuple enabled", decodedStock.enabled);

// Every catalogued signature must carry its actual Ethereum selector/topic.
let signatureCount = 0;
for (const target of Object.values(allowlist.targets)) {
  for (const entry of [...(target.reads ?? []), ...(target.writes ?? [])]) {
    signatureCount += 1;
    equal(`allowlist selector ${target.kind}.${entry.signature}`, entry.selector.toLowerCase(), selector(entry.signature));
  }
}
for (const event of allowlist.events) {
  equal(`event topic ${event.signature}`, event.topic0.toLowerCase(), eventTopic(event.signature));
}
check("broad selector coverage", signatureCount >= 100, `count=${signatureCount}`);
check("default deny policy", allowlist.policy.defaultDeny === true);
check("one tx at a time policy", allowlist.policy.submitOneTransactionAtATime === true);
check("exact ERC20 policy", /Exact amount only/.test(allowlist.policy.approvals.erc20));
check("token-specific ERC721 policy", /Token-specific/.test(allowlist.policy.approvals.erc721));

const userWriteSignatures = Object.values(allowlist.targets).flatMap((target) => (target.writes ?? []).map((entry) => entry.signature));
for (const forbidden of [
  "recoverExcess(uint8,address,uint256,address)", "wirePeersAndLock(address,address)",
  "pauseFeeRoute()", "pauseStockRoute()", "setRevenueSource(address,bool)",
  "sweepStockDust(address,address)", "queueStock(uint256,address,bytes,uint8)",
]) {
  check(`privileged call excluded: ${forbidden}`, !userWriteSignatures.includes(forbidden));
}

// Bankr's public skill format: frontmatter identity/discovery fields plus the
// standalone or curated catalog/install linkage must stay internally consistent.
const frontmatter = skillMarkdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] ?? "";
equal("Bankr frontmatter name", frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim(), "punktown");
check("Bankr frontmatter description", /^description:\s*\S.+$/m.test(frontmatter));
check("Bankr frontmatter tags", /^tags:\s*\[[^\]]+\]$/m.test(frontmatter));
equal("Bankr frontmatter version", frontmatter.match(/^version:\s*(\d+)$/m)?.[1], "3");
equal("Bankr frontmatter visibility", frontmatter.match(/^visibility:\s*(\S+)$/m)?.[1], "public");
if (catalog) {
  equal("catalog slug matches skill name", catalog.slug, "punktown");
  equal("catalog schema version", catalog.schemaVersion, 1);
  equal("catalog provider", catalog.provider, "Bario Entertainment System");
  const installsStandaloneRepo = catalog.install?.type === "bankr"
    && catalog.install?.repoPath === "."
    && catalog.install?.command === "install the skill at https://github.com/panikadak/punktown-bankr-skill";
  const installsCuratedRepo = catalog.install?.type === "bankr"
    && catalog.install?.repoPath === "punktown"
    && catalog.install?.command === "install the punktown skill from https://github.com/BankrBot/skills/tree/main/punktown";
  check("catalog installs a reviewed public source", installsStandaloneRepo || installsCuratedRepo);
} else {
  check("optional source-catalog metadata may be absent from an installed Bankr resource bundle", true);
}
equal("execution pin EntryPoint address", bankrExecution.sponsored.entryPoint.address.toLowerCase(), ENTRY_POINT_V07);
equal("execution pin EntryPoint runtime", bankrExecution.sponsored.entryPoint.runtimeCodeHash, ENTRY_POINT_V07_CODE_HASH);
equal("execution pin Kernel implementation", bankrExecution.sponsored.account.implementation, KERNEL_IMPLEMENTATION);
equal("execution pin Kernel validation slot", bankrExecution.sponsored.account.validationStorageSlot, KERNEL_VALIDATION_STORAGE_SLOT);
equal("execution pin Kernel root selector", bankrExecution.sponsored.account.rootValidatorSelector, ROOT_VALIDATOR_SELECTOR);
check("execution pin requires native validation and no paymaster", bankrExecution.sponsored.account.requiredValidationMode === "0x00"
  && bankrExecution.sponsored.account.requiredValidationType === "0x00"
  && bankrExecution.sponsored.account.requireEmptyPaymasterAndData === true);
check("execution pin includes live first-use type-4 fixture", bankrExecution.sponsored.liveRegressionFixtures.some((fixture) => fixture.transactionType === 4
  && fixture.authorizationTarget === KERNEL_IMPLEMENTATION));
check("execution pin limits proven acquisition sources", bankrExecution.acquisition.provenSourceAssets.map((source) => source.symbol).join(",") === "ETH,WETH,USDC"
  && bankrExecution.acquisition.rejectOtherSourceAssets === true);

// Bankr loads these files; keep each below its 100 KB limit.
for (const relative of [
  "SKILL.md", "references/operations.md", "references/bankr-execution.md", "references/natural-join-flow.md",
  "references/deployment.json", "references/signing-allowlist.json", "references/bankr-execution.json",
]) {
  try {
    const bytes = statSync(new URL(`../${relative}`, import.meta.url)).size;
    check(`${relative} under 100 KB`, bytes < 100_000, `${bytes} bytes`);
  } catch (error) {
    check(`${relative} exists`, false, error.message);
  }
}

if (process.argv.includes("--live")) {
  async function liveDelegationProof(transaction, receipt, activeWallet) {
    const receiptBlock = await getBlockByHash(receipt.blockHash, true);
    const parentBlockRef = { blockHash: receiptBlock.parentHash, requireCanonical: true };
    const [parentWalletCode, parentWalletNonce] = await Promise.all([
      getCode(activeWallet, parentBlockRef),
      getTransactionCount(activeWallet, parentBlockRef),
    ]);
    let parentRootValidator;
    if (parentWalletCode === "0x") {
      equal(
        "live Bankr empty parent has no retained Kernel validation state",
        await getStorageAt(activeWallet, KERNEL_VALIDATION_STORAGE_SLOT, parentBlockRef),
        zeroRootValidatorResult,
      );
      parentRootValidator = zeroRootValidatorResult;
    } else {
      parentRootValidator = await ethCall(activeWallet, ROOT_VALIDATOR_SELECTOR, null, parentBlockRef);
    }
    return await proveKernelDelegationAtTransaction({
      wallet: activeWallet,
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
  }

  const integrity = await verifyDeployment();
  check("live deployment integrity", integrity.ok, integrity.failed.join(", "));
  const status = await protocolStatus();
  check("live system open inventory read", BigInt(status.desk.inventoryCount) >= 0n);
  check("live route booleans", typeof status.routes.feeRoutePaused === "boolean" && typeof status.routes.stockRoutePaused === "boolean");
  const page = await inventoryPage(0n, 1n);
  check("live FIFO page decodes", Array.isArray(page.values) && page.values.length <= 1);
  equal("live release pin", DEPLOYMENT.release.commit, "2bbf9e3");

  // This hash is tied to Bankr's public token-launch activity feed and proves
  // the real relayer -> EntryPoint -> delegated wallet -> logical call shape.
  const bankrFixtureHash = "0xfdf361d11a6cb47861094961e289a9f9e5dbf8910a9a0cbbd48a916df35aa1bb";
  const bankrFixtureWallet = "0x3aa337f5d049859baf3b9e10ef990f8ceb25ef20";
  const [bankrTransaction, bankrReceipt] = await Promise.all([
    getTransaction(bankrFixtureHash),
    getReceipt(bankrFixtureHash),
  ]);
  check("live Bankr fixture transaction and receipt", Boolean(bankrTransaction && bankrReceipt));
  if (bankrTransaction && bankrReceipt) {
    const bankrEnvelope = decodeBankrExecution(bankrTransaction, bankrFixtureWallet);
    equal("live Bankr fixture sponsored mode", bankrEnvelope.mode, "bankr-entrypoint-kernel-single");
    equal("live Bankr fixture logical sender", bankrEnvelope.logicalSender, bankrFixtureWallet);
    equal("live Bankr fixture native validation mode", bankrEnvelope.validation.mode, 0);
    equal("live Bankr fixture native validation type", bankrEnvelope.validation.type, 0);
    equal("live Bankr fixture has no paymaster", bankrEnvelope.userOperation.paymasterAndData, "0x");
    equal(
      "live Bankr EntryPoint runtime pin",
      await getCodeHash(ENTRY_POINT_V07, bankrReceipt.blockNumber),
      ENTRY_POINT_V07_CODE_HASH,
    );
    equal(
      "live Bankr EIP-7702 delegation pin",
      (await getCode(bankrFixtureWallet, bankrReceipt.blockNumber)).toLowerCase(),
      `0xef0100${KERNEL_IMPLEMENTATION.slice(2)}`,
    );
    const liveUserOpHash = decodeBytes32(await ethCall(
      bankrEnvelope.entryPoint,
      userOperationHashCall(bankrEnvelope),
      null,
      bankrReceipt.blockNumber,
    ));
    const liveReceiptProof = verifyBankrExecutionReceipt(bankrEnvelope, bankrReceipt, liveUserOpHash);
    check("live Bankr UserOperationEvent proves logical success", liveReceiptProof.success);
    const delegationProof = await liveDelegationProof(bankrTransaction, bankrReceipt, bankrFixtureWallet);
    equal("live Bankr persistent delegation is transaction-order proven", delegationProof.parentState, "reviewed-kernel");
    equal("live Bankr persistent root validator is zero", delegationProof.parentRootValidator, `0x${"0".repeat(42)}`);
  }

  const bankrBundleHash = "0x4913736cfafb2e269f33fe3e4507c879c4c09dbe927d8334c697528e337ae8a5";
  const bankrBundleWallet = "0x3aa337f5d049859baf3b9e10ef990f8ceb25ef20";
  const [bundleTransaction, bundleReceipt] = await Promise.all([
    getTransaction(bankrBundleHash),
    getReceipt(bankrBundleHash),
  ]);
  check("live Bankr multi-user fixture transaction and receipt", Boolean(bundleTransaction && bundleReceipt));
  if (bundleTransaction && bundleReceipt) {
    const bundleEnvelope = decodeBankrExecution(bundleTransaction, bankrBundleWallet);
    equal("live Bankr selects second bundled userOp", bundleEnvelope.userOperation.index, 1);
    equal("live Bankr multi-user bundle size", bundleEnvelope.userOperationCount, 2);
    const bundleUserOpHash = decodeBytes32(await ethCall(
      bundleEnvelope.entryPoint,
      userOperationHashCall(bundleEnvelope),
      null,
      bundleReceipt.blockNumber,
    ));
    const bundleProof = verifyBankrExecutionReceipt(bundleEnvelope, bundleReceipt, bundleUserOpHash);
    equal("live Bankr selected bundle userOp hash", bundleProof.userOpHash, "0xb3f4906b3bef2921a8f314719ebdbbc2311460f5d08c2e0d7b8986dbab29e177");
    check("live Bankr multi-user logical call succeeds", bundleProof.success);
    equal("live Bankr wrapper attribution decoded", bundleEnvelope.attribution?.codes?.[0], "bc_i85qhgg2");
    equal("live Bankr bundle has no paymaster", bundleEnvelope.userOperation.paymasterAndData, "0x");
    const scopedBundleLogs = bundleReceipt.logs.slice(
      bundleProof.receiptLogRange.start,
      bundleProof.receiptLogRange.end,
    );
    check(
      "live Bankr multi-user log window is isolated",
      scopedBundleLogs.length > 0
        && BigInt(scopedBundleLogs[0].logIndex) === 0x409n
        && BigInt(scopedBundleLogs.at(-1).logIndex) === 0x41cn,
    );
    const bundleDelegationProof = await liveDelegationProof(bundleTransaction, bundleReceipt, bankrBundleWallet);
    equal("live Bankr bundle delegation is transaction-order proven", bundleDelegationProof.parentState, "reviewed-kernel");
  }

  const bankrFirstUseHash = "0x8c7a851e34d3545001ff346a72986e90bdbee06e13e40cd587edad8171cb7c65";
  const bankrFirstUseWallet = "0x5ba986ab1a9a239a57b1b83bbb7c6d7bac156681";
  const [firstUseTransaction, firstUseReceipt] = await Promise.all([
    getTransaction(bankrFirstUseHash),
    getReceipt(bankrFirstUseHash),
  ]);
  check("live Bankr first-use fixture transaction and receipt", Boolean(firstUseTransaction && firstUseReceipt));
  if (firstUseTransaction && firstUseReceipt) {
    equal("live Bankr first-use fixture is type 4", BigInt(firstUseTransaction.type), 4n);
    const firstUseEnvelope = decodeBankrExecution(firstUseTransaction, bankrFirstUseWallet);
    equal("live Bankr first-use sponsored mode", firstUseEnvelope.mode, "bankr-entrypoint-kernel-single");
    equal("live Bankr first-use native validation mode", firstUseEnvelope.validation.mode, 0);
    equal("live Bankr first-use native validation type", firstUseEnvelope.validation.type, 0);
    equal("live Bankr first-use has no paymaster", firstUseEnvelope.userOperation.paymasterAndData, "0x");
    const firstUseProof = await liveDelegationProof(firstUseTransaction, firstUseReceipt, bankrFirstUseWallet);
    equal("live Bankr first-use parent is empty", firstUseProof.parentState, "empty");
    equal("live Bankr first-use authorization count", firstUseProof.observedWalletAuthorizations.length, 1);
    equal("live Bankr first-use recovered authority", firstUseProof.observedWalletAuthorizations[0].authority, bankrFirstUseWallet);
    equal("live Bankr first-use authorization target", firstUseProof.observedWalletAuthorizations[0].target, KERNEL_IMPLEMENTATION);
    equal("live Bankr first-use authorization chain", firstUseProof.observedWalletAuthorizations[0].chainId, 8453n);
    equal("live Bankr first-use authorization nonce", firstUseProof.observedWalletAuthorizations[0].nonce, 0n);
    equal("live Bankr first-use root validator is zero", firstUseProof.parentRootValidator, `0x${"0".repeat(42)}`);
  }
}

const failed = results.filter((result) => !result.pass);
for (const result of results) {
  console.error(`${result.pass ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  (${result.detail})` : ""}`);
}
console.log(JSON.stringify({ ok: failed.length === 0, checks: results.length, failed: failed.map((result) => result.name) }));
process.exitCode = failed.length === 0 ? 0 : 1;
