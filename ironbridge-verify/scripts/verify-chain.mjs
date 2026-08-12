#!/usr/bin/env node
// verify-chain.mjs — re-walk the IronBridge public seal chain and confirm every
// row's prev_hash links to the previous row's entry_hash. READ-ONLY, no wallet,
// no key, no funds. This is the "don't trust, verify" path a second agent runs
// before relying on an IronBridge seal.
//
// Usage:  node verify-chain.mjs [baseUrl]
//   baseUrl defaults to https://ironbridge.foundation
//
// Exit 0 = chain links (modulo disclosed known_breaks); exit 1 = an undisclosed break.

const BASE = process.argv[2] || "https://ironbridge.foundation";

async function getPage(fromSeq, limit = 100) {
  const u = `${BASE}/api/chain/page?from_seq=${fromSeq}&limit=${limit}`;
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`GET ${u} -> HTTP ${r.status}`);
  return r.json();
}

async function main() {
  const head = await getPage(0, 1);
  const tip = head.tip_seq;
  const known = new Map((head.known_breaks || []).map((b) => [b.seq, b]));
  console.log(`tip_seq=${tip}  known_breaks=${known.size}`);

  let prev = null;
  let checked = 0,
    linkedOk = 0,
    disclosed = 0,
    undisclosed = 0;

  for (let from = 0; from <= tip; from += 100) {
    const page = await getPage(from, 100);
    for (const row of page.rows) {
      if (prev) {
        checked++;
        if (row.prev_hash === prev.entry_hash) {
          linkedOk++;
        } else if (known.has(row.seq)) {
          disclosed++;
          console.log(`  seq ${row.seq}: break DISCLOSED in known_breaks (${known.get(row.seq).kind})`);
        } else {
          undisclosed++;
          console.error(`  seq ${row.seq}: UNDISCLOSED BREAK — prev_hash != prior entry_hash`);
        }
      }
      prev = row;
    }
  }

  console.log(
    `checked=${checked} linked_ok=${linkedOk} disclosed_breaks=${disclosed} undisclosed_breaks=${undisclosed}`
  );
  if (undisclosed > 0) {
    console.error("RESULT: FAIL — chain has an undisclosed discontinuity");
    process.exit(1);
  }
  console.log("RESULT: OK — chain links end-to-end (all breaks disclosed)");
}

main().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(2);
});
