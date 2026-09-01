#!/usr/bin/env node
/**
 * Place a bid on the current BASED DAO auction
 * Usage: PRIVATE_KEY=0x... node place-bid.js <bid_amount_in_eth>
 * Example: PRIVATE_KEY=0x123... node place-bid.js 0.0009
 */

const { ethers } = require('ethers');

const AUCTION_HOUSE = '0x0D2790f4831bDFd6a8Fd21C6f591bB69496b5e91';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const AUCTION_ABI = [
  "function auction() view returns (uint256 tokenId, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, bool settled)",
  "function createBid(uint256 tokenId) payable",
  "function minBidIncrement() view returns (uint256)",
  "function reservePrice() view returns (uint256)"
];

async function main() {
  // Parse arguments
  const bidAmountETH = process.argv[2];
  
  if (!bidAmountETH) {
    console.error('❌ Usage: node place-bid.js <bid_amount_in_eth>');
    console.error('   Example: node place-bid.js 0.0009');
    process.exit(1);
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable not set');
    console.error('   Usage: PRIVATE_KEY=0x... node place-bid.js 0.0009');
    process.exit(1);
  }

  // Setup
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(AUCTION_HOUSE, AUCTION_ABI, wallet);

  console.log('🏛️  BASED DAO Auction Bid\n');
  console.log('Bidder:', wallet.address);
  console.log('Bid Amount:', bidAmountETH, 'ETH\n');

  try {
    // Get current auction state
    const [auctionData, reservePrice, minBidIncrement] = await Promise.all([
      contract.auction(),
      contract.reservePrice(),
      contract.minBidIncrement()
    ]);

    const tokenId = auctionData.tokenId;
    const currentBid = auctionData.highestBid;
    const endTime = Number(auctionData.endTime);
    const settled = auctionData.settled;

    console.log('Auction #' + tokenId.toString());
    console.log('Current Bid:', ethers.formatEther(currentBid), 'ETH');
    
    // Check if auction is active
    const now = Math.floor(Date.now() / 1000);
    if (now > endTime) {
      console.error('❌ Auction has ended');
      process.exit(1);
    }

    if (settled) {
      console.error('❌ Auction already settled');
      process.exit(1);
    }

    const timeLeft = endTime - now;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    console.log(`Time Left: ${hours}h ${minutes}m\n`);

    // Parse and validate bid amount
    const bidAmount = ethers.parseEther(bidAmountETH);

    // Check minimum bid
    let minBid;
    if (currentBid === 0n) {
      minBid = reservePrice;
      console.log('Reserve Price:', ethers.formatEther(reservePrice), 'ETH');
    } else {
      minBid = currentBid + (currentBid * minBidIncrement / 100n);
      console.log('Min Bid Increment:', minBidIncrement.toString() + '%');
    }

    console.log('Minimum Required Bid:', ethers.formatEther(minBid), 'ETH');

    if (bidAmount < minBid) {
      console.error(`❌ Bid too low. Minimum: ${ethers.formatEther(minBid)} ETH`);
      process.exit(1);
    }

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    const gasBuffer = ethers.parseEther('0.001'); // ~0.001 ETH for gas
    const totalNeeded = bidAmount + gasBuffer;

    console.log('\n💰 Balance Check:');
    console.log('Your Balance:', ethers.formatEther(balance), 'ETH');
    console.log('Needed (bid + gas):', ethers.formatEther(totalNeeded), 'ETH');

    if (balance < totalNeeded) {
      console.error('❌ Insufficient balance');
      process.exit(1);
    }

    // Confirm bid
    console.log('\n📤 Submitting bid...');

    const tx = await contract.createBid(tokenId, {
      value: bidAmount,
      gasLimit: 200000  // Typical gas usage: 60k-80k
    });

    console.log('Transaction:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Bid confirmed!');
    console.log('Block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    const gasCost = receipt.gasUsed * receipt.gasPrice;
    console.log('Gas cost:', ethers.formatEther(gasCost), 'ETH');

    console.log('\n🎉 You are now the highest bidder!');
    console.log(`View auction: https://nouns.build/dao/base/0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf/${tokenId.toString()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Parse common errors
    if (error.message.includes('Auction expired')) {
      console.error('   → Auction has ended');
    } else if (error.message.includes('Must send more than last bid')) {
      console.error('   → Bid amount too low');
    } else if (error.message.includes('insufficient funds')) {
      console.error('   → Insufficient ETH balance');
    }
    
    process.exit(1);
  }
}

main().catch(console.error);
