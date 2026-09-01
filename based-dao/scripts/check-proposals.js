#!/usr/bin/env node
/**
 * Check active BASED DAO governance proposals
 * Usage: node check-proposals.js [--all]
 */

const { ethers } = require('ethers');

const GOVERNOR = '0x1b20dcfdf520176cfab22888f07ea3419d15779d';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

const GOVERNOR_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256) view returns (uint256 proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed)",
  "function state(uint256) view returns (uint8)",
  "function getActions(uint256) view returns (address[] targets, uint256[] values, string[] signatures, bytes[] calldatas)",
  "function votingDelay() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function quorumVotes() view returns (uint256)"
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

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(GOVERNOR, GOVERNOR_ABI, provider);

  const showAll = process.argv.includes('--all');

  console.log('🏛️  BASED DAO Proposals\n');

  try {
    // Get governance params
    const [votingDelay, votingPeriod, proposalThreshold] = await Promise.all([
      contract.votingDelay().catch(() => 0n),
      contract.votingPeriod().catch(() => 0n),
      contract.proposalThreshold().catch(() => 0n)
    ]);

    if (votingDelay > 0n) {
      console.log('📊 Governance Parameters:');
      // votingDelay and votingPeriod are in blocks (Governor Bravo)
      // Base ~2 sec/block = ~43200 blocks/day
      const delayDays = (Number(votingDelay) * 2) / 86400;
      const periodDays = (Number(votingPeriod) * 2) / 86400;
      console.log(`Voting Delay: ${Number(votingDelay)} blocks (~${delayDays.toFixed(1)} days)`);
      console.log(`Voting Period: ${Number(votingPeriod)} blocks (~${periodDays.toFixed(1)} days)`);
      console.log(`Proposal Threshold: ${proposalThreshold.toString()} votes\n`);
    }

    // Get proposal count
    const count = await contract.proposalCount();
    console.log(`Total Proposals: ${count.toString()}\n`);

    if (count === 0n) {
      console.log('No proposals yet.');
      return;
    }

    // Check proposals (start from 1, Nouns governor is 1-indexed)
    const proposals = [];
    for (let i = 1; i <= Number(count); i++) {
      try {
        const [proposal, state] = await Promise.all([
          contract.proposals(i),
          contract.state(i)
        ]);

        const stateNum = Number(state);
        const stateName = STATES[stateNum] || 'Unknown';

        // Skip non-active if not --all
        if (!showAll && stateNum !== 1) continue;

        proposals.push({
          id: i,
          state: stateName,
          stateNum: stateNum,
          forVotes: proposal.forVotes,
          againstVotes: proposal.againstVotes,
          abstainVotes: proposal.abstainVotes,
          startBlock: proposal.startBlock,
          endBlock: proposal.endBlock,
          executed: proposal.executed,
          canceled: proposal.canceled
        });
      } catch (e) {
        // Proposal might not exist
        continue;
      }
    }

    if (proposals.length === 0) {
      console.log(showAll ? 'No proposals found.' : 'No active proposals. Use --all to see all proposals.');
      return;
    }

    // Display proposals
    for (const prop of proposals) {
      console.log(`Proposal #${prop.id}`);
      console.log(`State: ${prop.state}`);
      // Vote counts are raw integers (1 NFT = 1 vote, ERC721Votes)
      console.log(`For: ${prop.forVotes.toString()} votes`);
      console.log(`Against: ${prop.againstVotes.toString()} votes`);
      console.log(`Abstain: ${prop.abstainVotes.toString()} votes`);

      // Get current block
      const currentBlock = await provider.getBlockNumber();
      if (prop.stateNum === 1) { // Active
        const blocksLeft = Number(prop.endBlock) - currentBlock;
        const secondsLeft = blocksLeft * 2; // ~2 sec/block on Base
        const hoursLeft = Math.floor(secondsLeft / 3600);
        console.log(`Time Left: ~${hoursLeft} hours (${blocksLeft} blocks)`);
      }

      console.log(`URL: https://nouns.build/dao/base/0x10a5676ec8ae3d6b1f36a6f1a1526136ba7938bf/vote/${prop.id}`);
      console.log('---\n');
    }

    // Summary
    const active = proposals.filter(p => p.stateNum === 1).length;
    const succeeded = proposals.filter(p => p.stateNum === 4).length;
    const executed = proposals.filter(p => p.stateNum === 7).length;

    console.log(`\n📈 Summary:`);
    console.log(`Active: ${active}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Executed: ${executed}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
