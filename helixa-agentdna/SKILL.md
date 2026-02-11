---
name: agentdna-mint
description: Mint an AgentDNA identity NFT onchain via the Helixa platform (Base network). Use when an AI agent wants to register itself onchain, get a portable identity, claim an AgentDNA NFT, or set up its onchain reputation. Also use when asked about Helixa, AgentDNA, ERC-8004, or agent identity minting.
---

# Helixa · AgentDNA Mint

Mint your onchain identity on Base via the Helixa platform. One contract call, permanent identity.

## What You Get

- ERC-8004 compliant identity NFT on Base
- Traits, personality, evolution history
- Early adopter points (2x for first 100, 1.5x for first 500)
- Referral tracking
- Soulbound option (your choice)

## Quick Start

### Option A: Use the SDK CLI

```bash
npx agentdna mint \
  --name "YourAgentName" \
  --framework "openclaw" \
  --rpc https://mainnet.base.org
```

The CLI auto-detects your framework (OpenClaw, ElizaOS, LangChain, CrewAI) and builds ERC-8004 compliant metadata.

### Option B: Direct Contract Call

Contract: `0x665971e7bf8ec90c3066162c5b396604b3cd7711` (Base mainnet)

```solidity
// ABI: register(string agentURI) payable returns (uint256)
// Simplest mint — just a metadata URI
function register(string calldata agentURI) external payable returns (uint256 agentId);

// ABI: register(string agentURI, MetadataEntry[] metadata) payable returns (uint256)
// Mint with structured metadata
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}
function register(string calldata agentURI, MetadataEntry[] calldata metadata) external payable returns (uint256 agentId);

// ABI: mint(address,string,string,string,bool,string,uint256) payable returns (uint256)
// Full featured mint
function mint(
    address agentAddress,     // Your agent's wallet address
    string name,              // Agent name
    string framework,         // "openclaw", "eliza", "langchain", "crewai", etc.
    string tokenURI,          // Metadata URI (IPFS, data URI, or HTTPS)
    bool soulbound,           // true = non-transferable
    string version,           // e.g. "1.0.0"
    uint256 parentTokenId     // Use type(uint256).max for no parent
) external payable returns (uint256 tokenId);

// Mint with referral (referrer earns points)
function mintWithReferral(
    address agentAddress,
    string name,
    string framework,
    string tokenURI,
    bool soulbound,
    string version,
    uint256 parentTokenId,
    address referrer          // Address that referred you
) external payable returns (uint256 tokenId);
```

### Pricing

| Agents Minted | Price |
|---|---|
| 1–100 | Free |
| 101–500 | 0.005 ETH |
| 501–1000 | 0.01 ETH |
| 1001+ | 0.02 ETH |

Check current price: `contract.mintPrice()`

## Step-by-Step for AI Agents

1. **Get a wallet** — You need an Ethereum wallet with ETH on Base. If running on OpenClaw, check if you have a wallet configured.

2. **Build your metadata URI** — Create a JSON metadata object:
```json
{
  "name": "YourAgentName",
  "description": "What you do",
  "image": "",
  "attributes": [
    { "trait_type": "framework", "value": "openclaw" },
    { "trait_type": "model", "value": "claude-sonnet-4" },
    { "trait_type": "capabilities", "value": "coding,research,automation" }
  ]
}
```
Encode as a data URI: `data:application/json;base64,<base64-encoded-json>`

3. **Call register or mint** — Use ethers.js, viem, cast, or any EVM library:
```bash
# Using cast (Foundry)
cast send 0x665971e7bf8ec90c3066162c5b396604b3cd7711 \
  "register(string)" "data:application/json;base64,..." \
  --value <MINT_PRICE> \
  --rpc-url https://mainnet.base.org \
  --private-key $AGENT_PRIVATE_KEY
```

```javascript
// Using ethers.js
const tx = await contract.mint(
  agentWalletAddress,
  "MyAgent",
  "openclaw",
  metadataURI,
  false,  // soulbound
  "1.0.0",
  ethers.MaxUint256,  // no parent
  { value: await contract.mintPrice() }
);
```

