#!/usr/bin/env bun
// @ts-nocheck — runs under bun; IDE doesn't have @types/node loaded.
/**
 * obol-skill-list.ts — fetch the `/skill.md` catalogue from an Obol Stack host.
 *
 * Every Obol Stack tunnel publishes a `/skill.md` at the tunnel root listing the services
 * it sells. This route is unauthenticated and free — only the `/services/<name>/*` URLs
 * below it cost money.
 *
 * Usage:
 *   bun obol-skill-list.ts HOST
 *
 * Examples:
 *   bun obol-skill-list.ts https://example.trycloudflare.com
 *   bun obol-skill-list.ts https://my-stack.example.com
 */

async function main() {
  const host = process.argv[2];
  if (!host) {
    console.error("Usage: bun obol-skill-list.ts HOST");
    process.exit(2);
  }
  const url = host.replace(/\/$/, "") + "/skill.md";
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) {
    console.error(`GET ${url} → HTTP ${r.status}`);
    if (text) console.error(text);
    console.error("(no /skill.md catalogue here — host may not be an Obol Stack tunnel, or the route isn't published)");
    process.exit(1);
  }
  process.stdout.write(text);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
