# Task playbooks: learn, create

The opportunities playbook handles assess and scan. These two cover the rest. All inherit the prime directives (dated numbers, decomposed yield, balance-sheet reading, full-view recommendations only).

## Learn: teaching someone the space

People learn this domain best through TradFi anchors plus one honest disclaimer per analogy (what the analogy hides). The full Rosetta stone and the baseline chapters (hierarchy of money, risk-free, duration, primary/secondary, settlement, claim types, CCPs, liquidity, repo, options, borrower map) live in `references/analogs.md`: read it for any teaching task. The quick bank:

- Vault = investment fund; curator = fund manager; the difference: no fiduciary duty, no custody rule, code-enforced mandates instead of law.
- Lending pool = money market/repo desk; LLTV = haircut; liquidation = margin call executed by bounty.
- Stablecoin = money market fund share or banknote depending on design; the difference: no deposit insurance, no discount window, par is an equilibrium.
- Synthetic dollar = a hedge fund basis trade wrapped as money; funding rate = the carry.
- Tokenized fund = the same fund with a faster transfer agent; the token is not always the share (issuer-operator vs agent model).
- Perp funding = the interest rate that keeps a futures price pinned to spot; positive when longs pay.
- Curator concentration = the asset management industry's 80/20, sped up.

Teaching pattern that works: define in one sentence, give the TradFi anchor, show one live example WITH numbers pulled fresh, name the top risk, and end with the two questions that test understanding. Layer depth on request rather than front-loading.

Explaining a specific yield to a learner: always walk the four-axis decomposition on their actual example. "Your 9% = 4% T-bill base + 3% credit spread + 2% token incentives (ends next month), accrual-marked" teaches more than any glossary.

## Create: marketing and content

Accuracy is the moat; DeFi audiences punish sloppiness and regulators punish promises. Rules:

1. Never promise yield. State current rates with as-of dates and call them variable. No "earn X%" without "current, variable, as of <date>".
2. Decompose APY in public copy when it is the headline: organic vs incentives. Audiences trust products that show the split; hiding it reads as a red flag to exactly the users worth having.
3. No "safe", "riskless", "guaranteed", "insured" (unless a named policy exists: then name the insurer and the coverage cap). State the honest risk line once, plainly.
4. Superlatives need receipts: "largest/first/fastest" claims carry a source and date or get cut.
5. Ground claims in verifiable onchain data and link primary sources: docs, dashboards, explorers. Screenshots are decoration; links are evidence.
6. Know the jurisdictional tripwires: yield-bearing products and US persons, securities-adjacent language ("investment", "returns", "profit share"), and geo-gated products marketed globally. Flag for legal review rather than improvising.

Content structures that perform for this audience: the numbers-forward thread (hook with a dated stat, decompose it, end with the implication); the mechanism explainer (how X actually works, with one diagram-in-words); the honest comparison table (including the option that is not yours); and the "what everyone missed in <primary source>" close read. Write in the user's voice rules if provided; default to plain, confident, zero hype.

## Scan and assess

Moved: the opportunity hunting grounds and the twelve-step assessment live together in `defi-opportunities-playbook.md`, because an opportunity is just a risk analysis with a why-does-this-exist attached.
