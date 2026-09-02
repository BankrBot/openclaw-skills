# bankr-um-radar-app — supplementary detail

When a user posts an event collage/group photo and tags @bankrbot with "$UM-Radar scan [event_name]":

1. **Download the image** — Extract the image URL from the X post. Download it to processing pipeline.

2. **Call Zo Computer HTTP API** — Send the image to Zo's portrait extraction pipeline:
   ```
   POST https://alexdolbun.zo.space/api/um-radar/event
   Content-Type: application/json
   {
     "image_url": "https://pbs.twimg.com/media/...",
     "event_name": "user-provided-event-name",
     "x_post_url": "original X post URL",
     "api_key": "your-zo-api-key"
   }
   ```

3. **Zo's pipeline** (runs automatically on Zo Computer):
   - Downloads image with proper X/Twitter User-Agent
   - Runs OpenCV DNN face detection (haarcascade_frontalface)
   - Clips tight square portraits around each face
   - Runs Tesseract OCR on text regions near faces
   - Matches detected names against known database (BankrBot team, UnicornsMap profiles)
   - Generates commercial profiles in um-radar-data.json
   - Creates UnicornsMap.com pages: /person/{slug} and /events/{slug}

4. **Reply to X user** with:
   ```
   📸 $UM-Radar Event Scan Complete

   Event: {event_name}
   Profiles extracted: {count} people
   Event brochure: https://unicornsmap.com/events/{event_slug}
   
   👤 Notable profiles found:
   • {name1} → https://unicornsmap.com/person/{slug1}
   • {name2} → https://unicornsmap.com/person/{slug2}
   • {name3} → https://unicornsmap.com/person/{slug3}
   
   💰 Unlock full dossiers (5 USDC in $UM): tag @bankrbot "$UM-Radar deep @handle"
   🏦 Join #BNKRCLUB: https://bankr.bot/terminal?refCode=RN982CZZ-BNKR
   ```

## COMMAND 2: $UM-Radar whois @handle

When tagged with "$UM-Radar whois @handle":

1. **Search central database** — Query `GET https://alexdolbun.zo.space/api/um-radar` for profiles matching the X handle.

2. **If profile exists**, reply:
   ```
   👤 @{handle} — Profile Found on UnicornsMap.com
   
   Name: {name}
   Organization: {organization}  
   Profile: https://unicornsmap.com/person/{slug}
   
   📡 This profile is tracked by Prometheus v30 spy map
   ⚡ Deep scan (5 USDC in $UM): tag "$UM-Radar deep @{handle}"
   ```

3. **If profile not found**, reply:
   ```
   🔍 @{handle} — Not Yet in $UM-Radar
   
   This profile hasn't been mapped yet. To add them:
   • If you have an event photo with them: tag @bankrbot "$UM-Radar scan"
   • For individual deep scan: tag "$UM-Radar deep @{handle}" (5 USDC in $UM)
   
   🏦 Join #BNKRCLUB for priority scanning: https://bankr.bot/terminal?refCode=RN982CZZ-BNKR
   ```

## COMMAND 3: $UM-Radar deep @handle (x402 PAID)

When tagged with "$UM-Radar deep @handle" and the user has paid 5 USDC in $UM via x402:

1. **Verify payment** — Check x402 settlement on Base chain for 5 USDC equivalent in $UM token to the UnicornsMap.com settlement address.

2. **Full OSINT scan** — Run comprehensive profile enrichment:
   - Fetch all available X timeline tweets (up to 3200)
   - Extract creation geo, app origin, join date
   - Count monthly tweet/reply activity (12-month table)
   - Detect username changes
   - Analyze follower/following ratio
   - Generate risk flags and HNWI classification

3. **Generate enriched profile** — Create full HNWI commercial profile with:
   - Professional background synthesis
   - Network graph connections
   - Investment signals
   - Liquidity event predictions
   - x402 premium data tier access

4. **Store and deploy** — Save to um-radar-data.json, create UnicornsMap.com page.

5. **Reply**:
   ```
   ⚡ x402 Deep Scan Complete — $UM Settled
   
   @{handle}: Full HNWI Dossier Ready
   Profile: https://unicornsmap.com/person/{slug}
   
   📊 Risk Flags: {count}
   💼 Commercial Classification: {hnwi_tier}
   🔗 Connected Events: {event_count}
   
   📡 Now tracked by Prometheus v30 spy map
   🏦 #BNKRCLUB members get priority signal alerts
   ```

