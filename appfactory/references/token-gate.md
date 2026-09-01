# Token Gate Pattern

Restrict access to content based on token ownership (ERC20 or ERC721).

## Features

- Check token balance
- Show/hide gated content
- Multiple token support
- Threshold configuration

## ERC20 Token Gate

```typescript
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';

const TOKEN_ADDRESS = '0x...' as const;
const REQUIRED_BALANCE = 1n * 10n ** 18n; // 1 token (18 decimals)
const TOKEN_DECIMALS = 18;
const TOKEN_SYMBOL = 'TOKEN';

export default function TokenGate() {
  const { address, isConnected } = useAccount();
  
  const { data: balance, isLoading } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const hasAccess = balance !== undefined && balance >= REQUIRED_BALANCE;
  const formattedBalance = balance 
    ? formatUnits(balance, TOKEN_DECIMALS) 
    : '0';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold">Members Only 🔐</h1>
      
      <ConnectButton />
      
      {isConnected && isLoading && (
        <div className="animate-pulse">
          <p className="text-gray-400">Checking access...</p>
        </div>
      )}
      
      {isConnected && !isLoading && (
        <>
          {/* Balance display */}
          <p className="text-gray-400">
            Your balance: {formattedBalance} {TOKEN_SYMBOL}
          </p>
          
          {hasAccess ? (
            <div className="max-w-lg p-8 bg-green-900/30 border border-green-500 rounded-2xl">
              <h2 className="text-2xl font-bold text-green-400 mb-4">
                🔓 Welcome, Token Holder!
              </h2>
              <p className="text-gray-300 mb-4">
                You have access to exclusive content:
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>✅ Private Discord access</li>
                <li>✅ Early feature previews</li>
                <li>✅ Exclusive airdrops</li>
                <li>✅ Premium support</li>
              </ul>
              
              {/* Your exclusive content here */}
              <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <h3 className="font-bold mb-2">Secret Message:</h3>
                <p className="text-green-300">
                  Thank you for being a holder! 🎉
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-lg p-8 bg-red-900/30 border border-red-500 rounded-2xl">
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                🔒 Access Denied
              </h2>
              <p className="text-gray-300 mb-4">
                You need at least {formatUnits(REQUIRED_BALANCE, TOKEN_DECIMALS)} {TOKEN_SYMBOL} to access this content.
              </p>
              <a 
                href="https://app.uniswap.org" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                Get {TOKEN_SYMBOL} →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

## NFT Gate (ERC721)

```typescript
'use client';

import { useAccount, useReadContract } from 'wagmi';

const NFT_ADDRESS = '0x...' as const;

const NFT_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export default function NFTGate() {
  const { address, isConnected } = useAccount();
  
  const { data: nftBalance } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const hasNFT = nftBalance !== undefined && nftBalance > 0n;

  // Same UI pattern as above
  return hasNFT ? <GatedContent /> : <AccessDenied />;
}
```

## Multi-Token Gate

```typescript
const REQUIRED_TOKENS = [
  { address: '0x...', minBalance: 1n * 10n ** 18n },
  { address: '0x...', minBalance: 100n * 10n ** 18n },
];

// Check multiple tokens
const results = REQUIRED_TOKENS.map(token => 
  useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })
);

const hasAllTokens = results.every((result, i) => 
  result.data !== undefined && result.data >= REQUIRED_TOKENS[i].minBalance
);
```

## Tiered Access

```typescript
const TIERS = [
  { name: 'Bronze', minBalance: 100n * 10n ** 18n },
  { name: 'Silver', minBalance: 1000n * 10n ** 18n },
  { name: 'Gold', minBalance: 10000n * 10n ** 18n },
];

const userTier = TIERS.filter(tier => 
  balance !== undefined && balance >= tier.minBalance
).pop();
```

## Best Practices

1. **Show loading state** while checking balance
2. **Display current balance** so users know how much they have
3. **Link to DEX** for users to acquire tokens
4. **Cache balance checks** to avoid excessive RPC calls
5. **Consider grace periods** for users who recently sold
