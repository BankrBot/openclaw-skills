---
name: jb-croptop
description: |
  Croptop posting mechanics (CTPublisher, CTDeployer, CTProjectOwner). Use when:
  (1) publishing NFT posts to a project's 721 hook, (2) configuring allowed-post criteria
  per category, (3) deploying a Croptop-ready project, (4) locking a collection's
  ownership, (5) computing post pricing and the 5% fee. Croptop lets anyone mint NFT
  posts onto a Juicebox project's tiered 721 hook, subject to owner-set criteria.
version: 6.0.0
---

# Croptop: Permissionless NFT Posting

Croptop lets anyone publish NFT posts to a Juicebox project's tiered 721 hook. Each post becomes a new 721 tier (or reuses the existing tier for the same content); the poster pays the tier price plus a 5% fee and receives the first mint.

Contracts (same address on all chains — `references/shared/chain-config.json`):

| Contract | Role |
|----------|------|
| `CTPublisher` | Publishing engine: validates posts against criteria, creates tiers, takes the fee, pays the project |
| `CTDeployer` | Deploys projects pre-wired for Croptop (721 hook + data hook + optional suckers) |
| `CTProjectOwner` | Dead-end project owner: locks ownership forever while keeping posting alive |

## Posting criteria (`CTPublisher.configurePostingCriteriaFor`)

The collection owner defines per-category rules. Caller must hold `ADJUST_721_TIERS` (permission ID 24) for the hook owner's account on the hook's project. Each call replaces the category's criteria; categories can never be fully disabled after creation (set restrictive criteria/allowlist instead).

`CTAllowedPost` fields (ABI order):

