# Tip Jar Pattern

A simple tip jar that lets users send ETH to a creator address with preset amounts.

## Features

- Preset tip amounts (0.001, 0.005, 0.01 ETH)
- Custom amount option
- Transaction status tracking
- Success/error feedback

## Implementation

```typescript
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useState } from 'react';

const RECIPIENT = '0x...'; // Creator's wallet address

const TIP_AMOUNTS = ['0.001', '0.005', '0.01'];

export default function TipJar() {
  const [customAmount, setCustomAmount] = useState('');
  const { isConnected } = useAccount();
  const { 
    sendTransaction, 
    data: hash, 
    isPending,
    error,
    reset
  } = useSendTransaction();
  const { 
    isLoading: isConfirming, 
    isSuccess 
  } = useWaitForTransactionReceipt({ hash });

  const tip = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return;
    sendTransaction({
      to: RECIPIENT,
      value: parseEther(amount),
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold">Tip Jar 💰</h1>
      <p className="text-gray-400">Support the creator</p>
      
      <ConnectButton />
      
      {isConnected && (
        <div className="flex flex-col gap-6 w-full max-w-md">
          {/* Preset amounts */}
          <div className="flex gap-3 justify-center">
            {TIP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => tip(amount)}
                disabled={isPending || isConfirming}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                {amount} ETH
              </button>
            ))}
          </div>
          
          {/* Custom amount */}
          <div className="flex gap-2">
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="Custom amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-800 rounded-xl text-white"
            />
            <button
              onClick={() => tip(customAmount)}
              disabled={isPending || isConfirming || !customAmount}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-xl font-semibold"
            >
              Send
            </button>
          </div>
        </div>
      )}
      
      {/* Status messages */}
      {isPending && (
        <p className="text-yellow-400">⏳ Confirm in your wallet...</p>
      )}
      {isConfirming && (
        <p className="text-yellow-400">⏳ Waiting for confirmation...</p>
      )}
      {isSuccess && (
        <div className="text-center">
          <p className="text-green-400 text-xl">✅ Thanks for the tip!</p>
          <button
            onClick={() => reset()}
            className="mt-2 text-sm text-gray-400 hover:text-white"
          >
            Send another tip
          </button>
        </div>
      )}
      {error && (
        <div className="text-center">
          <p className="text-red-400">❌ {error.message}</p>
          <button
            onClick={() => reset()}
            className="mt-2 text-sm text-gray-400 hover:text-white"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
```

## Key wagmi Hooks

- `useSendTransaction` - Send ETH transactions
- `useWaitForTransactionReceipt` - Wait for confirmation
- `useAccount` - Get connected wallet info

## Customization

### Add ENS Resolution

```typescript
import { useEnsName } from 'wagmi';

const { data: ensName } = useEnsName({ address: RECIPIENT });
// Display ensName || truncated address
```

### Add Recent Tips Feed

Query your contract events or use The Graph to display recent tips.

### Add USD Conversion

Use a price feed or API to show tip amounts in USD.
