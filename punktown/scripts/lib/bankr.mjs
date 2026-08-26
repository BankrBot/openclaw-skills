import { encodeUint, normalizeAddress, strip0x, stripErc8021Suffix } from "./abi.mjs";
import { eventTopic, keccak256, selector } from "./keccak256.mjs";

// Bankr's current gas-sponsored Base wallet path uses EntryPoint v0.7. A
// bundler may place unrelated users in the same handleOps transaction, but the
// active wallet must have exactly one PackedUserOperation and that operation
// must be Kernel's fail-on-error ERC-7579 single call. Keep the decoder narrow:
// an unknown entry point, wallet batch, try-mode, delegatecall, or
// non-canonical ABI fails closed.
export const ENTRY_POINT_V07 = "0x0000000071727de22e5e9d8baf0edac6f37da032";
export const ENTRY_POINT_V07_CODE_HASH = "0x8db5ff695839d655407cc8490bb7a5d82337a86a6b39c3f0258aa6c3b582fc58";
export const HANDLE_OPS_SELECTOR = selector(
  "handleOps((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[],address)",
);
export const KERNEL_EXECUTE_SELECTOR = selector("execute(bytes32,bytes)");
export const ROOT_VALIDATOR_SELECTOR = selector("rootValidator()");
export const GET_USER_OP_HASH_SELECTOR = selector(
  "getUserOpHash((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes))",
);
export const USER_OPERATION_EVENT_TOPIC = eventTopic(
  "UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)",
);
export const BEFORE_EXECUTION_EVENT_TOPIC = eventTopic("BeforeExecution()");
export const KERNEL_IMPLEMENTATION = "0xd6cedde84be40893d153be9d467cd6ad37875b28";
export const KERNEL_IMPLEMENTATION_CODE_HASH = "0xe5b56d82025d2358308f77833fe29c3856b1a7a0f7a4b9f86b1fd77da3e3b4fb";
export const KERNEL_DELEGATION_DESIGNATOR = `0xef0100${KERNEL_IMPLEMENTATION.slice(2)}`;
export const ECRECOVER_PRECOMPILE = "0x0000000000000000000000000000000000000001";
export const KERNEL_VALIDATION_STORAGE_SLOT = "0x7bcaa2ced2a71450ed5a9a1b4848e8e5206dbc3f06011e595f7f55428cc6f84f";

const WORD_BYTES = 32;
const MAX_ENVELOPE_BYTES = 1_000_000;
const MAX_USER_OPERATIONS = 256;
const MAX_BLOCK_TRANSACTIONS = 10_000;
const MAX_BLOCK_AUTHORIZATIONS = 1_024;
const ZERO_EXEC_MODE = `0x${"0".repeat(64)}`;
const ZERO_ROOT_VALIDATOR = `0x${"0".repeat(42)}`;
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const ERC20_TRANSFER_TOPIC = eventTopic("Transfer(address,address,uint256)");

function fail(detail) {
  throw new Error(detail);
}

function hexBody(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    fail(`${label} must be even-length hex`);
  }
  const body = strip0x(value).toLowerCase();
  if (body.length / 2 > MAX_ENVELOPE_BYTES) fail(`${label} exceeds ${MAX_ENVELOPE_BYTES} bytes`);
  return body;
}

function bytesLength(hex) {
  return hex.length / 2;
}

function sliceBytes(hex, offset, length, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
    fail(`${label} has an unsafe byte range`);
  }
  const end = offset + length;
  if (!Number.isSafeInteger(end) || end > bytesLength(hex)) fail(`${label} is truncated`);
  return hex.slice(offset * 2, end * 2);
}

function wordAtByte(hex, offset, label) {
  return sliceBytes(hex, offset, WORD_BYTES, label);
}

function uintWord(hex, offset, label) {
  return BigInt(`0x${wordAtByte(hex, offset, label)}`);
}

