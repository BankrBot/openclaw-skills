# Locking HYDX for Voting Power

Lock HYDX tokens to receive veHYDX (vote-escrowed HYDX), which grants governance voting power. Locked positions are represented as NFTs.

**HYDX Token:** `0x00000e7efa313F4E11Bfff432471eD9423AC6B30` (Standard ERC20)
**veHYDX Contract:** `0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1` on Base (chain ID 8453)

## Overview

When you lock HYDX:
1. Your HYDX is locked in the veHYDX contract
2. You receive an NFT representing your locked position
3. This NFT grants voting power (available after next epoch flip)
4. Voting power determines how much influence you have in gauge votes

## Lock Types

The veHYDX contract supports multiple lock types:

- **Type 0**: Time-vested lock (traditional veNFT with decay over specified duration)
- **Type 1**: Rolling lock (2-year lock that auto-extends for maximum power)
- **Type 2**: Permanent lock (immutable, no time decay)

**For maximum voting power without time management, use Type 1 (rolling lock).**

Type 1 rolling locks automatically extend to maintain a 2-year lock duration, maximizing your voting and earning power without manual intervention.

## Creating a Lock

### Step 1: Approve HYDX

First, approve the veHYDX contract to spend your HYDX:

**Using Bankr:**
```
Approve 1000 HYDX to 0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1 on Base
```

Replace `1000` with the amount you want to lock.

### Step 2: Create Lock

**Function**: `createLock(uint256 _value, uint256 _lockDuration, uint8 _lockType)`

**Parameters:**
- `_value`: Amount of HYDX to lock (in wei, 18 decimals)
- `_lockDuration`: Lock duration in seconds (use `0` for Type 1 rolling locks)
- `_lockType`: Lock type (use `1` for rolling lock - recommended)

**Using Bankr (Natural Language):**
```
Lock 1000 HYDX on Hydrex with rolling lock
```

```
Create veHYDX rolling lock with 500 HYDX on Base
```

```
Send transaction to 0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1 on Base calling createLock with 1000000000000000000000 (1000 HYDX in wei), 0 duration, and type 1
```

**Using Arbitrary Transaction Format:**
```json
{
  "to": "0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
  "data": "ENCODED_CALLDATA",
  "value": "0",
  "chainId": 8453
}
```

### Step 3: Receive NFT

The transaction will mint a veHYDX NFT to your address. This NFT:
- Represents your locked position
- Grants voting power starting next epoch
- Can be viewed in your wallet as an NFT
- Has a unique token ID

## Checking Lock Details

Query information about a locked position:

**Function**: `lockDetails(uint256 _tokenId)`

```bash
# Replace TOKEN_ID with your veHYDX NFT ID
TOKEN_ID=1
TOKEN_ID_HEX=$(printf '%064x' $TOKEN_ID)

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x2c79db11'"$TOKEN_ID_HEX"'"
    },"latest"],
    "id":1
  }' | jq -r '.result'
```

**Returns:**
- `amount`: Amount of HYDX locked
- `startTime`: When the lock was created
- `endTime`: When the lock expires (rolling locks maintain 2-year duration)
- `lockType`: Type of lock (1 = rolling)

## Checking Voting Power

Get the voting power of a specific veHYDX NFT:

**Function**: `balanceOfNFT(uint256 _tokenId)`

```bash
TOKEN_ID=1
TOKEN_ID_HEX=$(printf '%064x' $TOKEN_ID)

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x4f0e0ef3'"$TOKEN_ID_HEX"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

**Important**: This returns **voting power**. To get **earning power** (used for fee distribution), multiply by 1.3:

```bash
# Get earning power
VOTING_POWER=$(curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x4f0e0ef3'"$TOKEN_ID_HEX"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n")

echo "scale=2; $VOTING_POWER * 1.3" | bc
```

## Managing Your Lock

### Increase Lock Amount

Add more HYDX to an existing lock:

**Function**: `increaseAmount(uint256 _tokenId, uint256 _value)`

```
Add 500 HYDX to my veHYDX NFT #1 on Base
```

### Check NFT Ownership

Get the owner of a veHYDX NFT:

```bash
TOKEN_ID=1
TOKEN_ID_HEX=$(printf '%064x' $TOKEN_ID)

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x6352211e'"$TOKEN_ID_HEX"'"
    },"latest"],
    "id":1
  }' | jq -r '.result'
