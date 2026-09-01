# OnchainKit Integration

OnchainKit provides Base-native components for identity, swaps, and more.

## Installation

```bash
npm install @coinbase/onchainkit
```

## Setup Provider

Add to your providers:

```typescript
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider chain={base}>
          <RainbowKitProvider>
            {children}
          </RainbowKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Identity Components

### Avatar and Name

```typescript
import { Avatar, Name, Identity } from '@coinbase/onchainkit/identity';

function UserProfile({ address }: { address: `0x${string}` }) {
  return (
    <Identity address={address} className="flex items-center gap-3">
      <Avatar className="w-12 h-12 rounded-full" />
      <Name className="text-lg font-semibold" />
    </Identity>
  );
}
```

### Badge (Verified Status)

```typescript
import { Avatar, Name, Badge, Identity } from '@coinbase/onchainkit/identity';

function VerifiedProfile({ address }: { address: `0x${string}` }) {
  return (
    <Identity address={address}>
      <Avatar />
      <Name>
        <Badge />
      </Name>
    </Identity>
  );
}
```

### Address Display

```typescript
import { Address } from '@coinbase/onchainkit/identity';

<Address address="0x..." />
// Displays: 0x1234...5678 (truncated)
```

## Swap Component

```typescript
import { Swap, SwapButton, SwapMessage, SwapToggleButton } from '@coinbase/onchainkit/swap';
import { Token } from '@coinbase/onchainkit/token';

const ETH: Token = {
  name: 'Ethereum',
  address: '',
  symbol: 'ETH',
  decimals: 18,
  image: 'https://...',
  chainId: 8453,
};

const USDC: Token = {
  name: 'USD Coin',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
  image: 'https://...',
  chainId: 8453,
};

function TokenSwap() {
  return (
    <Swap>
      <SwapAmountInput
        label="Sell"
        token={ETH}
      />
      <SwapToggleButton />
      <SwapAmountInput
        label="Buy"
        token={USDC}
      />
      <SwapButton />
      <SwapMessage />
    </Swap>
  );
}
```

## Transaction Components

### Transaction Button

```typescript
import { Transaction, TransactionButton, TransactionStatus } from '@coinbase/onchainkit/transaction';

function MintButton() {
  const contracts = [
    {
      address: '0x...',
      abi: NFT_ABI,
      functionName: 'mint',
      args: [1n],
      value: parseEther('0.01'),
    },
  ];

  return (
    <Transaction
      chainId={8453}
      contracts={contracts}
      onSuccess={(response) => console.log('Success:', response)}
    >
      <TransactionButton text="Mint NFT" />
      <TransactionStatus />
    </Transaction>
  );
}
```

## Wallet Components

### Wallet Connect

```typescript
import { Wallet, ConnectWallet, WalletDropdown } from '@coinbase/onchainkit/wallet';

function WalletButton() {
  return (
    <Wallet>
      <ConnectWallet>
        <Avatar />
        <Name />
      </ConnectWallet>
      <WalletDropdown>
        <Identity />
        <WalletDropdownDisconnect />
      </WalletDropdown>
    </Wallet>
  );
}
```

## Frame Components

```typescript
import { FrameMetadata } from '@coinbase/onchainkit/frame';

export const metadata: Metadata = {
  ...FrameMetadata({
    buttons: [{ label: 'Mint' }],
    image: { src: 'https://...', aspectRatio: '1:1' },
    postUrl: 'https://.../api/frame',
  }),
};
```

## Styling

OnchainKit components accept className props:

```typescript
<Avatar className="w-16 h-16 rounded-full border-2 border-blue-500" />
<Name className="text-xl font-bold text-white" />
```

Or use CSS variables for theming:

```css
:root {
  --ock-primary: #0052FF;
  --ock-secondary: #1A1A2E;
}
```

## Best Practices

1. **Wrap with OnchainKitProvider** at the root
2. **Use Base chain** for best compatibility
3. **Handle loading states** - components may need to fetch data
4. **Combine with RainbowKit** for full wallet support
5. **Check documentation** for latest APIs - OnchainKit updates frequently

## Resources

- [OnchainKit Documentation](https://docs.base.org/onchainkit)
- [Component Playground](https://onchainkit.xyz)
- [GitHub Repository](https://github.com/coinbase/onchainkit)
