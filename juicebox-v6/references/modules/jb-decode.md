---
name: jb-decode
description: |
  Decode and analyze Juicebox transaction calldata. Use when: (1) explaining what
  a pending transaction will do before signing, (2) analyzing historical transactions
  from block explorer, (3) debugging failed transactions by decoding revert data,
  (4) reverse-engineering transaction parameters from raw calldata, (5) decoding
  hook metadata (buyback quotes, 721 tier mints) embedded in pay/cashOut calls.
version: 6.0.0
---

# Juicebox Transaction Decoder

Decode and analyze Juicebox transaction calldata.

## Identify the Contract

Core contracts share the same address on every chain (CREATE2). Match the transaction's `to` address (full list: `references/shared/chain-config.json`):

| `to` address | Contract |
|---|---|
| `0x130f5dd2bd8805443cf41755253d778a75a67f53` | JBMultiTerminal |
| `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` | JBController |
| `0xb853758a70a6b4216c09f1d071ea2344aba0a34f` | JBOmnichainDeployer |
| `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691` | JBProjects |
| `0xf92ac1ab5a00033e35a3975739124f61928c36b0` | JBPermissions |
| `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9` | JBTokens |
| `0x77bee1ad2ac0ace98a9b5b58d75685c8b4d94948` | JBBuybackHook |
| `0xb552eb94284f94b833837d4b2cbb237128415d4e` | REVDeployer |

Verified ABIs for every core contract are in `references/shared/abis/*.json`.

## Common Function Selectors

### JBMultiTerminal

| Selector | Signature | Effect |
|---|---|---|
| `0xfef43257` | `pay(uint256,address,uint256,address,uint256,string,bytes)` | Pay a project, mint tokens to beneficiary |
| `0x9e6eec05` | `addToBalanceOf(uint256,address,uint256,bool,string,bytes)` | Add funds without minting tokens |
| `0x13da8317` | `cashOutTokensOf(address,uint256,uint256,address,uint256,address,bytes)` | Burn tokens, reclaim surplus |
| `0xcfaf5839` | `sendPayoutsOf(uint256,address,uint256,uint256,uint256)` | Distribute payouts to splits |
| `0x748e821c` | `useAllowanceOf(uint256,address,uint256,uint256,uint256,address,address,string)` | Use surplus allowance |

### JBController

| Selector | Signature | Effect |
|---|---|---|
| `0x5c7465e5` | `launchProjectFor(address,string,JBRulesetConfig[],JBTerminalConfig[],string)` | Launch a new project (payable — see below) |
| `0x38945b58` | `launchRulesetsFor(uint256,string,JBRulesetConfig[],JBTerminalConfig[],string)` | Launch the first rulesets for an existing project |
| `0x3141db70` | `queueRulesetsOf(uint256,JBRulesetConfig[],string)` | Queue new rulesets |
| `0xc7fb92de` | `mintTokensOf(uint256,uint256,address,string,bool)` | Mint tokens |
| `0xa2d532e6` | `burnTokensOf(address,uint256,uint256,string)` | Burn tokens |
| `0x090db2f1` | `sendReservedTokensToSplitsOf(uint256)` | Distribute reserved tokens |
| `0x58178191` | `deployERC20For(uint256,string,string,bytes32)` | Deploy project ERC-20 |
| `0x303f5dfa` | `claimTokensFor(address,uint256,uint256,address)` | Claim credits as ERC-20 |
| `0xb1e6d2a1` | `transferCreditsFrom(address,uint256,address,uint256)` | Transfer credits |
| `0x702a3977` | `setUriOf(uint256,string)` | Set project metadata URI |

### Canonical tuple encodings

`JBRulesetConfig` encodes as:

```
(uint48 mustStartAtOrAfter, uint32 duration, uint112 weight, uint32 weightCutPercent,
 address approvalHook,
 (uint16 reservedPercent, uint16 cashOutTaxRate, uint32 baseCurrency,
  bool pausePay, bool pauseCreditTransfers, bool allowOwnerMinting, bool allowSetCustomToken,
  bool allowTerminalMigration, bool allowSetTerminals, bool allowSetController,
  bool allowAddAccountingContext, bool allowAddPriceFeed, bool ownerMustSendPayouts,
  bool holdFees, bool scopeCashOutsToLocalBalances, bool useDataHookForPay,
  bool useDataHookForCashOut, address dataHook, uint16 metadata),
 (uint256 groupId, (uint32 percent, uint64 projectId, address beneficiary,
  bool preferAddToBalance, uint48 lockedUntil, address hook)[])[],
 (address terminal, address token, (uint224 amount, uint32 currency)[],
  (uint224 amount, uint32 currency)[])[])
```

