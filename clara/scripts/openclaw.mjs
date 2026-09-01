#!/usr/bin/env node
/**
 * OpenClaw CLI — Clara marketplace explorer for Claude Code.
 * Uses claraid-sdk for all Ponder REST queries.
 *
 * Usage: node openclaw.mjs <command> [args] [--flags]
 *
 * Commands:
 *   browse [--skill=X] [--status=open] [--limit=N]
 *   show <address>
 *   challenges [--skill=X] [--status=open] [--limit=N]
 *   challenge <address>
 *   leaderboard <challengeAddress> [--limit=N]
 *   agent <id>
 *   agent-address <address>
 *   reputation <agentId>
 *   find-agents [--skill=X] [--limit=N]
 *   my-work <address>
 *   stats
 */

import { ClaraClient, formatAddress, formatRawAmount, BOUNTY_ABI } from 'claraid-sdk';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const client = new ClaraClient();

// ── Wallet setup (optional — enables write operations) ──────────────────

let writer = null;
let walletAddress = null;

const pk = process.env.OPENCLAW_PRIVATE_KEY;
if (pk) {
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  walletAddress = account.address;
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });
  writer = client.withWallet(walletClient);
}

function requireWriter(command) {
  if (!writer) {
    out({
      error: `Write operation "${command}" requires OPENCLAW_PRIVATE_KEY to be set.`,
      hint: 'Set OPENCLAW_PRIVATE_KEY env var with a hex private key for Base mainnet.',
      alternative: 'Use --prepare to get raw transaction data without signing.',
    });
    process.exit(1);
  }
  return writer;
}

// ── Arg parsing ──────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;
const prepareOnly = rest.includes('--prepare');

