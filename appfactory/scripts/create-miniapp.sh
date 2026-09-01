#!/bin/bash
# AppFactory - Create a new Base miniapp
# Created by Axiom (@AxiomBot)

set -e

PROJECT_NAME="${1:-my-miniapp}"
TEMPLATE="${2:-base}"

echo "🏭 AppFactory - Creating new miniapp: $PROJECT_NAME"
echo ""

# Create Next.js project
echo "📦 Creating Next.js project..."
npx create-next-app@latest "$PROJECT_NAME" --typescript --tailwind --app --no-git --use-npm

cd "$PROJECT_NAME"

# Install wallet dependencies
echo "🔗 Installing wallet dependencies..."
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query

# Install OnchainKit for Base features
echo "🔵 Installing OnchainKit..."
npm install @coinbase/onchainkit

# Create lib directory
mkdir -p lib

# Create wagmi config
echo "⚙️ Creating wagmi config..."
cat > lib/wagmi.ts << 'EOF'
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'My Miniapp',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [base, baseSepolia],
  ssr: true,
});
EOF

# Create providers
echo "🎨 Creating providers..."
cat > app/providers.tsx << 'EOF'
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
EOF

# Update layout
echo "📄 Updating layout..."
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'My Miniapp',
  description: 'A Base miniapp built with AppFactory',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

# Create sample page with wallet connect
echo "🏠 Creating sample page..."
cat > app/page.tsx << 'EOF'
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold">🏭 My Miniapp</h1>
      <p className="text-gray-400">Built with AppFactory on Base</p>
      
      <ConnectButton />
      
      {isConnected && (
        <div className="mt-8 p-6 bg-gray-800 rounded-xl">
          <p className="text-green-400">✅ Connected!</p>
          <p className="text-sm text-gray-400 mt-2 font-mono">{address}</p>
        </div>
      )}
    </main>
  );
}
EOF

# Create .env.example
echo "🔐 Creating environment template..."
cat > .env.example << 'EOF'
# Get your project ID at dashboard.reown.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional: Alchemy API key for better RPC
NEXT_PUBLIC_ALCHEMY_API_KEY=your_key

# For Farcaster frames
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
EOF

# Copy to .env.local
cp .env.example .env.local

echo ""
echo "✅ Miniapp created successfully!"
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_NAME"
echo "  2. Get a WalletConnect Project ID at https://dashboard.reown.com"
echo "  3. Add it to .env.local"
echo "  4. npm run dev"
echo ""
echo "🔵 Built for Base by AppFactory"
echo "🤖 Created by Axiom (@AxiomBot)"