function safeOffset(hex, offset, label) {
  const value = uintWord(hex, offset, label);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${label} exceeds the safe integer range`);
  const number = Number(value);
  if (number % WORD_BYTES !== 0) fail(`${label} is not word-aligned`);
  return number;
}

function addressWord(hex, offset, label) {
  const word = wordAtByte(hex, offset, label);
  if (!/^0{24}[0-9a-f]{40}$/.test(word)) fail(`${label} is not a canonical ABI address`);
  return normalizeAddress(`0x${word.slice(-40)}`);
}

function topicAddress(topic, label) {
  const body = hexBody(topic, label);
  if (!/^0{24}[0-9a-f]{40}$/.test(body)) fail(`${label} is not a canonical indexed address`);
  return normalizeAddress(`0x${body.slice(-40)}`);
}

function hash32(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) fail(`${label} must be 32-byte hex`);
  return value.toLowerCase();
}

function rpcUint(value, label, bits = 256) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) fail(`${label} must be a hex quantity`);
  const parsed = BigInt(value);
  if (parsed < 0n || parsed >= 1n << BigInt(bits)) fail(`${label} exceeds uint${bits}`);
  return parsed;
}

function minimalIntegerHex(value) {
  if (value === 0n) return "";
  const encoded = value.toString(16);
  return encoded.length % 2 === 0 ? encoded : `0${encoded}`;
}

function rlpLength(length, shortBase, longBase) {
  if (length <= 55) return (shortBase + length).toString(16).padStart(2, "0");
  const encodedLength = minimalIntegerHex(BigInt(length));
  const lengthBytes = encodedLength.length / 2;
  if (lengthBytes > 8) fail("RLP payload length is too large");
  return `${(longBase + lengthBytes).toString(16).padStart(2, "0")}${encodedLength}`;
}

function rlpBytes(body) {
  if (!/^[0-9a-f]*$/.test(body) || body.length % 2 !== 0) fail("RLP byte string must be canonical hex");
  const length = body.length / 2;
  if (length === 1 && Number.parseInt(body, 16) < 0x80) return body;
  return `${rlpLength(length, 0x80, 0xb7)}${body}`;
}

function rlpList(items) {
  const body = items.join("");
  return `${rlpLength(body.length / 2, 0xc0, 0xf7)}${body}`;
}

export function authorizationRecoveryCall(authorization) {
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
    fail("EIP-7702 authorization must be an object");
  }
  const chainId = rpcUint(authorization.chainId, "authorization chainId");
  const target = normalizeAddress(authorization.address);
  const nonce = rpcUint(authorization.nonce, "authorization nonce", 64);
  const yParity = rpcUint(authorization.yParity, "authorization yParity", 8);
  const r = rpcUint(authorization.r, "authorization r");
  const s = rpcUint(authorization.s, "authorization s");
  const signatureCanonical = (yParity === 0n || yParity === 1n)
    && r > 0n && r < SECP256K1_N
    && s > 0n && s <= SECP256K1_N / 2n;
  const authorizationRlp = rlpList([
    rlpBytes(minimalIntegerHex(chainId)),
    rlpBytes(strip0x(target)),
    rlpBytes(minimalIntegerHex(nonce)),
  ]);
  const authorizationHash = keccak256(`0x05${authorizationRlp}`);
  return {
    chainId,
    target,
    nonce,
    yParity,
    r,
    s,
    signatureCanonical,
    authorizationHash,
    callData: `0x${strip0x(authorizationHash)}${encodeUint(yParity + 27n)}${encodeUint(r)}${encodeUint(s)}`,
  };
}

export function decodeAuthorizationAuthority(result) {
  const body = hexBody(result, "ecrecover result");
  if (body.length === 0 || /^0+$/.test(body)) return null;
  if (!/^0{24}[0-9a-f]{40}$/.test(body)) fail("ecrecover result is not a canonical address word");
  return normalizeAddress(`0x${body.slice(-40)}`);
}

export function decodeRootValidator(result) {
  const body = hexBody(result, "rootValidator result");
  if (!/^[0-9a-f]{42}0{22}$/.test(body)) fail("rootValidator result is not canonical ABI bytes21");
  return `0x${body.slice(0, 42)}`;
}

export function sumCanonicalErc20Transfers(logs, tokenAddress, direction, accountAddress) {
  if (!Array.isArray(logs)) fail("receipt logs must be an array");
  if (direction !== "from" && direction !== "to") fail("ERC-20 transfer direction must be from or to");
  const token = normalizeAddress(tokenAddress);
  const account = normalizeAddress(accountAddress);
  let total = 0n;
  for (let index = 0; index < logs.length; index += 1) {
    const log = logs[index];
    if (!log || typeof log !== "object") fail(`receipt log ${index} is not an object`);
    let emitter;
    try {
      emitter = normalizeAddress(log.address);
    } catch {
      fail(`receipt log ${index} has an invalid emitter address`);
    }
    if (emitter !== token) continue;
    if (typeof log.topics?.[0] !== "string" || log.topics[0].toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    if (log.topics.length !== 3) fail(`ERC-20 Transfer log ${index} must have exactly three topics`);
    const from = topicAddress(log.topics[1], `ERC-20 Transfer log ${index} from`);
    const to = topicAddress(log.topics[2], `ERC-20 Transfer log ${index} to`);
    const data = hexBody(log.data, `ERC-20 Transfer log ${index} data`);
    if (!/^[0-9a-f]{64}$/.test(data)) fail(`ERC-20 Transfer log ${index} data must be one uint256 word`);
    const selected = direction === "from" ? from : to;
    const counterparty = direction === "from" ? to : from;
    if (selected === account && counterparty !== account) total += BigInt(`0x${data}`);
  }
  return total;
}

export async function proveKernelDelegationAtTransaction({
  wallet: expectedWallet,
  transaction,
  block,
  parentWalletCode,
  parentWalletNonce,
  parentRootValidator,
  recoverAuthority,
}) {
  const wallet = normalizeAddress(expectedWallet);
  if (!transaction || !block || typeof recoverAuthority !== "function") {
    fail("delegation proof requires transaction, block, and authority recovery");
  }
  if (!Array.isArray(block.transactions)
    || block.transactions.length < 1
    || block.transactions.length > MAX_BLOCK_TRANSACTIONS) {
    fail(`receipt block must contain 1..${MAX_BLOCK_TRANSACTIONS} full transactions`);
  }
  const targetHash = hash32(transaction.hash, "transaction hash");
  const targetIndexValue = rpcUint(transaction.transactionIndex, "transaction index");
  if (targetIndexValue > BigInt(Number.MAX_SAFE_INTEGER)) fail("transaction index exceeds the safe integer range");
  const targetIndex = Number(targetIndexValue);
  if (targetIndex >= block.transactions.length) fail("transaction index is outside the receipt block");
  const indexedTransaction = block.transactions[targetIndex];
  if (!indexedTransaction || hash32(indexedTransaction.hash, "indexed transaction hash") !== targetHash) {
    fail("receipt block transaction index does not match the transaction hash");
  }

  const parentCode = hexBody(parentWalletCode, "parent-block wallet code");
  const expectedDelegation = strip0x(KERNEL_DELEGATION_DESIGNATOR);
  const parentState = parentCode.length === 0
    ? "empty"
    : parentCode === expectedDelegation
      ? "reviewed-kernel"
      : null;
  if (!parentState) fail("wallet was not empty or delegated to the reviewed Kernel at the parent block");
  const parentNonce = BigInt(parentWalletNonce);
  if (parentNonce < 0n || parentNonce >= 1n << 64n) fail("parent-block wallet nonce exceeds uint64");
  const rootValidator = decodeRootValidator(parentRootValidator);
  if (rootValidator !== ZERO_ROOT_VALIDATOR) {
    fail("Bankr wallet rootValidator was nonzero before the target transaction");
  }

  let authorizationCount = 0;
  let walletOriginations = 0n;
  const observedWalletAuthorizations = [];
  const targetWalletAuthorizations = [];
  for (let index = 0; index <= targetIndex; index += 1) {
    const candidate = block.transactions[index];
    if (!candidate || typeof candidate !== "object") fail(`block transaction ${index} is not a full transaction object`);
    const candidateFrom = normalizeAddress(candidate.from);
    const candidateTarget = candidate.to === null || candidate.to === undefined
      ? null
      : normalizeAddress(candidate.to);
    if (candidateFrom === wallet) walletOriginations += 1n;
    if (index < targetIndex && candidateFrom === wallet && candidateTarget === wallet) {
      fail("active Bankr wallet made a prior same-block self-call before logical execution");
    }
    if (index < targetIndex && candidateTarget === ENTRY_POINT_V07) {
      const candidateInput = candidate.input ?? candidate.data ?? "0x";
      const candidateSelector = typeof candidateInput === "string" && candidateInput.length >= 10
        ? candidateInput.slice(0, 10).toLowerCase()
        : null;
      if (candidateSelector !== HANDLE_OPS_SELECTOR) {
        fail("unsupported prior same-block EntryPoint call prevents root-validator proof");
      }
      const priorUserOperations = decodePackedUserOperations(candidateInput).userOperations;
      if (priorUserOperations.some((userOperation) => userOperation.sender === wallet)) {
        fail("active Bankr wallet had a prior same-block user operation before logical execution");
      }
    }
    const type = rpcUint(candidate.type ?? "0x0", `block transaction ${index} type`, 8);
    const authorizations = candidate.authorizationList;
    if (type === 4n) {
      if (!Array.isArray(authorizations) || authorizations.length < 1) {
        fail(`type-4 block transaction ${index} has no authorization list`);
      }
    } else if (authorizations !== undefined && (!Array.isArray(authorizations) || authorizations.length !== 0)) {
      fail(`non-type-4 block transaction ${index} carries an authorization list`);
    }
    for (const authorization of authorizations ?? []) {
      authorizationCount += 1;
      if (authorizationCount > MAX_BLOCK_AUTHORIZATIONS) {
        fail(`receipt block prefix exceeds ${MAX_BLOCK_AUTHORIZATIONS} EIP-7702 authorizations`);
      }
      const parsed = authorizationRecoveryCall(authorization);
      if ((parsed.chainId !== 0n && parsed.chainId !== 8453n) || !parsed.signatureCanonical) continue;
      const authority = await recoverAuthority(parsed);
      if (authority === null || normalizeAddress(authority) !== wallet) continue;
      const observed = {
        transactionIndex: index,
        authority: wallet,
        target: parsed.target,
        nonce: parsed.nonce,
        chainId: parsed.chainId,
        authorizationHash: parsed.authorizationHash,
      };
      observedWalletAuthorizations.push(observed);
      if (parsed.target !== KERNEL_IMPLEMENTATION) {
        fail("active Bankr wallet has a non-reviewed EIP-7702 authorization before logical execution");
      }
      if (parentState === "empty" && index < targetIndex) {
        fail("same-block delegation before first-use Bankr execution is unsupported");
      }
      if (index === targetIndex) targetWalletAuthorizations.push(observed);
    }
  }

  if (parentState === "empty") {
    if (targetWalletAuthorizations.length !== 1) {
      fail("first-use Bankr execution requires exactly one reviewed wallet authorization in the target transaction");
    }
    const expectedNonce = parentNonce + walletOriginations;
    if (targetWalletAuthorizations[0].nonce !== expectedNonce) {
      fail("first-use Bankr wallet authorization nonce does not match transaction-order state");
    }
  }
  if (targetWalletAuthorizations.length > 1) {
    fail("target Bankr transaction has multiple active-wallet EIP-7702 authorizations");
  }
  return {
    parentState,
    parentWalletNonce: parentNonce,
    parentRootValidator: rootValidator,
    nativeValidation: {
      mode: 0,
      type: 0,
      paymaster: null,
      priorWalletUserOperations: 0,
      priorWalletSelfCalls: 0,
    },
    targetTransactionIndex: targetIndex,
    walletOriginationsThroughTarget: walletOriginations,
    observedWalletAuthorizations,
    executionDelegation: KERNEL_DELEGATION_DESIGNATOR,
    source: parentState === "reviewed-kernel"
      ? "parent-block delegation plus ordered authorization exclusion"
      : "target-transaction authorization signature and nonce",
  };
}

function dynamicBytesAt(hex, base, relativeOffset, label) {
  const absolute = base + relativeOffset;
  const lengthValue = uintWord(hex, absolute, `${label} length`);
  if (lengthValue > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${label} length exceeds the safe integer range`);
  const length = Number(lengthValue);
  const paddedLength = Math.ceil(length / WORD_BYTES) * WORD_BYTES;
  const bodyStart = absolute + WORD_BYTES;
  const data = sliceBytes(hex, bodyStart, length, label);
  const padding = sliceBytes(hex, bodyStart + length, paddedLength - length, `${label} padding`);
  if (!/^0*$/.test(padding)) fail(`${label} has nonzero ABI padding`);
  return {
    data: `0x${data}`,
    length,
    endRelative: relativeOffset + WORD_BYTES + paddedLength,
  };
}

