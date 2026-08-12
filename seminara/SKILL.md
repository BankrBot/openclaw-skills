---
name: seminara
description: Create AI-hosted live sessions from PDF slides. Aura presents, answers questions, and engages your audience — hands free.
homepage: https://seminara.online
---

# Seminara — AI-Hosted Live Sessions

You can create live presentation sessions on Seminara. You provide a title (and optionally a PDF deck URL), and Aura — the AI host — will present it to your audience with real-time voice, Q&A, and engagement tracking.

## Setup

Your human needs a Seminara API key. They can generate one at:
**https://seminara.online/settings → API Keys**

Store it as an environment variable:
```
SEMINARA_API_KEY=sk_live_xxxxx
```

## When to Use This Skill

Use this when the user asks to:
- Create a presentation, session, or webinar
- Host a live session with AI
- Present slides to an audience
- Schedule an automated presentation

## Commands

### Create a Session

```bash
curl -s -X POST https://seminara.online/api/openclaw/create-session \
  -H "Authorization: Bearer $SEMINARA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "<title>", "slides_url": "<optional_pdf_url>"}'
```

The response contains:
- `join_url` — Share this with attendees
- `host_url` — The live session control panel
- `setup_url` — Upload slides and configure the session

After creating a session, tell the user:
1. Share the `join_url` with their audience
2. Visit `setup_url` to upload slides if they didn't provide a `slides_url`
3. Go to `host_url` when ready to start the live session

### Check Seminara Status

```bash
curl -s https://seminara.online/api/openclaw/status
```

Use this to verify Seminara is reachable before creating a session.