## COMMAND 6: $UM-Radar profile @handle <facts> (FREE — add/update a profile from a tweet)

When a user tags with natural-language "explain <X> and add it into @<handle>'s profile on UnicornsMap.com $UM-Radar" (or `$UM-Radar profile @handle <facts>`):

1. Resolve the person handle (@EvgenyGaevoy) → name slug `evgeny-gaevoy`.
2. Extract the commercial / hidden-future-alpha facts from the tweet (vault-curation standard + live APY/TVL, fund AUM, protocol, IPO track, corridor) into `desc` (+ the structured `alpha` block when rich).
3. Call the **one-call Profile endpoint** — it resolves the GIS pin, mirrors to whois, and makes the page live instantly (no worker redeploy):
   ```
   POST https://alexdolbun.zo.space/api/um-radar/profile
   x-um-key: {UM_PIPELINE_KEY}   (only if that secret is set)
   { "name":"Evgeny Gaevoy","handle":"EvgenyGaevoy","title":"...","city":"London, UK",
     "desc":"<fresh alpha>","alpha":{...},"x":"https://x.com/...","nonUSDRadar":{...},"x402Price":4.99,"event":"..." }
   ```
4. **Wait for GIS OSINT magic**: check `gis_status` in the response (`pinned`, `entity_resolved`, `locales`, `currencies`). Once `pinned:true`, the multilingual/multicurrency hreflang + JSON-LD are live on the UnicornsMap.com edge.
5. Reply with the profile URL + stored facts + non-USD / GIS OSINT note.

## API ENDPOINTS (Zo Computer ←→ Bankr.bot) — additions
- **Canonical one-call profile + GIS OSINT write:** `POST https://alexdolbun.zo.space/api/um-radar/profile` (geo-resolves, whois-mirrors, returns `gis_status`).
- Profile registry upsert (fallback / registry-only): `POST https://alexdolbun.zo.space/api/investor-registry`.
- Profile lookup: `GET https://alexdolbun.zo.space/api/investor-registry?slug=<slug>` / `?handle=<h>`.
- Whois lookup: `GET https://alexdolbun.zo.space/api/um-radar?handle=<h>`.

## API ENDPOINTS (Zo Computer ←→ Bankr.bot)

### Zo → Bankr (price feed)
```
GET https://api.bankr.bot/agent/portfolio?tokens=UM,BNKR,BTC,ETH,SOL
Header: X-API-Key: {BANKR_TOKEN}
```
Used by Prometheus agent every 60 min to update live prices.

### Bankr → Zo (event pipeline)
```
POST https://alexdolbun.zo.space/api/um-radar/event
Content-Type: application/json
{
  "image_url": "...",
  "event_name": "...",
  "x_post_url": "..."
}
```

### Bankr → Zo (profile lookup)
```
GET https://alexdolbun.zo.space/api/um-radar?handle={handle}
```

## CACHING STRATEGY
- X images: hard-cache to /home/workspace/event_brochures/incoming/
- Extracted portraits: hard-cache to /home/workspace/event_brochures/processed/{event_slug}/portraits/
- Central profiles: um-radar-data.json (30+ min TTL for Prometheus, instant for x402 scans)
- NEVER re-download an image that exists in cache
- NEVER re-extract portraits that exist in cache

## ERROR HANDLING
- If image download fails (X blocks): reply "📸 Image download blocked by X. Please DM the image to @bankrbot."
- If face detection finds < 2 faces: reply "🔍 Only {count} face(s) detected. Is this an event collage? Try a higher resolution image."
- If x402 payment not verified: reply "⚡ Payment not confirmed. Send 5 USDC in $UM via x402 to scan @{handle}."
- If Zo API unavailable: reply "🔄 $UM-Radar backend is processing. Check back in 2 minutes."
```

---

## Zo HTTP API Endpoints (already deployed)

These are the API routes that Bankr.bot calls. They already exist on `alexdolbun.zo.space`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/um-radar` | GET | Return full central data: profiles, signals, prices |
| `/api/um-radar/event` | POST | Submit event image for portrait pipeline |
| `/api/um-radar?handle=X` | GET | Lookup profile by X handle |

## Prometheus Agent (60-min recurring)

