# AgentDNA Contract ABI (key functions)

## Mint
```
mint(address agentAddress, string name, string framework, string tokenURI_, bool soulbound, string version, uint256 parentTokenId) payable returns (uint256)
mintWithReferral(address agentAddress, string name, string framework, string tokenURI_, bool soulbound, string version, uint256 parentTokenId, address referrer) payable returns (uint256)
register(string agentURI) payable returns (uint256)
```

## Identity
```
getAgent(uint256 tokenId) view returns (Agent)
setPersonality(uint256 tokenId, string temperament, string communicationStyle, uint8 riskTolerance, uint8 autonomyLevel, string alignment, string specialization)
addTrait(uint256 tokenId, string name, string category)
mutate(uint256 tokenId, string newVersion, string description, string newTokenURI) payable
```

## Points
```
points(address) view returns (uint256)
mintPrice() view returns (uint256)
```

Contract: 0x665971e7bf8ec90c3066162c5b396604b3cd7711 (Base mainnet)
Website: https://helixa.xyz
GitHub: https://github.com/Bendr-20/helixa
