# defi-native

A skill that makes your AI crypto-native. Give it an understanding of capital markets. Use it to assess any vault or yield down to its lowest layer, decompose any APY into what you would actually earn, monitor what changed this week, write accurate DeFi content, and learn key financial concepts.

Works with Claude Code, Cursor, Codex, and any agent that reads the [Agent Skills](https://agentskills.io) format. MIT licensed.

Built by [@emilylai](https://x.com/emilylai) as a way to deepen my own capital markets and market microstructure understanding, as crypto increasingly becomes finance on new rails.

## What it does

This skill gives your agent two things:

1. **Evergreen mental models**: foundational capital markets and market microstructure understanding, what vaults and curators actually are, how to decompose any yield along four axes and four realization filters, lending market architectures, stablecoin taxonomy, RWA wrappers and tokenized equities, the take-rate map, oracle classes, AMM/LP mechanics, MEV, and more.
2. **Live data direction and discipline**: the skill points the agent at the right source for each question (vaults.fyi, DefiLlama, Morpho's free GraphQL, rwa.xyz, Merkl, protocol APIs, and 90+ verified protocol docs, 20+ with llms.txt indexes) and forces fresh pulls before any numeric claim, with as-of dates on every number.

For example, if you want to break down a DeFi vault strategy, an agent with this skill names the five layers, looks through to the real collateral, names the oracle class, splits base from incentives, points at first loss, and says whether liquidations can fire on the tape humans see.

## What it was built from

Over 6,000 pages and hundreds of corpus files. Books on banking, finance, and money. Transcripts from the latest industry conferences: TokenizeThis NYC 2026, Vault Summit 2026, Stablecoin Summit, the Aug 20 CFTC advisory committee meeting. Multiple podcasts from curators, asset managers, founders, and builders. Multiple reports, academic papers, X articles, and essays. SEC filings and regulatory primaries. A 90+ source protocol docs manifest (Morpho, Aave, Euler, Ethena, Pendle, Midas, EtherFi, Veda, Securitize, Chainlink, and more), every URL liveness-checked.

Before release, every load-bearing claim was re-verified against live primary sources, the skill was audited adversarially by a panel of independent models, and it was eval-gated: paired runs with and without the skill, graded on structure, not memorized numbers. Dated figures inside are calibration examples; the skill re-verifies at use time by design.

## How it works

```mermaid
flowchart TD
    Q[User asks about DeFi:<br/>a vault, a yield, an options play,<br/>a trade, a curator, a market] --> S[SKILL.md<br/>8 prime directives, routing, the loop]
    S --> C{Classify the ask}
    C -->|learn| AN[analogs.md<br/>TradFi Rosetta stone +<br/>baseline chapters]
    C -->|learn / create| TP[task-playbooks.md]
    C -->|assess / recommend| PB[defi-opportunities-playbook.md<br/>12-step assessment, recommendation<br/>protocol, composed positions,<br/>the depth floor]
    C -->|options / LP| OL[options-and-liquidity.md<br/>options from zero;<br/>every CL position is a<br/>short option]
    C -->|trades / blowups| TA[trade-anatomy.md<br/>order types, what is this<br/>book short, OTC locked tokens]
    C -->|rate a manager| CF[curation-frameworks.md<br/>eleven frameworks,<br/>one scoreable anatomy]
    C -->|RWA mint/redeem, APY print| RM[rwa-fund-mechanics.md<br/>settlement classes, forward pricing,<br/>APY formulas, issuer fee map]
    C -->|tokens| TV[tokens-and-value-accrual.md]
    C -->|perps / funding| PF[perps-and-funding.md]
    C -->|monitor| MP[market-pulse.md<br/>weekly pulse, ToS diffing]
    S --> K[concepts.md<br/>18 evergreen sections:<br/>balance sheets, yield, oracles,<br/>look-through, failure shapes]
    PB --> CH[checklist.md<br/>unanswered items are findings]
    PB --> CS[credit-cycles-and-history.md]
    S --> R[api-routes.json<br/>question-to-API router:<br/>MCP, then keyed, then keyless;<br/>the key offer]
    R --> D[data-sources.md<br/>recipes, pitfalls,<br/>freshness rules]
    R --> M[manifest.json<br/>123 verified doc sources,<br/>priority tiers, llms.txt]
    R --> P[scripts/pulse.py<br/>keyless live pulls]
    K --> G[glossary.md<br/>124 entries]
    PB --> OUT[Output: dated numbers, decomposed yield,<br/>named risks and seats with their numbers,<br/>exit engineering, watch plan,<br/>research-not-advice close]
```

Progressive disclosure: only the description is always loaded. SKILL.md loads when a DeFi question fires it; references load only when the task routes there; the manifest is an address book the agent fetches 4 to 6 rows from, never whole.

## Use cases

Learning:
- "What is a vault and where does this 9% come from?"
- "Explain synthetic dollars like I know TradFi but not crypto"
- "How do liquidations actually work on Morpho?"

Due diligence and opportunity:
- "Assess this vault's risk and opportunity makeup [link]"
- "Is this 12% APY sustainable?"
- "Base just launched tokenized stocks, what are the best opportunities? I have $5,000"
- "Compare sUSDe vs sUSDS for parking $10k"
- "Why did that vault depeg yesterday?"

Content and marketing:
- "Write an accurate X thread about our new USDC vault paying 8.2%"
- "Draft the honest comparison table for our product page"

Monitoring:
- "What changed in DeFi this week?"
- "Set up a watch plan for my positions"
- "Scan for rate dislocations"

Full worked outputs: [examples/assessment-example.md](examples/assessment-example.md) (the minimum-bar skeleton, fictional product) and [evals/sample-output-2026-08-28.md](evals/sample-output-2026-08-28.md) (a full real run under the recommendation protocol).

## Structure

| File | What it is |
|---|---|
| [SKILL.md](SKILL.md) | The brain: 8 prime directives, routing, and the working loop |
| [analogs.md](references/analogs.md) | The TradFi Rosetta stone: every onchain object mapped to its ancestor, plus the baseline chapters (money hierarchy, duration, settlement, claim types) |
| [concepts.md](references/concepts.md) | The evergreen foundation: 18 sections from balance sheets to oracle classes to legal classification |
| [defi-opportunities-playbook.md](references/defi-opportunities-playbook.md) | The flagship workflow: 12-step assessment, recommendation protocol, composed positions, the depth floor |
| [options-and-liquidity.md](references/options-and-liquidity.md) | Options from zero, and the identity that every concentrated liquidity position is a short option |
| [trade-anatomy.md](references/trade-anatomy.md) | Order types, what every "neutral" book is short, and the locked-token OTC trade decomposed with real 2026 prints |
| [market-microstructure.md](references/market-microstructure.md) | Depth, squeezes, manipulation fingerprints, and tokenized stocks: three prices, two clocks, and the mint/redeem rail |
| [curation-frameworks.md](references/curation-frameworks.md) | Eleven published curator and allocator frameworks distilled into one scoreable anatomy |
| [data-sources.md](references/data-sources.md) | Where to get live data: keyless APIs, fallbacks, and the bring-your-own-keys table |
| [checklist.md](references/checklist.md) | The full pre-verdict checklist; unanswered items are findings |
| [task-playbooks.md](references/task-playbooks.md) | How to teach the space and how to write accurate DeFi content |
| [market-pulse.md](references/market-pulse.md) | The monitoring discipline: weekly pulse, leading indicators, structural signals |
| [rwa-fund-mechanics.md](references/rwa-fund-mechanics.md) | The RWA primary market: mint/redeem settlement classes, forward pricing and stale-rate arbitrage, the APY print taxonomy, the issuer fee map, and the audited take-rate print |
| [tokens-and-value-accrual.md](references/tokens-and-value-accrual.md) | Is this token worth anything: rights, accrual mechanisms, launch supply mechanics |
| [perps-and-funding.md](references/perps-and-funding.md) | Perpetual futures, funding rates, basis strategies, venue due diligence |
| [credit-cycles-and-history.md](references/credit-cycles-and-history.md) | Cycle classification and the historical rhyme table |
| [glossary.md](references/glossary.md) | The vocabulary, one line each |
| [pulse.py](scripts/pulse.py) | A small script for keyless live data pulls: stablecoin float, TVL, yields |
| [api-routes.json](api-routes.json) | The question-to-API router: which endpoint answers this question, keyless or keyed, and what your own key unlocks |
| [manifest.json](manifest.json) | The address book: 123 verified doc sources with priority tiers and llms.txt endpoints |
| [evals/](evals/) | Test cases plus a full real sample output |
| [examples/](examples/) | Worked examples, including a failure autopsy |

## Install

**Easiest: ask your agent to do it.** If you use Claude Code (or another coding agent), paste this into it and it will install the skill for you:

> Install the skill from github.com/emlai/defi-native-skill by running: npx skills add emlai/defi-native-skill

**Or run one command yourself.** This goes in your computer's terminal, not in a chat window:

1. Open the terminal. Mac: press Cmd+Space, type "Terminal", press Enter. Windows: open "PowerShell" from the Start menu.
2. Paste this and press Enter:

```
npx skills add emlai/defi-native-skill
```

3. Answer the prompts (it detects your agent and asks where to install; the defaults are fine).
4. Start a new session in your agent. The skill triggers automatically on DeFi questions.

If step 2 says `command not found: npx`, install Node.js first from [nodejs.org](https://nodejs.org) (the LTS download), then repeat step 2. The [skills CLI](https://github.com/vercel-labs/skills) works for Claude Code, Cursor, Codex, and other Agent Skills hosts.

**Updating:** installed skills do not update themselves, but this one checks: during monitoring tasks it compares its version against this repo and tells you when an update exists. To update, run `npx skills update` (or `git pull` in the cloned folder).

**Manual (for developers):**

```
git clone https://github.com/emlai/defi-native-skill.git
ln -s "$(pwd)/defi-native-skill" ~/.claude/skills/defi-native
```

Other Agent Skills hosts: same folder into that host's skills directory (`.agents/skills/` for the cross-agent standard).

**Optional keys** for deeper data (none required): see the bring-your-own-keys table in `references/data-sources.md`. Everything core works keyless.

## Principles

- A number without a date is a rumor.
- An APY you have not decomposed is marketing, not information.
- Vault names describe marketing; only composition describes risk.
- Look through to the lowest layer: the stack ends at a real cash flow or a named counterparty, not a product label.
- Recommendations only with the full view: decomposed risk, the opportunity case, labeled-basis probabilities, risk:reward including the total-loss branch, invalidation triggers, and a runner-up.
- Read-only, always. The skill never signs, submits, or approves anything.
- Every strong opinion in this industry is someone's book talking.

## Contributing

Issues and pull requests welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: the conventions are strict (dated numbers, no em dashes, decomposition discipline) and PRs that add undated figures or recommendations without the full view will be asked to revise. The highest-value contributions: new verified manifest sources with llms.txt endpoints, postmortem-sourced failure shapes, corrections with primary sources, and eval cases that catch a real failure.

## License

MIT. See [LICENSE](LICENSE). This skill produces research, not financial advice; DeFi carries total-loss tails, and the skill says so in every assessment.
