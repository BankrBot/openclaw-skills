# Chitin Contract Reference

## Base Mainnet (Chain ID: 8453)

| Contract | Address | Type |
|----------|---------|------|
| ChitinSoulRegistry | `0x4DB94aD31BC202831A49Fd9a2Fa354583002F894` | UUPS Proxy |
| CertRegistry | `0x9694Fde4dBb44AbCfDA693b645845909c6032D4d` | UUPS Proxy |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | — |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | — |
| WorldIdVerifier | `0x71a944574685141b72896694303FD8bC5F579e4a` | — |
| CrossChainVerifier | `0x656420426F30f8937B1a5eb1DC190c4E947c8541` | — |

## Base Sepolia (Chain ID: 84532)

| Contract | Address | Type |
|----------|---------|------|
| ChitinSoulRegistry | `0xB204969F768d861024B7aeC3B4aa9dBABF72109d` | UUPS Proxy |
| ChitinGovernor | `0xB7C2380AE3B89C4cF54f60600761cD9142c289bd` | UUPS Proxy |
| ReputationLedger | `0xbe7B896cBB3a769c1eF9958fd8D5820707f790dE` | UUPS Proxy |
| DelegationRegistry | `0x6a7412Da6Dfeb4bF6EC77BB0a0067d069c9256Ef` | UUPS Proxy |
| PluralityStrategy | `0xDAF381bB3ABeD937798cD82C1Fa7efa1532F5ab1` | — |
| ApprovalStrategy | `0x87EFCFc4e67B3fc9ED63B53b83F2A3e0A4cf29a3` | — |
| BordaStrategy | `0x2adBb222bF6D831c822521195E1335a6A457B599` | — |
| QuadraticStrategy | `0x9501C8D92b9A976ED2a77ac25B8B232c6BEdbEcb` | — |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | — |

## Key Functions

### ChitinSoulRegistry

```solidity
// Read
function tokenIdOf(string agentName) → uint256
function soulOf(uint256 tokenId) → Soul
function isSealed(uint256 tokenId) → bool
function isFrozen(uint256 tokenId) → bool

// Write (owner/minter only)
function mint(address to, string agentName, bytes32 soulHash, string arweaveId) → uint256
function seal(uint256 tokenId)
function verifyOwner(uint256 tokenId, uint256 root, uint256 nullifierHash, uint256[8] proof)
```

### CertRegistry

```solidity
// Read
function certOf(uint256 tokenId) → CertData
function isRevoked(uint256 tokenId) → bool

// Write
function mint(address holder, string certType, string metadataUri) → uint256
function revoke(uint256 tokenId)
```

### ChitinGovernor (Testnet)

```solidity
function createProposal(bytes32 descHash, bytes32 topicTag, uint8 optionCount, address strategy) → uint256
function commitVote(uint256 proposalId, uint256 tokenId, bytes32 commitHash)
function revealVote(uint256 proposalId, uint256 tokenId, bytes voteData, bytes32 salt)
function finalizeProposal(uint256 proposalId)
function executeProposal(uint256 proposalId, bytes callData)
```

## Standards

- **EIP-5192**: Soulbound Token (non-transferable)
- **ERC-8004**: Agent Passport (cross-chain identity)
- **UUPS**: Universal Upgradeable Proxy Standard (ERC-1822)
