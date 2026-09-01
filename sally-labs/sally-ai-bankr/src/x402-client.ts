import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { WalletClient } from 'viem';

export interface X402Headers {
  'X-Payment-Version': string;
  'X-Payment-Chain': string;
  'X-Payment-Token': string;
  'X-Payment-Amount': string;
  'X-Payment-Address': string;
  'X-Payment-Signature': string;
}

export class SallyX402Client {
  private wallet: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  
  private readonly SALLY_API = 'https://api-x402.asksally.xyz';
  private readonly VERSION = 'x402-0.1.0';
  private readonly USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  
  constructor(privateKey: string) {
    if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;
    
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    this.wallet = createWalletClient({
      account: this.account,
      chain: base,
      transport: http(),
    });
  }
  
  getAddress() {
    return this.account.address;
  }
  
  async createPaymentHeaders(amount: bigint): Promise<X402Headers> {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${this.VERSION}:${base.id}:${amount}:${timestamp}`;
    const signature = await this.wallet.signMessage({ message });
    
    return {
      'X-Payment-Version': this.VERSION,
      'X-Payment-Chain': base.id.toString(),
      'X-Payment-Token': this.USDC,
      'X-Payment-Amount': amount.toString(),
      'X-Payment-Address': this.account.address,
      'X-Payment-Signature': signature,
    };
  }
  
  async chatWithSally(message: string): Promise<any> {
    const amount = BigInt(10000); // $0.01 USDC
    const headers = await this.createPaymentHeaders(amount);
    
    const res = await fetch(`${this.SALLY_API}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ message }),
    });
    
    if (res.status === 402) {
      throw new Error(
        `x402 Payment Failed. Wallet: ${this.account.address}. ` +
        `Ensure sufficient USDC on Base.`
      );
    }
    
    if (!res.ok) throw new Error(`Sally API error: ${await res.text()}`);
    return res.json();
  }
}