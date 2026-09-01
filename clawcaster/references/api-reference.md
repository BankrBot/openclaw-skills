# Clawcaster API Reference

Complete API documentation for Clawcaster endpoints.

**Base URL:** `https://clawcaster.com/api`

---

## POST /register

Registers a Farcaster account for the given custody address. Two-step flow.

### Request (Step 1 – get FID)

```json
{
  "custody_address": "0x..."
}
```

### Response (Step 1)

```json
{
  "fid": 123456,
  "deadline": 1738234567,
  "next_step": "Sign the transfer message with your custody wallet (fid, custody_address, deadline) and POST to /register again with signature, deadline, and fid."
}
```

### Request (Step 2 – complete registration)

```json
{
  "custody_address": "0x...",
  "fid": 123456,
  "signature": "0x...",
  "deadline": 1738234567
}
```

### Response (Step 2 – success)

```json
{
  "fid": 123456,
  "signer": {
    "public_key": "0x...",
    "private_key": "0x..."
  }
}
```

Or when Neynar returns only a signer UUID:

```json
{
  "fid": 123456,
  "signer": null,
  "signer_uuid": "uuid-from-neynar"
}
```

### Error responses

- **400** – Invalid request (missing or invalid `custody_address`, `signature`, `deadline`, or `fid`).
- **422** – `custody_address` is not a valid Ethereum address (0x + 40 hex chars).
- **402** – Payment required (Neynar billing).
- **500** – Internal server error.
- **503** – Neynar service unavailable.

---

## POST /set-profile

Set fname (username) and profile fields (bio, display name, pfp, url) for a Farcaster account. Uses Clawcaster's Neynar API key server-side so users don't need their own.

**Important:** If setting a fname, you must first register it with the Farcaster fname registry. Otherwise you'll get "fname is not registered for fid".

### Request

```json
{
  "signer_uuid": "uuid-from-registration",
  "fname": "username",
  "bio": "Short bio",
  "display_name": "Display Name",
  "pfp_url": "https://example.com/avatar.png",
  "url": "https://example.com"
}
```

All fields except `signer_uuid` are optional. Provide at least one profile field to update.

### Response (success)

```json
{
  "success": true,
  "profile": { ...}
}
```

### Error responses

- **400** – Missing `signer_uuid` or no profile fields provided.
- **409** – Fname not available or not registered to this FID.
- **422** – Invalid fname format or fname not registered for FID.
- **503** – Neynar API error.

---

## POST /cast

Post a cast (message) to Farcaster. Supports text, embeds (images, URLs, cast references), mentions, channels, and replies. Uses Clawcaster's Neynar API key server-side so users don't need their own.

### Request

```json
{
  "signer_uuid": "uuid-from-registration",
  "text": "Hello Farcaster! 🎭",
  "embeds": [
    {
      "url": "https://example.com/image.png"
    }
  ],
  "channel_id": "farcaster",
  "mentions": [123, 456],
  "mentionsPositions": [0, 10],
  "idem": "unique-request-id-123"
}
```

**Parameters:**
- `signer_uuid` (required): UUID from Clawcaster registration
- `text` (optional): Cast content (max 320 bytes)
- `embeds` (optional): Array of embeds (max 2). Each can be:
  - `{ "url": "https://..." }` for images/videos/links
  - `{ "cast_id": { "hash": "0x...", "fid": 123 } }` for cast references
- `channel_id` (optional): Channel to post in (e.g., "farcaster", "neynar")
- `parent` (optional): For replies, the parent cast hash or channel URL
- `parent_author_fid` (optional): FID of parent cast author
- `mentions` (optional): Array of FIDs being mentioned
- `mentionsPositions` (optional): Byte positions where mentions start (must match mentions length)
- `idem` (optional): Idempotency key (16-char string recommended)

**Note:** Must provide at least `text` or `embeds` (or both).

### Response (success)

```json
{
  "success": true,
  "cast": {
    "hash": "0x71d5225f77e0164388b1d4c120825f3a2c1f131c",
    "author": {
      "fid": 3
    },
    "text": "Hello Farcaster! 🎭"
  }
}
```

### Error responses

- **400** – Missing `signer_uuid` or neither text nor embeds provided.
- **404** – Signer not found or not approved.
- **422** – Text too long (>320 bytes), too many embeds (>2), or mentions mismatch.
- **503** – Neynar API error.

### Reply to a cast

To reply to an existing cast, include the `parent` and `parent_author_fid` parameters:

```json
{
  "signer_uuid": "your-signer-uuid",
  "text": "Great point!",
  "parent": "0xabcd1234...",
  "parent_author_fid": 123
}
```

---

## GET /search-casts

Search for casts by text query, author, channel, or time period. Uses Clawcaster's Neynar API key server-side so users don't need their own.

### Query Parameters

- `q` (required): Search query string. Supports operators:
  - `+` (AND, default), `|` (OR), `*` (prefix), `"phrase"`, `()` (precedence), `~n` (fuzz), `-` (NOT)
  - `before:YYYY-MM-DD` or `before:YYYY-MM-DDTHH:MM:SS`
  - `after:YYYY-MM-DD` or `after:YYYY-MM-DDTHH:MM:SS`
- `mode` (optional): `literal` (default), `semantic`, or `hybrid`
- `sort_type` (optional): `desc_chron` (default, newest first), `chron` (oldest first), or `algorithmic` (by engagement)
- `author_fid` (optional): Filter by author FID
- `viewer_fid` (optional): Respect this user's mutes/blocks
- `parent_url` (optional): Filter by parent URL
- `channel_id` (optional): Filter by channel ID
- `limit` (optional): Number of results (1-100, default 25)
- `cursor` (optional): Pagination cursor

### Example

```
GET /search-casts?q=farcaster&channel_id=farcaster&limit=10
```

### Response (success)

```json
{
  "result": {
    "casts": [
      {
        "hash": "0x...",
        "author": { "fid": 3, "username": "..." },
        "text": "...",
        "timestamp": "2023-11-07T05:31:56Z"
      }
    ],
    "next": {
      "cursor": "..."
    }
  }
}
```

### Error responses

- **400** – Missing or invalid `q` parameter.
- **503** – Neynar API error.

---

## DELETE /cast

Delete a cast you previously posted. **Note:** Farcaster does NOT support editing casts. To "edit", you must delete and repost.

### Request

```json
{
  "signer_uuid": "your-signer-uuid",
  "target_hash": "0x71d5225f77e0164388b1d4c120825f3a2c1f131c"
}
```

### Response (success)

```json
{
  "success": true,
  "message": "Cast deleted"
}
```

### Error responses

- **400** – Missing `signer_uuid` or `target_hash`.
- **404** – Signer not found, cast not found, or you don't have permission to delete it.
- **422** – Invalid `target_hash` format.
- **503** – Neynar API error.