function decodeUserOperations(calldata, { handleSelector, headWords, paymasterIndex, signatureIndex, label }) {
  const full = hexBody(calldata, `${label} calldata`);
  if (full.length < 8 || `0x${full.slice(0, 8)}` !== handleSelector) {
    fail(`outer calldata is not ${label} handleOps`);
  }
  const payload = full.slice(8);
  if (payload.length % (WORD_BYTES * 2) !== 0) fail("handleOps payload is not whole ABI words");
  if (bytesLength(payload) < 4 * WORD_BYTES) fail("handleOps payload is truncated");

  const arrayOffset = safeOffset(payload, 0, "userOps offset");
  if (arrayOffset !== 2 * WORD_BYTES) fail("userOps offset is non-canonical");
  const beneficiary = addressWord(payload, WORD_BYTES, "handleOps beneficiary");
  const userOpCountValue = uintWord(payload, arrayOffset, "userOps length");
  if (userOpCountValue < 1n || userOpCountValue > BigInt(MAX_USER_OPERATIONS)) {
    fail(`handleOps must contain 1..${MAX_USER_OPERATIONS} user operations`);
  }
  const userOpCount = Number(userOpCountValue);
  const elementsBase = arrayOffset + WORD_BYTES;
  let expectedElementOffset = userOpCount * WORD_BYTES;
  const userOperations = [];

  for (let index = 0; index < userOpCount; index += 1) {
    const elementOffset = safeOffset(payload, elementsBase + index * WORD_BYTES, `userOps[${index}] offset`);
    if (elementOffset !== expectedElementOffset) fail(`userOps[${index}] offset is non-canonical`);
    const tupleStart = elementsBase + elementOffset;
    const userOperationHeadBytes = headWords * WORD_BYTES;
    if (tupleStart + userOperationHeadBytes > bytesLength(payload)) {
      fail(`${label} UserOperation ${index} head is truncated`);
    }
    const sender = addressWord(payload, tupleStart, `${label} UserOperation ${index} sender`);
    const nonce = uintWord(payload, tupleStart + WORD_BYTES, `${label} UserOperation ${index} nonce`);
    const initCodeOffset = safeOffset(payload, tupleStart + 2 * WORD_BYTES, `userOps[${index}] initCode offset`);
    const callDataOffset = safeOffset(payload, tupleStart + 3 * WORD_BYTES, `userOps[${index}] callData offset`);
    const paymasterOffset = safeOffset(payload, tupleStart + paymasterIndex * WORD_BYTES, `userOps[${index}] paymasterAndData offset`);
    const signatureOffset = safeOffset(payload, tupleStart + signatureIndex * WORD_BYTES, `userOps[${index}] signature offset`);

    let expectedTupleOffset = userOperationHeadBytes;
    if (initCodeOffset !== expectedTupleOffset) fail(`userOps[${index}] initCode offset is non-canonical`);
    const initCode = dynamicBytesAt(payload, tupleStart, initCodeOffset, `userOps[${index}] initCode`);
    expectedTupleOffset = initCode.endRelative;
    if (callDataOffset !== expectedTupleOffset) fail(`userOps[${index}] callData offset is non-canonical`);
    const callData = dynamicBytesAt(payload, tupleStart, callDataOffset, `userOps[${index}] callData`);
    expectedTupleOffset = callData.endRelative;
    if (paymasterOffset !== expectedTupleOffset) fail(`userOps[${index}] paymasterAndData offset is non-canonical`);
    const paymasterAndData = dynamicBytesAt(payload, tupleStart, paymasterOffset, `userOps[${index}] paymasterAndData`);
    expectedTupleOffset = paymasterAndData.endRelative;
    if (signatureOffset !== expectedTupleOffset) fail(`userOps[${index}] signature offset is non-canonical`);
    const signature = dynamicBytesAt(payload, tupleStart, signatureOffset, `userOps[${index}] signature`);
    expectedTupleOffset = signature.endRelative;
    const encodedTuple = `0x${sliceBytes(payload, tupleStart, expectedTupleOffset, `${label} UserOperation ${index} tuple`)}`;
    userOperations.push({
      version: label,
      beneficiary,
      index,
      sender,
      nonce,
      initCode: initCode.data,
      callData: callData.data,
      paymasterAndData: paymasterAndData.data,
      signature: signature.data,
      encodedTuple,
    });
    expectedElementOffset += expectedTupleOffset;
  }
  if (elementsBase + expectedElementOffset !== bytesLength(payload)) {
    fail("handleOps calldata has trailing or overlapping ABI data");
  }
  return { beneficiary, userOperations };
}

