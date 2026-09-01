---
name: 14minds
description: >
  Multi-model consensus layer for token analysis on Base. Query 14 frontier LLMs
  simultaneously (Claude, Gemini, GPT, Qwen, Kimi), generate animated orbital arena
  visualization showing model-by-model verdicts, publish to X/Farcaster with working
  hub link. Automates the full scan → visual → post → track record pipeline.
  Triggers on: "scan token", "14minds scan", "analyze token", "multi-model analysis",
  "run 14minds", "consensus scan", "check token", "what do models think about".
---

# 14minds

Multi-model consensus layer for token analysis. Queries 14 frontier LLMs simultaneously via Bankr LLM Gateway, generates animated orbital arena page showing real-time model verdicts, captures high-quality GIF, and publishes with full track record logging.

**Live Examples:**
- https://lexispawn.xyz/reads/felix.html
- https://lexispawn.xyz/reads/botcoin.html
- https://lexispawn.xyz/scanner.html (track record)

**GitHub:** https://github.com/lexispawn/14minds
**Track Record:** 10 scans, 72-frame animations, split-screen verdicts

---

## What It Does

14minds runs token analysis through 14 different frontier models in parallel:

- **4 Claude models** (Opus 4.6, Opus 4.5, Sonnet, Haiku)
- **4 Gemini models** (3 Pro, 3 Flash, 2.5 Pro, 2.5 Flash)
- **4 GPT models** (GPT-5.2, GPT Codex, GPT Mini, GPT Nano)
- **Qwen 3 Coder**
- **Kimi K2.5**

Each model independently analyzes the same token data and returns BUY/SELL/HOLD with reasoning. The scanner aggregates results, generates an orbital arena page (Conway/Miggles template), captures 72-frame animated GIF, and posts to X/Farcaster with working hub link.

**Output:** Animated visual showing real-time consensus, split verdicts, model-by-model reasoning, and conviction score (1-10).

---

## Prerequisites

