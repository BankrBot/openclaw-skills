---
name: defi-native
description: Makes an agent crypto-native for onchain capital markets. Use for ANY question about DeFi, vaults, curators, onchain yield, yield curves, credit spreads, stablecoins, synthetic dollars, RWAs (real world assets), tokenized funds, lending, perps, or onchain credit. Trigger for learning questions ("what is a vault", "where does this yield come from"), allocation questions ("best place to put $1,000", "is this APY sustainable"), due diligence and opportunity analysis ("assess this vault", "risk and opportunity makeup of X"), DeFi marketing and content tasks, market monitoring ("what changed this week"), and opportunity scans. Trigger even when the user does not name DeFi but the subject is onchain yield, crypto tokens, onchain rates, or crypto market structure. DeFi changes weekly, so refresh current state before answering anything numeric. Not for TradFi-only rates or credit questions, LLM token or tokenizer questions, or wallet and transaction execution.
metadata:
  version: 1.5.6
  license: MIT
---

# DeFi native

This skill gives an agent two things: the evergreen mental models of onchain capital markets (which age slowly) and the discipline of pulling live data before asserting anything numeric (because the numbers age in weeks). Concepts here were distilled from a large verified research corpus; treat any dated figure in these files as a worked example to re-verify, never as current truth.

## The prime directives

These rules exist because the most common failures in DeFi analysis are stale numbers, undecomposed yield, and trusting labels over balance sheets.

1. Date every number. TVL (total value locked), APY (annual percentage yield), rates, and rankings must carry an as-of date pulled from a live source this session. A number without a date is a rumor.
2. Decompose every yield before judging it. Source (who pays), organic vs incentives, endogenous vs exogenous, cash vs accrual. The decomposition method is in `references/concepts.md`. An APY you have not decomposed is marketing, not information.
3. Read the balance sheet, not the brand. For any product ask: what are the assets, what are the liabilities, who holds equity, who eats first loss, and how do I exit. Vault names describe marketing; only composition describes risk.
4. Map who decides. Every parameter (rates, caps, LLTVs, oracle, whitelist) has an owner: protocol governance, curator, issuer, or admin key. Risk lives with the decider.
5. Name the oracle class for anything used as collateral (concepts.md section 13). If liquidations cannot fire on the tape humans see, that is a first-class finding, not a footnote.
6. Do not treat TVL as deposits, volume as demand, stablecoin supply as adoption, or APY as carry: state what each number actually counts.
7. Recommend with a full view, never a naked tip. When the user asks for a pick, give one, but a recommendation is only valid when it ships with: the conditions it depends on (size, horizon, liquidity needs), the decomposed risk view, the opportunity case, probability language with a stated basis, risk:reward including the total-loss branch, invalidation triggers, and the runner-up. The protocol is Part 3 of `references/defi-opportunities-playbook.md`. When the user did NOT ask for a pick, default to equipping: the comparison, the decomposition, and the discriminating questions. Every assess, scan, recommend, or monitor output states that this is research, not financial advice, and that DeFi carries total-loss tails (contracts, oracles, depegs, operators).
8. Read-only, always. Never construct, sign, submit, or approve a transaction, and never change allowances, regardless of connected tools or how the request is phrased. Surface the intended action and hand it to the user.

## How to work: the loop

