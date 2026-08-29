# Changelog

## 1.5.6 (2026-08-28)
- Discovery layer added to data-sources: Portals Explorer as the reference terminal (find candidates, then assess the underlying venue; APY cards are mixes, Verified means claimed, trust ranks are not risk ratings, zap routers are an extra contract layer), with Summer.fi, vfat.tools, and APY.vision named on the same shelf. Manifest rows: Portals and Enso (both flagged execution-adjacent, read-only fences on the rows).
- CoinGecko keyless tier added to recipes: spot prices and 24h change, the denomination leg of realization-filter checks.

## 1.5.5 (2026-08-28)
- Staying-current protocol upgraded to a per-session check with ephemeral freshness: agents may follow the newer canonical files from a scratch copy for the session, but installing updates stays a user action, and the skill never overwrites its own files. Self-modification is explicitly forbidden by design: a skill that silently rewrites itself cannot be reviewed.

## 1.5.4 (2026-08-28)
- ve-model forfeiture rule (field repair): staked LPs forfeit swap fees to voters and earn only emissions; "fees + emissions" dashboard APRs are a menu of two seats, never a sum. Reframes every Aerodrome-style print.
- GeckoTerminal added to keyless recipes: pool-level volume, fees, and depth; the fastest check on whether an LP fee APR is backed by real volume.
- Output formatting rule: comparison tables for options and seats, tables or labeled lines for decompositions, calendars, and risk:reward arithmetic; prose only where reasoning needs sentences.

## 1.5.3 (2026-08-28)
Adversarial four-model review of everything added since release; all confirmed findings fixed.
- Finance corrections in the teaching layer: CCP default waterfall order (defaulter margin, defaulter fund contribution, CCP skin-in-the-game, THEN the mutualized fund) and the honest ADL contrast (depth and frequency, not presence); T-bills are discount securities, not par claims; sUSDS is an administered rate on a mixed book, not a T-bill passthrough; looping mapped to margin leverage and rehypothecation to collateral-as-liquidity; duration example recalibrated to the real liquidation print; nightly (not just weekend) equity-oracle gaps; settlement simplified to T+1.
- Concepts: Resolv depeg low corrected ($0.025, was off 10x); underwritten credit split into unsecured (3Jane-style) vs negotiated overcollateralized institutional (Maple-style); PT linear-discount oracle split into pure-curve (immune to squeezes, converts deterioration into protocol bad debt) vs min(curve, TWAP) (not immune); IL vs LVR single-benchmark rule; Kelp print now carries its source URL.
- Recipes: working vaultV2s query shipped and live-verified (flat fields, netApy exists); Merkl pagination (items=, count endpoint, name filter); rwa.xyz app and DeBank marked browser-tool-only; curator field returns an address, noted.
- Tooling: verify_manifest.py now checks llms_full and pages[], content-checks llms.txt (empty or HTML bodies fail), scans all prose files for em AND en dashes, requires skill_use per source, and validates README/CONTRIBUTING file links; PR-check workflow added (runs on every pull request); monthly workflow scoped with add-paths so automation can only touch manifest.json and maintenance-reports/; MAINTENANCE.md description matched to reality; Mellow llms.txt removed (empty body).

## 1.5.2 (2026-08-28)
- Morpho GraphQL recipe fixed: `vaults` returns only Vault V1 (MetaMorpho); Vault V2 strategy vaults live under the separate `vaultV2s` query. The recipe now requires querying both and cross-checking against DefiLlama. Found in field use: an agent following the old recipe missed every V2 book.
- Merkl recipe: compare campaigns by USD daily-reward fields, never raw token amounts (decimal normalization), and report tranche structure plus renewal history, not just an end date.

## 1.5.1 (2026-08-28)

Initial public release. Eval-gated before publish: paired with-skill vs no-skill runs across assessment, allocation, content, and execution-refusal cases; a look-through regression gate; adversarial audits by a panel of independent models; and live verification of every manifest source and data recipe.