The Prometheus agent on Zo Computer runs every 60 minutes and:
1. Fetches fresh unicorn/IPO signals
2. Gets live Bankr prices via Bankr REST API
3. Updates `um-radar-data.json`
4. Updates both Prometheus spy maps (zo.space + UnicornsMap.com)
5. Updates all UnicornsMap.com person pages with fresh signal data

The Bankr App can also **trigger** a Prometheus refresh by calling:
```
POST https://alexdolbun.zo.space/api/um-radar/trigger-prometheus
```


---

## COMMAND 4 / 5 — COMMERCIAL SEO PRODUCT + BACKLINK PACK (x402, $UM)

### x402 Purchase Request (AI agents and users both use this)
```http
POST https://alexdolbun.zo.space/api/x402/pay
Content-Type: application/json
x402-accept: application/json
# AI agents: pass their auth token to buy programmatically
# Authorization: Bearer <token>

{
  "investorSlug": "person-slug",         // who the profile is for
  "amount": "4.99",                       // USD
  "currency": "USDC",                     // settled -> $UM on Base
  "affiliateCode": "RN982CZZ-BNKR",
  "product": "seo_profile",               // or "backlink" | "alpha_feed"
  "backlink_url": "https://client-website.com",
  "locales": ["en","ar","ru","zh","es"],  // desired localizations (default full set)
  "holder_address": "0x..."               // optional: enables holder-gating (>=100M $UM -> free)
}
```

Response `status: "x402_ready"` + `paymentUrl` (Bankr.bot terminal) + `sessionId`. On confirmed settlement, the pipeline:
1. Creates/reconciles `/person/{slug}` + `/company/{org-slug}` commercial profiles,
2. Localizes content across 20+ locales with multicurrency pricing + hreflang + schema.org JSON-LD,
3. Geo-pins HQ / LPs / SWFs / VCs / family office connections on the GIS OSINT map,
4. Tags arrival + verification links (do-follow) to the client's `backlink_url` on every page,

### Holder-Gating (price optimization)
- Balance >= 100,000,000 $UM (1e8 tokens, 18 decimals): profile + backlinks **free** (x402 waived).
- Balance >= 10,000,000 $UM: 50% discount per scan.
- Otherwise ~$4.99/scan or $0.99/backlink (floor above chain commission so we never operate at a loss).

### Supported x402 callers
- **Consumers**: tag @bankrbot on X → `$UM-Radar promote @handle` (paid in $UM/USDC).
- **HNWI / paid tiers**: `$UM-Radar deep @handle` (existing) and `$UM-Radar alpha @handle` ($99/mo feed).
- **AI agents**: POST `/api/x402/pay` with `x402-accept`/`Authorization`; get link set as JSON.

### Settlement
- `$UM` token: 0x909851A8598f560F2F3B68Bb949D836E7dbb5e93 (Base), 18 decimals.
- USD amounts convert to $UM at live Bankr price; holding large $UM lowers or waives cost, boosting token demand and LP liquidity.

---

## BANKR-AGENT-DELIVERED: 4 app scripts + X execution chain (2026-08-21)

Apply via update_app manifest `publicScripts: ["scanSwarm","queryOSINT","uploadAlpha","fetchDexMetrics"]`.

