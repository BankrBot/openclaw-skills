---
name: multimodal
description: Powerful executable scripts + workflows for image, meme, PFP, banner and visual generation via Bankr x402 + LLM gateway. Includes prompt engineering, discovery, and NFT minting flows using opensea/onchainkit. Ships real thin shell scripts the agent can execute.
tags: [image, meme, pfp, x402, generation, nft, grok-imagine, flux, prompt-engineering, creative, bankr]
version: 1.5
visibility: public
metadata:
  clawdbot:
    emoji: "🎨"
    homepage: "https://github.com/0xcalibrated/skills/tree/multimodal-skill/multimodal"
    requires:
      skills: ["bankr", "opensea", "onchainkit"]
      bins: ["bash", "curl", "jq"]
---

# Multimodal — AI Image, Meme & NFT Generation (Powerful Scripts)

**Skill name:** `multimodal`

This skill provides **real executable scripts** the agent can run. The scripts deliver strong prompt engineering, service discovery, and structured workflows that delegate actual generation and minting to the core `bankr` skill (x402 payments + LLM gateway) and NFT skills.

Ideal for token PFPs, memes, launch visuals, and on-chain minting.

## Capabilities

- High-quality prompt enhancement with style templates
- Text-to-image orchestration via best x402 endpoints (Grok Imagine, Flux, etc.)
- Meme generation with top/bottom text support
- Batch + creative variation generation
- Live discovery of visual x402 services
- Rich NFT metadata generation + minting workflows
- Full control over aspect ratio, quality, negative prompts

## Execution Model

The agent should **directly execute** these scripts:

| Script                        | Purpose                                           | Key Flags |
|-------------------------------|---------------------------------------------------|-----------|
| `scripts/generate.sh`         | Main orchestrator — best prompt + bankr command   | --prompt, --template, --aspect, --count, --variations |
| `scripts/enhance-prompt.sh`   | Standalone prompt rewriter (very powerful alone)  | --prompt, --template, --strength |
| `scripts/discover.sh`         | Find current visual x402 services (tries live)    | (none) |
| `scripts/mint.sh`             | Generate rich metadata + mint instructions        | --image, --name, --description, --royalty, --attributes |

## Recommended Workflow

1. (Optional) `enhance-prompt.sh` to turn a weak idea into a great prompt.
2. `generate.sh --prompt "..." --template cyberpunk --count 3 --variations`
3. Agent takes the output JSON/command and runs it through the `bankr` skill.
4. User reviews results.
5. `mint.sh` on any approved image (with traits, royalty, collection).

## Style Templates (generate.sh & enhance-prompt.sh)

`cyberpunk`, `meme`, `banner`, `pfp`, `logo`, `retro`, `abstract`, `general`

## Example Usage (Agent Executes These)

```bash
# Powerful one-liner
bash /skills/multimodal/scripts/generate.sh \
  --prompt "cyberpunk cat wearing sunglasses" \
  --template cyberpunk \
  --aspect 1:1 \
  --count 4 \
  --variations

# Standalone prompt engineering
bash /skills/multimodal/scripts/enhance-prompt.sh \
  -p "a cat" \
  -t cyberpunk \
  --strength high

# Discovery
bash /skills/multimodal/scripts/discover.sh

# Minting
bash /skills/multimodal/scripts/mint.sh \
  --image "https://.../result.png" \
  --name "CyberCat #042" \
  --description "Genesis PFP for $CATZ" \
  --royalty 5 \
  --attributes "Background:Neon,Expression:Smug"
```

## Best Practices

- Always get explicit confirmation before paid x402 calls or gas.
- Use `--variations` when the user is unsure.
- Prefer `enhance-prompt.sh` first for weak or vague user ideas.
- Combine with `bankr` for all wallet/x402 work and `opensea`/`onchainkit` for minting.

## Dependencies

- `bankr` skill (x402 execution + wallet + LLM gateway)
- `opensea` / `onchainkit` (NFT minting)
- Network access for discovery (optional but powerful)

The scripts contain **no secrets** and perform **no payments themselves**. They only produce excellent prompts, structured data, and precise instructions for the agent to follow using existing powerful Bankr capabilities.
