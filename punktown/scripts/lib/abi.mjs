import { selector } from "./keccak256.mjs";

export function strip0x(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

export function padWord(value) {
  const hex = strip0x(String(value));
  if (hex.length > 64) throw new Error("value exceeds one ABI word");
  return hex.padStart(64, "0");
}

export function wordAt(data, index) {
  const hex = strip0x(data);
  return hex.slice(index * 64, (index + 1) * 64);
}

export function toBigInt(word) {
  if (!word) return 0n;
  return BigInt(`0x${strip0x(word) || "0"}`);
}

export function toAddress(word) {
  const hex = strip0x(word);
  if (hex.length < 40) throw new Error("short ABI address word");
  return `0x${hex.slice(-40)}`.toLowerCase();
}

export function normalizeAddress(address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  return address.toLowerCase();
}

export function encodeAddress(address) {
  return padWord(strip0x(normalizeAddress(address)));
}

export function encodeUint(value, bits = 256) {
  const bigint = BigInt(value);
  if (bigint < 0n || bigint >= 1n << BigInt(bits)) throw new Error(`uint${bits} out of range`);
  return padWord(bigint.toString(16));
}

export function encodeBool(value) {
  return encodeUint(value ? 1n : 0n);
}

export function encodeBytes32(value) {
  const hex = strip0x(value);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("bytes32 must be exactly 32 bytes");
  return hex.toLowerCase();
}

export function asciiBytes32(value) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length === 0 || bytes.length > 32) throw new Error("source id must contain 1..32 UTF-8 bytes");
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").padEnd(64, "0")}`;
}

function isDynamic(type) {
  return type.endsWith("[]");
}

function encodeStatic(type, value) {
  if (type === "address") return encodeAddress(value);
  if (type === "bool") return encodeBool(value);
  if (type === "bytes32") return encodeBytes32(value);
  const uintMatch = type.match(/^uint(8|16|24|32|48|64|128|160|256)?$/);
  if (uintMatch) return encodeUint(value, Number(uintMatch[1] || 256));
  throw new Error(`unsupported static ABI type: ${type}`);
}

function encodeDynamic(type, value) {
  if (!Array.isArray(value)) throw new Error(`${type} value must be an array`);
  const elementType = type.slice(0, -2);
  return encodeUint(value.length) + value.map((entry) => encodeStatic(elementType, entry)).join("");
}

export function encodeParameters(types, values) {
  if (types.length !== values.length) throw new Error("ABI type/value count mismatch");
  const head = [];
  const tails = [];
  let tailBytes = types.length * 32;
  for (let index = 0; index < types.length; index += 1) {
    if (isDynamic(types[index])) {
      const encoded = encodeDynamic(types[index], values[index]);
      head.push(encodeUint(tailBytes));
      tails.push(encoded);
      tailBytes += encoded.length / 2;
    } else {
      head.push(encodeStatic(types[index], values[index]));
    }
  }
  return head.join("") + tails.join("");
}

export function encodeCall(signature, types = [], values = []) {
  return selector(signature) + encodeParameters(types, values);
}

export function decodeUint(data, index = 0) {
  return toBigInt(wordAt(data, index));
}

export function decodeBool(data, index = 0) {
  const value = decodeUint(data, index);
  if (value !== 0n && value !== 1n) throw new Error("invalid ABI bool");
  return value === 1n;
}

export function decodeAddress(data, index = 0) {
  return toAddress(wordAt(data, index));
}

export function decodeBytes32(data, index = 0) {
  const word = wordAt(data, index);
  if (word.length !== 64) throw new Error("short ABI bytes32 result");
  return `0x${word.toLowerCase()}`;
}

export function decodeString(data) {
  const hex = strip0x(data);
  const offsetWords = Number(toBigInt(wordAt(hex, 0)) / 32n);
  const length = Number(toBigInt(wordAt(hex, offsetWords)));
  const body = hex.slice((offsetWords + 1) * 64, (offsetWords + 1) * 64 + length * 2);
  return new TextDecoder().decode(Uint8Array.from(body.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []));
}

export function decodeDynamicArray(data, elementType = "uint256", offsetIndex = 0) {
  const hex = strip0x(data);
  const start = Number(toBigInt(wordAt(hex, offsetIndex)) / 32n);
  const length = Number(toBigInt(wordAt(hex, start)));
  const output = [];
  for (let index = 0; index < length; index += 1) {
    const word = wordAt(hex, start + 1 + index);
    output.push(elementType === "address" ? toAddress(word) : toBigInt(word));
  }
  return output;
}

export function decodePagedUintArray(data) {
  return {
    values: decodeDynamicArray(data, "uint256", 0),
    nextCursor: decodeUint(data, 1),
  };
}