```

### Check Balance

Get number of veHYDX NFTs owned by an address:

```bash
ADDRESS="0xYourAddress"
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x70a08231'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

## Epoch System

veHYDX operates on an epoch system:
- Voting power from new locks becomes active at the next epoch flip
- Epochs typically last 1 week
- Votes and rewards are calculated per epoch

**Check when voting power activates:**
After creating a lock, your voting power will be available for voting starting at the next epoch boundary (typically the next Thursday 00:00 UTC).

## Function Selectors

| Function | Selector | Parameters | Returns |
|----------|----------|------------|---------|
| `createLock(uint256,uint256,uint8)` | `0x2fb1cb6c` | value, duration, type | tokenId |
| `increaseAmount(uint256,uint256)` | `0xf4f6ad89` | tokenId, value | — |
| `lockDetails(uint256)` | `0x2c79db11` | tokenId | LockDetails |
| `balanceOfNFT(uint256)` | `0x4f0e0ef3` | tokenId | uint256 |
| `ownerOf(uint256)` | `0x6352211e` | tokenId | address |
| `balanceOf(address)` | `0x70a08231` | owner | uint256 |
| `totalSupply()` | `0x18160ddd` | — | uint256 |

## Complete Workflow Example

### Using Bankr Natural Language

```bash
# 1. Check HYDX balance
"What's my HYDX balance on Base?"

# 2. Approve HYDX
"Approve 1000 HYDX to 0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1 on Base"

# 3. Create rolling lock
"Lock 1000 HYDX on Hydrex with rolling lock"

# 4. Check earning power (after next epoch)
"What's my Hydrex earning power?"
```

### Manual Flow

```bash
# 1. Get HYDX balance
ADDRESS="0xYourAddress"
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x00000e7efa313F4E11Bfff432471eD9423AC6B30",
      "data":"0x70a08231'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"

# 2. Approve HYDX (via Bankr)
"Approve 1000 HYDX to 0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1 on Base"

# 3. Create rolling lock (via Bankr)
"Lock 1000 HYDX on Hydrex with rolling lock"

# 4. Check veHYDX NFT balance
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1",
      "data":"0x70a08231'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "You have %d veHYDX NFTs\n"
```

## Lock Type Details

### Type 0: Time-Vested Lock
- Voting power decays over time
- Must set `_lockDuration` (in seconds)
- Unlocks after duration expires
- Example: 2 year lock = `63072000` seconds
- Power gradually decreases as lock approaches expiration

### Type 1: Rolling Lock (Recommended)
- **Automatically extends to maintain 2-year lock**
- Maximum voting power at all times
- Set `_lockDuration` to `0`
- No manual management needed
- Best for maximizing governance and earning power
- Lock continuously extends to maintain optimal duration

### Type 2: Permanent Lock
- Immutable permanent lock
- Cannot be unlocked or modified
- Set `_lockDuration` for permanent commitment
- Use only if absolutely certain about permanent locking

## Voting Power vs Earning Power

**Voting Power**: Used for governance votes on pool gauges (checked on voter contract)
**Earning Power**: Used for calculating fee distribution (1.3x voting power)

When displaying power to users:
- **For voting allocation**: Use voting power from voter contract
- **For fee earnings**: Show earning power (voting power × 1.3)

Example:
- You lock 1000 HYDX with Type 1 rolling lock
- Voting power: ~2000 (depends on lock duration calculation)
- Earning power: ~2600 (voting power × 1.3)

## Important Notes

1. **Rolling locks auto-extend** - Type 1 locks automatically maintain 2-year duration
2. **Voting power activates next epoch** - Don't expect immediate voting ability
3. **NFTs are transferable** - veHYDX NFTs can be sold/transferred like any NFT
4. **Amount is in wei** - 1 HYDX = 1000000000000000000 wei (18 decimals)
5. **Approve first** - Always approve HYDX before attempting to create a lock
6. **Earning power = 1.3x voting power** - Display earning power for fee calculations

## Tips

- **Start small**: Test with a small amount first to understand the flow
- **Rolling for max power**: Type 1 rolling locks give maximum voting power with auto-extension
- **Check epoch timing**: Lock before epoch end to vote in the next epoch
- **Track your NFT**: Note the token ID returned from createLock
- **Multiple locks allowed**: You can create multiple veHYDX NFTs with different amounts
- **Display earning power**: When showing fee earnings potential, use voting power × 1.3
