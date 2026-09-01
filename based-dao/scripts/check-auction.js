#!/usr/bin/env node
/**
 * Check current BASED DAO auction status
 * Usage: node check-auction.js
 */

const { ethers } = require('ethers');

const AUCTION_HOUSE = '0x0D2790f4831bDFd6a8Fd21C6f591bB69496b5e91';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const AUCTION_ABI = [
  "function auction() view returns (uint256 tokenId, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, bool settled)",
  "function minBidIncrement() view returns (uint256)",
  "function reservePrice() view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(AUCTION_HOUSE, AUCTION_ABI, provider);

  console.log('🏛️  BASED DAO Auction Status\n');

  try {
    const [auctionData, minBidIncrement, reservePrice] = await Promise.all([
      contract.auction(),
      contract.minBidIncrement(),
      contract.reservePrice()
    ]);

    const tokenId = auctionData.tokenId.toString();
    const currentBid = auctionData.highestBid;
    const bidder = auctionData.highestBidder;
    const endTime = Number(auctionData.endTime);
    const settled = auctionData.settled;

    console.log(`Auction #${tokenId}`);
    console.log(`URL: https://nouns.build/dao/base/0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf/${tokenId}\n`);

    console.log('Current Bid:', ethers.formatEther(currentBid), 'ETH');
    
    if (bidder === ethers.ZeroAddress) {
      console.log('Highest Bidder: None (no bids yet)');
    } else {
      console.log('Highest Bidder:', bidder);
    }

    const endDate = new Date(endTime * 1000);
    console.log('Ends:', endDate.toISOString());

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTime - now;

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      console.log(`Time Left: ${hours}h ${minutes}m`);
    } else {
      console.log('Status: ⏰ ENDED (awaiting settlement)');
    }

    console.log('Settled:', settled ? 'Yes' : 'No');
    
    console.log('\n📊 Bidding Info:');
    console.log('Reserve Price:', ethers.formatEther(reservePrice), 'ETH');
    console.log('Min Bid Increment:', minBidIncrement.toString() + '%');

    // Calculate minimum next bid
    let minNextBid;
    if (currentBid === 0n) {
      minNextBid = reservePrice;
      console.log('\n💰 Minimum First Bid:', ethers.formatEther(minNextBid), 'ETH');
    } else {
      minNextBid = currentBid + (currentBid * minBidIncrement / 100n);
      console.log('\n💰 Minimum Next Bid:', ethers.formatEther(minNextBid), 'ETH');
    }

    // Output JSON for programmatic use
    if (process.argv.includes('--json')) {
      console.log('\n---JSON---');
      console.log(JSON.stringify({
        tokenId: tokenId,
        currentBid: ethers.formatEther(currentBid),
        bidder: bidder,
        endTime: endTime,
        timeLeft: timeLeft,
        settled: settled,
        reservePrice: ethers.formatEther(reservePrice),
        minBidIncrement: minBidIncrement.toString(),
        minNextBid: ethers.formatEther(minNextBid)
      }, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
