/**
 * build-merkle.ts — hand-rolled sorted-pair merkle tree compatible
 * with cc0.company's CC0CollectionShared `_verifyAllowlistProof`.
 *
 * Use this if you don't want to pull `@openzeppelin/merkle-tree`.
 * The convention is the same:
 *
 *   - leaf = keccak256(abi.encodePacked(address, uint256))
 *   - intermediate nodes hash the SORTED pair (lo, hi) of children
 *   - root is the final hash
 *
 * The on-chain verifier walks the proof the same way: for each
 * sibling, it sorts (current, sibling) and hashes — so any proof
 * produced here is accepted by the contract as-is.
 *
 * Run with: `tsx examples/build-merkle.ts`
 * Requires: viem (for keccak256 + encodePacked).
 */

import { keccak256, encodePacked, type Hex } from "viem"

export interface AllowlistEntry {
  address: `0x${string}`
  limit: bigint
}

function leafHash(entry: AllowlistEntry): Hex {
  return keccak256(
    encodePacked(["address", "uint256"], [entry.address, entry.limit]),
  )
}

function pairHash(a: Hex, b: Hex): Hex {
  // Sorted-pair: smaller hash first, so verification is direction-
  // independent (the verifier doesn't need to know "left or right").
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return keccak256(`${lo}${hi.slice(2)}` as Hex)
}

export interface MerkleTree {
  root: Hex
  leaves: Hex[]
  layers: Hex[][]
}

export function buildMerkleTree(entries: AllowlistEntry[]): MerkleTree {
  if (entries.length === 0) {
    // Empty tree → root = bytes32(0). Matches EMPTY_MERKLE_ROOT
    // semantics used by the frontend.
    return {
      root: ("0x" + "00".repeat(32)) as Hex,
      leaves: [],
      layers: [[]],
    }
  }

  // Dedup by lowercased address (last write wins on limit) — must
  // match what computeMerkleRoot() does on the frontend.
  const dedup = new Map<string, AllowlistEntry>()
  for (const e of entries) {
    dedup.set(e.address.toLowerCase(), e)
  }
  const normalized = Array.from(dedup.values()).map((e) => ({
    address: e.address.toLowerCase() as `0x${string}`,
    limit: e.limit,
  }))

  const leaves = normalized.map(leafHash).sort()
  const layers: Hex[][] = [leaves]

  let layer = leaves
  while (layer.length > 1) {
    const next: Hex[] = []
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) {
        // Odd node out — promote unchanged. (Matches OpenZeppelin.)
        next.push(layer[i])
      } else {
        next.push(pairHash(layer[i], layer[i + 1]))
      }
    }
    layers.push(next)
    layer = next
  }

  return { root: layer[0], leaves, layers }
}

export function getProof(
  tree: MerkleTree,
  entry: AllowlistEntry,
): Hex[] {
  const target = leafHash({
    address: entry.address.toLowerCase() as `0x${string}`,
    limit: entry.limit,
  })
  let idx = tree.leaves.indexOf(target)
  if (idx < 0) {
    throw new Error(
      `Entry ${entry.address}/${entry.limit} not in this tree. Did you dedup before passing it in?`,
    )
  }

  const proof: Hex[] = []
  for (let l = 0; l < tree.layers.length - 1; l++) {
    const layer = tree.layers[l]
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1
    if (siblingIdx < layer.length) {
      proof.push(layer[siblingIdx])
    }
    idx = Math.floor(idx / 2)
  }
  return proof
}

// ─── Demo ──────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries: AllowlistEntry[] = [
    {
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      limit: 3n,
    },
    {
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      limit: 1n,
    },
    {
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      limit: 5n,
    },
  ]

  const tree = buildMerkleTree(entries)
  console.log("root:", tree.root)
  console.log("leaves:", tree.leaves.length)
  console.log("layers:", tree.layers.length)

  const proof = getProof(tree, entries[0])
  console.log(
    "proof for",
    entries[0].address,
    "limit",
    entries[0].limit.toString(),
    ":",
    proof,
  )
  console.log(
    "→ pass to collection.mint(qty, proof, limit) when this address mints",
  )
}
