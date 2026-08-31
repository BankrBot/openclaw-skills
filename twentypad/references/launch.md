# TwentyPad launch reference

Factory (Base 8453): `0x15a3f3ABb733868d193b511dd5b91f82ebF888A3`  
`createLaunch` is not payable. `value` must be `"0"`.

Contracts unaudited.

## Reads (do these first)

```text
tokenSuffix()(uint16)
lastSaltUint()(uint256)
usedSalt(bytes32)(bool)
predictToken(bytes32)(address)
quotes(address)(bool registered, int24 startTickToken0Frame)
feeDefaults()(uint16,uint16,uint16,uint16,uint32)

```

Do not hardcode the suffix. Live value has been `0xca7`. Trust `tokenSuffix()`.
Require `quotes[quote].registered == true`. ETH = `address(0)`, USDC = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Salt mine (off-chain only)

```text
saltUint = lastSaltUint + 1
loop:
  salt = bytes32(uint256(saltUint))
  skip if usedSalt(salt)
  token = predictToken(salt)
  accept if (uint160(token) & 0xFFF) == tokenSuffix
  else saltUint += 1

```

Stop after 50,000 tries. Never grind inside the user transaction.

## ABI

```text
struct TokenProfile {
    string image;
    string description;
    string website;
    string twitter;
    string telegram;
    string discord;
    bool editable;
}

struct LaunchParams {
    string name;
    string symbol;
    bytes32 salt;
    address quote;
    TokenProfile profile;
}

function createLaunch(LaunchParams calldata p)
    external
    returns (address token, bytes32 poolId);

```

Human ABI:

```text
createLaunch((string,string,bytes32,address,(string,string,string,string,string,string,bool)))

```

Args:

```json
{
  "name": "Twenty Launchpad",
  "symbol": "TWENTY",
  "salt": "0x000000000000000000000000000000000000000000000000000000000000043c",
  "quote": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "profile": {
    "image": "ipfs://bafybeifcgvnxzkkjf6xbtorj3zxgsz2a7l4deskciw4jq7la7yv5ourlei",
    "description": "Twentypad is a B20 token launchpad built on Base, making it simple to create, launch, and trade meme tokens onchain.",
    "website": "https://twentypad.com",
    "twitter": "https://x.com/twentypad",
    "telegram": "https://t.me/twentypad",
    "discord": "",
    "editable": false
  }
}

```

Encode with viem / ethers / `cast calldata`. Do not hand-roll offsets.

## What the tx does

- B20 ASSET, 18 decimals, supply `1_000_000_000 ether`
- Uniswap v4 pool fee `0`, tickSpacing `200`
- Single-sided locked LP at ~$4k FDV
- Hook fee 1% of quote: 70% creator / 30% platform
- Default anti-snipe 99% → 1% over 20s
- `tokenCreator[token] = msg.sender`

## Refuse

Custom supply, custom ticks, extra ETH/USDC into the pool, bonding curves, unregistered quotes, missing name.


## After Success

Reply with token, salt, poolId, tx + Basescan, pair, unaudited warning. CA last 12 bits must match live `tokenSuffix` (often `ca7`).