#!/usr/bin/env python3
"""
14MINDS Unified Scanner Pipeline
Spec: 2026-02-18 22:34 PST

Queries 14 models → generates orbital arena page → captures animated MP4 → posts → logs track record

TOKEN SELECTION RULES (added 2026-02-18 23:52 PST):
- REJECT tokens with >+1000% or <-80% 24h change (obvious outcome, no edge)
- The edge is in AMBIGUOUS signals where models DISAGREE
- Ideal targets: moderate movement, unusual volume patterns, divergence, new tokens with real liquidity
"""

import json
import time
import urllib.request
import sys
import subprocess
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

BANKR_API_KEY = "bk_6XR5WFYULUYTWVXQ6MSXBCZPUEMZ4G2R"
LLM_ENDPOINT = "https://llm.bankr.bot/v1/chat/completions"

# 14 models in fixed order (spec)
MODELS = [
    ("claude-opus-4.6", "Opus 4.6", "Claude", "#E8B4F8"),
    ("claude-opus-4.5", "Opus 4.5", "Claude", "#C89CF8"),
    ("claude-sonnet-4.5", "Sonnet", "Claude", "#A882E8"),
    ("claude-haiku-4.5", "Haiku", "Claude", "#8F6FD8"),
    ("gemini-3-pro", "Gem 3 Pro", "Gemini", "#4ECDC4"),
    ("gemini-3-flash", "Gem 3 Flash", "Gemini", "#45B7AA"),
    ("gemini-2.5-pro", "Gem 2.5 Pro", "Gemini", "#3AA396"),
    ("gemini-2.5-flash", "Gem 2.5 Flash", "Gemini", "#31978A"),
    ("gpt-5.2", "GPT-5.2", "OpenAI", "#74C0FC"),
    ("gpt-5.2-codex", "GPT Codex", "OpenAI", "#5AAFF5"),
    ("gpt-5-mini", "GPT Mini", "OpenAI", "#4A9FE8"),
    ("gpt-5-nano", "GPT Nano", "OpenAI", "#3A8ED8"),
    ("kimi-k2.5", "Kimi", "Moonshot", "#FFB347"),
    ("qwen3-coder", "Qwen", "Alibaba", "#98D8AA"),
]

SITE_DIR = Path.home() / ".openclaw/workspace/lexispawn-site"
READS_DIR = SITE_DIR / "reads"
TEMPLATE_PATH = READS_DIR / "clanker.html"
VPS_HOST = "lexispawn-vps"
VPS_READS_DIR = "/var/www/html/reads"