export function decodePackedUserOperations(calldata) {
  return decodeUserOperations(calldata, {
    handleSelector: HANDLE_OPS_SELECTOR,
    headWords: 9,
    paymasterIndex: 7,
    signatureIndex: 8,
    label: "EntryPoint v0.7",
  });
}

export function decodeSinglePackedUserOperation(calldata) {
  const decoded = decodePackedUserOperations(calldata);
  if (decoded.userOperations.length !== 1) fail("expected exactly one packed user operation");
  return decoded.userOperations[0];
}

export function decodeKernelSingleCall(calldata) {
  const full = hexBody(calldata, "Kernel calldata");
  if (full.length < 8 || `0x${full.slice(0, 8)}` !== KERNEL_EXECUTE_SELECTOR) {
    fail("user operation is not Kernel execute(bytes32,bytes)");
  }
  const payload = full.slice(8);
  if (payload.length % (WORD_BYTES * 2) !== 0 || bytesLength(payload) < 3 * WORD_BYTES) {
    fail("Kernel execute payload is not canonical ABI data");
  }
  const execMode = `0x${wordAtByte(payload, 0, "Kernel execMode")}`;
  if (execMode !== ZERO_EXEC_MODE) {
    fail("Kernel execution must be single-call default mode; batch, try, and delegate modes are unsupported");
  }
  const executionOffset = safeOffset(payload, WORD_BYTES, "Kernel executionCalldata offset");
  if (executionOffset !== 2 * WORD_BYTES) fail("Kernel executionCalldata offset is non-canonical");
  const execution = dynamicBytesAt(payload, 0, executionOffset, "Kernel executionCalldata");
  if (execution.endRelative !== bytesLength(payload)) fail("Kernel calldata has trailing or overlapping ABI data");

  const packed = hexBody(execution.data, "Kernel single execution");
  if (bytesLength(packed) < 52) fail("Kernel single execution is shorter than target plus value");
  const target = normalizeAddress(`0x${sliceBytes(packed, 0, 20, "Kernel target")}`);
  if (target === "0x0000000000000000000000000000000000000000") fail("Kernel target must be nonzero");
  const value = BigInt(`0x${sliceBytes(packed, 20, 32, "Kernel value")}`);
  const data = `0x${sliceBytes(packed, 52, bytesLength(packed) - 52, "Kernel call data")}`;
  return { execMode, target, value, data };
}