**SCRIPT 1 — scanSwarm(imageUrl, eventName, xPostUrl)**
```typescript
const imageUrl = args.imageUrl || args.image_url || "";
const eventName = args.eventName || args.event_name || "";
const xPostUrl = args.xPostUrl || args.x_post_url || "";
if (!imageUrl || !eventName) return { success:false, error:"both imageUrl and eventName are required" };
try {
  const payload = { image_url: imageUrl, event_name: eventName, x_post_url: xPostUrl };
  const res = await http.fetch("https://alexdolbun.zo.space/api/um-radar/event", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  if (res && typeof res === "object") return {
    success: true,
    event_slug: res.event_slug || res.slug || null,
    event_page: res.event_page || res.url || (res.event_slug ? `https://unicornsmap.com/events/${res.event_slug}` : null),
    status: res.status || "queued", raw: res
  };
  return { success:false, error:"invalid response from swarm endpoint", raw: res };
} catch (err) { return { success:false, error: err&&err.message?err.message:String(err) }; }
```

**SCRIPT 2 — queryOSINT(handle)**
```typescript
const handle = (args&&args.handle?String(args.handle):"").replace(/^@/,"").trim();
if (!handle) return { found:false, error:"handle is required" };
try {
  const url = `https://alexdolbun.zo.space/api/um-radar?handle=${encodeURIComponent(handle)}`;
  const res = await http.fetch(url);
  if (!res || typeof res !== "object") return { found:false, handle, error:"invalid response" };
  if (res.found === false || (!res.profile && !res.name && !res.display_name)) return { found:false, handle };
  const profile = res.profile || res;
  const name = profile.name || profile.display_name || null;
  const organization = profile.organization || profile.org || profile.company || null;
  const unicornsmapUrl = res.unicornsmap_url || profile.unicornsmap_url || `https://unicornsmap.com/p/${handle}`;
  return { found:true, handle, profile:{ name, organization }, name, organization, unicornsmap_url: unicornsmapUrl };
} catch (err) { return { found:false, handle, error: err&&err.message?err.message:String(err) }; }
```

**SCRIPT 3 — uploadAlpha(payload) → x402 $UM settlement**
```typescript
const payload = args&&args.payload?args.payload:args;
const receiver = "0x211D91beD006f7bB3Eaf97496260a8F905298Cea";
const token = "0x909851A8598f560F2F3B68Bb949D836E7dbb5e93"; // $UM on Base
const maxPaymentUsd = 5.0;
if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) return { success:false, error:"alpha payload is required" };
try {
  const endpointUrl = "https://alexdolbun.zo.space/api/x402/alpha-upload";
  const res = await http.fetch(endpointUrl, {
    method: "POST", headers: { "content-type":"application/json","x-x402-token":token,"x-x402-receiver":receiver,"x-x402-max-payment-usd":String(maxPaymentUsd) },
    body: JSON.stringify({ payload, token, receiver, network:"base", maxPaymentUsd })
  });
  const receipt = (res&&res.receipt)||res||{};
  return { success:true, tokenAddress:token, receiverAddress:receiver, settlementToken:"$UM", chain:"base", maxPaymentUsd, x402Accept:true,
    receipt:{ txHash: receipt.txHash||receipt.transactionHash||null, paymentId: receipt.paymentId||receipt.id||null, settledAt: receipt.settledAt||new Date().toISOString(), raw: res } };
} catch (err) { return { success:false, error: err&&err.message?err.message:String(err) }; }
```

**SCRIPT 4 — fetchDexMetrics()**
```typescript
try {
  const tokenAddress = "0x909851A8598f560F2F3B68Bb949D836E7dbb5e93";
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const res = await http.fetch(url);
  const pairs = res && Array.isArray(res.pairs) ? res.pairs : [];
  const basePair = pairs.find((p)=>(p.chainId||"").toLowerCase()==="base") || pairs[0] || {};
  const priceUsd = basePair.priceUsd ? Number(basePair.priceUsd) : (basePair.priceNative ? Number(basePair.priceNative) : 0);
  const liquidityUsd = basePair.liquidity && typeof basePair.liquidity.usd==="number" ? basePair.liquidity.usd : 0;
  const volume24h = basePair.volume && typeof basePair.volume.h24==="number" ? basePair.volume.h24 : 0;
  return { success:true, tokenAddress, chainId:"base", priceUsd, liquidityUsd, volume24h, pairAddress: basePair.pairAddress||null, timestampUtc: new Date().toISOString() };
} catch (err) { return { success:false, error: err&&err.message?err.message:String(err), timestampUtc:new Date().toISOString() }; }
```

### X mention → reply execution chain
1. Webhook `https://alexdolbun.zo.space/api/x402/x-mention` ingests `{"tweet_id","author_handle","text":"$UM-Radar scan <img> <evt>","media_urls":["<img>"],"x_post_url"}`.
2. Parse intent → imageUrl, eventName, xPostUrl.
3. Run SCRIPT 1 `scanSwarm` → `POST /api/um-radar/event`.
4. `um-radar/event` queues pipeline → returns `{event_slug, event_page, status:"queued"}`.
5. Bot posts in-thread reply to tweet_id with the `event_page` URL.

### GAP FLAGGED (needs build on our side)
SCRIPT 3 calls `https://alexdolbun.zo.space/api/x402/alpha-upload` — this endpoint does NOT exist yet on zo.space. Must be created to make uploadAlpha fully functional (it wraps the $UM x402 handshake to the receiver wallet).
