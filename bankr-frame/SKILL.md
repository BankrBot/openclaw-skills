---
name: bankr-frame
description: Frame digital content into Bankr Frame collectibles on Robinhood Chain. Use when a user asks to frame an X post, X thread, image, video, audio, artwork, document, file, URL, or when @bankrbot is tagged on X timeline or replies.
---

# Bankr Frame

Bankr Frame is a universal digital-content collectible system.

The user-facing action is always called **Frame**.

The canonical product is:

* Product: Bankr Frame
* Collection: Bankr Frame
* Symbol: FRAME
* Primary network: Robinhood Chain
* Mainnet chain ID: 4663

## Core rule

All Frames belong to ONE canonical Bankr Frame collection.

Never create a new collection for an individual Frame, user, tweet, image, video, thread, or media item.

The canonical collection must be configured before any Frame is created.

If the collection is not configured, do not silently deploy another collection.

---

# User Commands & X Mentions Trigger

The primary user-facing command is:

`frame`

Never require the user to say `mint`.

Supported commands include:

* `frame this`
* `frame this tweet`
* `frame this thread`
* `frame this image`
* `frame this video`
* `frame this audio`
* `frame this artwork`
* `frame this file`
* `frame this URL`

## X Timeline & Tag Integration (@bankrbot)

Bankr Frame monitors X mentions and timeline triggers for `@bankrbot`.

Triggers include:
* Mentioning `@bankrbot frame this` or `@bankrbot frame` on any X post, reply, or quote tweet.
* Tagging `@bankrbot` under an X thread or media post to trigger automatic framing for that content.
* Timeline monitoring where `@bankrbot` is tagged with framing intent.

When `@bankrbot` is tagged on X:
1. Extract the target X post ID, author, media, and text.
2. Resolve provenance and build Frame metadata.
3. Prepare the frame collectible on Robinhood Chain.

---

# Universal Frame

When the user says `frame this` or tags `@bankrbot` with framing intent:

Inspect the current context and identify the digital content.

Supported sources include:

* X posts & mentions
* X threads
* images
* videos
* audio
* GIFs
* artwork
* documents
* digital files
* supported public URLs

Select the appropriate workflow automatically.

If the content cannot be identified reliably, ask the user to provide the content or URL.

---

# X Frame

Support:

`frame this tweet`

`frame this thread`

`frame this tweet as "TITLE"`

When framing X content (via direct command or `@bankrbot` tag), preserve provenance whenever available:

* original X URL
* X post ID
* author handle
* author display name
* publication timestamp
* original text
* referenced media
* media type

Do not fabricate provenance.

Do not claim ownership of third-party content merely because it was Framed.

The original source must remain identifiable in the resulting metadata.

---

# Media Frame

Support:

* image
* video
* audio
* GIF
* artwork
* document
* supported digital file

The original media should remain the primary artwork/media of the Frame.

Do not replace the original content with the Bankr Frame collection logo.

The Bankr Frame logo is collection branding.

---

# Canonical Collection

Every Frame must use the configured Bankr Frame collection.

Collection:

Bankr Frame

Symbol:

FRAME

The collection is persistent.

Do not create another collection unless the project owner explicitly changes the canonical collection configuration.

---

# Metadata

Each Frame must contain structured metadata.

Minimum fields:

* name
* description
* media URI
* creator
* source
* source URL when available
* content type
* Frame timestamp

For X content, include when available:

* x_url
* x_post_id
* x_author
* x_published_at

Preserve the original source relationship.

Never fabricate missing information.

---

# Frame Creation Workflow

Follow this sequence:

1. Identify the content (from chat context or `@bankrbot` X tag).
2. Identify the source.
3. Validate that the content can be Framed.
4. Preserve source information.
5. Prepare the original media.
6. Create metadata.
7. Resolve the canonical Bankr Frame collection.
8. Resolve the creator wallet.
9. Prepare the blockchain transaction.
10. Show a concise transaction preview.
11. Obtain user confirmation before an irreversible transaction unless an explicitly authorized execution mode applies.
12. Execute using the approved Bankr blockchain mechanism.
13. Wait for blockchain confirmation.
14. Verify the resulting token.
15. Return the confirmed result.

Never claim that a Frame exists merely because a transaction was submitted.

---

# Editions

Default:

`frame this`

creates one unique collectible when supported by the configured contract.

Support explicit editions when the contract supports them:

* `frame this 1/1`
* `frame this 10 editions`
* `frame this 100 editions`

Never report an edition as created until the transaction is confirmed onchain.

---

# Creator Earnings

Bankr Frame must support creator earnings through the canonical collection/contract where technically supported.

The configuration must identify:

* creator earnings recipient
* fee percentage or basis points
* enforcement mechanism

Never claim that royalties are guaranteed across every marketplace.

Marketplace enforcement depends on the marketplace and NFT contract mechanism.

---

# OpenSea & Explorers

Bankr Frame uses standard EVM NFT metadata on Robinhood Chain (Chain ID: 4663).

Never fabricate an OpenSea collection or item URL.

After confirmed creation, return:

* collection name
* symbol
* token ID
* contract address
* transaction hash
* blockchain explorer reference when available
* marketplace reference only when confirmed/indexed

---

# Robinhood Chain

Production network:

Robinhood Chain

Chain ID:

4663

Native gas asset:

ETH

Use the configured production RPC/provider.

---

# Security

Never request seed phrases, private keys, wallet passwords, or API secrets.

---

# Successful Frame

After blockchain confirmation, respond:

🖼️ **Frame created**

Collection: Bankr Frame
Symbol: FRAME
Network: Robinhood Chain
Token ID: [token ID]
Contract: [contract address]
Transaction: [transaction hash]

Only provide a marketplace link when the marketplace has actually indexed the item.
