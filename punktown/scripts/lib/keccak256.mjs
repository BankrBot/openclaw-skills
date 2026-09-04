// Zero-dependency Keccak-256 for Ethereum selectors, topics, and code hashes.
// Keccak uses suffix 0x01; Node's built-in sha3-256 uses a different suffix.

const MASK_64 = (1n << 64n) - 1n;
const RATE_BYTES = 136;

const ROTATION = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n,
  0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n,
  0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn,
  0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n,
  0x0000000080000001n, 0x8000000080008008n,
];

function rotl64(value, amount) {
  const shift = BigInt(amount);
  if (shift === 0n) return value & MASK_64;
  return ((value << shift) | (value >> (64n - shift))) & MASK_64;
}

function keccakF(state) {
  const c = new Array(5).fill(0n);
  const d = new Array(5).fill(0n);
  const b = new Array(25).fill(0n);

  for (const roundConstant of ROUND_CONSTANTS) {
    for (let x = 0; x < 5; x += 1) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x += 1) {
      d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    }
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const index = x + 5 * y;
        state[index] = (state[index] ^ d[x]) & MASK_64;
      }
    }

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const newX = y;
        const newY = (2 * x + 3 * y) % 5;
        b[newX + 5 * newY] = rotl64(state[x + 5 * y], ROTATION[x + 5 * y]);
      }
    }

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        state[x + 5 * y] =
          b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y] & MASK_64) & b[((x + 2) % 5) + 5 * y]);
      }
    }
    state[0] ^= roundConstant;
  }
}

function inputBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== "string") throw new TypeError("keccak256 input must be a string or Uint8Array");
  if (value.startsWith("0x")) {
    const hex = value.slice(2);
    if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error("invalid hex input");
    return Uint8Array.from(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  }
  return new TextEncoder().encode(value);
}

export function keccak256(value) {
  const bytes = inputBytes(value);
  const paddedLength = Math.ceil((bytes.length + 1) / RATE_BYTES) * RATE_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += RATE_BYTES) {
    for (let lane = 0; lane < RATE_BYTES / 8; lane += 1) {
      let word = 0n;
      for (let byte = 0; byte < 8; byte += 1) {
        word |= BigInt(padded[offset + lane * 8 + byte]) << BigInt(byte * 8);
      }
      state[lane] ^= word;
    }
    keccakF(state);
  }

  const output = new Uint8Array(32);
  for (let i = 0; i < output.length; i += 1) {
    output[i] = Number((state[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 0xffn);
  }
  return `0x${Array.from(output, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function selector(signature) {
  return keccak256(signature).slice(0, 10);
}

export function eventTopic(signature) {
  return keccak256(signature);
}
