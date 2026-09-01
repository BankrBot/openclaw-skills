# Troubleshooting

Common issues and solutions when building Base miniapps.

## Wallet Issues

### Wallet Won't Connect

**Symptoms**: ConnectButton appears but clicking does nothing or shows error.

**Solutions**:
1. **Check WalletConnect Project ID**
   ```bash
   # Verify .env.local has valid ID
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_id
   ```
   Get one at [dashboard.reown.com](https://dashboard.reown.com)

2. **Check chain configuration**
   ```typescript
   // Make sure chains are properly imported
   import { base, baseSepolia } from 'wagmi/chains';
   ```

3. **Clear browser cache** - Cached wallet state can cause issues

4. **Try different browser** - Some browser extensions interfere

### Wrong Network

**Symptoms**: Wallet connected but shows wrong chain.

**Solution**: Add network switching:
```typescript
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';

const { switchChain } = useSwitchChain();

// In your component
if (chainId !== base.id) {
  return (
    <button onClick={() => switchChain({ chainId: base.id })}>
      Switch to Base
    </button>
  );
}
```

## Transaction Issues

### Transaction Fails Immediately

**Causes**:
- Insufficient gas
- Contract reverted
- Wrong parameters

**Debug steps**:
1. Check error message in console
2. Verify contract address is correct
3. Check ABI matches deployed contract
4. Ensure user has enough ETH for gas

```typescript
// Add error handling
const { error } = useWriteContract();
if (error) {
  console.log('Error:', error.message);
  // Check for specific errors
  if (error.message.includes('insufficient funds')) {
    // Show "need more ETH" message
  }
}
```

### Transaction Pending Forever

**Causes**:
- Gas price too low
- Network congestion
- Nonce issues

**Solutions**:
1. Wait for network to clear
2. Speed up transaction in wallet
3. Cancel and retry with higher gas

### "User Rejected" Error

This is normal - user declined in wallet. Show friendly message:
```typescript
if (error?.message.includes('User rejected')) {
  return <p>Transaction cancelled</p>;
}
```

## Build Errors

### "Module not found"

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors with wagmi

Ensure correct versions:
```json
{
  "dependencies": {
    "@rainbow-me/rainbowkit": "^2.0.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0"
  }
}
```

### Hydration Mismatch

Wrap wallet-dependent code in client component:
```typescript
'use client';

// This file uses wallet hooks
```

Add `ssr: true` to wagmi config:
```typescript
export const config = getDefaultConfig({
  // ...
  ssr: true,
});
```

## Frame Issues

### Frame Not Showing in Warpcast

**Checklist**:
1. ✅ `NEXT_PUBLIC_APP_URL` set correctly
2. ✅ Frame endpoint returns valid response
3. ✅ Image URL is accessible
4. ✅ Buttons have valid labels

**Test with**: [Warpcast Frame Validator](https://warpcast.com/~/developers/frames)

### Frame Image Not Loading

- Ensure image URL is absolute (https://...)
- Check CORS headers allow Farcaster
- Image must be < 10MB
- Supported formats: PNG, JPG, GIF

### Frame Transaction Fails

1. Verify `chainId` is correct (`eip155:8453` for Base)
2. Check transaction data is properly encoded
3. Ensure contract function exists and is callable

## Environment Issues

### Environment Variables Not Loading

```bash
# Variables must be prefixed with NEXT_PUBLIC_ for client-side
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxx  # ✅ Works
WALLETCONNECT_PROJECT_ID=xxx              # ❌ Won't work client-side
```

Restart dev server after changing `.env.local`.

### Vercel Deployment Issues

1. Add environment variables in Vercel dashboard
2. Trigger new deployment after adding vars
3. Check build logs for errors

## Getting Help

1. **Check error message** - Usually tells you what's wrong
2. **Search GitHub issues** - RainbowKit, wagmi, frames.js repos
3. **Base Discord** - community support
4. **Stack Overflow** - with `[base]` or `[wagmi]` tags

## Quick Fixes Checklist

- [ ] Environment variables set and prefixed correctly
- [ ] Dependencies installed (`npm install`)
- [ ] Dev server restarted after env changes
- [ ] Using `'use client'` for wallet components
- [ ] Correct chain IDs (Base: 8453, Base Sepolia: 84532)
- [ ] Contract addresses are checksummed
- [ ] ABI matches deployed contract
- [ ] User has ETH for gas
