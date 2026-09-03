/** Keccak-256 (Ethereum), not NIST SHA3. No runtime dependencies. */
const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROTATION = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];
const MASK = 0xffffffffffffffffn;

function rotl(value, shift) {
  const n = BigInt(shift);
  return ((value << n) | (value >> (64n - n))) & MASK;
}

function keccakF(lanes) {
  for (let round = 0; round < 24; round++) {
    const c = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) {
      c[x] = lanes[x][0] ^ lanes[x][1] ^ lanes[x][2] ^ lanes[x][3] ^ lanes[x][4];
    }
    const d = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) lanes[x][y] ^= d[x];
    }
    const next = Array.from({ length: 5 }, () => [0n, 0n, 0n, 0n, 0n]);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        next[y][(2 * x + 3 * y) % 5] = rotl(lanes[x][y], ROTATION[x][y]);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        lanes[x][y] = next[x][y] ^ (~next[(x + 1) % 5][y] & next[(x + 2) % 5][y]);
      }
    }
    lanes[0][0] ^= ROUND_CONSTANTS[round];
  }
}

export function hexToBytes(value) {
  const hex = String(value).replace(/^0x/i, "");
  if (hex.length % 2 !== 0 || (hex && !/^[0-9a-fA-F]+$/.test(hex))) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function keccak256(data) {
  const input = typeof data === "string" ? hexToBytes(data) : data;
  const rate = 136;
  const lanes = Array.from({ length: 5 }, () => [0n, 0n, 0n, 0n, 0n]);
  const block = new Uint8Array(rate);
  let offset = 0;
  const absorb = (chunk) => {
    for (let i = 0; i < rate; i += 8) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) lane |= BigInt(chunk[i + j]) << BigInt(8 * j);
      lanes[(i / 8) % 5][Math.floor(i / 8 / 5)] ^= lane;
    }
    keccakF(lanes);
  };
  for (let i = 0; i < input.length; i++) {
    block[offset++] = input[i];
    if (offset === rate) {
      absorb(block);
      offset = 0;
    }
  }
  block.fill(0, offset);
  block[offset] ^= 0x01;
  block[rate - 1] ^= 0x80;
  absorb(block);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const lane = lanes[Math.floor(i / 8) % 5][Math.floor(i / 8 / 5)];
    out[i] = Number((lane >> BigInt(8 * (i % 8))) & 0xffn);
  }
  return bytesToHex(out);
}

export function selector(signature) {
  return keccak256(new TextEncoder().encode(signature)).slice(0, 10);
}