4. **Verify your mint** — Check your agent exists:
```bash
cast call 0x665971e7bf8ec90c3066162c5b396604b3cd7711 "getAgent(uint256)(address,string,string,uint256,bool,bool,uint256,uint256,string,uint256)" 0
```

## ERC-8004 Cross-Registry Integration

AgentDNA supports bidirectional integration with the official 8004.org Identity Registry on Base (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).

### Direction 1: Import from 8004 → AgentDNA

If you already have an 8004.org identity, pull your data in and cross-reference it:

```javascript
const ERC8004_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const erc8004 = new ethers.Contract(ERC8004_REGISTRY, [
  "function tokenURI(uint256) view returns (string)",
  "function getAgentWallet(uint256) view returns (address)"
], provider);

// Fetch your 8004 identity
const uri = await erc8004.tokenURI(your8004TokenId);
const meta8004 = JSON.parse(atob(uri.split(',')[1]));
const wallet = await erc8004.getAgentWallet(your8004TokenId);

// Include 8004 cross-reference in your AgentDNA metadata
const metadata = {
  name: meta8004.name,
  description: meta8004.description,
  erc8004: {
    tokenId: your8004TokenId,
    registry: ERC8004_REGISTRY,
    chain: "base"
  },
  attributes: [...]
};

// Mint AgentDNA with the merged data
const tokenURI = "data:application/json;base64," + btoa(JSON.stringify(metadata));
await agentDnaContract.mint(wallet, meta8004.name, "openclaw", tokenURI, false, "1.0.0", ethers.MaxUint256, { value: mintPrice });
```

### Direction 2: AgentDNA → Register on 8004

Mint AgentDNA and also register on 8004.org in the same session for cross-chain portability:

```javascript
// Step 1: Mint AgentDNA
const tx = await agentDnaContract.mint(agentAddr, name, framework, tokenURI, false, "1.0.0", ethers.MaxUint256, { value: mintPrice });
const receipt = await tx.wait();
const agentDnaTokenId = receipt.logs[0]?.args?.[0];

// Step 2: Build 8004-compliant agent URI
const agentURI8004 = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: name,
  description: description,
  services: [
    { name: "agentWallet", endpoint: "eip155:8453:" + agentAddr }
  ],
  registrations: [
    { agentId: Number(agentDnaTokenId), agentRegistry: "eip155:8453:" + AGENTDNA_CONTRACT }
  ],
  active: true
};

// Step 3: Register on 8004.org
const erc8004 = new ethers.Contract(ERC8004_REGISTRY, [
  "function register(string) returns (uint256)"
], signer);
const uri8004 = "data:application/json;base64," + btoa(JSON.stringify(agentURI8004));
await erc8004.register(uri8004);
```

### Using cast (Foundry)

```bash
# Import: Read 8004 data
cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "tokenURI(uint256)(string)" <TOKEN_ID> --rpc-url https://mainnet.base.org

# Export: Register on 8004 after AgentDNA mint
cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "register(string)" "data:application/json;base64,..." --rpc-url https://mainnet.base.org --private-key $KEY
```

## After Minting

- **Add traits**: `addTrait(tokenId, "Trading", "capability")` — costs traitFee
- **Evolve**: `mutate(tokenId, "2.0.0", "Added vision", "newURI")` — costs mutationFee  
- **Set personality**: `setPersonality(tokenId, "analytical", "formal", 5, 8, "lawful-good", "researcher")`
- **Check points**: `points(yourAddress)` — view your early adopter points

## Network Details

- **Chain**: Base (Chain ID: 8453)
- **RPC**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org
- **Standard**: ERC-8004 (Trustless Agents)

## Points System

Every action earns Helixa points. Points convert to $DNA token allocation at TGE.

| Action | Base Points | First 100 agents | First 500 |
|---|---|---|---|
| Mint | 100 | 200 (2x) | 150 (1.5x) |
| Evolve | 50 | 100 | 75 |
| Add Trait | 10 | 20 | 15 |
| Referral | 25 | 50 | 37 |
