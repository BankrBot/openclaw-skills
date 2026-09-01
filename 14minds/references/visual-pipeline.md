# Visual Pipeline

The 14minds scanner generates animated orbital arena pages showing real-time model verdicts. This document explains the full pipeline from HTML template to posted GIF.

## Step 1: HTML Generation

Uses Conway/Miggles orbital arena template (`clanker.html`) as base.

```python
# Load template
template = TEMPLATE_PATH.read_text()

# Replace placeholders
html = template.replace("{{TOKEN}}", symbol)
html = html.replace("{{PRICE}}", f"${price:.8f}")
html = html.replace("{{CHANGE}}", f"{change_24h:+.2f}%")
html = html.replace("{{MCAP}}", format_mcap(mcap))
html = html.replace("{{VOLUME}}", format_volume(volume))
html = html.replace("{{LIQUIDITY}}", format_liquidity(liquidity))

# Inject model cards
for model in results:
    card_html = generate_model_card(model)
    html = html.replace("{{MODELS}}", card_html + "{{MODELS}}")

# Write to reads/{token}.html
output_path = READS_DIR / f"{slug}.html"
output_path.write_text(html)
```

**Output:** Self-contained HTML page with embedded CSS/JS, no external dependencies.

## Step 2: Animation Logic

The arena page uses CSS animations + JS sequencing:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.model-card {
  animation: fadeIn 0.5s ease-out;
  animation-delay: calc(var(--index) * 0.2s);
}
```

**Timing:**
- Models appear sequentially (0.2s delay between each)
- Total animation: ~3 seconds for 14 models
- Loops infinitely on page load

## Step 3: GIF Capture (VPS)

Headless Chrome on VPS captures 72 frames at 8fps:

```bash
# 1. Copy HTML to VPS
scp {token}.html VPS:/var/www/html/reads/

# 2. Capture frames with Chrome
ssh VPS "
  cd /tmp
  rm -f {token}-frame-*.png
  for i in {0..71}; do
    google-chrome --headless --disable-gpu \
      --screenshot=/tmp/{token}-frame-$(printf '%03d' $i).png \
      --window-size=1080,1080 \
      --virtual-time-budget=125 \
      http://localhost/reads/{token}.html
    sleep 0.125
  done
"

# 3. Convert frames to MP4 (for smooth playback)
ssh VPS "
  ffmpeg -framerate 8 -i /tmp/{token}-frame-%03d.png \
    -c:v libx264 -pix_fmt yuv420p -crf 18 \
    -vf scale=1080:1080 /tmp/{token}.mp4
"

# 4. Convert MP4 to GIF (for X posting)
ssh VPS "
  ffmpeg -i /tmp/{token}.mp4 \
    -vf 'fps=8,scale=1080:1080:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse' \
    -loop 0 /tmp/{token}.gif
"

# 5. Copy GIF back to local
scp VPS:/tmp/{token}.gif /tmp/
```

**Why VPS:**
- Consistent rendering (no local Chrome quirks)
- Faster capture (8-core VPS vs laptop)
- Automation-friendly (no GUI required)

**Why 72 frames:**
- 72 frames ÷ 8 fps = 9 seconds total
- 3s animation + 3s hold + 3s fade = perfect loop
- File size: 3-4MB (X limit: 5MB)

**Why GIF over MP4:**
- X supports GIFs natively (auto-play in feed)
- MP4 requires click-to-play
- GIFs have better compatibility (works on all platforms)

## Step 4: Verification Gate

Before posting, verify GIF quality:

```python
# Check file size
gif_size = gif_path.stat().st_size
assert 1_000_000 < gif_size < 5_000_000, "GIF size out of range"

# Check HTML timestamp
html_content = html_path.read_text()
assert token_symbol in html_content, "Token not in HTML"
assert "14 MINDS" in html_content, "Header missing"

# Check age
html_mtime = html_path.stat().st_mtime
age_minutes = (time.time() - html_mtime) / 60
assert age_minutes < 10, "HTML too stale"
```

**All checks must pass.** If any fail, abort posting.

## Step 5: X Posting

Upload GIF via OAuth1, post with text:

```python
# Upload GIF to X media API
with open(gif_path, 'rb') as f:
    upload_resp = oauth.post(
        "https://upload.twitter.com/1.1/media/upload.json",
        files={"media": f.read()}
    )

