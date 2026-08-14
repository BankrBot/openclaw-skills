#!/usr/bin/env node
// Every free, keyless Tenjin call in one place (Node 18+, no dependencies).
// Read-only against your wallet: nothing here touches keys, signs, or pays.
// Paid retries happen OUTSIDE this script, only after scripts/verify-402.mjs
// passes and the user confirms - see SKILL.md.
//
// Usage:
//   tenjin-api.mjs search "<whole question>" [--max-price <atomic>] [--fresh <P30D>] [--limit <1-10>]
//   tenjin-api.mjs answer "<question>" [--fresh <P30D>]
//   tenjin-api.mjs inspect <url>
//   tenjin-api.mjs articles [--q <terms>] [--max-price <atomic>] [--limit <n>]
//   tenjin-api.mjs latest <0x-address>
//   tenjin-api.mjs trending
//   tenjin-api.mjs outcome <searchId> used|partially_used|rejected|regenerated|purchase_declined

const ORIGIN = 'https://tenjin.blog';
const [cmd, ...args] = process.argv.slice(2);

function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function die(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

async function call(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('https://') ? path : `${ORIGIN}${path}`;
  if (!url.startsWith(`${ORIGIN}/`)) die(`refusing non-Tenjin URL: ${url}`);
  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, text, url };
}

function show(json, text) {
  console.log(json ? JSON.stringify(json, null, 2) : text);
}

// A 402 is a quote, not an error: surface the preview body plus the raw
// PAYMENT-REQUIRED value so verify-402.mjs can check it without re-fetching.
function quote402({ res, json, text, url }) {
  show(json, text);
  const header = res.headers.get('payment-required');
  console.log(`\n--- 402 quote. Before ANY payment:`);
  console.log(`  node scripts/verify-402.mjs '${url}' --header '${header}'`);
  console.log(`then get user confirmation and pay per SKILL.md (e.g. bankr x402 call).`);
}

switch (cmd) {
  case 'search': {
    const [question] = args;
    if (!question || question.startsWith('--')) die('usage: search "<whole question, one sentence>" [--max-price] [--fresh] [--limit]');
    const body = { question };
    if (opt('max-price')) body.maxPrice = opt('max-price');
    if (opt('fresh')) body.freshWithin = opt('fresh');
    if (opt('limit')) body.limit = Number(opt('limit'));
    const r = await call('/api/agent/search', { method: 'POST', body });
    show(r.json, r.text);
    if (r.json?.truncated) console.log('\n--- truncated: trailing candidates dropped; retry with a larger --limit.');
    if (r.json?.searchId) console.log(`\n--- keep searchId ${r.json.searchId}: report the outcome after use, and pass it when buying (X-Tenjin-Search-Id) or when publishing research that answers a MISS.`);
    break;
  }
  case 'answer': {
    const [question] = args;
    if (!question || question.startsWith('--')) die('usage: answer "<question>" [--fresh <P30D>]');
    const body = { question };
    if (opt('fresh')) body.freshWithin = opt('fresh');
    const r = await call('/api/answer', { method: 'POST', body });
    if (r.res.status === 402) quote402(r);
    else show(r.json, r.text);
    break;
  }
  case 'inspect':
  case 'latest': {
    const [target] = args;
    if (!target) die(`usage: ${cmd} ${cmd === 'latest' ? '<0x-address>' : '<url>'}`);
    const path = cmd === 'latest' ? `/api/read/${target}/latest` : target;
    const r = await call(path);
    if (r.res.status === 402) quote402(r);
    else show(r.json, r.text); // 200 = free piece or entitled; 400 on `latest` carries the address URL to use.
    break;
  }
  case 'articles': {
    const q = new URLSearchParams();
    if (opt('q')) q.set('q', opt('q'));
    if (opt('max-price')) q.set('maxPrice', opt('max-price'));
    if (opt('limit')) q.set('limit', opt('limit'));
    const r = await call(`/api/articles${q.size ? `?${q}` : ''}`);
    show(r.json, r.text);
    break;
  }
  case 'trending': {
    const r = await call('/api/trending');
    show(r.json, r.text);
    break;
  }
  case 'outcome': {
    const [searchId, status] = args;
    const valid = ['used', 'partially_used', 'rejected', 'regenerated', 'purchase_declined'];
    if (!searchId || !valid.includes(status)) die(`usage: outcome <searchId> ${valid.join('|')}`);
    const r = await call(`/api/agent/searches/${searchId}/outcomes`, { method: 'POST', body: { status } });
    show(r.json, r.text);
    break;
  }
  default:
    die('commands: search | answer | inspect | articles | latest | trending | outcome (see header for usage)');
}