`JBTerminalConfig` encodes as `(address terminal, (address token, uint8 decimals, uint32 currency)[])`.

Full flat signature (for `cast calldata-decode`):

```
launchProjectFor(address,string,(uint48,uint32,uint112,uint32,address,(uint16,uint16,uint32,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,bool,address,uint16),(uint256,(uint32,uint64,address,bool,uint48,address)[])[],(address,address,(uint224,uint32)[],(uint224,uint32)[])[])[],(address,(address,uint8,uint32)[])[],string)
```

`queueRulesetsOf` uses the same `JBRulesetConfig[]` tuple: `queueRulesetsOf(uint256,<JBRulesetConfig[] tuple>,string)`.

### msg.value rules

- `launchProjectFor` is payable: `msg.value` must equal `JBProjects.creationFee()` exactly, or it reverts with `JBController_InvalidCreationFee`. A launch transaction always carries a nonzero `value`.
- `pay` / `addToBalanceOf` carry `msg.value == amount` only when `token` is the native token `0x000000000000000000000000000000000000EEEe`; for ERC-20 payments `value` is 0 and the amount moves via `transferFrom` (or Permit2 metadata).

## Decoding with Cast

```bash
# Get the function signature for a selector
cast 4byte <first-4-bytes-of-calldata>

# Decode calldata
cast calldata-decode "pay(uint256,address,uint256,address,uint256,string,bytes)" <calldata>

# Get transaction details
cast tx <txhash> --rpc-url $RPC_URL
```

### Example: Decode a Pay Transaction

```bash
cast calldata-decode \
    "pay(uint256,address,uint256,address,uint256,string,bytes)" \
    "0xfef43257..."
# Returns:
# projectId: 123
# token: 0x000000000000000000000000000000000000EEEe (native token)
# amount: 1000000000000000000
# beneficiary: 0x...
# minReturnedTokens: 0
# memo: "Supporting the project"
# metadata: 0x...
```

## Decoding with ethers.js

```typescript
import { ethers } from 'ethers';

// Prefer loading the full verified ABI from references/shared/abis/JBMultiTerminal.json.
const TERMINAL_ABI = [
    'function pay(uint256 projectId, address token, uint256 amount, address beneficiary, uint256 minReturnedTokens, string memo, bytes metadata) payable returns (uint256)',
    'function cashOutTokensOf(address holder, uint256 projectId, uint256 cashOutCount, address tokenToReclaim, uint256 minTokensReclaimed, address beneficiary, bytes metadata) returns (uint256)',
    'function addToBalanceOf(uint256 projectId, address token, uint256 amount, bool shouldReturnHeldFees, string memo, bytes metadata) payable',
    'function sendPayoutsOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut) returns (uint256)',
    'function useAllowanceOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut, address beneficiary, address feeBeneficiary, string memo) returns (uint256)',
];

const iface = new ethers.Interface(TERMINAL_ABI);

function decodeCalldata(calldata: string) {
    try {
        const decoded = iface.parseTransaction({ data: calldata });
        return { name: decoded.name, args: decoded.args, signature: decoded.signature };
    } catch (e) {
        return null;
    }
}

async function decodeTransaction(txHash: string) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const tx = await provider.getTransaction(txHash);
    if (!tx) throw new Error('Transaction not found');
    const decoded = iface.parseTransaction({ data: tx.data });
    return { from: tx.from, to: tx.to, value: ethers.formatEther(tx.value), function: decoded?.name, args: decoded?.args };
}
```

## Transaction Analysis Examples

### Pay Transaction
```
Function: pay(uint256,address,uint256,address,uint256,string,bytes)
Parameters:
  projectId: 123                → Paying into project #123
  token: 0x0000...EEEe          → Native token (msg.value must equal amount)
  amount: 1e18                  → Paying 1 ETH
  beneficiary: 0xABC...         → Tokens minted to this address
  minReturnedTokens: 0          → No minimum (accepts any token count)
  memo: "Great project!"        → Payment memo
  metadata: 0x...               → JBMetadataResolver-formatted hook metadata

Effect: Sends 1 ETH to project #123, mints project tokens to 0xABC...
```

