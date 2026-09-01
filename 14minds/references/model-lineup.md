# Model Lineup

14minds queries 14 frontier LLMs simultaneously via Bankr LLM Gateway. Each model independently analyzes the same token data and returns a BUY/SELL/HOLD verdict with reasoning.

## The 14 Models

### Claude (Anthropic)
- **claude-opus-4.6** — Latest flagship, strongest reasoning
- **claude-opus-4.5** — Previous flagship, proven reliability
- **claude-sonnet-4.5** — Fast, balanced, good for trading signals
- **claude-haiku-4.5** — Fastest, concise, surprising conviction on edge cases

### Gemini (Google)
- **gemini-3-pro** — Latest reasoning model, verbose
- **gemini-3-flash** — Fast variant, punchy verdicts
- **gemini-2.5-pro** — Proven reasoning, conservative bias
- **gemini-2.5-flash** — Fast, efficient, good pattern recognition

### GPT (OpenAI)
- **gpt-5.2** — Latest flagship, balanced
- **gpt-5.2-codex** — Code-tuned, good at data parsing
- **gpt-5-mini** — Fast, cheap, surprisingly sharp
- **gpt-5-nano** — Smallest, fastest, useful as a noise filter

### Others
- **kimi-k2.5** (Moonshot) — Chinese model, different bias set
- **qwen3-coder** (Alibaba) — Code-focused, technical analysis

## Why 14?

**Consensus strength.** When 12/14 models agree, you have signal. When they split 7-7, you have ambiguity. Both are useful.

**Bias diversity.** Claude is RLHF-conservative. Gemini is verbose. GPT is balanced. Qwen/Kimi have different training data. Aggregating across these removes single-model bias.

**Failure tolerance.** 4-6 models are typically offline at any time (API rate limits, maintenance, timeouts). 14 models ensures 8-10 responses even with degraded service.

**Cost efficiency.** 80 tokens × 14 models = ~$0.50/scan via Bankr LLM Gateway bulk pricing. Cheaper than running individually.

## Model Behavior Patterns (Observed)

### Unanimous BUY (rare)
When 10+ models say BUY, they're seeing obvious momentum. Usually pumping tokens with strong volume. High confidence.

### Unanimous SELL (rare)
When 10+ models say SELL, they're seeing obvious risk. Usually dumping tokens or rug indicators. High confidence.

### HOLD Dominant (common)
When 6+ models say HOLD, they're seeing ambiguity. This is the scanner's sweet spot — models can't agree, which means NO EDGE.

### Split Verdict (common)
When models split 5-5-4 or similar, the token is at an inflection point. Interesting, but no conviction.

### Dissenter Pattern
When 13 models agree and 1 dissents, look at WHO dissented. Opus 4.6 dissenting from 13 HOLDs has more weight than GPT Nano dissenting from 13 BUYs.

## Model Offline Patterns

**Typical online rate:** 8-10/14 (57-71%)

**Common offline models:**
- GPT-5.2 (rate limited)
- GPT Nano (frequently down)
- Kimi (China API unreliable)
- Qwen (same)

**Reliable responders:**
- Claude Opus 4.5, Sonnet, Haiku (95%+ uptime)
- Gemini 2.5 Pro, Flash (90%+ uptime)

**When <6 models respond:** Abort scan. Not enough data for consensus.

## Prompt Engineering

Standardized prompt sent to all models:

```
Token: {SYMBOL} @ ${price} ({change_24h}%)
MCap: ${mcap} | Volume: ${volume_24h} | Liquidity: ${liquidity}

Based ONLY on this data, respond in EXACTLY this format:
ACTION: [BUY/SELL/HOLD]
REASON: [one sentence, max 50 chars]
```

**Why this format:**
- **Minimal tokens** — 80 token limit forces concise reasoning
- **Structured output** — Easy to parse programmatically
- **No context pollution** — Each model sees identical prompt
- **No chain-of-thought** — We want the gut verdict, not reasoning artifacts

## Parsing Logic

```python
# Extract ACTION
if "BUY" in response.upper():
    action = "BUY"
elif "SELL" in response.upper():
    action = "SELL"
else:
    action = "HOLD"

# Extract REASON (first 50 chars after "REASON:")
reason = extract_reason(response)[:50]
```

Robust against formatting variations. Models rarely comply perfectly, so we parse flexibly.

## Aggregation Strategy

```python
# Count votes
buy_count = sum(1 for r in results if r.action == "BUY")
sell_count = sum(1 for r in results if r.action == "SELL")
hold_count = sum(1 for r in results if r.action == "HOLD")

# Determine dominant action
if buy_count > responded * 0.7:
    dominant = "BUY"
    conviction = 7-8
elif sell_count > responded * 0.7:
    dominant = "SELL"
    conviction = 7-8
elif hold_count == responded:
    dominant = "HOLD"
    conviction = 3
else:
    dominant = "HOLD"
    conviction = 4  # Split verdict
```

**Conviction scoring:**
- 8-10: Strong consensus (90%+ agree)
- 7: Weak consensus (70%+ agree)
- 4: Split verdict (no consensus)
- 3: Unanimous HOLD (models see nothing)
- 1-2: Abort signal (too few responses)

## Visual Representation

Each model gets a card in the orbital arena:
- **Color:** Provider-specific (purple for Claude, teal for Gemini, blue for GPT)
- **Position:** Orbiting the center token card
- **Animation:** Fade-in sequentially as responses arrive
- **Verdict badge:** Green (BUY), Red (SELL), Gray (HOLD)

The visual makes disagreement VISIBLE. When you see 6 gray cards and 3 green, you know the signal is weak.

## Cost Breakdown

Via Bankr LLM Gateway (bulk pricing):
- Claude Opus: ~$0.08/scan (4 models × 80 tokens)
- Gemini: ~$0.12/scan (4 models × 80 tokens)
- GPT: ~$0.20/scan (4 models × 80 tokens)
- Qwen/Kimi: ~$0.10/scan (2 models × 80 tokens)

**Total: ~$0.50/scan**

Compare to direct API pricing:
- Claude Opus 4.6 alone: $15/$75 per million tokens (80 tokens = $0.006)
- Gemini Pro alone: $1.25/$5 per million tokens (80 tokens = $0.0004)
- GPT-5.2 alone: $5/$15 per million tokens (80 tokens = $0.0012)

Bankr Gateway aggregates and caches, making multi-model queries economical.

## Future Expansion

Potential models to add:
- **DeepSeek-V3** (Chinese reasoning model)
- **Llama 4** (Meta, when released)
- **Grok 3** (xAI, when API available)
- **Mistral Large 3** (Mistral AI)

The scanner is designed for 14 models specifically (orbital layout, animation timing), but can be extended to 20+ with minor visual adjustments.
