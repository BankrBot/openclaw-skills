# Prompt Patterns for Multimodal Generation

Use these patterns when crafting prompts inside the `generate.sh` workflow or when calling x402 image endpoints via the bankr skill.

## PFP / Avatar Patterns

**Cyberpunk PFP**
```
cyberpunk [SUBJECT], neon city reflections, rain, holographic elements, detailed face, cinematic lighting, high contrast, 4k, sharp focus --aspect 1:1
```

**Meme Coin Style PFP**
```
cute but slightly unhinged [ANIMAL] wearing [ACCESSORY], bold outlines, vibrant meme colors, text space at bottom, high meme energy, simple background --aspect 1:1
```

## Meme Patterns

**Base Memecoin Meme**
```
[SUBJECT] reacting to [EVENT], classic meme format, bold white Impact font text at top and bottom, high contrast, internet culture, slightly absurd --aspect 16:9
```

## Banner / Marketing

**Launch Banner**
```
professional [PROJECT] banner, [THEME] aesthetic, modern typography space, high quality product photography style, clean composition, suitable for Twitter/X header and website hero --aspect 16:9
```

## General Quality Boosters (append these)

- `, highly detailed, intricate, sharp focus, professional photography`
- `, cinematic lighting, dramatic atmosphere`
- `, vibrant colors, perfect composition, award winning`
- `, 8k, ultra realistic / stylized as needed`

## Negative Prompts (good defaults)

```
blurry, lowres, deformed, ugly, bad anatomy, watermark, text, extra limbs, cropped, worst quality
```

## Aspect Ratio Quick Reference

- 1:1 — PFPs, square memes
- 16:9 — banners, Twitter headers, videos
- 9:16 — stories, mobile-first
- 3:2 or 2:3 — photography style

Always ask the user for preferred aspect ratio when not specified.