### Cash Out Transaction
```
Function: cashOutTokensOf(...)
Parameters:
  holder: 0xABC...              → Token holder cashing out
  projectId: 123                → From project #123
  cashOutCount: 1000e18         → Burning 1000 tokens
  tokenToReclaim: 0x0000...EEEe → Reclaiming native token
  minTokensReclaimed: 0         → No minimum
  beneficiary: 0xABC...         → Reclaimed funds go here
  metadata: 0x...               → JBMetadataResolver-formatted hook metadata

Effect: Burns 1000 tokens, sends the bonding-curve share of surplus to 0xABC...
(2.5% protocol fee applies when the ruleset's cashOutTaxRate != 0)
```

### Queue Rulesets Transaction
```
Function: queueRulesetsOf(...)
Parameters:
  projectId: 123
  rulesetConfigurations: [...]  → New JBRulesetConfig[]
  memo: "Update params"

Effect: Queues new ruleset(s) that activate when the current one ends
(subject to the current ruleset's approvalHook)
```

## Decoding Hook Metadata

The `metadata` argument of `pay`/`cashOutTokensOf` is NOT a bare `abi.encode` payload. It uses the `JBMetadataResolver` format:

- bytes 0–31: reserved word for the protocol
- next: a lookup table of `(bytes4 id, uint8 wordOffset)` entries, zero-padded to a 32-byte word
- then: each entry's data, zero-padded to 32-byte words

Each hook looks up its own entry by ID:

```solidity
bytes4 id = bytes4(bytes20(target) ^ bytes20(keccak256(bytes(purpose))));
// == JBMetadataResolver.getId(purpose, target)
```

| Hook | purpose | target | Entry payload |
|---|---|---|---|
| JBBuybackHook (pay) | `"pay"` | buyback hook address | `abi.encode(uint256 amountToSwapWith, uint256 minimumSwapAmountOut)` — `minimumSwapAmountOut == 0` means "no explicit quote", hook falls back to its TWAP oracle |
| JBBuybackHook (cash out) | `"cashOut"` | buyback hook address | `abi.encode(uint256 minimumSwapAmountOut, bool skip)` |
| JB721TiersHook (pay) | `"pay"` | hook's `METADATA_ID_TARGET()` | `abi.encode(bool allowOverspending, uint16[] tierIdsToMint)` |
| JB721TiersHook (cash out) | `"cashOut"` | hook's `METADATA_ID_TARGET()` | `abi.encode(uint256[] tokenIdsToBurn)` |

`METADATA_ID_TARGET` is an immutable set to `address(this)` at implementation deployment — for cloned 721 hooks it is the shared implementation address, not the clone's address. Read `METADATA_ID_TARGET()` on the hook to get the right ID target.

To build metadata off-chain, replicate `JBMetadataResolver.createMetadata(ids, datas)`: reserved word, then the id table, then each 32-byte-padded payload.

## Generation Guidelines

1. **Identify the contract** from the `to` address (table above / `references/shared/chain-config.json`)
2. **Extract the function selector** (first 4 bytes) and match it in the selector tables
3. **Decode parameters** using the ABI from `references/shared/abis/`
4. **Explain the effect** in plain language, including `msg.value` checks
5. **Decode nested hook metadata** via the JBMetadataResolver format if present

## Common mistakes

- Treating the native token as `address(0)`. Juicebox uses `0x000000000000000000000000000000000000EEEe` (`JBConstants.NATIVE_TOKEN`).
- Decoding `pay`/`cashOut` metadata as a bare `abi.encode(...)` tuple. It is JBMetadataResolver-framed; the hook payload sits behind a `(bytes4 id, uint8 offset)` lookup table.
- Using the clone's own address as the 721 metadata ID target. Use the hook's `METADATA_ID_TARGET()` (the implementation address for clones).
- Forgetting that `launchProjectFor` requires `msg.value == JBProjects.creationFee()` exactly — decoders that flag "unexpected value" on project-creation transactions are wrong.
- Decoding `JBRulesetConfig` with wide types. Fields are packed: `uint48 mustStartAtOrAfter`, `uint32 duration`, `uint112 weight`, `uint32 weightCutPercent`; splits are `(uint32,uint64,address,bool,uint48,address)`.

## Example Prompts

- "What does this transaction do? 0x..."
- "Decode this calldata for JBMultiTerminal"
- "Explain what happened in transaction 0xabc..."
- "What tiers does this pay() call mint?"
