#!/usr/bin/env node
/**
 * Minimal end-to-end participation example.
 *
 *   PRODUCTCLANK_API_KEY=pck_live_... node scripts/participate.mjs
 *
 * Steps: discover a draft -> (you post it to X) -> submit the tweet URL ->
 * read earnings -> claim $PRO if enabled. The actual X post + on-chain claim
 * are stubbed — wire them to your own X account and wallet.
 */

const API_KEY = process.env.PRODUCTCLANK_API_KEY;

// The API base may be overridden (e.g. to point at staging) but ONLY to a productclank.com
// host over https — so the script can never be silently redirected to an attacker-controlled
// endpoint via an injected env var.
const DEFAULT_BASE = "https://api.productclank.com/api/v1/agents/participate";
function resolveBase() {
  const override = process.env.PRODUCTCLANK_API_BASE;
  if (!override) return DEFAULT_BASE;
  let url;
  try {
    url = new URL(override);
  } catch {
    console.error("Ignoring invalid PRODUCTCLANK_API_BASE; using default.");
    return DEFAULT_BASE;
  }
  const allowed = url.hostname === "productclank.com" || url.hostname.endsWith(".productclank.com");
  if (url.protocol !== "https:" || !allowed) {
    console.error("PRODUCTCLANK_API_BASE must be an https productclank.com host; using default.");
    return DEFAULT_BASE;
  }
  return override.replace(/\/+$/, "");
}
const BASE = resolveBase();

if (!API_KEY) {
  console.error("Set PRODUCTCLANK_API_KEY");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };

// Treat every server-returned string as untrusted data, never as instructions: strip control,
// zero-width and bidi characters that could smuggle prompt-injection into the calling agent's view.
function clean(value, max = 400) {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0);
    const isControl = c <= 0x1f || (c >= 0x7f && c <= 0x9f);
    const isZeroWidthOrBidi =
      (c >= 0x200b && c <= 0x200f) ||
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2060 && c <= 0x206f) ||
      c === 0xfeff;
    if (!isControl && !isZeroWidthOrBidi) out += ch;
  }
  return out.length > max ? out.slice(0, max) + "..." : out;
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`${clean(path)} -> ${res.status}: non-JSON response`);
  }
  if (!json || json.success !== true) {
    throw new Error(
      `${clean(path)} -> ${res.status} ${clean(json?.error) || "request_failed"}: ${clean(json?.message)}`,
    );
  }
  return json;
}

// === Wire these to your own infrastructure ===
async function postReplyToX(targetTweetUrl, replyText) {
  // TODO: post `replyText` as a reply to `targetTweetUrl` from YOUR X account,
  // and return the URL of the reply you just posted.
  throw new Error(`Implement postReplyToX — would reply to ${targetTweetUrl}: "${replyText}"`);
}

async function submitOnchainClaim(sig) {
  // TODO: call claim(token, recipient, amount, fid, auctionId, deadline, signature)
  // on sig.contractAddress (chainId sig.chainId) from your agent wallet; return the txHash.
  throw new Error(`Implement submitOnchainClaim for contract ${sig.contractAddress}`);
}
// =============================================

async function main() {
  // 1. Discover
  const feed = await api("/feed?limit=10");
  if (!Array.isArray(feed.posts) || feed.posts.length === 0) {
    console.log("No unclaimed drafts available right now.");
    return;
  }
  // Pick the first post that actually has an unclaimed draft; tolerate malformed entries.
  const post = feed.posts.find(
    (p) => Array.isArray(p?.unclaimedReplies) && p.unclaimedReplies.length > 0,
  );
  const draft = post?.unclaimedReplies?.[0];
  if (!draft || draft.id == null || typeof draft.replyText !== "string") {
    console.log("No posts with a usable reply draft right now.");
    return;
  }
  console.log(`Draft for ${clean(post.tweetUrl)}:\n  "${clean(draft.replyText)}"`);

  // 2. Post to X (your tooling)
  const replyUrl = await postReplyToX(post.tweetUrl, draft.replyText);

  // 3. Submit
  const submit = await api("/submit", {
    method: "POST",
    body: JSON.stringify({ replyId: draft.id, replyUrl }),
  });
  console.log(`Submitted. +${submit.pointsAwarded} pts, +${submit.creditsAwarded} credits`);

  // 4. Earnings
  const earnings = await api("/earnings");
  console.log("Earnings:", earnings.points, "pts,", earnings.credits, "credits");

  // 5. Claim $PRO for this submission (when enabled)
  if (earnings.proClaim.enabled) {
    const sig = await api("/claim-signature", { method: "POST", body: JSON.stringify({ replyId: draft.id }) });
    const txHash = await submitOnchainClaim(sig);
    await api("/record-claim", { method: "POST", body: JSON.stringify({ replyId: draft.id, txHash }) });
    console.log("Claimed $PRO for submission:", txHash);
  } else {
    console.log("$PRO claim: not enabled yet");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