export function decodeBankrExecution(transaction, expectedWallet) {
  const wallet = normalizeAddress(expectedWallet);
  const outerFrom = normalizeAddress(transaction.from);
  const outerTarget = transaction.to ? normalizeAddress(transaction.to) : null;
  const input = transaction.input ?? transaction.data ?? "0x";
  const outerValue = BigInt(transaction.value ?? 0);
  const outerSelector = typeof input === "string" && input.length >= 10 ? input.slice(0, 10).toLowerCase() : null;

  if (outerTarget === ENTRY_POINT_V07 && outerSelector === HANDLE_OPS_SELECTOR) {
    if (outerValue !== 0n) fail("Bankr EntryPoint outer transaction must carry zero native value");
    const decoded = decodePackedUserOperations(input);
    const matching = decoded.userOperations.filter((candidate) => candidate.sender === wallet);
    if (matching.length !== 1) fail("EntryPoint bundle must contain exactly one user operation for the active Bankr wallet");
    const [userOperation] = matching;
    if (userOperation.initCode !== "0x") fail("Bankr EIP-7702 user operation must not deploy a separate account");
    const validationMode = Number((userOperation.nonce >> 248n) & 0xffn);
    const validationType = Number((userOperation.nonce >> 240n) & 0xffn);
    if (validationMode !== 0 || validationType !== 0) {
      fail("Bankr Kernel user operation must use native EIP-7702 validation mode/type 0x00/0x00");
    }
    if (userOperation.paymasterAndData !== "0x") {
      fail("Bankr Kernel user operation must not use a paymaster");
    }
    const attributedCall = stripErc8021Suffix(userOperation.callData);
    const logicalCall = decodeKernelSingleCall(attributedCall.calldata);
    if (logicalCall.target === wallet) {
      fail("Bankr logical call must not target the active wallet itself");
    }
    return {
      mode: "bankr-entrypoint-kernel-single",
      entryPointVersion: "0.7",
      entryPoint: ENTRY_POINT_V07,
      accountKind: "kernel-eip7702",
      logicalSender: wallet,
      logicalCall,
      outer: { from: outerFrom, target: outerTarget, value: outerValue },
      userOperation,
      validation: { mode: validationMode, type: validationType, rootValidator: ZERO_ROOT_VALIDATOR },
      userOperationCount: decoded.userOperations.length,
      attribution: attributedCall.attribution,
    };
  }

  if (outerFrom !== wallet) fail("transaction sender does not match the active Bankr wallet or supported sponsored envelope");
  if (!outerTarget) fail("direct Bankr transaction cannot be a contract creation");
  if (outerTarget === wallet) fail("Bankr logical call must not target the active wallet itself");
  const directType = rpcUint(transaction.type ?? "0x0", "direct transaction type", 8);
  const directAuthorizations = transaction.authorizationList;
  if (directType === 4n || (Array.isArray(directAuthorizations) && directAuthorizations.length > 0)) {
    fail("direct Bankr transaction must not carry EIP-7702 authorizations");
  }
  if (directAuthorizations !== undefined && !Array.isArray(directAuthorizations)) {
    fail("direct transaction authorizationList must be an array when present");
  }
  return {
    mode: "direct-wallet-transaction",
    entryPointVersion: null,
    entryPoint: null,
    accountKind: "direct",
    logicalSender: wallet,
    logicalCall: { target: outerTarget, value: outerValue, data: input },
    outer: { from: outerFrom, target: outerTarget, value: outerValue },
    userOperation: null,
    userOperationCount: null,
    attribution: null,
  };
}

