# SmartVault — integration reference

Empire treasuries are **ERC‑4337 SmartVault** contracts — same logical vault address on **Base (`8453`)** and **Arbitrum (`42161`)**.

---

## Addresses

Resolve **`empire_address`** from **`GET /api/empires/[empire_id]`**. Use that address as **`treasuryAddress`/`empireAddress`** when calling **`executeBatch`** returned by **`POST /api/distribute-prepare`**.

---

## Core ABI fragments

```solidity
struct Call {
    address target;
    uint256 value;
    bytes data;
}

function execute(Call calldata call_) external payable;

function executeBatch(Call[] calldata calls_) external payable;

function owner() external view returns (address);
```

Prepared payouts encode ERC‑20 **`transfer`** calls inside **`calls_`** — **`target`** = token contract, **`value`** = `0`, **`data`** = encoded **`transfer(recipient, amount)`**.

---

## Owner vs co-signers (on-chain)

**Integration semantics:** successful **API integration** payouts require an EOA that is the vault **`owner()`** to broadcast **`execute(...)`** / **`executeBatch(...)`** with the prepare response calldata — that access rule is enforced **on-chain** (see table below).

SmartVault **`execute`** and **`executeBatch`** are **not** “any signer may call.” A normal transaction **from a co-signer EOA** to the vault **`execute(...)`** or **`executeBatch(...)`** reverts with **`Unauthorized`** — the same check applies to both selectors.

| Role | Direct vault tx (`execute` / `executeBatch`) | ERC‑4337 UserOp |
|------|-----------------------------------------------|------------------|
| **`owner()`** | Allowed (typical integration + owner wallet) | Allowed (web app; signatures may be required per flow) |
| **Co-signer** (vault signer for **`validateUserOp`**) | **Not allowed** | Allowed when **`callData`** is validated **`executeBatch`** (e.g. website sponsored flow) |

Co-signers act **only** through **EntryPoint → `validateUserOp`** for batched execution, not by calling the vault directly.

---

## Two execution contexts

| Context | Who submits | Gas |
|---------|-------------|-----|
| **Website** UserOperation | Bundler + paymaster sponsorship | Covered by product **TX credits** ( **`executeBatch`**-shaped calldata ) |
| **API integration** (`distribute-prepare`) | **Vault `owner()`** wallet sends **`executeBatch`** txs using returned calldata | **You pay** native gas |

Agent integrations **must** follow the second row unless explicitly automating the native web UI. **Co-signers cannot substitute** for the owner on the API path.

---

## Burns vs vault sends

| Goal | Mechanism |
|------|-----------|
| Treasury → many recipients | **`executeBatch`** — prepare → **owner** broadcasts, or website UserOp for co-signers |
| Supply burn tracked in Empire analytics | Receipt must show eligible **Transfer** to burn address; **`POST /api/store-burn`**. Tokens **held outside** the vault: any wallet **`transfer`**. Tokens **in the vault**: **owner** **`execute`**, token **`burn`**, or website **`executeBatch`** UserOp for co-signers |

---

## Ordering multi-batch distributions

When **`transactions[]`** contains multiple rows sharing **`chainId`**, honor **`batchIndex`** ascending so nonce-dependent splits stay deterministic.

---

## StakingLocker (native staking)

