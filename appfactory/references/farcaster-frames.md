# Farcaster Frames

Build interactive frames for Farcaster using frames.js.

## Setup

```bash
npm install frames.js
```

## Basic Frame

Create `app/api/frame/route.tsx`:

```typescript
import { createFrames, Button } from 'frames.js/next/server';

const frames = createFrames({
  basePath: '/api/frame',
});

const handler = frames(async (ctx) => {
  const hasClicked = ctx.searchParams.clicked === 'true';
  
  return {
    image: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a2e',
          color: 'white',
          fontSize: 48,
          fontFamily: 'sans-serif',
        }}
      >
        {hasClicked ? '🎉 Thanks for clicking!' : '👋 Welcome!'}
      </div>
    ),
    buttons: hasClicked
      ? [
          <Button action="link" target="https://appfactory.fun">
            Visit AppFactory
          </Button>,
        ]
      : [
          <Button action="post" target={{ query: { clicked: 'true' } }}>
            Click Me!
          </Button>,
        ],
  };
});

export const GET = handler;
export const POST = handler;
```

## Frame with Mint Action

```typescript
import { createFrames, Button } from 'frames.js/next/server';

const frames = createFrames({
  basePath: '/api/mint-frame',
});

const handler = frames(async (ctx) => {
  // Get user's Farcaster ID
  const fid = ctx.message?.requesterFid;
  
  return {
    image: (
      <div style={{ /* ... */ }}>
        <h1>Mint NFT</h1>
        <p>Price: 0.01 ETH</p>
      </div>
    ),
    buttons: [
      <Button 
        action="tx" 
        target="/api/mint-frame/tx"
        post_url="/api/mint-frame/success"
      >
        Mint Now
      </Button>,
    ],
  };
});

export const GET = handler;
export const POST = handler;
```

Create transaction endpoint `app/api/mint-frame/tx/route.ts`:

```typescript
import { TransactionTargetResponse } from 'frames.js';
import { encodeFunctionData, parseEther } from 'viem';

const NFT_ADDRESS = '0x...';
const NFT_ABI = [/* mint function ABI */];

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();
  
  const calldata = encodeFunctionData({
    abi: NFT_ABI,
    functionName: 'mint',
    args: [1n], // quantity
  });

  const txData: TransactionTargetResponse = {
    chainId: 'eip155:8453', // Base
    method: 'eth_sendTransaction',
    params: {
      to: NFT_ADDRESS,
      data: calldata,
      value: parseEther('0.01').toString(),
    },
  };

  return Response.json(txData);
}
```

## Frame with Input

```typescript
const handler = frames(async (ctx) => {
  const userInput = ctx.message?.inputText;
  
  return {
    image: (
      <div style={{ /* ... */ }}>
        {userInput 
          ? `You said: ${userInput}` 
          : 'Enter your message:'}
      </div>
    ),
    textInput: 'Type something...',
    buttons: [
      <Button action="post">
        Submit
      </Button>,
    ],
  };
});
```

## Add Frame Metadata to Page

In your main `app/page.tsx`:

```typescript
import { Metadata } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

export const metadata: Metadata = {
  title: 'My Frame',
  description: 'An interactive Farcaster frame',
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${APP_URL}/api/frame`,
    'fc:frame:button:1': 'Click Me!',
    'fc:frame:post_url': `${APP_URL}/api/frame`,
  },
};
```

## Testing Frames

1. **Warpcast Frame Validator**: https://warpcast.com/~/developers/frames
2. **frames.js Debugger**: Run `npx frames` locally
3. **Deploy to Vercel** and test in Warpcast

## Environment Variables

```bash
# Required for frames
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Best Practices

1. **Keep images simple** - frames render in small sizes
2. **Test on mobile** - most Farcaster users are on mobile
3. **Handle errors gracefully** - show friendly error states
4. **Optimize image generation** - cache when possible
5. **Use meaningful button labels** - users should know what happens

## Resources

- [frames.js Documentation](https://framesjs.org)
- [Farcaster Frame Spec](https://docs.farcaster.xyz/reference/frames/spec)
- [Warpcast Frame Validator](https://warpcast.com/~/developers/frames)
