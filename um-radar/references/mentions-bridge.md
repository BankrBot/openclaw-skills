# @bankrbot mentions bridge — Free/Basic tier (no X Pro)

## Why
X Account Activity API webhooks (push) require **Pro ($5,000/mo)**.
On Free/Basic you can only **poll** the mention timeline. If you don't pay for Pro,
use the polling bridge instead — it achieves the same end result (public
"$UM-Radar scan <image>" → automated reply) at zero cost.

## Flow
```
User tags @bankrbot "$UM-Radar scan <image_url>"
   → mention appears in @alexdolbun mentions timeline
   → poll_mentions.ts (Zo Automation, 60s) matches "$UM-Radar"
   → forwards event to https://alexdolbun.zo.space/api/x402/x-mention
   → webhook clips faces / OCR / GIS-maps via /api/um-radar/event
   → replies with UnicornsMap report URL (+ x402 paywall link)
```

## Secrets required (Zo Settings → Advanced)
- X_API_CONSUMER_KEY, X_API_CONSUMER_SECRET (already set)
- X_API_ACCESS_TOKEN, X_API_ACCESS_SECRET (generate via X App → Keys & Tokens, bot account)
- X_API_BEARER_TOKEN (X App → Bearer Token)
- X_USER_ID (numeric id of the polling bot account)
- UM_WEBHOOK=https://alexdolbun.zo.space/api/x402/x-mention

## Pro-path alternative (push webhook)
Already deployed at /api/x402/x-mention, CRC verified. Requires Pro to register
POST .../account_activity/all/:env/webhooks.json?url=... and subscriptions.json.