def query_model(model_id: str, model_name: str, prompt: str) -> dict:
    body = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 80
    }
    req = urllib.request.Request(
        LLM_ENDPOINT,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {BANKR_API_KEY}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.load(resp)
            content = data['choices'][0]['message']['content'].strip()
            # Treat empty/whitespace responses as failures
            if not content or content == "":
                return {"model": model_name, "response": None, "success": False, "error": "Empty response"}
            return {"model": model_name, "response": content, "success": True}
    except Exception as e:
        return {"model": model_name, "response": None, "success": False, "error": str(e)}

def fetch_token(ca: str) -> dict:
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{ca}"
        req = urllib.request.Request(url, headers={"User-Agent": "14minds/unified"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.load(resp)
            if data.get("pairs"):
                p = data["pairs"][0]
                return {
                    "symbol": p["baseToken"]["symbol"],
                    "price": p.get("priceUsd", "?"),
                    "change": p.get("priceChange", {}).get("h24", 0),
                    "volume": p.get("volume", {}).get("h24", 0),
                    "liquidity": p.get("liquidity", {}).get("usd", 0),
                    "mcap": p.get("fdv", 0),
                }
    except Exception as e:
        print(f"Token fetch error: {e}")
    return {"symbol": "???", "price": "?", "change": 0, "volume": 0, "liquidity": 0, "mcap": 0}

def classify_response(response: str) -> str:
    if not response:
        return None
    response_upper = response.upper()
    if response_upper.startswith("BUY") or "BUY" in response_upper[:20]:
        return "BUY"
    elif response_upper.startswith("SELL") or "SELL" in response_upper[:20]:
        return "SELL"
    elif response_upper.startswith("HOLD") or "HOLD" in response_upper[:20]:
        return "HOLD"
    return "HOLD"

def generate_arena_page(token_data: dict, results: list, output_path: Path) -> dict:
    """Generate orbital arena page with 14 model positions"""
    
    template = TEMPLATE_PATH.read_text()
    
    # Map results to 14 fixed positions
    results_map = {r["model"]: r for r in results}
    
    buy_count = 0
    hold_count = 0
    sell_count = 0
    responded = 0
    offline_count = 0
    
    models_data = []
    angle_step = (2 * 3.14159) / 14
    
    for i, (model_id, model_name, family, color) in enumerate(MODELS):
        result = results_map.get(model_name)
        
        if result and result.get("success") and result.get("response"):
            stance = classify_response(result["response"])
            stance_glow = "#FF6B35" if stance == "SELL" else "#00ff88" if stance == "BUY" else "transparent"
            
            if stance == "BUY":
                buy_count += 1
            elif stance == "HOLD":
                hold_count += 1
            elif stance == "SELL":
                sell_count += 1
            responded += 1
            
            models_data.append({
                "name": model_name,
                "angle": -1.5708 + (i * angle_step),
                "bodyColor": color,
                "stanceGlow": stance_glow,
                "conviction": 5,
                "stance": stance.upper()
            })
        else:
            # Offline/failed model
            offline_count += 1
            models_data.append({
                "name": model_name,
                "angle": -1.5708 + (i * angle_step),
                "bodyColor": "#333333",  # Dark grey
                "stanceGlow": "transparent",
                "conviction": 0,
                "stance": "OFFLINE"
            })
    
    # Determine dominant verdict
    if sell_count > buy_count and sell_count > hold_count:
        verdict = "SELL"
    elif buy_count > sell_count and buy_count > hold_count:
        verdict = "BUY"
    else:
        verdict = "HOLD"
    
    change_color = "#00ff88" if float(token_data["change"] or 0) >= 0 else "#ff4444"
    change_sign = "+" if float(token_data["change"] or 0) >= 0 else ""
    
    # Format volume
    vol = token_data['volume']
    if vol >= 1_000_000:
        vol_str = f"${vol/1_000_000:.1f}M"
    elif vol >= 1_000:
        vol_str = f"${vol/1_000:.0f}K"
    else:
        vol_str = f"${vol:.0f}"
    
    # Generate timestamp (PST = UTC-8)
    pst = timezone(timedelta(hours=-8))
    now = datetime.now(pst)
    timestamp = now.strftime('%Y-%m-%d %H:%M PST')
    
    # Generate JavaScript models array
    models_js = json.dumps(models_data)
    
    # Replace template placeholders
    html = template
    html = html.replace("$CLANKER", f"${token_data['symbol']}")
    html = html.replace("$31.200000", f"${token_data['price']}")
    html = html.replace("-1.0% · $120,815 vol", f"{change_sign}{token_data['change']:.1f}% · {vol_str} vol")
    html = html.replace(">HOLD<", f">{verdict}<")
    html = html.replace("2026-02-16 21:43 PST", timestamp)
    html = html.replace("og:image\" content=\"thesis-clanker.png\"", f"og:image\" content=\"https://lexispawn.xyz/reads/thesis-{token_data['symbol'].lower()}.png\"")
    html = html.replace('og:title" content="14 MINDS · $CLANKER"', f'og:title" content="14 MINDS — ${token_data["symbol"]}"')
    
    # Replace models array
    html = re.sub(
        r'const models = \[.*?\];',
        f'const models = {models_js};',
        html,
        flags=re.DOTALL
    )
    
    # Update stats
    html = re.sub(r'<div class="stat-value bullish">\d+</div>', f'<div class="stat-value bullish">{buy_count}</div>', html)
    html = re.sub(r'<div class="stat-value neutral">\d+</div>', f'<div class="stat-value neutral">{hold_count}</div>', html)
    html = re.sub(r'<div class="stat-value bearish">\d+</div>', f'<div class="stat-value bearish">{sell_count}</div>', html)
    
    # Add model verdicts section
    models_html = ""
    for r in results:
        if r.get("success") and r.get("response"):
            response_text = r["response"][:80]
            stance = classify_response(response_text)
            verdict_class = stance.lower() if stance else "hold"
            models_html += f'<div class="model-verdict verdict-{verdict_class}">{r["model"]}: {response_text}</div>\n'
    
    if models_html:
        html = html.replace("</body>", f'<div class="models-section" style="margin-top: 40px; padding: 20px;">{models_html}</div></body>')
    
    output_path.write_text(html)
    print(f"Generated arena page: {output_path}")
    
    return {
        "buy": buy_count,
        "hold": hold_count,
        "sell": sell_count,
        "responded": responded,
        "offline": offline_count,
        "verdict": verdict,
        "timestamp": timestamp
    }

def capture_animated_visual(token_slug: str, local_html_path: Path) -> Path:
    """Capture animated GIF on VPS and return local path"""
    
    print("\n=== CAPTURING ANIMATED VISUAL ===")
    
    # 1. Copy HTML to VPS
    print("1. Copying HTML to VPS...")
    subprocess.run([
        "scp", str(local_html_path),
        f"{VPS_HOST}:/tmp/{token_slug}.html"
    ], check=True)
    
    subprocess.run([
        "ssh", VPS_HOST,
        f"sudo cp /tmp/{token_slug}.html {VPS_READS_DIR}/ && sudo chmod 644 {VPS_READS_DIR}/{token_slug}.html"
    ], check=True)
    
    # 2. Capture 72 frames on VPS
    print("2. Capturing 72 frames at 8fps...")
    result = subprocess.run([
        "ssh", VPS_HOST,
        f"cd /tmp && node capture-animated.js 'file://{VPS_READS_DIR}/{token_slug}.html' /tmp/{token_slug}"
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Frame capture failed: {result.stderr}")
        raise Exception("Frame capture failed")
    
    print(result.stdout)
    
    # 3. Convert frames to MP4 with ffmpeg
    print("3. Converting frames to MP4...")
    subprocess.run([
        "ssh", VPS_HOST,
        f"cd /tmp && ffmpeg -y -framerate 8 -i {token_slug}-frame-%03d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -vf scale=1080:1400 {token_slug}.mp4 2>&1 | tail -5"
    ], check=True)
    
    # 4. Convert MP4 to high-quality GIF (Twitter-compatible)
    print("4. Converting MP4 to high-quality GIF...")
    # Settings: 4fps (smoother), 1080x1400 (full page), better palette
    subprocess.run([
        "ssh", VPS_HOST,
        f"cd /tmp && ffmpeg -y -i {token_slug}.mp4 -vf 'fps=4,scale=1080:1400:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 {token_slug}.gif 2>&1 | tail -5"
    ], check=True)
    
    # 5. Clean up frames on VPS
    subprocess.run([
        "ssh", VPS_HOST,
        f"rm -f /tmp/{token_slug}-frame-*.png"
    ])
    
    # 6. Copy GIF back to local
    print("5. Copying GIF to local...")
    local_gif = Path(f"/tmp/{token_slug}.gif")
    subprocess.run([
        "scp", f"{VPS_HOST}:/tmp/{token_slug}.gif", str(local_gif)
    ], check=True)
    
    # Check size
    size_mb = local_gif.stat().st_size / 1_048_576
    print(f"✓ Animated GIF captured: {local_gif} ({size_mb:.2f}MB)")
    
    if size_mb > 5.0:
        print(f"⚠ Warning: GIF is {size_mb:.2f}MB (Twitter limit is 5MB)")
    
    return local_gif

def verify_before_post(html_path: Path, gif_path: Path, token_symbol: str) -> bool:
    """Automated verification gate"""
    
    print("\n=== VERIFICATION GATE ===")
    
    # Check 1: GIF exists and >50KB
    if not gif_path.exists():
        print(f"✗ FAIL: GIF does not exist at {gif_path}")
        return False
    
    size_kb = gif_path.stat().st_size / 1024
    if size_kb < 50:
        print(f"✗ FAIL: GIF is only {size_kb:.1f}KB (< 50KB)")
        return False
    print(f"✓ GIF exists ({size_kb:.1f}KB)")
    
    # Check 2: HTML contains correct token name
    html = html_path.read_text()
    if f"${token_symbol}" not in html:
        print(f"✗ FAIL: Token ${token_symbol} not found in HTML")
        return False
    print(f"✓ Token ${token_symbol} found in HTML")
    
    # Check 3: Timestamp is recent
    pst = timezone(timedelta(hours=-8))
    now = datetime.now(pst)
    timestamp_pattern = r'\d{4}-\d{2}-\d{2} \d{2}:\d{2} PST'
    match = re.search(timestamp_pattern, html)
    if not match:
        print("✗ FAIL: No timestamp found in HTML")
        return False
    
    timestamp_str = match.group()
    scan_time = datetime.strptime(timestamp_str.replace(" PST", ""), '%Y-%m-%d %H:%M')
    scan_time = scan_time.replace(tzinfo=pst)
    age_minutes = (now - scan_time).total_seconds() / 60
    
    if age_minutes > 10:
        print(f"✗ FAIL: Timestamp is {age_minutes:.1f} minutes old (> 10 min)")
        return False
    print(f"✓ Timestamp is recent ({age_minutes:.1f} min ago)")
    
    # Check 4: "14 MINDS" appears
    if "14 MINDS" not in html:
        print("✗ FAIL: '14 MINDS' not found in HTML")
        return False
    print("✓ '14 MINDS' header found")
    
    print("✓ ALL CHECKS PASSED")
    return True

def generate_voice(token_data: dict, stats: dict, results: list, html_url: str) -> tuple:
    """Generate 15th mind voice copy - returns (full_copy, short_copy_for_fc)"""
    
    symbol = token_data["symbol"]
    responded = stats["responded"]
    offline = stats["offline"]
    buy = stats["buy"]
    hold = stats["hold"]
    sell = stats["sell"]
    verdict = stats["verdict"]
    change = token_data["change"]
    mcap = token_data["mcap"]
    volume = token_data["volume"]
    liquidity = token_data["liquidity"]
    
    # LINE 1: Arena result - lead with insight, not methodology
    offline_text = f" ({offline} offline)" if offline > 0 else ""
    
    if buy == 0 and hold == 0 and sell == responded:
        # Unanimous SELL - lead with verdict
        line1 = f"Every model said SELL. {responded}/{responded + offline} responded{offline_text}. Zero bulls, zero hedges on ${symbol}."
    elif buy == responded and hold == 0 and sell == 0:
        # Unanimous BUY - lead with verdict
        line1 = f"Unanimous BUY from {responded} models{offline_text}. Zero bears, zero hesitation on ${symbol}."
    elif sell == 0 and buy == 0:
        # All HOLD - lead with indecision
        line1 = f"{responded} models froze{offline_text}. All HOLD. Zero conviction either direction on ${symbol}."
    else:
        # Mixed - lead with split
        line1 = f"{sell} SELL, {buy} BUY, {hold} HOLD on ${symbol}. {responded} responded{offline_text}. Split verdict."
    
    # LINE 2-3: What Lex sees
    # Analyze the pattern
    vol_to_liq = volume / liquidity if liquidity > 0 else 0
    
    if sell == responded and sell > 0:
        # Unanimous SELL - explain why they all agreed using actual data
        if abs(change) > 10000:  # Massive pump (4+ digits)
            multiplier = (100 + abs(change)) / 100
            line2 = f"+{abs(change):,.0f}% in 24 hours. That's not a pump — price multiplied by {multiplier:.0f}x in one day. ${volume/1000:.1f}K volume cycled through ${liquidity/1000:.1f}K liquidity."
            cycles = vol_to_liq
            line3 = f"The same money changed hands {cycles:.0f} times because there's nowhere else for it to go. When 8 frontier models independently flag the same pattern, I listen."
        elif vol_to_liq > 20:
            line2 = f"${volume/1000:.1f}K volume through ${liquidity/1000:.1f}K liquidity = {vol_to_liq:.0f}x cycling. Every model saw it: the pool is too small for the flow."
            line3 = f"When unanimous SELL happens, it's not prediction — it's measurement. The math doesn't lie."
        elif abs(change) > 50:
            line2 = f"Unanimous on a {change:+.1f}% move. Models see crash pattern + extreme volatility as fait accompli."
            line3 = f"When frontier models converge on SELL after a {abs(change):.0f}% drop, they're not predicting — they're confirming."
        else:
            line2 = f"Complete consensus is rare. When it happens, the signal is clear."
            line3 = f"Every model saw the same risk independently. No dissent."
    
    elif buy > sell and buy > hold:
        # Bullish dominant - write data-driven interpretation
        if buy == responded:
            mcap_k = mcap / 1000
            line2 = f"Unanimous BUY from {buy} models. ${mcap_k:.0f}K mcap + {change:+.1f}% move + ${volume/1_000_000:.1f}M volume. Models see continuation."
            line3 = f"When the entire arena aligns bullish, the question isn't if — it's how far."
        else:
            # Find dissenters
            sell_models = [r["model"] for r in results if r.get("success") and classify_response(r["response"]) == "SELL"]
            if sell_models:
                line2 = f"{buy} bulls vs {sell} bears. {', '.join(sell_models[:2])} flag risk while most see {change:+.1f}% momentum as real."
                line3 = f"The dissent matters — but {buy}/{responded} is a strong signal. I lean with the majority."
            else:
                line2 = f"{buy} say BUY. {hold} say wait. Zero bears. ${volume/1_000_000:.1f}M volume flowing with no distribution."
                line3 = f"Caution without conviction. The bulls control this."
    
    elif hold > buy and hold > sell:
        # HOLD dominant - interpret the indecision with data
        if abs(change) < 10 and liquidity < 500_000:
            line2 = f"{hold} models say HOLD on a {change:+.1f}% move. ${liquidity/1000:.0f}K liquidity is thin, but price is stable. They're waiting for a catalyst."
            line3 = f"Indecision means no edge. When the arena splits between caution and nothing, that IS the signal."
        else:
            line2 = f"{hold} HOLD, {buy} BUY, {sell} SELL. Models see {change:+.1f}% + ${liquidity/1000:.0f}K liquidity and can't agree. Uncertainty is unanimous."
            line3 = f"When frontier models freeze, I freeze. No conviction = no position."
    
    else:
        # SELL dominant (but not unanimous) - interpret the distribution
        if sell == responded:
            line2 = f"Every model said SELL. Zero bulls. Zero fence-sitters. ${volume/1_000_000:.1f}M volume on {change:+.1f}% tells the story."
            line3 = f"This isn't analysis. This is measurement. When unanimity happens, it's because the data is screaming."
        else:
            # Find bulls if any
            buy_models = [r["model"] for r in results if r.get("success") and classify_response(r["response"]) == "BUY"]
            if buy_models:
                line2 = f"{sell} bears vs {buy} bulls. {', '.join(buy_models[:2])} see {change:+.1f}% momentum. {sell} see ${liquidity/1000:.0f}K liquidity as the ceiling."
                line3 = f"Dissent exists. But {sell}/{responded} bearish is a strong signal. I lean with the majority."
            else:
                line2 = f"{sell} SELL. {hold} HOLD. Zero bulls. {change:+.1f}% with ${volume/1_000_000:.1f}M volume flowing out."
                line3 = f"Distribution is clear. Not panic yet — but the bears control the narrative."
    
    # LINE 4: Thesis - Lex's conviction
    if sell == responded:
        conviction = min(9, 7 + (2 if vol_to_liq > 20 else 0))
        thesis = "This isn't a prediction. This is physics."
    elif buy == responded:
        conviction = 8
        thesis = "Unanimous BUY from 14 frontier models is signal, not noise."
    elif hold == responded:
        conviction = 3
        thesis = "Indecision is a verdict. WAIT."
    elif sell > responded * 0.7:
        conviction = min(8, 6 + (1 if vol_to_liq > 15 else 0))
        thesis = f"When {sell}/{responded} minds align bearish, the edge is real."
    elif buy > responded * 0.7:
        conviction = 7
        thesis = f"{buy}/{responded} bullish. Not unanimous, but strong."
    else:
        conviction = 4
        thesis = "Split verdict. No edge."
    
    # LINE 5: Conviction + link
    line5 = f"Conviction: {conviction}/10.\n\n{html_url}"
    
    # Full X copy
    full_copy = f"{line1}\n\n{line2}\n\n{line3}\n\n{thesis}\n\n{line5}"
    
    # Shortened FC copy (280 char limit consideration)
    fc_short = f"{line1}\n\n{line2}\n\n{thesis}"
    
    return (full_copy, fc_short, conviction)

def post_scan(token_data: dict, stats: dict, results: list, mp4_path: Path, html_url: str) -> int:
    """Post to X and Farcaster, return conviction score"""
    
    print("\n=== POSTING ===")
    
    # Generate voice
    x_copy, fc_copy, conviction = generate_voice(token_data, stats, results, html_url)
    
    print(f"\n--- X COPY ---\n{x_copy}\n")
    
    # Post to X with GIF (via working image upload path)
    print("Posting to X...")
    subprocess.run([
        "python3",
        str(Path.home() / ".openclaw/workspace/post_x_image.py"),
        str(mp4_path),  # Actually a GIF now
        x_copy
    ], check=True)
    
    # Post to Farcaster
    print("Posting to Farcaster...")
    fc_env = {
        "PRIVATE_KEY": "0x626d5c517c11e25441ee77c7101aca9c8ccee0922b299488c65eceff9451fcbb",
        "SIGNER_PRIVATE_KEY": "1ba0d5f38885c19b3ccb64f6c7ecb83123f21d40e2cc549de7b22d73969b7cb0",
        "FID": "2648583"
    }
    subprocess.run([
        "node",
        str(Path.home() / ".openclaw/workspace/skills/farcaster-agent-src/src/post-embed.js"),
        fc_copy,
        html_url
    ], env={**subprocess.os.environ, **fc_env}, check=True)
    
    print("✓ Posted to X and FC")
    return conviction

def update_track_record(token_data: dict, stats: dict, slug: str, timestamp: str):
    """Update scanner.html and 14minds.html, then git push"""
    
    print("\n=== UPDATING TRACK RECORD ===")
    
    symbol = token_data["symbol"]
    mcap = token_data["mcap"]
    ca = token_data.get("ca", "???")
    conviction = stats.get("conviction", 5)
    
    # Format mcap for display
    if mcap >= 1_000_000:
        mcap_str = f"${mcap/1_000_000:.1f}M"
    elif mcap >= 1_000:
        mcap_str = f"${mcap/1_000:.0f}K"
    else:
        mcap_str = f"${mcap:.0f}"
    
    # Determine conviction class (new HTML uses conviction-high/med/low)
    if conviction >= 7:
        conviction_class = "conviction-high"
    elif conviction >= 5:
        conviction_class = "conviction-med"
    else:
        conviction_class = "conviction-low"
    
    # 1. Update scanner.html (new table structure)
    scanner_html_path = SITE_DIR / "scanner.html"
    scanner_html = scanner_html_path.read_text()
    
    # Truncate CA for display
    ca_short = f"{ca[:8]}...{ca[-4:]}" if len(ca) > 12 else ca
    
    # New row template (table structure)
    scanner_entry = f"""        <tr>
          <td data-label="Time"><span class="timestamp">{timestamp}</span></td>
          <td data-label="Token">
            <div class="token-name">${symbol}</div>
            <div class="token-ca">{ca_short}</div>
          </td>
          <td data-label="Conviction" style="text-align:center">
            <span class="conviction {conviction_class}">{conviction}/10</span>
          </td>
          <td data-label="24h" class="outcome outcome-pending">Pending</td>
          <td data-label="48h" class="outcome outcome-pending">Pending</td>
          <td data-label="MCap" class="mcap">{mcap_str}</td>
          <td class="read-link"><a href="reads/{slug}.html">14minds read</a></td>
        </tr>
"""
    
    # Insert after <!-- NEW_SCAN_ROW --> marker
    scanner_html = scanner_html.replace(
        '<!-- NEW_SCAN_ROW -->',
        f'<!-- NEW_SCAN_ROW -->\n{scanner_entry}',
        1
    )
    
    # Update total scans count
    current_count = scanner_html.count('<tr>')  - 1  # Subtract header row
    scanner_html = re.sub(
        r'<div class="stat-value accent" id="total-scans">\d+</div>',
        f'<div class="stat-value accent" id="total-scans">{current_count}</div>',
        scanner_html
    )
    
    scanner_html_path.write_text(scanner_html)
    print("✓ Updated scanner.html")
    
    # 2. Update 14minds.html
    minds_html_path = SITE_DIR / "14minds.html"
    minds_html = minds_html_path.read_text()
    
    date_part = timestamp.split()[0]
    time_part = timestamp.split()[1]
    
    minds_entry = f"""
<div class="scan-item">
<div class="scan-date">{date_part}<br>{time_part} PST</div>
<div class="scan-token">
<a href="reads/{slug}.html">${symbol}</a>
</div>
<div class="scan-conviction {conviction_class}">{conviction}/10</div>
<div class="outcome outcome-pending">24h: pending</div>
<div class="outcome outcome-pending">48h: pending</div>
</div>
"""
    
    # Insert after scan-list div opening
    minds_html = minds_html.replace(
        '<div class="scan-list">',
        '<div class="scan-list">' + minds_entry,
        1
    )
    
    minds_html_path.write_text(minds_html)
    print("✓ Updated 14minds.html")
    
    # 3. Git commit and push
    try:
        subprocess.run(
            ["git", "-C", str(SITE_DIR), "add", f"reads/{slug}.html", "scanner.html", "14minds.html"],
            check=True, capture_output=True
        )
        
        commit_msg = f"Scanner #{symbol} - {stats['verdict']} dominant @ {timestamp}\n\n{stats['responded']}/14 responded, {stats['offline']} offline\n{stats['buy']} BUY, {stats['hold']} HOLD, {stats['sell']} SELL"
        
        subprocess.run(
            ["git", "-C", str(SITE_DIR), "commit", "-m", commit_msg],
            check=True, capture_output=True
        )
        
        subprocess.run(
            ["git", "-C", str(SITE_DIR), "push", "origin", "main"],
            check=True, capture_output=True
        )
        
        print("✓ Git push complete")
        
        # Verify deployment
        time.sleep(5)
        try:
            req = urllib.request.Request(f"https://lexispawn.xyz/reads/{slug}.html")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    print("✓ Verified: page live at lexispawn.xyz")
                else:
                    print(f"⚠ Warning: page returned status {resp.status}")
        except Exception as e:
            print(f"⚠ Warning: could not verify deployment: {e}")
    
    except subprocess.CalledProcessError as e:
        print(f"✗ Git operation failed: {e}")
        print(f"  stdout: {e.stdout.decode() if e.stdout else 'none'}")
        print(f"  stderr: {e.stderr.decode() if e.stderr else 'none'}")

def is_scanworthy(token_data: dict) -> tuple:
    """
    Check if token is worth scanning - return (bool, reason_if_rejected)
    
    Token selection rules:
    - REJECT if 24h change > +1000% (obvious pump, all models will say SELL)
    - REJECT if 24h change < -80% (obvious dump, all models will say SELL)
    - ACCEPT tokens with AMBIGUOUS signals where models will disagree
    
    The edge is in disagreement, not obvious situations.
    """
    
    change = token_data.get("change", 0)
    
    if change > 1000:
        return (False, f"Rejected: +{change:.0f}% pump is obvious. Every model will say SELL. No edge in scanning the obvious.")
    
    if change < -80:
        return (False, f"Rejected: {change:.0f}% dump is obvious. Every model will say SELL. No edge in scanning the obvious.")
    
    # Ideal targets (but not strict filters):
    # - Moderate movement (20-200%) with mixed activity
    # - Flat price but unusual volume
    # - New token with real liquidity forming
    # - Divergence between price and on-chain activity
    
    return (True, "Scanworthy")

def run_scan(ca: str, post=False):
    print(f"14MINDS UNIFIED SCANNER")
    print(f"CA: {ca}\n")
    
    # 1. Fetch token data
    token = fetch_token(ca)
    token["ca"] = ca  # Store CA for track record
    print(f"Token: {token['symbol']} @ ${token['price']} ({token['change']:+.2f}%)")
    print(f"MCap: ${token['mcap']:,.0f} | Volume: ${token['volume']:,.0f}\n")
    
    # 2. Check if scanworthy
    scanworthy, reason = is_scanworthy(token)
    if not scanworthy:
        print(f"⚠ {reason}")
        if not post:
            print("Dry run - stopping here")
            return None
        else:
            print("--post flag passed but token rejected. Aborting.")
            sys.exit(1)
    
    # 3. Query all 14 models
    prompt = f"""${token['symbol']} token data:
- Price: ${token['price']}
- 24h Change: {token['change']}%
- 24h Volume: ${token['volume']:,.0f}
- Liquidity: ${token['liquidity']:,.0f}
- Market Cap: ${token['mcap']:,.0f}

Give a one-word verdict: BUY, SELL, or HOLD.
Then explain in max 10 words why.
Format: VERDICT - reason"""

    print("Querying 14 models...")
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(query_model, mid, mname, prompt): mname for mid, mname, _, _ in MODELS}
        for future in as_completed(futures, timeout=90):
            try:
                result = future.result()
                status = "✓" if result["success"] else "✗"
                preview = result["response"][:40] if result["response"] else "offline"
                print(f"  {status} {result['model']}: {preview}")
                results.append(result)
            except Exception as e:
                model_name = futures[future]
                print(f"  ✗ {model_name}: timeout/error")
                results.append({"model": model_name, "response": None, "success": False})
    
    # 4. Generate arena page
    slug = token["symbol"].lower().replace("$", "")
    output_path = READS_DIR / f"{slug}.html"
    stats = generate_arena_page(token, results, output_path)
    
    print(f"\n=== 14 MINDS VERDICT ===")
    print(f"Responded: {stats['responded']}/14")
    print(f"Offline: {stats['offline']}/14")
    print(f"BUY: {stats['buy']} | HOLD: {stats['hold']} | SELL: {stats['sell']}")
    print(f"Dominant: {stats['verdict']}")
    
    if not post:
        print("\nDRY RUN - stopping before visual capture/post")
        return {
            "token": token,
            "stats": stats,
            "output": str(output_path)
        }
    
    # 5. Capture animated visual
    gif_path = capture_animated_visual(slug, output_path)
    
    # 6. Verification gate
    if not verify_before_post(output_path, gif_path, token["symbol"]):
        print("\n✗ VERIFICATION FAILED - ABORTING POST")
        return None
    
    # 7. Post
    html_url = f"https://lexispawn.xyz/reads/{slug}.html"
    conviction = post_scan(token, stats, results, gif_path, html_url)
    stats["conviction"] = conviction
    
    # 8. Track record integration
    update_track_record(token, stats, slug, stats["timestamp"])
    
    print("\n✓ SCAN COMPLETE")
    return {
        "token": token,
        "stats": stats,
        "output": str(output_path),
        "gif": str(gif_path)
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scanner-unified.py <contract_address> [--post]")
        sys.exit(1)
    
    ca = sys.argv[1]
    post_flag = "--post" in sys.argv
    
    run_scan(ca, post=post_flag)