function getFlag(name) {
  const prefix = `--${name}=`;
  const match = rest.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function getPositional(index = 0) {
  return rest.filter((a) => !a.startsWith('--'))[index];
}

// ── Token helpers ────────────────────────────────────────────────────────

function tokenLabel(address, rawAmount) {
  const formatted = formatRawAmount(String(rawAmount), address);
  // formatRawAmount returns the formatted string with symbol, or raw amount if unknown token
  return formatted;
}

function deadlineLabel(ts) {
  if (!ts) return 'none';
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = ts * 1000 - now;
  if (diff < 0) return `expired ${d.toLocaleDateString()}`;
  const days = Math.floor(diff / 86400000);
  if (days > 1) return `${days}d left (${d.toLocaleDateString()})`;
  const hours = Math.floor(diff / 3600000);
  return `${hours}h left`;
}

// ── Output helper ────────────────────────────────────────────────────────

function out(data) {
  console.log(JSON.stringify(data, null, 2));
}

// ── Commands ─────────────────────────────────────────────────────────────

async function browse() {
  const filters = {};
  const skill = getFlag('skill');
  const status = getFlag('status') || 'open';
  const limit = parseInt(getFlag('limit') || '20', 10);
  if (skill) filters.skill = skill;
  if (status) filters.status = status;
  if (limit) filters.limit = limit;

  const bounties = await client.bounties.list(filters);

  if (bounties.length === 0) {
    out({ command: 'browse', filters, count: 0, bounties: [], message: 'No bounties found matching filters.' });
    return;
  }

  const rows = bounties.map((b) => ({
    address: b.bountyAddress,
    reward: tokenLabel(b.token, b.amount),
    status: b.status,
    skills: b.skillTags,
    deadline: deadlineLabel(b.deadline),
    poster: formatAddress(b.poster),
    hasClaimer: !!b.claimer,
  }));

  out({ command: 'browse', filters, count: rows.length, bounties: rows });
}

async function show() {
  const addr = getPositional();
  if (!addr) {
    out({ error: 'Missing bounty address. Usage: show <address>' });
    process.exit(1);
  }

  const b = await client.bounties.get(addr);
  if (!b) {
    out({ error: `Bounty not found: ${addr}` });
    process.exit(1);
  }

  // Parse task metadata from URI if it's a data URI
  let task = null;
  if (b.taskURI?.startsWith('data:')) {
    try {
      const json = b.taskURI.split(',')[1];
      task = JSON.parse(decodeURIComponent(json));
    } catch {}
  }

  out({
    command: 'show',
    bounty: {
      address: b.bountyAddress,
      status: b.status,
      reward: tokenLabel(b.token, b.amount),
      token: b.token,
      poster: b.poster,
      deadline: deadlineLabel(b.deadline),
      deadlineTs: b.deadline,
      skills: b.skillTags,
      claimer: b.claimer || null,
      claimerAgentId: b.claimerAgentId || null,
      proofURI: b.proofURI || null,
      workerBond: b.workerBond || null,
      posterBond: b.posterBond || null,
      taskDescription: task?.description || task?.summary || null,
      taskRaw: task,
      createdTxHash: b.createdTxHash,
    },
  });
}

async function listChallenges() {
  const filters = {};
  const skill = getFlag('skill');
  const status = getFlag('status') || 'open';
  const limit = parseInt(getFlag('limit') || '20', 10);
  if (skill) filters.skill = skill;
  if (status) filters.status = status;
  if (limit) filters.limit = limit;

  const challenges = await client.challenges.list(filters);

  if (challenges.length === 0) {
    out({ command: 'challenges', filters, count: 0, challenges: [], message: 'No challenges found.' });
    return;
  }

  const rows = challenges.map((c) => ({
    address: c.challengeAddress,
    prizePool: tokenLabel(c.token, c.prizePool),
    status: c.status,
    skills: c.skillTags,
    deadline: deadlineLabel(c.deadline),
    submissions: c.submissionCount,
    winnerCount: c.winnerCount,
    maxParticipants: c.maxParticipants,
  }));

  out({ command: 'challenges', filters, count: rows.length, challenges: rows });
}

async function showChallenge() {
  const addr = getPositional();
  if (!addr) {
    out({ error: 'Missing challenge address. Usage: challenge <address>' });
    process.exit(1);
  }

  const c = await client.challenges.get(addr);
  if (!c) {
    out({ error: `Challenge not found: ${addr}` });
    process.exit(1);
  }

  // Parse challenge metadata
  let meta = null;
  if (c.challengeURI?.startsWith('data:')) {
    try {
      const json = c.challengeURI.split(',')[1];
      meta = JSON.parse(decodeURIComponent(json));
    } catch {}
  }

  const submissionList = Object.values(c.submissions || {}).map((s) => ({
    submitter: formatAddress(s.submitter),
    agentId: s.agentId,
    score: s.score,
    rank: s.rank,
    submittedAt: s.submittedAt ? new Date(s.submittedAt * 1000).toISOString() : null,
  }));

  out({
    command: 'challenge',
    challenge: {
      address: c.challengeAddress,
      status: c.status,
      prizePool: tokenLabel(c.token, c.prizePool),
      token: c.token,
      poster: c.poster,
      evaluator: c.evaluator,
      deadline: deadlineLabel(c.deadline),
      scoringDeadline: deadlineLabel(c.scoringDeadline),
      skills: c.skillTags,
      submissionCount: c.submissionCount,
      winnerCount: c.winnerCount,
      maxParticipants: c.maxParticipants,
      payoutBps: c.payoutBps,
      winners: c.winners,
      submissions: submissionList,
      description: meta?.description || meta?.summary || null,
      metaRaw: meta,
      createdTxHash: c.createdTxHash,
    },
  });
}

async function leaderboard() {
  const addr = getPositional();
  if (!addr) {
    out({ error: 'Missing challenge address. Usage: leaderboard <address>' });
    process.exit(1);
  }
  const limit = parseInt(getFlag('limit') || '25', 10);

  const entries = await client.challenges.leaderboard(addr, limit);
  const rows = entries.map((s, i) => ({
    rank: s.rank ?? i + 1,
    submitter: formatAddress(s.submitter),
    agentId: s.agentId,
    score: s.score,
  }));

  out({ command: 'leaderboard', challenge: addr, count: rows.length, entries: rows });
}

async function showAgent() {
  const id = getPositional();
  if (!id) {
    out({ error: 'Missing agent ID. Usage: agent <id>' });
    process.exit(1);
  }

  const agent = await client.agents.get(parseInt(id, 10));
  if (!agent) {
    out({ error: `Agent not found: #${id}` });
    process.exit(1);
  }

  out({
    command: 'agent',
    agent: {
      id: agent.agentId,
      name: agent.name,
      owner: agent.owner,
      skills: agent.skills,
      description: agent.description || null,
      reputation: {
        count: agent.reputationCount ?? 0,
        average: agent.reputationAvg ?? null,
        sum: agent.reputationSum ?? 0,
      },
    },
  });
}

async function showAgentByAddress() {
  const addr = getPositional();
  if (!addr) {
    out({ error: 'Missing address. Usage: agent-address <address>' });
    process.exit(1);
  }

  const agent = await client.agents.getByAddress(addr);
  if (!agent) {
    out({ error: `No agent registered at ${addr}` });
    process.exit(1);
  }

  out({
    command: 'agent',
    agent: {
      id: agent.agentId,
      name: agent.name,
      owner: agent.owner,
      skills: agent.skills,
      description: agent.description || null,
      reputation: {
        count: agent.reputationCount ?? 0,
        average: agent.reputationAvg ?? null,
        sum: agent.reputationSum ?? 0,
      },
    },
  });
}

async function findAgents() {
  const filters = {};
  const skill = getFlag('skill');
  const limit = parseInt(getFlag('limit') || '20', 10);
  if (skill) filters.skill = skill;
  if (limit) filters.limit = limit;

  const agents = await client.agents.find(filters);
  const rows = agents.map((a) => ({
    id: a.agentId,
    name: a.name,
    skills: a.skills,
    reputation: a.reputationAvg ?? null,
    reputationCount: a.reputationCount ?? 0,
  }));

  out({ command: 'find-agents', filters, count: rows.length, agents: rows });
}

async function showReputation() {
  const id = getPositional();
  if (!id) {
    out({ error: 'Missing agent ID. Usage: reputation <agentId>' });
    process.exit(1);
  }

  const agentId = parseInt(id, 10);
  const [summary, feedbacks] = await Promise.all([
    client.reputation.summary(agentId),
    client.reputation.feedbacks(agentId),
  ]);

  const feedbackRows = feedbacks.map((f) => ({
    from: formatAddress(f.clientAddress),
    value: f.value,
    tags: [f.tag1, f.tag2].filter(Boolean),
    revoked: f.revoked,
  }));

  out({
    command: 'reputation',
    agentId,
    summary: summary
      ? {
          count: summary.count,
          average: summary.averageRating,
          total: summary.totalValue,
        }
      : null,
    feedbacks: feedbackRows,
  });
}

async function myWork() {
  const addr = getPositional();
  if (!addr) {
    out({ error: 'Missing address. Usage: my-work <address>' });
    process.exit(1);
  }

  // Fetch bounties where user is poster AND where user is claimer, in parallel
  const [asPosted, asClaimed] = await Promise.all([
    client.bounties.list({ poster: addr }),
    client.bounties.list({ claimer: addr }),
  ]);

  const posted = asPosted.map((b) => ({
    address: b.bountyAddress,
    reward: tokenLabel(b.token, b.amount),
    status: b.status,
    skills: b.skillTags,
    claimer: b.claimer ? formatAddress(b.claimer) : null,
  }));

  const claimed = asClaimed.map((b) => ({
    address: b.bountyAddress,
    reward: tokenLabel(b.token, b.amount),
    status: b.status,
    skills: b.skillTags,
    poster: formatAddress(b.poster),
  }));

  out({
    command: 'my-work',
    address: addr,
    posted: { count: posted.length, bounties: posted },
    claimed: { count: claimed.length, bounties: claimed },
  });
}

async function stats() {
  const s = await client.stats();
  out({ command: 'stats', ...s });
}

// ── Write Commands ───────────────────────────────────────────────────────

async function claim() {
  const bounty = getPositional(0);
  const agentIdStr = getPositional(1) || getFlag('agent');
  if (!bounty || !agentIdStr) {
    out({ error: 'Usage: claim <bountyAddress> <agentId>' });
    process.exit(1);
  }
  const agentId = parseInt(agentIdStr, 10);

  if (prepareOnly) {
    out({
      command: 'claim',
      mode: 'prepare',
      transaction: {
        to: bounty,
        data: encodeFunctionData({ abi: BOUNTY_ABI, functionName: 'claim', args: [BigInt(agentId)] }),
        value: '0',
      },
    });
    return;
  }

  const w = requireWriter('claim');
  const txHash = await w.bounty.claim({ bounty, agentId });
  out({ command: 'claim', txHash, bounty, agentId });
}

async function submitWork() {
  const bounty = getPositional(0);
  const proofURI = getPositional(1) || getFlag('proof');
  if (!bounty || !proofURI) {
    out({ error: 'Usage: submit <bountyAddress> <proofURI>' });
    process.exit(1);
  }

  if (prepareOnly) {
    out({
      command: 'submit',
      mode: 'prepare',
      transaction: {
        to: bounty,
        data: encodeFunctionData({ abi: BOUNTY_ABI, functionName: 'submitWork', args: [proofURI] }),
        value: '0',
      },
    });
    return;
  }

  const w = requireWriter('submit');
  const txHash = await w.bounty.submit({ bounty, proofURI });
  out({ command: 'submit', txHash, bounty });
}

async function approveBounty() {
  const bounty = getPositional(0);
  if (!bounty) {
    out({ error: 'Usage: approve <bountyAddress>' });
    process.exit(1);
  }

  if (prepareOnly) {
    out({
      command: 'approve',
      mode: 'prepare',
      transaction: {
        to: bounty,
        data: encodeFunctionData({ abi: BOUNTY_ABI, functionName: 'approve' }),
        value: '0',
      },
    });
    return;
  }

  const w = requireWriter('approve');
  const txHash = await w.bounty.approve({ bounty });
  out({ command: 'approve', txHash, bounty });
}

async function rejectBounty() {
  const bounty = getPositional(0);
  if (!bounty) {
    out({ error: 'Usage: reject <bountyAddress>' });
    process.exit(1);
  }

  if (prepareOnly) {
    out({
      command: 'reject',
      mode: 'prepare',
      transaction: {
        to: bounty,
        data: encodeFunctionData({ abi: BOUNTY_ABI, functionName: 'reject' }),
        value: '0',
      },
    });
    return;
  }

  const w = requireWriter('reject');
  const txHash = await w.bounty.reject({ bounty });
  out({ command: 'reject', txHash, bounty });
}

async function cancelBounty() {
  const bounty = getPositional(0);
  if (!bounty) {
    out({ error: 'Usage: cancel <bountyAddress>' });
    process.exit(1);
  }

  if (prepareOnly) {
    out({
      command: 'cancel',
      mode: 'prepare',
      transaction: {
        to: bounty,
        data: encodeFunctionData({ abi: BOUNTY_ABI, functionName: 'cancel' }),
        value: '0',
      },
    });
    return;
  }

  const w = requireWriter('cancel');
  const txHash = await w.bounty.cancel({ bounty });
  out({ command: 'cancel', txHash, bounty });
}

async function walletInfo() {
  if (!walletAddress) {
    out({
      command: 'wallet',
      configured: false,
      message: 'No wallet configured. Set OPENCLAW_PRIVATE_KEY to enable write operations.',
    });
    return;
  }

  const publicClient = createPublicClient({ chain: base, transport: http() });
  const balance = await publicClient.getBalance({ address: walletAddress });
  const ethBalance = Number(balance) / 1e18;

  // Check if this address has a registered agent
  const agent = await client.agents.getByAddress(walletAddress);

  out({
    command: 'wallet',
    configured: true,
    address: walletAddress,
    ethBalance: `${ethBalance.toFixed(6)} ETH`,
    agent: agent
      ? { id: agent.agentId, name: agent.name, skills: agent.skills }
      : null,
  });
}

// ── Router ───────────────────────────────────────────────────────────────

const commands = {
  // Reads
  browse,
  show,
  challenges: listChallenges,
  challenge: showChallenge,
  leaderboard,
  agent: showAgent,
  'agent-address': showAgentByAddress,
  'find-agents': findAgents,
  reputation: showReputation,
  'my-work': myWork,
  stats,
  // Writes
  claim,
  submit: submitWork,
  approve: approveBounty,
  reject: rejectBounty,
  cancel: cancelBounty,
  wallet: walletInfo,
};

async function main() {
  if (!command || command === 'help') {
    out({
      commands: Object.keys(commands),
      usage: 'node openclaw.mjs <command> [args] [--flags]',
      examples: [
        'browse --skill=typescript --limit=5',
        'show 0x...',
        'challenges --status=open',
        'challenge 0x...',
        'leaderboard 0x... --limit=10',
        'agent 42',
        'agent-address 0x...',
        'find-agents --skill=solidity',
        'reputation 42',
        'my-work 0x...',
        'stats',
        'wallet',
        'claim 0x<bounty> 14448',
        'submit 0x<bounty> ipfs://proof',
        'approve 0x<bounty>',
        'reject 0x<bounty>',
        'cancel 0x<bounty>',
        'claim 0x<bounty> 42 --prepare  (output raw tx, no signing)',
      ],
    });
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }

  try {
    await handler();
  } catch (err) {
    out({ error: err.message, type: err.constructor.name });
    process.exit(1);
  }
}

main();
