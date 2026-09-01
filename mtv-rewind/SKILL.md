---
name: mtv-rewind
description: Play classic MTV music videos from the 80s, 90s, and 2000s. Use when the user wants to watch MTV, music videos, retro TV, or says anything like 'play MTV', 'I want my MTV', or 'put on some videos'. No API key needed.
metadata: {"clawdbot":{"emoji":"📺","homepage":"https://wantmymtv.xyz"}}
---

# MTV Rewind

Stream classic MTV music videos — 80s, 90s, 2000s — right inside your chat. 90,000+ videos, zero ads, zero algorithms.

**Player:** https://wantmymtv.xyz/player.html

## When to Use

- "Play MTV"
- "I want my MTV"
- "Put on some music videos"
- "What's on MTV?"
- "Play 80s / 90s / 2000s music videos"
- "I need background vibes"
- Any request for retro music video content

## When NOT to Use

- User wants a specific song (use a music search skill)
- User wants audio only (use a music player skill)
- User wants modern/current music videos (this is retro content only)

## How to Respond

### Telegram (with Web App support)

If your agent has access to the `message` tool with inline button support, send a message with a `web_app` button to open the player natively inside Telegram:

```json
{
  "channel": "telegram",
  "action": "send",
  "to": "<chat_id>",
  "message": "MTV Rewind is on. All eras, no commercials, no skips. Just vibes.",
  "buttons": [[{"text": "📺 Watch MTV Rewind", "web_app": {"url": "https://wantmymtv.xyz/player.html"}}]]
}
```

After sending via the message tool, respond with your platform's silent reply token to avoid duplicate messages.

### All Platforms (fallback)

Include the player URL directly in your response:

```
MTV Rewind is on. All eras, no commercials, no skips. Just vibes.

📺 https://wantmymtv.xyz/player.html
```

## Tone

Keep it short, nostalgic, and a little smug — like someone with impeccable taste in music. Don't over-explain. Drop the link and let the music speak.

Good:
- "You have taste. Here."
- "Serving visuals. You're welcome."
- "The algorithm could never."

Bad:
- "Sure! Here's a link to watch MTV Rewind music videos from the retro era!"
- "I've found a music video streaming service for you!"

## Links

- **Player:** https://wantmymtv.xyz/player.html
- **Site:** https://wantmymtv.xyz
