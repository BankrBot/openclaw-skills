/**
 * full-deploy.ts — end-to-end deploy of an ERC721Shared collection
 * as an AI agent. Walks all 5 steps from SKILL.md.
 *
 * Run with: `tsx examples/full-deploy.ts ./your-artwork.png`
 *
 * Env required:
 *   CC0_AGENT_API_KEY      — agent API key (Bearer)
 *   CDP_API_KEY_ID         — Coinbase CDP credentials...
 *   CDP_API_KEY_SECRET     — ...for signing the ETH payment
 *
 * The CDP SDK paths in here can be swapped for any viem-compatible
 * signer — see SKILL.md "Step 4" for the viem alternative.
 */

import { readFile } from "node:fs/promises"
import { CdpClient } from "@coinbase/cdp-sdk"

const API = "https://cc0.company/api"
const CHUNK_SIZE = 50_000

const API_KEY = process.env.CC0_AGENT_API_KEY
if (!API_KEY) {
  throw new Error("CC0_AGENT_API_KEY is required")
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
}

async function main() {
  const artworkPath = process.argv[2]
  if (!artworkPath) {
    throw new Error("Usage: tsx full-deploy.ts <path-to-artwork>")
  }

  // ─── Step 1: Create draft ─────────────────────────────────────
  const draft = await jsonPost(`${API}/store/agents/me/collections`, {
    name: "Cosmic Dreams",
    symbol: "COSMIC",
    description: "100 editions of a hand-drawn cosmic scene.",
    token_standard: "ERC721Shared",
    chain: "base",
    max_supply: 100,
    mint_price: "1000000000000000", // 0.001 ETH
    payment_token: "0x0000000000000000000000000000000000000000",
    royalty_bps: 500,
  })
  if (!draft.success) {
    throw new Error(`Draft creation failed: ${draft.error}`)
  }
  const collectionId: string = draft.collection.id
  console.log("✓ Draft created:", collectionId)

  // ─── Step 2: Upload artwork chunks ────────────────────────────
  const bytes = await readFile(artworkPath)
  const mime = guessMime(artworkPath)
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`
  const chunks: string[] = []
  for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) {
    chunks.push(dataUrl.slice(i, i + CHUNK_SIZE))
  }
  for (let i = 0; i < chunks.length; i++) {
    const res = await jsonPost(
      `${API}/store/agents/me/collections/${collectionId}/artwork-chunk`,
      {
        chunk_index: i,
        total_chunks: chunks.length,
        data: chunks[i],
      },
    )
    if (!res.success) {
      throw new Error(`Chunk ${i} failed: ${res.error}`)
    }
    process.stdout.write(`\rchunk ${i + 1}/${chunks.length}`)
  }
  console.log("\n✓ Artwork buffered:", chunks.length, "chunks")

  // ─── Step 3: Get the deploy quote (402 challenge) ─────────────
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
  })
  const account = await cdp.evm.getOrCreateAccount({ name: "my-agent" })
  console.log("✓ Wallet:", account.address)

  const now = Math.floor(Date.now() / 1000)
  const deployParams = {
    name: "Cosmic Dreams",
    symbol: "COSMIC",
    description: "100 editions of a hand-drawn cosmic scene.",
    maxSupply: "100",
    mintSettings: {
      publicMintPrice: "1000000000000000",
      paymentToken: "0x0000000000000000000000000000000000000000",
      mintStart: now,
      mintEnd: now + 60 * 60 * 24 * 30, // 30 days
      maxPerAddress: "5",
    },
    withdrawRecipients: [
      { recipient: account.address, percentage: 10000 },
    ],
    royaltyRecipient: account.address,
    royaltyBps: 500,
    owner: account.address,
    initialMerkleRoot:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  }

  const quote = await jsonPost(
    `${API}/store/agents/me/collections/${collectionId}/orchestrate-shared-deploy`,
    { deploy_params: deployParams },
  )
  if (quote.success || quote.error !== "Payment Required") {
    throw new Error(`Expected 402 quote, got: ${JSON.stringify(quote)}`)
  }
  console.log(
    "✓ Quote received:",
    quote.ethCostWei,
    "wei to",
    quote.platformWallet,
  )

  // ─── Step 4: Pay the quoted amount ────────────────────────────
  const { transactionHash: paymentTxHash } = await account.sendTransaction({
    network: "base",
    transaction: {
      to: quote.platformWallet as `0x${string}`,
      value: BigInt(quote.ethCostWei),
      data: "0x",
    },
  })
  console.log("✓ Payment sent:", paymentTxHash)

  // ─── Step 5: Finalize the deploy ──────────────────────────────
  console.log("→ Orchestrating deploy + artwork commit (this takes 10-30s)…")
  const deployed = await jsonPost(
    `${API}/store/agents/me/collections/${collectionId}/orchestrate-shared-deploy`,
    {
      payment_tx_hash: paymentTxHash,
      deploy_params: deployParams,
    },
  )
  if (!deployed.success) {
    throw new Error(`Deploy failed: ${JSON.stringify(deployed)}`)
  }
  console.log("\n✅ COLLECTION LIVE")
  console.log("   Contract:", deployed.contract_address)
  console.log("   Deploy tx:", deployed.deploy_tx_hash)
  console.log("   Finalize tx:", deployed.finalize_tx_hash)
  console.log(
    "   OpenSea:",
    `https://opensea.io/assets/base/${deployed.contract_address}/1`,
  )
}

async function jsonPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return res.json()
}

function guessMime(path: string): string {
  const ext = path.toLowerCase().split(".").pop()
  switch (ext) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "svg":
      return "image/svg+xml"
    case "webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}

main().catch((err) => {
  console.error("✗", err.message || err)
  process.exit(1)
})