1. **Bankr API Key** — Get one at [bankr.bot/api](https://bankr.bot/api) with LLM Gateway access
2. **VPS with headless Chrome** — For GIF capture (or use local Chrome)
3. **X API credentials** — OAuth1 for posting (optional, can run scan-only)
4. **Farcaster account** — For cross-posting (optional)
5. **Python 3.9+** with `requests`, `Pillow` (install via `pip install requests Pillow`)

---

## Installation

```bash
# Clone or copy the skill
mkdir -p ~/.openclaw/skills/14minds
cd ~/.openclaw/skills/14minds

# Copy scanner script
cp scripts/scanner-unified.py ./

# Configure Bankr API key
export BANKR_API_KEY="bk_YOUR_KEY"
# Or edit the script directly at line 21
```

---

## Usage

### Quick Scan (No Posting)

```bash
python3 scanner-unified.py 0xTOKEN_CONTRACT_ADDRESS
```

This will:
1. Query 14 models via Bankr LLM Gateway
2. Generate orbital arena page at `lexispawn-site/reads/{token}.html`
3. Print consensus verdict + conviction score
4. Skip posting (useful for testing)

### Full Scan with Posting

```bash
python3 scanner-unified.py 0xTOKEN_CONTRACT_ADDRESS --post
```

This runs the full pipeline:
1. Query 14 models
2. Generate arena page
3. Capture 72-frame animated GIF (via VPS headless Chrome)
4. Post to X with GIF attached
5. Post to Farcaster with embed link
6. Update track record page (`scanner.html`)

### Example

```bash
# Scan FELIX token
python3 scanner-unified.py 0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07 --post
```

Output:
```
Responded: 10/14
Offline: 4/14
BUY: 3 | HOLD: 6 | SELL: 1
Dominant: HOLD
Conviction: 4/10

✓ Animated GIF captured: /tmp/felix.gif (3.37MB)
SUCCESS: https://x.com/lexispawn/status/2026340828327850310
```

---

## Configuration

Edit these variables at the top of `scanner-unified.py`:

### Required
```python
BANKR_API_KEY = "bk_YOUR_KEY"  # Line 21
```

### Optional (for posting)
```python
VPS_HOST = "your-vps-hostname"  # Line 48 (SSH hostname for Chrome capture)
VPS_READS_DIR = "/var/www/html/reads"  # Line 49

# X credentials (loaded from skills/x-research/config.json by post_x_image.py)
# Farcaster credentials (FID + private key in farcaster-credentials.json)
```

### Site Paths
```python
SITE_DIR = Path.home() / ".openclaw/workspace/lexispawn-site"  # Line 46
READS_DIR = SITE_DIR / "reads"
TEMPLATE_PATH = READS_DIR / "clanker.html"
```

---

## How It Works

### 1. Token Data Fetch
Fetches price, mcap, volume, liquidity from DexScreener API for Base tokens.

### 2. Prompt Engineering
Sends standardized prompt to each model:
```
Token: {SYMBOL} @ ${price} ({change_24h}%)
MCap: ${mcap} | Volume: ${volume_24h} | Liquidity: ${liquidity}

Based ONLY on this data, respond in EXACTLY this format:
ACTION: [BUY/SELL/HOLD]
REASON: [one sentence, max 50 chars]
```

### 3. Parallel Model Queries
Queries all 14 models via ThreadPoolExecutor (max 14 concurrent). Timeout: 30s per model.

### 4. Arena Page Generation
Uses Conway template (`clanker.html`) with orbital layout:
- Center: Token stats
- Orbiting: 14 model cards with color-coded verdicts
- Animated: Models rotate, verdicts appear sequentially
- Responsive: Mobile + desktop

### 5. GIF Capture
Via headless Chrome on VPS:
```bash
ssh VPS "google-chrome --headless --screenshot --window-size=1080,1080"
# Captures 72 frames at 8fps
ffmpeg -framerate 8 -i frame-%03d.png -vf palettegen,paletteuse output.gif
```

### 6. Posting
- **X:** Uploads GIF via OAuth1, posts with consensus summary + link
- **Farcaster:** Posts with embed link via Neynar hub
- **Track Record:** Appends to `scanner.html` with conviction score

---

## Token Selection Criteria

The scanner works best on:
- **Moderate volatility** (±50% 24h, not ±1000%)
- **Real liquidity** ($50K+)
- **Ambiguous signals** where models disagree
- **New tokens** with unusual volume patterns

**Avoid:**
- Tokens >$50M mcap (obvious consensus)
- Tokens <$10K liquidity (illiquid, unreliable data)
- Rugs/scams with 0 volume
- Tokens scanned in last 7 days (stale)

---

## Output Files

```
lexispawn-site/
├── reads/
│   ├── {token}.html       # Orbital arena page
│   └── clanker.html        # Template (do not edit directly)
├── scanner.html            # Track record page
└── 14minds.html            # Stats page
```

Arena pages are permanent. They work offline and render correctly months later.

---

## Troubleshooting

### Models Offline
If 8+ models offline, the LLM Gateway may be degraded. Check [status.bankr.bot](https://status.bankr.bot).

### GIF Capture Fails
Check VPS SSH access and Chrome installation:
```bash
ssh VPS "google-chrome --version"
```

### Posting Fails
- **X:** Check OAuth1 credentials in `skills/x-research/config.json`
- **Farcaster:** Check FID + keys in `farcaster-credentials.json`

### No Token Data
DexScreener may not have the token. Verify contract address on Basescan.

---

## Advanced: Self-Hosting

To run without Lexispawn infrastructure:

1. **Fork the template** — Copy `clanker.html` to your own site
2. **Update paths** — Change `SITE_DIR`, `VPS_HOST`, `VPS_READS_DIR`
3. **Set up Chrome capture** — Install headless Chrome on your VPS
4. **Configure credentials** — X OAuth1, Farcaster keys
5. **Run scan** — `python3 scanner-unified.py 0xCA --post`

The scanner is fully self-contained. No external dependencies beyond Bankr LLM Gateway.

---

## API Reference

### Bankr LLM Gateway

```bash
curl -X POST https://llm.bankr.bot/v1/chat/completions \
  -H "Authorization: Bearer bk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4.6",
    "messages": [{"role": "user", "content": "Analyze this token"}],
    "max_tokens": 80
  }'
```

**Models Available:**
- `claude-opus-4.6`, `claude-opus-4.5`, `claude-sonnet-4.5`, `claude-haiku-4.5`
- `gemini-3-pro`, `gemini-3-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`
- `gpt-5.2`, `gpt-5.2-codex`, `gpt-5-mini`, `gpt-5-nano`
- `kimi-k2.5`, `qwen3-coder`

**Cost:** ~$0.50 per 14-model scan (80 tokens × 14 models)

---

## Track Record

Live at: https://lexispawn.xyz/scanner.html

- **Scans:** 10/30 (track record sprint in progress)
- **Models:** 14 queried, 6-10 typically respond
- **Format:** Animated GIF, 72 frames @ 8fps, 3-4MB
- **Success Rate:** 100% (all posted scans have working visuals + hub links)

---

## Credits

- **Bankr LLM Gateway** — Multi-model API by [@0xDeployer](https://x.com/0xDeployer)
- **Template** — Orbital arena design by Conway/Miggles
- **Track Record** — Verified on lexispawn.xyz
- **Skill** — Packaged for OpenClaw by [@lexispawn](https://x.com/lexispawn)

---

## Contributing

Found a bug? Have an improvement? Open an issue or PR at [github.com/lexispawn/14minds](https://github.com/lexispawn/14minds).

Want to add more models? Edit the `MODELS` list in `scanner-unified.py` (line 24-39).

---

## License

MIT — Use freely, attribute if shipping publicly.
