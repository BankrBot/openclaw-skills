# Stash contracts — addresses, ABIs, encodings

## Addresses
| Contract | RHC mainnet (4663) |
| --- | --- |
| ERC-6551 registry | `0x000000006551c19487814612e58FE06813775758` ✅ live (canonical) |
| Stash account impl | `0xf7D4E66eA5b88B62a4aEb1E531e483B947B6151D` ✅ deployed |
| Stash collection (ERC-721 "STASH") | `0xA5718a030bd9dC18EB0b23B5409D86AA66A11944` ✅ deployed |
| StashMint (fee entrypoint) | `0xc6083Ffb885777cF8e80834E78346F726E825F9E` ✅ deployed |

> **Deployed to RHC mainnet 2026-07-20.** `SALT` = `0x00…00` (bytes32 zero). `feeRecipient` =
> `0xE852823A8daE6418Ad07A3E62F0bdac7fA665d4a`; `wrapFee` = 0 (free mints until priced via
> `setWrapFee`). `owner` (setMinter/setWrapFee/setFeeRecipient) = the deployer
> `0xE852823A8daE6418Ad07A3E62F0bdac7fA665d4a`. Verified on-chain: `collection.minter` = StashMint
> (minting locked to the paid entrypoint; a direct `mint()` reverts `not minter`).

## Registry — deterministic account
```solidity
// view: address is known before the account exists (pre-funding)
function account(address implementation, bytes32 salt, uint256 chainId,
                 address tokenContract, uint256 tokenId) external view returns (address);
// deploy the account (idempotent for the same args)
function createAccount(address implementation, bytes32 salt, uint256 chainId,
                       address tokenContract, uint256 tokenId) external returns (address);
```

## StashMint — the paid wrap entrypoint
```solidity
function wrap() external payable returns (uint256 tokenId, address account); // requires msg.value >= wrapFee
function wrapFee() external view returns (uint256);
function feeRecipient() external view returns (address);
```
`wrap()` collects the flat fee, mints the Stash to `msg.sender`, creates its account, refunds any
overpayment, emits `Wrapped(to, tokenId, account, fee)`. Minting is locked to this contract, so the
fee cannot be bypassed.

## Stash account — hold & unwrap
```solidity
function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
function owner() external view returns (address); // = ownerOf(the Stash NFT)
// only the current NFT holder may call; this is how unwrap + nested control happen
function execute(address to, uint256 value, bytes calldata data, uint8 operation)
    external payable returns (bytes memory);
```

## Encodings (viem-style)
```
wrap:    StashMint.wrap()                        value = wrapFee
fund:    erc20.transfer(account, amount)         // one per constituent
gift:    Stash.transferFrom(holder, to, tokenId)
nest:    Stash.transferFrom(holder, outerAccount, innerTokenId)
unwrap:  account.execute(erc20, 0,
             erc20.transfer(holder, balanceOf(account)), 0)   // one per constituent
nested:  outerAccount.execute(innerAccount, 0,
             innerAccount.execute(erc20, 0, erc20.transfer(holder, bal), 0), 0)
```

## Bankr Wallet API
Submit each encoded tx via the Bankr Wallet API (`/wallet/*`, direct signing + submission). Resolve
`@social` recipients to addresses with Bankr's handle resolution before `gift`. Use a read-only
`bk_` key to expose only `nav`.

All ABIs/selectors are in the Foundry project (`out/*.json`) and the source under `src/`.