Optional per-empire feature — only active when `empires.staking_activated == true` (see [`http-api.md` → Native staking](./http-api.md#native-staking)). The contract is **immutable**, has **no admin / upgrade path**, and is called **directly from the staker's EOA** — never through the empire SmartVault.

### Addresses (placeholders)

| Network | Chain ID | Address |
|---------|----------|---------|
| Base | 8453 | `<STAKING_LOCKER_BASE>` *(env: `NEXT_PUBLIC_STAKING_LOCKER_8453`)* |
| Arbitrum | 42161 | `<STAKING_LOCKER_ARBITRUM>` *(env: `NEXT_PUBLIC_STAKING_LOCKER_42161`)* |

Resolve at runtime via `getStakingLockerAddress(chainId)` (`src/config/staking-locker.ts`); when the env var is unset the helper returns `null` and `isStakingChainSupported(chainId)` is `false` — the activate-staking API will refuse with a clear error. Mainnet (chain `1`) is **not** supported.

### Lock duration

`lockDuration` is **any integer number of seconds** in `[0, 315_360_000]` (`0` = flexible, max = 10 years = `3650 days`). The on-chain check is `duration <= MAX_LOCK_DURATION`. There are no fixed tiers; UI presets exist only for convenience. `unlockTime` is `uint40` so 10 years fits.

### Operational caps + minimums

- `MAX_STAKES_PER_USER = 100` active positions per (user, token).
- `getMinimumStake(token)` is token-dependent: WETH → `0.001 ether`, USDC → `1e6` (USDC is 6-decimal), default → `100 * 1e18`.
- Fee-on-transfer tokens are **not supported**.

### Stake (two-step ERC-20 approve + stake)

```solidity
// Token: standard ERC-20 approve
function approve(address spender, uint256 amount) external returns (bool);

// StakingLocker
function stake(
    address token,
    uint256 amount,         // >= getMinimumStake(token)
    uint256 lockDuration    // any seconds in [0, 315_360_000]; 0 = flexible
) external returns (uint256 stakeId);

event Staked(
    uint256 indexed stakeId,
    address indexed token,
    address indexed owner,
    uint256 amount,
    uint40  unlockTime
);
```

Approve `amount` on the ERC-20 to the StakingLocker, then call `stake`. `lockDuration == 0` produces a "flexible" stake, unstakeable at any time.

### Unstake by global stake id

```solidity
function unstake(uint256 stakeId) external;

event Unstaked(
    uint256 indexed stakeId,
    address indexed token,
    address indexed owner,
    uint256 amount
);
```

Pass the **global** `stakeId`. `getUserStakeIds(user, token)` returns ids in the same order as `getActiveStakes` — index by id, never by array position.

### Reads used by Empire's pipelines

```solidity
function getMinimumStake(address token)        external pure returns (uint256);
function isValidLockDuration(uint256 duration) external pure returns (bool);

function getRawStake(address user, address token)        external view returns (uint256);
function getActiveStakeCount(address user, address token) external view returns (uint256);

struct Stake {
    address token;
    address owner;
    uint40  startTime;
    uint40  unlockTime;
    bool    unstaked;
    uint256 amount;
}

function getActiveStakes(address user, address token) external view returns (Stake[] memory);
function getUserStakeIds(address user, address token) external view returns (uint256[] memory);

function getStakerCount(address token) external view returns (uint256);
function getStakersPage(address token, uint256 page)
    external view
    returns (
        address[] memory stakers,
        uint256[] memory rawStakes,
        uint256          totalStakers,
        uint256          totalPages    // 250 stakers per page
    );

function getLockUpRemaining(uint256 stakeId) external view returns (uint256 remaining);
function getLockUpDuration(uint256 stakeId)  external view returns (uint256 duration);

function tokenStakers(address token, uint256 index) external view returns (address);
```

Where these are used:

- **Stakers leaderboard:** `getStakersPage` enumerates every staker; the pipeline pages `0..totalPages-1`.
- **`tokenHolders` / `farToken` augmentation:** the per-staker `rawStakes` are added on top of Ankr-derived holder balances before scoring.
- **STAKING booster qualification:** sums `getActiveStakes(user, token).amount` where each stake's `unlockTime - startTime >= booster.min_lockup_seconds`, then compares against `booster.min_amount`.

### After staking on-chain

There's no required server callback — refresh on the existing `PATCH /api/leaderboards/refresh/<type>` route (30s cooldown). The frontend `StakingModal` re-reads `getActiveStakes` + `getUserStakeIds` after every successful stake/unstake.