| Field | Type | Meaning |
|-------|------|---------|
| `hook` | `address` | the 721 hook the criteria apply to |
| `category` | `uint24` | tier category being configured |
| `minimumPrice` | `uint104` | minimum post price (in the hook's pricing context) |
| `minimumTotalSupply` | `uint32` | minimum NFT supply per post; **must be non-zero** — zero means the category is closed |
| `maximumTotalSupply` | `uint32` | max supply per post; 0 = unlimited |
| `maximumSplitPercent` | `uint32` | max poster split, out of `JBConstants.SPLITS_TOTAL_PERCENT` (1,000,000,000); 0 = splits not allowed |
| `allowedAddresses` | `address[]` | allowlist of posters; empty = anyone |

Read back with `allowanceFor(hook, category)`.

## Publishing (`CTPublisher.mintFrom`)

```solidity
function mintFrom(
    IJB721TiersHook hook,
    CTPost[] calldata posts,
    address token,               // terminal token to pay with (0x…EEEe for native)
    uint256 amount,              // total supplied: post prices + 5% fee (must equal msg.value for native)
    address nftBeneficiary,      // receives the minted NFTs
    address feeBeneficiary,      // receives the fee project's tokens (must not be address(0))
    bytes calldata additionalPayMetadata // optional permit2 entry; must NOT already contain a pay metadata ID
) external payable;
```

`CTPost` fields (ABI order): `encodedIpfsUri (bytes32)`, `totalSupply (uint32)`, `price (uint104)`, `category (uint24)`, `splitPercent (uint32)`, `splits (JBSplit[])`.

Mechanics:
- Each new post creates a tier on the hook: `price`, `initialSupply = totalSupply`, poster's `splitPercent`/`splits`; everything else zeroed (no votes, no reserves, no discount, transfers unpausable).
- **Duplicate content reuses the tier**: `tierIdForEncodedIpfsUriOf[hook][encodedIpfsUri]` maps content to its tier. Re-posting the same URI mints from the existing tier at the **actual tier price** (a caller-supplied `price: 0` cannot dodge payment). Duplicate URIs within one batch revert.
- **Pricing**: `price` is denominated in the hook's pricing context (`hook.pricingContext()` → currency, decimals). The publisher converts to the payment token's accounting context via the price feed, rounding up. No feed → revert.
- **Fee**: `fee = totalPrice / FEE_DIVISOR` (`FEE_DIVISOR = 20` → 5%), required **on top** of the price: send `totalPrice + fee`. Skipped when posting to the fee project itself (`FEE_PROJECT_ID`). The fee is paid into the fee project's terminal with `feeBeneficiary` receiving the resulting tokens; if the fee project can't accept it, the fee is refunded to the caller.
- The remainder (`amount − fee`) is paid into the project's terminal with metadata instructing the 721 hook to mint the posted tier IDs to `nftBeneficiary`. Overpayment above the tier prices is still a payment — it buys project tokens for the beneficiary. The publisher verifies the NFT balance actually increased by the post count.
- ERC-20 payments: direct approval to the publisher or a permit2 entry inside `additionalPayMetadata` (id `"permit2"`). Native: `amount == msg.value` exactly.

Look up tiers for known content with `tiersFor(hook, encodedIpfsUris[])`.

## Deploying a Croptop project (`CTDeployer.deployProjectFor`)

```solidity
function deployProjectFor(
    address owner,
    CTProjectConfig calldata projectConfig,        // terminals, projectUri, allowedPosts, 721 name/symbol/contractUri, salt
    CTSuckerDeploymentConfig calldata suckerDeploymentConfiguration,
    IJBController controller
) external payable returns (uint256 projectId, IJB721TiersHook hook);
```

What it sets up:
- A project with one ruleset: `weight = 1_000_000e18`, base currency ETH, `cashOutTaxRate = MAX` (cash-outs disabled for holders), `dataHook = CTDeployer` — which grants suckers 0% cash-out tax and mint permission, and forwards pay/cash-out logic to the 721 hook.
- A tiered 721 hook (no initial tiers) owned by `CTDeployer`, with the publisher permitted to add tiers.
- The supplied `allowedPosts` configured on the publisher.
- Optional suckers (non-zero salt); sucker deployment failure emits an event instead of reverting the launch.
- The project NFT transferred to `owner`, who also gets direct hook permissions (`ADJUST_721_TIERS`, `SET_721_METADATA`, `MINT_721`, `SET_721_DISCOUNT_PERCENT`) scoped on the deployer's account.

`msg.value` covers the project creation fee, attributed to the true payer via the payer-tracker.

### Claiming full hook ownership

`CTDeployer.claimCollectionOwnershipOf(hook)` — callable by the project owner. Two steps, only the first is atomic:
1. The call revokes the launch-time deployer-scoped permissions and transfers hook ownership to the project (`transferOwnershipToProject`).
2. **The owner must then grant `CTPublisher` the `ADJUST_721_TIERS` permission for the project** — otherwise every subsequent `mintFrom` reverts.

## Locking ownership (`CTProjectOwner`)

`safeTransferFrom` the project NFT to `CTProjectOwner` to burn ownership while keeping posting alive: on receipt it grants the publisher `ADJUST_721_TIERS` for that project and has no transfer-out function. Configure posting criteria **before** transferring — criteria become immutable afterwards.

## Croptop in revnets

`REVDeployer.deployFor` accepts `REVCroptopAllowedPost[]` (same fields as `CTAllowedPost` minus `hook`). It configures them on the publisher during deployment and grants the publisher `ADJUST_721_TIERS` on the revnet, so posts work on revnet 721 hooks with no extra setup.

## Common mistakes

- Sending exactly `totalPrice` — the 5% fee is additive; the required amount is `totalPrice + totalPrice / 20`.
- Passing `price: 0` for content that already has a tier expecting a free mint — the publisher charges the stored tier's actual price.
- Configuring a category with `minimumTotalSupply: 0` — that's the "closed" sentinel; configuration reverts.
- After `claimCollectionOwnershipOf`, forgetting the `ADJUST_721_TIERS` grant to the publisher — all posting reverts.
- Including a pay-metadata entry for the hook's metadata ID target inside `additionalPayMetadata` — reverts (`CTPublisher_DuplicatePayMetadata`) to prevent tier-selection shadowing.
- Setting `feeBeneficiary` to `address(0)` — reverts.
