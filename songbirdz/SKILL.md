---
name: songbirdz
description: Play Songbirdz, an onchain bird-watching collectible game on Base. Identify bird species from images and audio recordings in order to mint NFTs and climb the leaderboard. Uses Bankr for transaction execution.
metadata: {"clawdbot":{"emoji":"🦉","homepage":"https://basescan.org/address/0x7c3b795e2174c5e0c4f7d563a2fb34f024c8390b","requires":{"bins":["curl","jq"]}}}
---

# Songbirdz

Songbirdz is an onchain bird-watching collectible game on **Base**. There are **10,000 birds** and **800 unique species**.  
Each bird can be minted **once**, only if you correctly identify its species using the bird’s **image** (and optionally an audio recording of the bird's **song**).

Correct identification mints the NFT to your wallet.  
Incorrect guesses charge a small fee.

**Contract:** `0x7c3b795e2174c5e0c4f7d563a2fb34f024c8390b`  
**Chain:** Base (chain ID `8453`)

---

## Game Rules

1. **One mint per bird** – each bird ID can only be minted once  
2. **4 answer choices per bird** - each unidentified bird has 4 possible answer choices to choose from
2. **Species verification** – species guesses are validated via a Merkle proof  
3. **Mint fee** – 0.0015 ETH per attempt  
4. **Partial refund on failure** – failed mints refund 0.00125 ETH  
5. **Correct mint wins NFT** – successful mint transfers the NFT to you  
6. **Leaderboard** – correct identifications earn points  

---

## Bird Assets

- **Image:** `https://songbirdz.cc/images/{BIRD_ID}.jpg`
- **Audio Recording:** `https://songbirdz.cc/audio/{BIRD_ID}.mp3`
- **Metadata:** `https://songbirdz.cc/birds/metadata/{BIRD_ID}`

---

## Contract Interface

### RPC Template
```bash
curl -s -X POST https://mainnet.base.org \
-H "Content-Type: application/json" \
-d '{
  "jsonrpc":"2.0",
  "method":"eth_call",
  "params":[
    {
      "to":"0x7c3b795e2174c5e0c4f7d563a2fb34f024c8390b",
      "data":"SELECTOR+PARAMS"
    },
    "latest"
  ],
  "id":1
}' | jq -r '.result'
```

## Public Functions

| Function              | Selector | Params                                                                  | Value      | Description              |
| --------------------- | -------- | ----------------------------------------------------------------------- | ---------- | ------------------------ |
| `publicMint()`        | `0xcc0e6126`   | `birdId(uint256)` + `speciesProof(bytes32[])` + `speciesName(string)` | 0.0015 ETH | Mint a bird NFT          |

## Songbirdz API

### Get Random Bird

`GET https://songbirdz.cc/birds/random-bird`

Response:

```json
{
	id: 0, // The bird ID
	name: "Songbird #0", // The bird name
	family: "Owls", // The bird's taxonomy family
	flock: "Night & Day", // The songbirdz themed flock for the bird
	options: [ // The 4 possible answer choices for the bird
		"Common Poorwill",
		"Northern Cardinal",
		"Barred Owl",
		"Snail Kite"
	]
}
```

**NOTE:** You can optionally add the `?id={BIRD_ID}` query parameter in order to fetch a specific undentified bird by its ID.

### Get Bird Merkle Proof Data

`GET https://songbirdz.cc/birds/merkle-proof/{BIRD_ID}?species_guess={SPECIES_NAME}`

Response:

```json
{
	proof: ["0xbd68766952315c274fdb40afbc1aa4f6058c342010ff252a259b3ec0b40ede12","0x8b0c387d0141b414d84bd7efdbf4b4fea1d9d656fc722282f42e7e61456ff692","0xb53623b27c76bfae22a4776a63f497d9473826d82be7d3efc085c0453f014beb","0x40e889c1b665c14f69eda4d94d82909783d984dbb8384404c611c658640184d0","0x32e020c6f604d8a24e60072965ef2701da91502ce0dccfb690bbaeded42e97f4","0x01d8f7b58c484cbdb731081684b626aa723df45a45d0cd96508f255f4eaea3a8","0x153959a6871f7b2b349fe07d7cbb8e433421f3dc00beb77203a767ee8f2f22bf","0x013fd8855de7964c544bc901284fb6828106f86e6b42bb043767e33b3433401e","0x37e7f1ccded9be20d195e82ee15c123477273136aa05597f239cec899f69893a","0x10c60a887fa564dd046471e2fc7c6902f4f38f7e27592b18ecfdf5849d9ddcd9","0x6fc0216735d6529ef1495090b10f091eec1befc44f4f1d19ba501e2c7ba8fea3"], // The merkle proof data
	species_guess: "Barred Owl", // The species name
}
```

## How to Identify a Bird (i.e. mint nft)

### Step 1: Choose a Bird that is unidentified

You can either (1) get a random unidentified bird via the API:

```bash
curl -s \
  "https://songbirdz.cc/birds/random-bird" \
  | jq
```

or (2) choose one you like via browsing the front-end gallery at `https://songbirdz.cc/collection` and then call the API with the specific bird ID:

```bash
curl -s \
  "https://songbirdz.cc/birds/random-bird?id=9678" \
  | jq
```

For example, with a bird id of `9678`.

### Step 2: View and Analyze the Bird

Analyze the bird's image (and audio recording) and compare to the 4 possible answer choices via a text description or web search of each species.

### Step 3: Guess the Species

Choose the species name exactly as defined by Songbirdz.

For example, species name of `"Prothonotary Warber"`.

### Step 4: Fetch Merkle Proof

```bash
curl -s \
  "https://songbirdz.cc/birds/merkle-proof/9678?species_guess=Prothonotary%20Warbler" \
  | jq
```

Response:

```json
{
  "proof": [
    "0xabc...",
    "0xdef..."
  ],
  "species_guess": "Prothonotary Warber"
}
```

### Step 5: Mint Transaction (Bankr)

Use Bankr’s arbitrary transaction feature to submit the mint to the Songbirdz contract.

```json
{
  "to": "0x7c3b795e2174c5e0c4f7d563a2fb34f024c8390b",
  "data": "ENCODED_publicMint_CALL",
  "value": "1500000000000000",
  "chainId": 8453
}
```

Value: 0.0015 ETH

Outcomes:

| Result              | Outcome                   |
| ------------------- | ------------------------- |
| ✅ Correct species   | NFT minted to your wallet |
| ❌ Incorrect species | 0.00125 ETH refunded      |
| ⛔ Already minted    | Transaction reverts       |

## Workflow

- Choose an unidentified bird
- Analyze bird image, audio, and metadata to identify species
- Fetch merkle proof from Songbirdz API for your species guess
- Submit `publicMint()` transaction via Bankr
- Verify the minted NFT with `ownerOf()`
- Show off your newly minted bird NFT on social media or try to re-sell it on a marketplace (such as OpenSea or Magic Eden)!

## Resources

- **Basescan:** https://basescan.org/address/0x7c3b795e2174c5e0c4f7d563a2fb34f024c8390b (ABI, events, source)
- **Website:** https://songbirdz.cc
- **Source Code (Back-end):** https://github.com/dry-tortuga/songbirdz-collection-backend
- **Source Code (Front-end):** https://github.com/dry-tortuga/songbirdz-collection-frontend
- **Source Code (Media):** https://github.com/dry-tortuga/songbirdz-collection-media-cc0
