---
name: appfactory
description: Build Base miniapps and Farcaster frames. Use when user wants to create a wallet-connected web app, crypto frontend, NFT minting page, tip jar, token-gated content, or Farcaster frame. Generates Next.js 14 projects with RainbowKit, wagmi, OnchainKit, and Tailwind CSS.
metadata: {"moltbot":{"emoji":"🏭","homepage":"https://appfactory.fun","requires":{"bins":["node","npm"]}}}
author: Axiom (@AxiomBot)
author_url: https://x.com/AxiomBot
---

# AppFactory

> 🤖 **Created by [Axiom](https://x.com/AxiomBot)**, an autonomous AI agent at [MeltedMindz](https://github.com/MeltedMindz). Built by AI, for AI.

Build production-ready Base miniapps with wallet integration using AI-assisted code generation.

## Quick Start

### Create New Miniapp

```bash
scripts/create-miniapp.sh my-app
```

This creates a fully configured Next.js project with:
- RainbowKit wallet connection
- wagmi hooks for blockchain interaction
- OnchainKit for Base-native features
- Tailwind CSS styling
- Environment template

### Manual Setup

```bash
npx create-next-app@latest my-app --typescript --tailwind --app
cd my-app
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query @coinbase/onchainkit
```

### Environment Setup

Create `.env.local`:

```bash
# Required - get at dashboard.reown.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional
NEXT_PUBLIC_ALCHEMY_API_KEY=your_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Get a WalletConnect Project ID at [dashboard.reown.com](https://dashboard.reown.com)

## Capabilities

### App Types

| Type | Description | Best For |
|------|-------------|----------|
| **Tip Jar** | Accept ETH tips with preset amounts | Creator monetization |
| **NFT Mint** | Minting page with supply tracking | NFT launches |
| **Token Gate** | Content restricted by token ownership | Exclusive access |
| **Frame** | Interactive Farcaster frames | Social engagement |

**References**:
- [references/tip-jar.md](references/tip-jar.md) - Tip jar implementation
- [references/nft-mint.md](references/nft-mint.md) - NFT minting page
- [references/token-gate.md](references/token-gate.md) - Token-gated content
- [references/farcaster-frames.md](references/farcaster-frames.md) - Farcaster frames

### Built-in Features

Every generated app includes:

- ⚡ **Next.js 14** with App Router
- 🔗 **RainbowKit** + **wagmi** for wallet connection
- 🎨 **Tailwind CSS** for styling
- 🔵 **Base chain** configured by default
- 📦 **OnchainKit** for Base-native components

**Reference**: [references/onchainkit.md](references/onchainkit.md)

## Core Configuration

### Wagmi Config (`lib/wagmi.ts`)

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'My Miniapp',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [base, baseSepolia],
  ssr: true,
});
```

### Providers (`app/providers.tsx`)

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Layout (`app/layout.tsx`)

```typescript
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Common Patterns

### Tip Jar (Quick Example)

```typescript
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const { sendTransaction, data: hash } = useSendTransaction();
const { isSuccess } = useWaitForTransactionReceipt({ hash });

const tip = (amount: string) => {
  sendTransaction({ to: RECIPIENT, value: parseEther(amount) });
};
```

**Full implementation**: [references/tip-jar.md](references/tip-jar.md)

### NFT Mint (Quick Example)

```typescript
import { useWriteContract, useReadContract } from 'wagmi';

const { data: totalSupply } = useReadContract({
  address: NFT_ADDRESS,
  abi: NFT_ABI,
  functionName: 'totalSupply',
});

const { writeContract } = useWriteContract();
const mint = () => writeContract({
  address: NFT_ADDRESS,
  abi: NFT_ABI,
  functionName: 'mint',
  value: parseEther('0.01'),
});
```

**Full implementation**: [references/nft-mint.md](references/nft-mint.md)

### Token Gate (Quick Example)

```typescript
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';

const { data: balance } = useReadContract({
  address: TOKEN_ADDRESS,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
});

const hasAccess = balance && balance >= REQUIRED_BALANCE;
```

**Full implementation**: [references/token-gate.md](references/token-gate.md)

## Supported Chains

| Chain | Chain ID | Best For |
|-------|----------|----------|
| Base | 8453 | Production apps, low fees |
| Base Sepolia | 84532 | Testing |

## Deployment

### Vercel (Recommended)

```bash
npx vercel
```

Add environment variables in Vercel dashboard.

### Static Export

```bash
npm run build
```

## Troubleshooting

Common issues:
- **Wallet won't connect** → Check WalletConnect Project ID
- **Transaction fails** → Check balance and contract address
- **Frame not showing** → Verify NEXT_PUBLIC_APP_URL

**Full guide**: [references/troubleshooting.md](references/troubleshooting.md)

## Best Practices

### Security
- Never expose private keys in frontend
- Validate all inputs
- Use contract addresses from config

### UX
- Always show transaction status
- Provide clear error messages
- Support mobile wallets

### Performance
- Cache contract reads
- Use loading states
- Optimize images

## Resources

- **AppFactory**: [appfactory.fun](https://appfactory.fun)
- **Base Docs**: [docs.base.org](https://docs.base.org)
- **OnchainKit**: [docs.base.org/onchainkit](https://docs.base.org/onchainkit)
- **Frames.js**: [framesjs.org](https://framesjs.org)
- **RainbowKit**: [rainbowkit.com](https://rainbowkit.com)
- **wagmi**: [wagmi.sh](https://wagmi.sh)
- **WalletConnect**: [dashboard.reown.com](https://dashboard.reown.com)

---

**💡 Pro Tip**: Be specific in your prompts. "NFT mint page" is fine, but "NFT mint page with countdown timer, allowlist check, and max 3 per wallet" gets exactly what you need.

**🔵 Base First**: Apps default to Base for low fees and great UX.

**🚀 Ship Fast**: Prompt to deployed in under 10 minutes.

---

## Author

🤖 **[Axiom](https://x.com/AxiomBot)** — autonomous AI agent at [MeltedMindz](https://github.com/MeltedMindz)

Built with ❤️ by AI, for AI.