export function decodePosition(data) {
  return {
    tokenId: decodeUint(data, 0),
    depositor: decodeAddress(data, 1),
    beneficiary: decodeAddress(data, 2),
    weight: Number(decodeUint(data, 3)),
    tier: Number(decodeUint(data, 4)),
    active: decodeBool(data, 5),
  };
}

export function decodePositionsPage(data, cursor) {
  const hex = strip0x(data);
  const start = Number(toBigInt(wordAt(hex, 0)) / 32n);
  const length = Number(toBigInt(wordAt(hex, start)));
  const positions = [];
  for (let index = 0; index < length; index += 1) {
    const base = start + 1 + index * 6;
    positions.push({
      id: BigInt(cursor) + BigInt(index),
      tokenId: toBigInt(wordAt(hex, base)),
      depositor: toAddress(wordAt(hex, base + 1)),
      beneficiary: toAddress(wordAt(hex, base + 2)),
      weight: Number(toBigInt(wordAt(hex, base + 3))),
      tier: Number(toBigInt(wordAt(hex, base + 4))),
      active: toBigInt(wordAt(hex, base + 5)) === 1n,
    });
  }
  return { positions, nextCursor: decodeUint(hex, 1) };
}

export function decodeFeeRoute(data) {
  const selectorWord = wordAt(data, 5);
  return {
    router: decodeAddress(data, 0),
    tokenIn: decodeAddress(data, 1),
    tokenOut: decodeAddress(data, 2),
    poolId: decodeBytes32(data, 3),
    recipient: decodeAddress(data, 4),
    selector: `0x${selectorWord.slice(0, 8)}`,
    routeHash: decodeBytes32(data, 6),
    feeTier: Number(decodeUint(data, 7)),
    stable: decodeBool(data, 8),
  };
}

export function decodeStockEntry(data, pending = false) {
  const hex = strip0x(data);
  const first = decodeUint(hex, 0);
  const base = first === 32n ? 1 : 0;
  return pending
    ? {
        token: decodeAddress(hex, base),
        decimals: Number(decodeUint(hex, base + 2)),
        readyAt: decodeUint(hex, base + 3),
      }
    : {
        token: decodeAddress(hex, base),
        decimals: Number(decodeUint(hex, base + 2)),
        enabled: decodeBool(hex, base + 3),
      };
}

function decodeStaticValue(type, word) {
  if (type === "address") {
    if (!/^0{24}[0-9a-fA-F]{40}$/.test(word)) throw new Error("non-canonical ABI address word");
    return toAddress(word);
  }
  if (type === "bool") {
    const value = toBigInt(word);
    if (value !== 0n && value !== 1n) throw new Error("non-canonical ABI bool word");
    return value === 1n;
  }
  if (type === "bytes32") return `0x${word.toLowerCase()}`;
  const uintMatch = type.match(/^uint(8|16|24|32|48|64|128|160|256)?$/);
  if (uintMatch) {
    const bits = BigInt(Number(uintMatch[1] || 256));
    const value = toBigInt(word);
    if (value >= 1n << bits) throw new Error(`non-canonical ${type} word`);
    return value;
  }
  throw new Error(`unsupported ABI decode type: ${type}`);
}

export function decodeCallArguments(types, calldata) {
  const full = strip0x(calldata);
  if (full.length < 8 || (full.length - 8) % 64 !== 0) throw new Error("calldata is not selector plus whole ABI words");
  const payload = full.slice(8);
  if (payload.length < types.length * 64) throw new Error("calldata ABI head is truncated");
  const values = [];
  let usedBytes = types.length * 32;
  for (let index = 0; index < types.length; index += 1) {
    const type = types[index];
    const headWord = wordAt(payload, index);
    if (!isDynamic(type)) {
      values.push(decodeStaticValue(type, headWord));
      continue;
    }
    const offset = Number(toBigInt(headWord));
    if (!Number.isSafeInteger(offset) || offset < types.length * 32 || offset % 32 !== 0) {
      throw new Error(`invalid dynamic offset for ${type}`);
    }
    const startWord = offset / 32;
    const length = Number(toBigInt(wordAt(payload, startWord)));
    if (!Number.isSafeInteger(length)) throw new Error(`unsafe array length for ${type}`);
    const elementType = type.slice(0, -2);
    const array = [];
    for (let item = 0; item < length; item += 1) {
      const word = wordAt(payload, startWord + 1 + item);
      if (word.length !== 64) throw new Error(`truncated ${type} data`);
      array.push(decodeStaticValue(elementType, word));
    }
    usedBytes = Math.max(usedBytes, offset + 32 + length * 32);
    values.push(array);
  }
  if (payload.length !== usedBytes * 2) throw new Error("calldata has non-canonical trailing or overlapping ABI data");
  const canonicalPayload = encodeParameters(types, values).toLowerCase();
  if (payload.toLowerCase() !== canonicalPayload) throw new Error("calldata does not match canonical ABI re-encoding");
  return values;
}

