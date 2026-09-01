#!/usr/bin/env node
/**
 * Vote on a BASED DAO governance proposal
 * Usage: PRIVATE_KEY=0x... node vote.js <proposal_id> <support>
 * Support: 0 = Against, 1 = For, 2 = Abstain
 * Example: PRIVATE_KEY=0x123... node vote.js 5 1
 */

const { ethers } = require('ethers');

const GOVERNOR = '0x1b20dcfdf520176cfab22888f07ea3419d15779d';
const TOKEN = '0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const GOVERNOR_ABI = [
  "function state(uint256) view returns (uint8)",
  "function proposals(uint256) view returns (uint256 proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed)",
  "function castVote(uint256 proposalId, uint8 support) external returns (uint256)",
  "function castVoteWithReason(uint256 proposalId, uint8 support, string reason) external returns (uint256)",
  "function hasVoted(uint256 proposalId, address voter) view returns (bool)"
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function delegates(address) view returns (address)"
];

const STATES = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed'
};

const SUPPORT = {
  0: 'Against',
  1: 'For',
  2: 'Abstain'
};

async function main() {
  // Parse arguments
  const proposalId = process.argv[2];
  const support = process.argv[3];
  const reason = process.argv[4] || '';

  if (!proposalId || support === undefined) {
    console.error('❌ Usage: node vote.js <proposal_id> <support> [reason]');
    console.error('   Support: 0 = Against, 1 = For, 2 = Abstain');
    console.error('   Example: node vote.js 5 1 "I support this proposal"');
    process.exit(1);
  }

  const supportNum = parseInt(support);
  if (![0, 1, 2].includes(supportNum)) {
    console.error('❌ Invalid support value. Use 0 (Against), 1 (For), or 2 (Abstain)');
    process.exit(1);
  }

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable not set');
    console.error('   Usage: PRIVATE_KEY=0x... node vote.js 5 1');
    process.exit(1);
  }

  // Setup
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const governorContract = new ethers.Contract(GOVERNOR, GOVERNOR_ABI, wallet);
  const tokenContract = new ethers.Contract(TOKEN, TOKEN_ABI, provider);

  console.log('🗳️  BASED DAO Vote\n');
  console.log('Voter:', wallet.address);
  console.log('Proposal ID:', proposalId);
  console.log('Vote:', SUPPORT[supportNum]);
  if (reason) console.log('Reason:', reason);
  console.log();

  try {
    // Check voting power
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log('Your NFTs:', balance.toString());

    if (balance === 0n) {
      console.error('❌ You have no BASED DAO NFTs. Cannot vote.');
      process.exit(1);
    }

    // Check delegation
    const delegate = await tokenContract.delegates(wallet.address);
    if (delegate === ethers.ZeroAddress) {
      console.log('⚠️  Warning: Your voting power is not delegated.');
      console.log('   You may need to delegate to yourself to vote.');
      console.log('   Check: https://nouns.build/dao/base/0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf');
    } else if (delegate.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('⚠️  Warning: Your votes are delegated to:', delegate);
      console.log('   Only the delegate can vote with your voting power.');
    }

    // Check proposal state
    const [state, proposal] = await Promise.all([
      governorContract.state(proposalId),
      governorContract.proposals(proposalId)
    ]);

    const stateNum = Number(state);
    const stateName = STATES[stateNum] || 'Unknown';

    console.log('\n📊 Proposal Status:');
    console.log('State:', stateName);
    // Vote counts are raw integers (1 NFT = 1 vote, ERC721Votes)
    console.log('For:', proposal.forVotes.toString(), 'votes');
    console.log('Against:', proposal.againstVotes.toString(), 'votes');
    console.log('Abstain:', proposal.abstainVotes.toString(), 'votes');

    if (stateNum !== 1) {
      console.error(`\n❌ Cannot vote. Proposal is ${stateName}, not Active.`);
      process.exit(1);
    }

    // Check if already voted
    const hasVoted = await governorContract.hasVoted(proposalId, wallet.address);
    if (hasVoted) {
      console.error('\n❌ You have already voted on this proposal.');
      process.exit(1);
    }

    // Calculate blocks left
    const currentBlock = await provider.getBlockNumber();
    const blocksLeft = Number(proposal.endBlock) - currentBlock;
    const hoursLeft = Math.floor((blocksLeft * 2) / 3600); // ~2 sec/block
    console.log(`\nVoting ends in: ~${hoursLeft} hours (${blocksLeft} blocks)`);

    // Cast vote
    console.log('\n📤 Submitting vote...');

    let tx;
    if (reason) {
      tx = await governorContract.castVoteWithReason(proposalId, supportNum, reason, {
        gasLimit: 300000
      });
    } else {
      tx = await governorContract.castVote(proposalId, supportNum, {
        gasLimit: 250000
      });
    }

    console.log('Transaction:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Vote cast!');
    console.log('Block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    const gasCost = receipt.gasUsed * receipt.gasPrice;
    console.log('Gas cost:', ethers.formatEther(gasCost), 'ETH');

    console.log('\n🎉 Your vote has been recorded!');
    console.log(`View proposal: https://nouns.build/dao/base/0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf/vote/${proposalId}`);

  } catch (error) {
    console.error('❌ Error:', error.message);

    // Parse common errors
    if (error.message.includes('User already voted')) {
      console.error('   → You have already voted on this proposal');
    } else if (error.message.includes('Proposal not active')) {
      console.error('   → Proposal is not currently active');
    } else if (error.message.includes('insufficient funds')) {
      console.error('   → Insufficient ETH for gas');
    }

    process.exit(1);
  }
}

main().catch(console.error);
