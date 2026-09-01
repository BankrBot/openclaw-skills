# Changelog

All notable changes to the Trade Router skill are documented here.

## Version tracks (four surfaces)

| Surface | Current version | Notes |
|---|---|---|
| **ClawHub skill** (`SKILL.md`) | `v1.3.0` (live, uploaded 2026-03-05) | Re-upload to `v1.3.1` pending mod review of [openclaw/clawhub#1811](https://github.com/openclaw/clawhub/issues/1811) |
| **npm `@traderouter/trade-router-mcp`** | `v1.0.8` (2026-04-24, current canonical) | Install target for MCP clients |
| **PyPI `traderouter-mcp`** | `v1.0.1` (2026-04-24) | Python MCP server |
| **MCP Registry `io.github.TradeRouter/trade-router-mcp`** | `v1.0.8` | `isLatest: true`, active |

The `@re-bruce-wayne/trade-router-mcp` npm package and `io.github.re-bruce-wayne/trade-router-mcp` MCP Registry namespace are **deprecated** — consolidated under the `@traderouter` / `io.github.TradeRouter` canonical namespaces on 2026-04-24.

---

## [Unreleased] — 2026-04-24 — pending ClawHub re-upload as v1.3.1

### Added (docs only, no change to `SKILL.md`)
- **[`SECURITY.md`](./SECURITY.md)** — threat model, data-flow diagram, permissions manifest. Split explicitly into "Mode A — direct API integration (SKILL.md reference agent)" and "Mode B — MCP server" to avoid conflating the two tools' env-var conventions.
- **[`LICENSE`](./LICENSE)** — MIT. Missing license was triggering additional scanner caution.
- **[`CHANGELOG.md`](./CHANGELOG.md)** — this file.
- **[`README.md`](./README.md)** — security-first intro, clear 4-step signing flow, pointers to both consumption modes.
- Disclosure policy: `security@traderouter.ai`, 48h acknowledgement commitment.

### Fixed (documentation bugs caught during audit, 2026-04-24)
- README previously claimed the MCP server supported `TRADEROUTER_DRY_RUN=1` and `MAX_DAILY_LOSS_SOL=N`. It does not — those are reference-agent (Mode A) conventions only. README and SECURITY.md now clearly scope each env var to the mode that actually implements it.
- README previously advertised `@traderouter/mcp` as the npm package name — the actual published package is `@traderouter/trade-router-mcp`. Fixed everywhere.
- README previously linked to `https://traderouter.ai/openapi.yaml` which returns 404. Link removed.

### Consolidated distribution (2026-04-24)
- npm: canonicalized on `@traderouter/trade-router-mcp@1.0.8`. The previously active `@re-bruce-wayne/trade-router-mcp` line is deprecated and points to the canonical scope.
- MCP Registry: canonical server is `io.github.TradeRouter/trade-router-mcp` at v1.0.8. The parallel `io.github.re-bruce-wayne/trade-router-mcp` namespace is deprecated across all versions.
- Removed token-leak exposure: five older versions (`@traderouter@1.0.6–1.0.7` + `@re-bruce-wayne@1.0.2–1.0.4`) shipped `.mcpregistry_*` files from the `mcp-publisher` CLI working directory. Tokens were already invalidated (GitHub OAuth revoked; registry JWT expired at its 5-minute TTL on 2026-03-12), but all five versions are now deprecated on npm with upgrade messages. Current v1.0.8 uses a `files:` whitelist in `package.json` so the same class of leak cannot recur.

### Why this update exists
No code change to `SKILL.md`. The update is documentation and distribution hygiene, responding to:
1. Automated scanners flagging the skill as "suspicious" because they observe `PRIVATE_KEY` env var read, HTTPS to an external API, and financial transaction submission — behaviors that, in isolation, trip every heuristic. The architecture is non-custodial by construction; this release makes that provable to a human reviewer in under 5 minutes.
2. An internal audit on 2026-04-24 that caught doc/code drift (fabricated env vars, wrong package name) before the v1.3.1 re-upload.

Tracked in ClawHub GitHub issue [openclaw/clawhub#1811](https://github.com/openclaw/clawhub/issues/1811) for moderator review of the "suspicious" flag.

## [1.3.0] — 2026-03-05 (current live ClawHub version)

### Added
- Combo orders (limit+trailing, limit+TWAP, trailing+TWAP, limit+trailing+TWAP)
- Multi-DEX routing across Raydium, PumpSwap, Orca, Meteora
- WebSocket TWAP / DCA orders with configurable intervals
- `/flex` endpoint — trade-card PNG generation
- `/mcap` endpoint — market-cap + price lookups

## [1.2.0] and earlier

See git history in [re-bruce-wayne/openclaw-skills](https://github.com/re-bruce-wayne/openclaw-skills).