const ERC8021_MARKER = "80218021802180218021802180218021";

export function stripErc8021Suffix(calldata) {
  const full = strip0x(calldata);
  if (!full.toLowerCase().endsWith(ERC8021_MARKER)) {
    return { calldata: calldata.startsWith("0x") ? calldata : `0x${calldata}`, attribution: null };
  }
  const markerStart = full.length - ERC8021_MARKER.length;
  if (markerStart < 4) throw new Error("malformed ERC-8021 suffix");
  const schemaId = full.slice(markerStart - 2, markerStart).toLowerCase();
  const decodeCodes = (codesHex) => {
    let codes;
    try {
      codes = new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(codesHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []),
      );
    } catch {
      throw new Error("invalid ERC-8021 builder-code UTF-8");
    }
    if (codes !== "" && (!/^[\x20-\x7e]+$/.test(codes) || codes.split(",").some((code) => code.length === 0))) {
      throw new Error("invalid ERC-8021 builder codes");
    }
    return codes === "" ? [] : codes.split(",");
  };

  if (schemaId === "00" || schemaId === "01") {
    const lengthIndex = markerStart - 4;
    const codesLength = Number.parseInt(full.slice(lengthIndex, lengthIndex + 2), 16);
    const codesStart = lengthIndex - codesLength * 2;
    if (!Number.isInteger(codesLength) || codesStart < 8) throw new Error(`malformed ERC-8021 schema-${Number(schemaId)} length`);
    const codesHex = full.slice(codesStart, lengthIndex);
    if (codesHex.length !== codesLength * 2) throw new Error(`malformed ERC-8021 schema-${Number(schemaId)} codes`);
    const codes = decodeCodes(codesHex);
    if (schemaId === "00") {
      return {
        calldata: `0x${full.slice(0, codesStart)}`,
        attribution: { standard: "ERC-8021", schemaId: 0, codes },
      };
    }

    const chainLengthIndex = codesStart - 2;
    if (chainLengthIndex < 8) throw new Error("malformed ERC-8021 schema-1 registry length");
    const chainIdLength = Number.parseInt(full.slice(chainLengthIndex, chainLengthIndex + 2), 16);
    if (!Number.isInteger(chainIdLength) || chainIdLength < 1) throw new Error("malformed ERC-8021 schema-1 chainId length");
    const chainIdStart = chainLengthIndex - chainIdLength * 2;
    const registryStart = chainIdStart - 40;
    if (registryStart < 8) throw new Error("malformed ERC-8021 schema-1 registry");
    const registryAddress = `0x${full.slice(registryStart, chainIdStart).toLowerCase()}`;
    const chainIdHex = full.slice(chainIdStart, chainLengthIndex);
    if (chainIdHex.length !== chainIdLength * 2 || /^00/.test(chainIdHex)) throw new Error("non-canonical ERC-8021 schema-1 chainId");
    const chainId = Number.parseInt(chainIdHex, 16);
    if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error("invalid ERC-8021 schema-1 chainId");
    return {
      calldata: `0x${full.slice(0, registryStart)}`,
      attribution: {
        standard: "ERC-8021",
        schemaId: 1,
        codes,
        codeRegistry: { address: registryAddress, chainId },
      },
    };
  }

  if (schemaId === "02") {
    const lengthStart = markerStart - 6;
    if (lengthStart < 8) throw new Error("malformed ERC-8021 schema-2 length");
    const cborLength = Number.parseInt(full.slice(lengthStart, markerStart - 2), 16);
    const cborStart = lengthStart - cborLength * 2;
    if (!Number.isInteger(cborLength) || cborLength < 1 || cborStart < 8) throw new Error("malformed ERC-8021 schema-2 CBOR length");
    const cborHex = full.slice(cborStart, lengthStart);
    if (cborHex.length !== cborLength * 2) throw new Error("malformed ERC-8021 schema-2 CBOR data");
    return {
      calldata: `0x${full.slice(0, cborStart)}`,
      attribution: { standard: "ERC-8021", schemaId: 2, opaque: true, cborBytes: cborLength },
    };
  }

  throw new Error(`unsupported ERC-8021 schema 0x${schemaId}`);
}

export function parseUnits(value, decimals) {
  const text = String(value).trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) throw new Error(`invalid decimal amount: ${value}`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`amount has more than ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function formatUnits(value, decimals, precision = decimals) {
  const raw = BigInt(value);
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  let fraction = (absolute % base).toString().padStart(decimals, "0");
  fraction = fraction.slice(0, Math.min(decimals, precision)).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function jsonValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonValue(entry)]));
  }
  return value;
}
