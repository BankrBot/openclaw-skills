# Promptr Contract ABI Reference

## Contract Addresses

| Contract | Address |
|----------|---------|
| Proxy | `0x40E164E2B005C9bfd56a44634047c3bc2629371d` |
| Implementation | `0x67745fE3157Ca72B06418d526D85f62C8039e888` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## User-Callable Functions

### Core Actions

#### submitPrompt
Submit a new prompt with USDC bid.

```solidity
function submitPrompt(string calldata text, uint256 amount) external returns (bytes32 promptId)
```

- `text`: The prompt text to submit
- `amount`: USDC amount (6 decimals) as initial votes
- Returns: `promptId` (bytes32 hash)
- Requires: USDC approval for `amount`

#### vote
Add votes to an existing prompt.

```solidity
function vote(bytes32 promptId, uint256 amount) external
```

- `promptId`: Hash of the prompt to vote on
- `amount`: USDC amount to add as votes
- Requires: USDC approval for `amount`

#### finalizeRound
Finalize an ended round. Caller receives 0.5% keeper reward.

```solidity
function finalizeRound() external
```

- Can only be called when `timeRemaining() == 0`
- Caller gets 0.5% of total pot as reward

### Refund Functions

#### claimRefund
Claim refund for a losing prompt.

```solidity
function claimRefund(uint256 round, bytes32 promptId) external
```

- `round`: Round number
- `promptId`: Hash of losing prompt
- Only works for non-winning prompts after round finalized

#### batchClaimRefunds
Batch claim multiple refunds.

```solidity
function batchClaimRefunds(uint256 round, bytes32[] calldata promptIds) external
```

- `round`: Round number
- `promptIds`: Array of prompt hashes to claim

### Emergency Functions

Available 24 hours after round end if not finalized.

#### emergencyWithdraw
```solidity
function emergencyWithdraw(uint256 round, bytes32 promptId) external
```

#### batchEmergencyWithdraw
```solidity
function batchEmergencyWithdraw(uint256 round, bytes32[] calldata promptIds) external
```

## View Functions

### Round Info

```solidity
function currentRound() external view returns (uint256)
function timeRemaining() external view returns (uint256)
function minPromptAmount() external view returns (uint256)
```

### Prompt Data

```solidity
function getRoundPrompts(uint256 round) external view returns (bytes32[] memory)
function getPrompt(bytes32 promptId) external view returns (
    address submitter,
    string memory text,
    uint256 totalVotes,
    uint256 timestamp,
    bool claimed
)
function getVotes(bytes32 promptId, address voter) external view returns (uint256)
```

### User Data

```solidity
function getUserPrompts(uint256 round, address user) external view returns (bytes32[] memory)
function getUnclaimedRefundsForRound(address user, uint256 round) external view returns (
    bytes32[] memory promptIds,
    uint256[] memory amounts
)
```

### Results

```solidity
function getRoundResult(uint256 round) external view returns (
    bytes32 winningPromptId,
    uint256 totalPot
)
function canEmergencyWithdraw(uint256 round) external view returns (bool)
```

## Events

```solidity
event PromptSubmitted(uint256 indexed round, bytes32 indexed promptId, address indexed submitter, string text, uint256 amount)
event Voted(uint256 indexed round, bytes32 indexed promptId, address indexed voter, uint256 amount)
event RoundFinalized(uint256 indexed round, bytes32 indexed winningPromptId, uint256 totalPot, address keeper, uint256 keeperReward)
event RefundClaimed(uint256 indexed round, bytes32 indexed promptId, address indexed claimer, uint256 amount)
event EmergencyWithdraw(uint256 indexed round, bytes32 indexed promptId, address indexed claimer, uint256 amount)
```

## USDC Approval

Before submitting or voting, approve USDC spending:

```solidity
// USDC contract
function approve(address spender, uint256 amount) external returns (bool)
```

Example with cast:
```bash
cast send 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "approve(address,uint256)" \
  0x40E164E2B005C9bfd56a44634047c3bc2629371d \
  1000000000 \
  --private-key $KEY \
  --rpc-url https://mainnet.base.org
```

## PromptId Calculation

The `promptId` is calculated as:
```solidity
keccak256(abi.encodePacked(round, submitter, text, block.timestamp))
```

This ensures unique IDs even for identical text in the same round.
