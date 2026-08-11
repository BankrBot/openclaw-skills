---
name: jb-suckers
description: |
  Juicebox V6 sucker contracts for cross-chain token bridging. Use when: (1) implementing bridge
  functionality, (2) encoding prepare/toRemote/claim transactions, (3) generating merkle proofs for
  cross-chain claims, (4) querying sucker pairs from JBSuckerRegistry, (5) handling emergency exits
  and deprecation, (6) debugging "claimable" vs "pending" states, (7) working with token mappings
  and the registry mapping allowlist, (8) reading cross-chain accounting gossip (remote surplus,
  supply). Covers JBSucker, JBOptimismSucker, JBBaseSucker, JBArbitrumSucker, JBCCIPSucker, and
  JBSuckerRegistry.
version: 6.0.0
---

# Juicebox Suckers — Cross-Chain Token Bridging

Suckers link Juicebox projects across chains and move project tokens AND their proportional treasury backing between them. Project IDs are chain-local (each chain assigns the next available ID independently), so suckers are what connect per-chain projects into one omnichain project.

Unlike a standard token bridge:
- Project tokens are cashed out on the source chain (burned via the terminal's cash-out path).
- The reclaimed terminal tokens (ETH/USDC) travel with the bridge message.
- The destination mints new project tokens to the beneficiary and adds the terminal tokens to the destination project's balance.

## Contracts

| Contract | Purpose | Address source |
|----------|---------|----------------|
| `JBSucker` | Abstract base: outbox/inbox merkle trees, claims, emergency hatch, accounting gossip | — |
| `JBOptimismSucker` | ETH(1)↔OP(10), Sepolia(11155111)↔OP Sepolia(11155420), via OP CrossDomainMessenger + StandardBridge | `JBOptimismSucker` in `references/shared/chain-config.json` (same address on both ends) |
| `JBBaseSucker` | ETH(1)↔Base(8453), Sepolia↔Base Sepolia(84532); OP-stack implementation | `JBBaseSucker` |
| `JBArbitrumSucker` | ETH(1)↔Arb(42161), Sepolia↔Arb Sepolia(421614), via Arbitrum Inbox/Bridge/Outbox | `JBArbitrumSucker` |
| `JBCCIPSucker` | Any CCIP-supported pair; used for L2↔L2 (OP↔Base, OP↔Arb, Base↔Arb) | `JBCCIPSucker__{PEER}` — **chain-specific**: each singleton and deployer targets one lane |
| `JBSuckerRegistry` | Deploys/tracks suckers, mapping allowlist, `toRemoteFee`, cross-chain value aggregation | `JBSuckerRegistry` (same address on all chains) |

CCIP deployers/singletons are keyed by lane in `references/shared/chain-config.json` (e.g. on Ethereum: `JBCCIPSuckerDeployer__OP`, `JBCCIPSuckerDeployer__BASE`, `JBCCIPSuckerDeployer__ARB`). Each lane's deployer shares one address on both ends of the pair (e.g. Ethereum's `JBCCIPSuckerDeployer__ARB` == Arbitrum's `JBCCIPSuckerDeployer__ETH`), but the address differs between lanes and chains — always read the exact key for the chain you're on.

Suckers are ERC-2771-aware (trusted forwarder: `ERC2771Forwarder` in chain-config), so all user-facing calls work through Relayr meta-transactions. `fromRemote`/`fromRemoteAccounting` authenticate the raw `msg.sender` (bridge messenger), never the forwarder.

## The three-phase bridge flow

### Phase 1: `prepare` (source chain) → status `pending`

```solidity
function prepare(
    uint256 projectTokenCount,   // project tokens to bridge
    bytes32 beneficiary,         // recipient on the remote chain — EVM address LEFT-PADDED to bytes32
    uint256 minTokensReclaimed,  // slippage floor on the cash-out
    address token,               // terminal token to cash out for (0xEeee…EEeE for native)
    bytes32 metadata             // opaque payload committed into the leaf hash; bytes32(0) if unused
) external
```

- Caller must first `approve` the project's ERC-20 to the sucker.
- Reverts if `projectTokenCount == 0`, `beneficiary == bytes32(0)`, the project has no ERC-20 deployed, the token isn't mapped/enabled, or sending is disabled (deprecation).
- Cashes the tokens out via the project's terminal, then inserts a leaf into the outbox merkle tree and emits `InsertToOutboxTree(beneficiary, token, hashed, index, root, projectTokenCount, terminalTokenAmount, metadata, caller)`.
- Amounts above `type(uint128).max` revert (cross-VM cap).

Beneficiary encoding: `bytes32(uint256(uint160(address)))`.

### Phase 2: `toRemote` (source chain) → status `claimable` on destination

```solidity
function toRemote(address token) external payable
```

Anyone can call once the outbox has unsent entries. `msg.value` must cover two things:

1. **Registry fee**: `JBSuckerRegistry.toRemoteFee()` (wei). Capped at `MAX_TO_REMOTE_FEE = 0.001 ether`; initialized at the cap; owner can lower it. The fee is paid into the fee project's (project 1) native terminal with the caller as pay beneficiary. If that pay fails, the fee is retained as a refundable credit — claim via `claimRetainedToRemoteFee(beneficiary)`.
2. **Bridge transport payment** = `msg.value - toRemoteFee`:
   - **Zero-cost lanes (OP-stack both directions; Arbitrum L2→L1)**: the transport payment must be exactly 0, so `msg.value` must EQUAL `toRemoteFee()`. Any excess reverts.
   - **Arbitrum L1→L2**: requires transport payment to fund the retryable ticket (submission cost + destination gas); insufficient payment reverts.
   - **CCIP suckers**: transport payment must cover the CCIP messaging fee in native ETH. If transport payment is 0, the sucker switches to LINK-fee mode and tries `transferFrom` LINK from the caller (reverts without approval). Discover the needed value by simulating `toRemote` at escalating `msg.value` tiers — the contract computes `getFee()` internally and refunds excess, so the smallest working tier is safe.

The call sends the outbox root plus locked funds (`JBMessageRoot`) across the AMB: OP messenger `sendMessage` + `bridgeERC20To`, Arbitrum retryable tickets, or `ccipSend`.

### Phase 3: `claim` (destination chain) → status `claimed`

```solidity
struct JBLeaf {
    uint256 index;
    bytes32 beneficiary;
    uint256 projectTokenCount;
    uint256 terminalTokenAmount;
    bytes32 metadata;
}
struct JBClaim {
    address token;      // the DESTINATION chain's local terminal token
    JBLeaf leaf;
    bytes32[32] proof;
}

function claim(JBClaim calldata claimData) public;      // single
function claim(JBClaim[] calldata claims) external;     // batch — per-leaf try/catch, failed leaves emit ClaimFailed and stay claimable
```

- Validates the proof against the inbox root, marks the leaf executed, mints `projectTokenCount` to the beneficiary via the controller, and adds `terminalTokenAmount` to the project's terminal balance.
- `claimData.token` is the destination chain's local token (e.g. Base USDC when claiming a bridge from Ethereum USDC).
- Double-spend guard: executed-leaf bitmap keyed `(token, index)`.
- `executedLeafHashOf(token, index)` returns the keccak256 leaf hash committed at execution time (`bytes32(0)` = not executed). Beneficiary contracts use it to authenticate settlement when their claim was front-run by a direct external call.
- The inbox retains a ring of the 4 most recently accepted roots per token, so a proof generated against a slightly-superseded root still validates.

## Merkle proofs — generate locally

Bendystraw does not index proofs. Build them from `InsertToOutboxTree` events:

- Leaf hash: `keccak256(abi.encode(projectTokenCount, terminalTokenAmount, beneficiary, metadata))` (four 32-byte words) — matches the event's `hashed` field.
- Tree: incremental merkle tree, depth 32. Pair hash `keccak256(abi.encode(a, b))`; zero hashes `Z[i+1] = H(Z[i], Z[i])` from `Z[0] = bytes32(0)`; empty-tree root is `Z[32]`.
- Proof for leaf `i`: sibling path over the dense leaf-hash array `[0, deliveredCount)`, padding missing right-siblings with `Z[level]`.
- Verify before submitting: fold the leaf up (`index` bit 0 → leaf-left) and compare to `inboxOf(token).root` on the destination sucker.

```javascript
// status derivation, all read from chain:
// outboxOf(token).numberOfClaimsSent  → how many source leaves have been shipped
// inboxOf(remoteToken).root           → which outbox root has arrived on the destination
// executedLeafHashOf(remoteToken, i)  → nonzero means claimed
// pending   = leaf exists, root not yet delivered (or not yet sent — canExecute if index >= numberOfClaimsSent)
// claimable = root delivered, leaf not executed, proof folds to the inbox root
// claimed   = executedLeafHashOf != 0
```

## Token mapping

```solidity
struct JBTokenMapping {
    address localToken;   // token on this chain
    uint32 minGas;        // destination gas for the ERC-20 delivery; must be >= 200_000 for ERC-20s
    bytes32 remoteToken;  // token on the peer chain, bytes32-encoded; bytes32(0) disables bridging
}

function mapToken(JBTokenMapping calldata map) public payable;
function mapTokens(JBTokenMapping[] calldata maps) external payable;
```

- Requires `MAP_SUCKER_TOKEN` permission (ID 32) from the project owner; the registry itself may map during `deploySuckersFor`.
- **Registry allowlist**: mappings that assert economic equivalence must be pre-allowlisted by the registry owner (`allowTokenMapping`). Rules (`requireTokenMappingAllowed`):
  - `remoteToken == bytes32(0)` (disable): always allowed.
  - Non-native token mapped to the SAME address on the remote chain: allowed without approval.
  - Native↔native and any differing-address mapping (e.g. Ethereum USDC ↔ Base USDC): must be allowlisted. The protocol deployment pre-allowlists native↔native and canonical-USDC pairs for the supported chains.
- **Native-bridge compatibility is a separate invariant.** Mapping validation and the registry allowlist do not query an external bridge's registered ERC-20 pair. For every OP Stack or Arbitrum ERC-20 route, verify both directions against the live bridge and map the exact token delivered or burned. The destination terminal must account for that same token. Canonical issuer status, equal addresses, and registry approval do not prove bridge compatibility.
  - OP Stack requires the destination token to be the bridge-compatible mintable counterpart for the source token and bridge. A bad pair can escrow the source token before destination delivery rejects.
  - Arbitrum's gateway router chooses the counterpart independently of `remoteToken`: L1→L2 can deliver a legacy bridged token while the root names a canonical token, and L2→L1 can try to burn the paired legacy token while the sucker holds the canonical token.
- Bridge canonical USDC over a CCIP sucker. Use native-bridge suckers for native ETH unless an ERC-20's exact bridge pair and destination terminal accounting have been verified explicitly.
- Native token (`0xEeee…EEeE`) may only map to the native token or `bytes32(0)`.
- Once a token's outbox tree has entries it can never be remapped to a different remote token — only disabled (mapping to `bytes32(0)` triggers a final root flush; attach transport payment via `msg.value`). A misconfigured mapping requires deploying a new sucker.
- One remote token can back only one local token per sucker (reverse reservation).

## JBSuckerRegistry

```solidity
struct JBSuckersPair { address local; bytes32 remote; uint256 remoteChainId; }
struct JBSuckerDeployerConfig {
    IJBSuckerDeployer deployer;
    bytes32 peer;                 // explicit remote peer; bytes32(0) = default same-address deterministic peer
    JBTokenMapping[] mappings;
}

function suckerPairsOf(uint256 projectId) external view returns (JBSuckersPair[] memory);  // active only
function suckersOf(uint256 projectId) external view returns (address[] memory);            // active only
function isSuckerOf(uint256 projectId, address addr) external view returns (bool);         // incl. deprecated
function deploySuckersFor(uint256 projectId, bytes32 salt, JBSuckerDeployerConfig[] calldata configurations)
    public returns (address[] memory suckers);
function toRemoteFee() external view returns (uint256);
```

- `deploySuckersFor` requires `DEPLOY_SUCKERS` (ID 33). A nonzero `peer` additionally requires `SET_SUCKER_PEER` (ID 34).
- The effective CREATE2 salt is `keccak256(abi.encode(msgSender, salt))` — **the same sender must call with the same salt on both chains** or the default same-address peer symmetry breaks.
- Deployment also applies the initial token mappings in the same call, so a wrong per-chain token address reverts here (see `jb-omnichain-erc20-config`).
- Cross-chain value aggregation (fed by accounting gossip): `totalRemoteSurplusOf(projectId, currency, decimals)`, `totalRemoteBalanceOf(...)`, `remoteTotalSupplyOf(projectId)`. These drive cross-chain cash-out taxation so a holder dominating one chain's local supply can't bypass the tax.

## Accounting gossip

Every root message carries a bundle of peer-chain accounting records (total supply, per-context surplus/balance). Records are freshness-gated per source chain, so stale relays can't roll back newer state.

- `syncAccountingData()` (payable) sends an accounting-only message without shipping a root or paying `toRemoteFee` — the caller covers only bridge transport.
- Read side: `peerChainContextsOf(chainId)`, `peerChainTotalSupplyOf(chainId)`, `snapshotTimestampOf(chainId)`, `peerChainIds(includeVirtual)`.
- Gossip is transitive best-effort: a hub relays sibling-chain records, but to guarantee freshness sync each source→destination lane directly.

## Deprecation

```solidity
function setDeprecation(uint40 timestamp) external  // 0 cancels
```

Requires `SET_SUCKER_DEPRECATION` (ID 36). Timestamp must be at least 14 days out (`_maxMessagingDelay`) so in-flight messages can land.

| `state()` | Meaning |
|-----------|---------|
| `ENABLED` (0) | Fully functional |
| `DEPRECATION_PENDING` (1) | Deprecation scheduled; still fully functional (warning window) |
| `SENDING_DISABLED` (2) | No new `prepare`/`toRemote`/`syncAccountingData`; incoming roots and claims still work |
| `DEPRECATED` (3) | No new outbound sends; incoming roots are STILL accepted and claims still work, so bridged tokens are never stranded |

`removeDeprecatedSucker(projectId, sucker)` (anyone, once `DEPRECATED`) removes it from active listings; it keeps mint permission so pending claims settle.

## Emergency exit

When a bridge is permanently broken for a token:

```solidity
// 1. Project owner (or SUCKER_SAFETY permission, ID 35) opens the hatch — irreversible per token:
function enableEmergencyHatchFor(address[] calldata tokens) external;

// 2. Users exit on the chain they deposited from, with the same JBClaim shape proven
//    against the OUTBOX tree:
function exitThroughEmergencyHatch(JBClaim calldata claimData) external;
```

Opening the hatch sets `enabled = false` for the token (no new prepares); `toRemote` for that token reverts.

## Querying bridge status (Bendystraw)

```graphql
query SuckerTransactions($suckerGroupId: String!, $status: suckerTransactionStatus) {
  suckerTransactions(where: { suckerGroupId: $suckerGroupId, status: $status }) {
    items {
      index token chainId peerChainId sucker peer beneficiary
      projectTokenCount terminalTokenAmount root status createdAt
    }
  }
}
```

`status` ∈ `pending | claimable | claimed`. The merkle proof is NOT indexed — generate it locally (above) — and claimable/claimed is best confirmed live from the destination sucker's `inboxOf` root + `executedLeafHashOf`.

## Common mistakes

- **Passing an `address` beneficiary.** `prepare` and `JBLeaf.beneficiary` take `bytes32` (left-padded EVM address), and `prepare` takes a fifth `metadata` param. Four-arg/address-typed encodings revert or corrupt the leaf.
- **Overpaying `toRemote` on zero-cost lanes.** OP-stack lanes and Arbitrum L2→L1 revert on any nonzero transport payment: `msg.value` must equal `toRemoteFee()` exactly. CCIP lanes and Arbitrum L1→L2 take extra value (CCIP refunds the excess).
- **Sending `msg.value < toRemoteFee()`.** Reverts `JBSucker_InsufficientMsgValue` even on zero-cost bridges.
- **Claiming with the source chain's token address.** The destination inbox is keyed by the destination chain's local token.
- **Omitting `metadata` from the leaf hash.** Proofs are over `(projectTokenCount, terminalTokenAmount, beneficiary, metadata)`; a claim with the wrong metadata fails validation.
- **Assuming a `minBridgeAmount` field.** `JBTokenMapping` is `{localToken, minGas, remoteToken}` — there is no minimum bridge amount.
- **Treating registry approval as bridge-pair validation.** The allowlist asserts economic equivalence only. Verify the exact OP Stack or Arbitrum token delivered and burned in both directions; use CCIP for canonical USDC.
- **Deploying suckers from different senders per chain.** The salt binds `msg.sender`; mismatched senders produce mismatched addresses and the default peer check fails. Use the same EOA (e.g. via Relayr) with the same salt everywhere.
- **Expecting sequential nonces.** `fromRemote` accepts any strictly-greater nonce (CCIP is unordered). Earlier leaves stay provable but need proofs regenerated against the latest delivered root (or one of the 4 retained roots).
- **Bridging without a project ERC-20.** `prepare` reverts `JBSucker_ZeroERC20Token` if the project hasn't deployed its ERC-20 on the source chain; claims revert if the controller/project is missing on the destination.

## Related skills

- `jb-omnichain-per-chain-projectids` — each chain has a different projectId; query before any operation
- `jb-omnichain-erc20-config` — per-chain ERC-20 addresses in terminal configs and token mappings
- `jb-relayr` — multi-chain transaction bundling for symmetric deploys