export function userOperationHashCall(envelope) {
  if (!envelope.userOperation || !envelope.entryPointVersion) fail("direct transactions have no user-operation hash call");
  return `${GET_USER_OP_HASH_SELECTOR}${encodeUint(WORD_BYTES)}${strip0x(envelope.userOperation.encodedTuple)}`;
}

export function verifyBankrExecutionReceipt(envelope, receipt, expectedUserOpHash = null) {
  if (envelope.mode === "direct-wallet-transaction") return null;
  if (typeof expectedUserOpHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(expectedUserOpHash)) {
    fail("sponsored receipt verification requires the EntryPoint-computed userOpHash");
  }
  const canonicalHash = expectedUserOpHash.toLowerCase();
  const logs = receipt.logs ?? [];
  const matching = logs.map((log, receiptIndex) => ({ log, receiptIndex })).filter(({ log }) => {
    try {
      return normalizeAddress(log.address) === envelope.entryPoint
        && log.topics?.[0]?.toLowerCase() === USER_OPERATION_EVENT_TOPIC
        && log.topics?.[1]?.toLowerCase() === canonicalHash;
    } catch {
      return false;
    }
  });
  if (matching.length !== 1) fail("sponsored receipt must contain exactly one matching EntryPoint UserOperationEvent");
  const [{ log: event, receiptIndex: eventReceiptIndex }] = matching;
  if (event.topics.length !== 4) fail("EntryPoint UserOperationEvent has an invalid topic count");
  const sender = topicAddress(event.topics[2], "UserOperationEvent sender");
  if (sender !== envelope.logicalSender) fail("UserOperationEvent sender does not match the active Bankr wallet");
  const data = hexBody(event.data, "UserOperationEvent data");
  if (bytesLength(data) !== 4 * WORD_BYTES) fail("UserOperationEvent data has an invalid length");
  const nonce = uintWord(data, 0, "UserOperationEvent nonce");
  if (nonce !== envelope.userOperation.nonce) fail("UserOperationEvent nonce does not match the submitted user operation");
  const success = uintWord(data, WORD_BYTES, "UserOperationEvent success");
  if (success !== 0n && success !== 1n) fail("UserOperationEvent success is not a canonical bool");
  if (success !== 1n) fail("Bankr user operation was included but its logical call reverted");

  const beforeExecutionIndices = [];
  const userOperationEventIndices = [];
  for (let index = 0; index <= eventReceiptIndex; index += 1) {
    const log = logs[index];
    let isEntryPoint = false;
    try {
      isEntryPoint = normalizeAddress(log.address) === envelope.entryPoint;
    } catch {
      // Ignore malformed unrelated logs; they cannot be emitted by the pinned EntryPoint.
    }
    if (!isEntryPoint) continue;
    const topic0 = log.topics?.[0]?.toLowerCase();
    if (topic0 === BEFORE_EXECUTION_EVENT_TOPIC) beforeExecutionIndices.push(index);
    if (topic0 === USER_OPERATION_EVENT_TOPIC) userOperationEventIndices.push(index);
  }
  if (beforeExecutionIndices.length !== 1) fail("sponsored receipt must contain one EntryPoint BeforeExecution boundary");
  const beforeExecutionIndex = beforeExecutionIndices[0];
  if (beforeExecutionIndex >= eventReceiptIndex) fail("EntryPoint BeforeExecution boundary is out of order");
  const completedAfterBoundary = userOperationEventIndices.filter((index) => index > beforeExecutionIndex);
  if (completedAfterBoundary.length !== envelope.userOperation.index + 1
    || completedAfterBoundary.at(-1) !== eventReceiptIndex) {
    fail("matching UserOperationEvent is not at the decoded user operation's bundle index");
  }
  const previousBoundaryIndex = envelope.userOperation.index === 0
    ? beforeExecutionIndex
    : completedAfterBoundary.at(-2);
  return {
    userOpHash: canonicalHash,
    sender,
    nonce,
    success: true,
    actualGasCost: uintWord(data, 2 * WORD_BYTES, "UserOperationEvent actualGasCost"),
    actualGasUsed: uintWord(data, 3 * WORD_BYTES, "UserOperationEvent actualGasUsed"),
    bundleIndex: envelope.userOperation.index,
    bundleSize: envelope.userOperationCount,
    receiptLogRange: {
      start: previousBoundaryIndex + 1,
      end: eventReceiptIndex,
    },
  };
}
