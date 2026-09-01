# ENSIP-25: Agent Registry ENS Name Verification

ENSIP-25 establishes a standardized method for verifying the association between an ENS name and an agent identity in any on-chain registry (e.g. ERC-8004).

Spec: https://docs.ens.domains/ensip/25/

## The Problem

Without ENSIP-25, an agent's ENS name and its ERC-8004 identity are two disconnected claims. Anyone could register an ERC-8004 entry claiming to be `alpha-go.bankr.eth` with no way to confirm the ENS name owner endorses that claim.

## How It Works

The ENS name owner sets a parameterized text record:

```
agent-registration[<registry>][<agentId>] = "1"
```

Where:
- `<registry>` is the [ERC-7930](https://eips.ethereum.org/EIPS/eip-7930) interoperable address of the agent registry contract
- `<agentId>` is the agent's identifier in that registry
- A non-empty value is an attestation: "this agent registration is legitimately associated with this name"

## ERC-7930 Address Encoding

The registry parameter uses ERC-7930 binary encoding of chain + contract address:

```
0x 0001 0000 02 2105 14 [20-byte registry address]
   ---- ---- -- ---- --
   |    |    |  |    +-- Address is 20 bytes (0x14)
   |    |    |  +-- Chain ID 8453 (Base) = 0x2105
   |    |    +-- ChainReference is 2 bytes long
   |    +-- ChainType 0x0000 (EVM)
   +-- Version 1
```

### Common Chain Encodings

| Chain | Chain ID | Hex Chain ID | ERC-7930 Prefix |
|-------|----------|-------------|-----------------|
| Ethereum | 1 | 0x01 | `0x00010000010114` |
| Base | 8453 | 0x2105 | `0x0001000002210514` |
| Arbitrum | 42161 | 0xA4B1 | `0x0001000002A4B114` |
| Optimism | 10 | 0x0A | `0x00010000010A14` |
| Sepolia | 11155111 | 0xAA36A7 | `0x0001000003AA36A714` |

## Concrete Example: Bankr on Base

For agent `alpha-go.bankr.eth` registered as ID `42` in an ERC-8004 registry at `0xBA001234...` on Base:

```
Key:   agent-registration[0x0001000002210514BA001234...][42]
Value: "1"
```

## Verification Flow

```
1. Agent claims: "I'm alpha-go.bankr.eth, agent #42 on Base"
2. Verifier resolves alpha-go.bankr.eth
3. Decodes the ERC-7930 registry address -> Base (chain 8453), contract 0xBA00...
4. Reads text record: agent-registration[0x0001000002210514BA00...][42]
5. Record is non-empty -> ENS name owner endorses this association
6. Queries ERC-8004 registry at 0xBA00... on Base for agent #42 -> identity confirmed
```

## Lifecycle Management

ENSIP-25 records must be managed alongside the agent lifecycle:

| Event | Action |
|-------|--------|
| Agent created + ERC-8004 minted | Set ENSIP-25 text record |
| Agent deactivated | Clear ENSIP-25 text record |
| ENS name transferred | Verification automatically invalidated (new owner has no record) |
| ERC-8004 NFT transferred | Old ENSIP-25 record becomes stale; new owner must re-attest |

## Relationship to agent:* Records

ENSIP-25 handles **verification** (proving the ENS name and registry entry belong together). The `agent:*` text records handle **metadata** (what the agent does, its capabilities, etc.). They are complementary:

```
agent:type = "trading-bot"                              <- metadata
agent:capabilities = "swap,bridge"                       <- metadata
agent-registration[<registry>][<agentId>] = "1"          <- verification
```

## Security Considerations

- Only the ENS name owner can set the verification record
- Name ownership transfers invalidate all existing records
- Verifiers should always check both directions: ENS -> registry AND registry -> ENS
- Stale records (where the ERC-8004 NFT has been transferred) should be detected by checking current NFT ownership