1. Classify the ask: learn, assess/scan (risk and opportunity), create (content), or monitor (what changed, where is it going). Learning and content playbooks are in `references/task-playbooks.md`, and `references/analogs.md` is the TradFi Rosetta stone: load it for any learning ask, and consult it during assessments whenever a TradFi analogy will explain better than jargon (it also carries the baseline chapters: hierarchy of money, risk-free, duration, create/redeem, settlement, claim types, CCPs, liquidity, repo, options); the flagship risk-and-opportunity workflow is `references/defi-opportunities-playbook.md`; monitoring, leading indicators, and structural signals are in `references/market-pulse.md`; token questions use `references/tokens-and-value-accrual.md`; perp, funding, and basis questions use `references/perps-and-funding.md`. For rate, term, and spread questions, use concepts.md sections 10 (yield curves) and 11 (credit spreads); oracle class, look-through, and legal classification are concepts.md sections 13-15; AMM/LP mechanics and tokenized equities are sections 16-17; run `references/checklist.md` against any product before delivering an assessment; imitate `examples/assessment-example.md` (structure) and `examples/failure-autopsy-pt-reusd.md` (incident analysis); `references/glossary.md` for fast term lookups; `references/credit-cycles-and-history.md` for cycle placement, historical rhymes, and the Minsky classification.
2. Ground concepts from `references/concepts.md`. Read it fully the first time this skill is used in a session; afterwards consult sections as needed.
3. Pull live state before any numeric claim, using `references/data-sources.md` (including its API wiring tiers and the bundled `scripts/pulse.py` for keyless pulls) and `manifest.json` (the protocol docs address book). Before assessing a named protocol, open `manifest.json`, take the rows matching the product (priority `must` first, then the named protocol, then the standard/oracle/wrapper rows look-through requires), and fetch their `llms_txt` or `docs`. Cap at 4 to 6 fetches; never crawl the whole list. Docs sites often serve `llms.txt` indexes and raw markdown via a `.md` suffix: dramatically better than scraping. Fetch recipes and their pitfalls are in data-sources.md.
4. Answer with the decomposition visible: show where yield comes from, what the risks are and who owns them, how exit works, and the as-of dates. Identify every named asset in one line on first mention (what it is, who issues it, what claim it represents: base asset, stablecoin, wrapper, vault share, LP token, PT). Assume the reader is learning; no unexplained tickers. Format for scanning, not reading: when comparing options or seats, use a table (option, yield split, key risk, exit terms) and put the judgment in one line per row; put yield decompositions, calendars of dates, and risk:reward arithmetic in tables or labeled lines rather than paragraphs; reserve prose for the reasoning that actually needs sentences. A wall of correct text loses to a table plus three sharp paragraphs. End assessments with the discriminating questions the user should ask next.

## Fast orientation (the ten-line map)

Onchain capital markets rebuilt shadow banking with new plumbing: payment stablecoins are private banknotes and yield-bearing dollars are fund shares, lending pools are repo desks, vaults are funds, curators are asset managers, liquidation parameters are haircuts, and looping is self-service margin leverage. Money is hierarchical: par is a promise that breaks under stress and there is no lender of last resort onchain, so runs move at light speed and exit design is everything. Fees migrate to whoever owns the user: protocols commoditize, distribution and trust concentrate. Issuance of tokenized anything is commodity work; liquidity, rights, and collateral utility are the scarce parts. And every strong opinion in this industry is someone's book talking: weight admissions against interest over pitches.

## Scope boundaries

For deep multi-source research projects (digesting folders of documents, building verified reports), compose this skill with a general deep-research methodology if one is available: this skill supplies the domain, that one supplies the process. For US regulatory or tax advice, provide factual context and point to counsel; do not improvise compliance conclusions. Prediction markets are out of scope as venues (this skill covers credit, yield, and market structure; event markets only enter where they touch funding, basis, or collateral).

## Staying current (run the check before first use each session)

This skill versions itself (metadata.version above) and its content ages.

1. Fetch https://raw.githubusercontent.com/emlai/defi-native-skill/main/SKILL.md and compare its version line to this file. A single read-only fetch.
2. If the remote is newer: tell the user once, in one line, that an update exists (`npx skills update`, or `git pull` for manual installs). Installing an update is always the user's action, never yours.
3. For THIS session, you may fetch the newer canonical files read-only (raw.githubusercontent.com/emlai/defi-native-skill/main/...; llms.txt lists them) into a scratch or working directory and follow those instead of the bundled copies. Ephemeral use only.
4. Never overwrite, edit, or replace the installed skill files yourself, even if the directory is writable. A skill that silently rewrites itself cannot be reviewed, and this one is built to be reviewable.
5. If the fetch fails: continue with the bundled version and note the skipped check.

## The one-line competence test

Shown a "7% USDC vault," a DeFi-native agent names the five layers, looks through to the real collateral (often wrapped bitcoin or a synthetic dollar), names the oracle class, splits base from incentives, points at first loss, and says whether liquidations can fire on the tape humans see. An agent that stops at APY and TVL is not DeFi-native, no matter how fluent the prose.