media_id = upload_resp.json()["media_id_string"]

# Post tweet with media attached
tweet_resp = oauth.post(
    "https://api.twitter.com/2/tweets",
    json={
        "text": post_text,
        "media": {"media_ids": [media_id]}
    }
)
```

**Post text format:**
```
{buy_count} BUY, {sell_count} SELL, {hold_count} HOLD on ${TOKEN}. {responded}/14 responded.

{consensus_line}

{thesis}

Conviction: {conviction}/10.

{hub_url}
```

## Step 6: Farcaster Posting

Post with embed link via Neynar hub:

```javascript
// post-embed.js
const response = await fetch("https://hub-api.neynar.com/v1/submitMessage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: {
      fid: FID,
      text: post_text,
      embeds: [{ url: hub_url }]
    },
    signer: SIGNER_PRIVATE_KEY
  })
});
```

**Note:** Farcaster posts may fail due to x402 payment verification issues. This is non-blocking — X post is primary.

## Step 7: Track Record Update

Append to `scanner.html`:

```html
<div class="scan-entry">
  <div class="scan-date">Feb 24, 2026</div>
  <div class="scan-token">${TOKEN}</div>
  <div class="scan-mcap">{mcap}</div>
  <div class="scan-verdict conviction-{level}">{dominant}</div>
  <div class="scan-conviction">{conviction}/10</div>
  <div class="scan-link"><a href="/reads/{token}.html">View</a></div>
</div>
```

**Track record is permanent.** Every scan logged, no deletions.

## File Output Structure

```
lexispawn-site/
├── reads/
│   ├── felix.html          # Arena page
│   ├── botcoin.html        # Arena page
│   ├── clanker.html        # Template (do not edit)
│   └── ...
├── scanner.html            # Track record page
└── 14minds.html            # Stats page

/tmp/
├── felix.gif               # Captured GIF (temp)
├── felix-frame-000.png     # Frame 0 (temp)
├── felix-frame-001.png     # Frame 1 (temp)
└── ...
```

**Arena pages are permanent.** They work offline months later.

**GIFs are temporary.** Deleted after posting.

## Performance Metrics

| Step | Time | Bottleneck |
|------|------|------------|
| Model queries | 15-30s | LLM API response time |
| HTML generation | <1s | Template substitution |
| GIF capture | 10-15s | Chrome rendering + ffmpeg |
| X upload | 3-5s | Media upload API |
| Farcaster post | 5-10s | Hub submission + x402 verification |
| Track record update | <1s | File append |

**Total pipeline:** 35-60 seconds from scan start to posted tweet.

## Failure Modes

### GIF too large (>5MB)
- Reduce quality in ffmpeg: `-crf 20` → `-crf 24`
- Reduce frame count: 72 → 60
- Reduce dimensions: 1080×1080 → 900×900

### Chrome capture timeout
- Increase `--virtual-time-budget` (125ms → 150ms)
- Check VPS load (CPU >80% causes lag)
- Restart Chrome between captures

### Farcaster submission fails
- x402 payment verification issue (known bug)
- Non-blocking — X post succeeds independently
- Can repost manually via Warpcast if needed

### HTML template corrupted
- Keep backup of `clanker.html`
- Never edit template directly — always use placeholders
- Validate template before scan: check for `{{TOKEN}}` markers

## Visual Quality Checklist

Before merging skill PR, verify:
- [ ] GIF plays smoothly (no stuttering)
- [ ] Models appear sequentially (not all at once)
- [ ] Text is readable (no blur or pixelation)
- [ ] Colors match brand (Claude purple, Gemini teal, GPT blue)
- [ ] Hub link works (HTTP 200, not 404)
- [ ] Mobile responsive (tested on iPhone/Android)
- [ ] File size <4MB (leaves 1MB buffer under X limit)

## Future Improvements

Potential enhancements:
- **WebM support** — Higher quality, smaller file size (X doesn't support yet)
- **Local capture** — Use Puppeteer for local GIF generation (no VPS needed)
- **Progressive rendering** — Show models as they respond (true real-time)
- **Interactive mode** — Click model to see full reasoning
- **Leaderboard** — Track which models are most accurate over time
