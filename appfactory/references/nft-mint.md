# NFT Mint Page Pattern

A minting page for NFT collections with supply tracking and quantity selection.

## Features

- Supply counter (minted / max)
- Progress bar visualization
- Quantity selector
- Owned NFTs display
- Transaction status

## Implementation

```typescript
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt 
} from 'wagmi';
import { parseEther } from 'viem';
import { useState } from 'react';

const NFT_ADDRESS = '0x...' as const;
const MINT_PRICE = '0.01'; // ETH per NFT

// Minimal ABI for minting
const NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'maxSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export default function MintPage() {
  const [quantity, setQuantity] = useState(1);
  const { address, isConnected } = useAccount();
  
  // Read contract data
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: 'totalSupply',
  });
  
  const { data: maxSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: 'maxSupply',
  });
  
  const { data: ownedCount, refetch: refetchOwned } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });
  
  // Write contract
  const { 
    writeContract, 
    data: hash, 
    isPending,
    error,
    reset
  } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash,
    onSuccess: () => {
      refetchSupply();
      refetchOwned();
    }
  });

  const mint = () => {
    const totalCost = (Number(MINT_PRICE) * quantity).toString();
    writeContract({
      address: NFT_ADDRESS,
      abi: NFT_ABI,
      functionName: 'mint',
      args: [BigInt(quantity)],
      value: parseEther(totalCost),
    });
  };

  const isSoldOut = totalSupply && maxSupply && totalSupply >= maxSupply;
  const progress = totalSupply && maxSupply 
    ? (Number(totalSupply) / Number(maxSupply)) * 100 
    : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-gray-900 text-white">
      {/* Collection info */}
      <h1 className="text-4xl font-bold">NFT Collection</h1>
      
      {/* Supply counter */}
      <div className="text-2xl">
        {totalSupply?.toString() ?? '?'} / {maxSupply?.toString() ?? '?'} minted
      </div>
      
      {/* Progress bar */}
      <div className="w-full max-w-md bg-gray-700 rounded-full h-4">
        <div 
          className="bg-purple-500 h-4 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <ConnectButton />
      
      {isConnected && !isSoldOut && (
        <div className="flex flex-col items-center gap-4">
          {/* Price info */}
          <p className="text-gray-400">
            Price: {MINT_PRICE} ETH each
          </p>
          
          {/* Quantity selector */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 bg-gray-700 rounded-lg text-xl"
            >
              -
            </button>
            <span className="text-2xl w-12 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-10 h-10 bg-gray-700 rounded-lg text-xl"
            >
              +
            </button>
          </div>
          
          {/* Total cost */}
          <p className="text-lg">
            Total: {(Number(MINT_PRICE) * quantity).toFixed(3)} ETH
          </p>
          
          {/* Mint button */}
          <button
            onClick={mint}
            disabled={isPending || isConfirming}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-xl text-xl font-bold transition-colors"
          >
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Minting...' : `Mint ${quantity}`}
          </button>
        </div>
      )}
      
      {isSoldOut && (
        <p className="text-2xl text-yellow-400">🎉 Sold Out!</p>
      )}
      
      {/* Owned count */}
      {ownedCount !== undefined && ownedCount > 0n && (
        <p className="text-green-400 text-lg">
          You own {ownedCount.toString()} NFT(s) from this collection
        </p>
      )}
      
      {/* Status messages */}
      {isSuccess && (
        <div className="text-center">
          <p className="text-green-400 text-xl">✅ Minted successfully!</p>
          <button
            onClick={() => reset()}
            className="mt-2 text-sm text-gray-400 hover:text-white"
          >
            Mint more
          </button>
        </div>
      )}
      {error && (
        <p className="text-red-400">❌ {error.message}</p>
      )}
    </div>
  );
}
```

## Key wagmi Hooks

- `useReadContract` - Read contract state (supply, balance)
- `useWriteContract` - Execute mint function
- `useWaitForTransactionReceipt` - Track confirmation

## Customization

### Add Allowlist Check

```typescript
const { data: isAllowlisted } = useReadContract({
  address: NFT_ADDRESS,
  abi: [..., { name: 'isAllowlisted', ... }],
  functionName: 'isAllowlisted',
  args: [address],
});
```

### Add Countdown Timer

```typescript
const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

useEffect(() => {
  const timer = setInterval(() => {
    setTimeLeft(calculateTimeLeft());
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

### Show Owned NFTs Gallery

Use an indexer API (Alchemy, SimpleHash) to fetch and display owned NFTs.
