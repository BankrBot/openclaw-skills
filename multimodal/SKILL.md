---
name: multimodal
description: Executable scripts and workflows for image, meme, PFP, and visual generation using Bankr’s x402 system and LLM gateway. Includes prompt engineering, visual discovery, and NFT minting support via opensea and onchainkit.
tags: [image, meme, pfp, x402, generation, nft, prompt-engineering, bankr]
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

# Multimodal — Image, Meme & NFT Generation

**Skill name:** `multimodal`

This skill provides executable shell scripts that Bankr agents can run directly. It focuses on high-quality prompt engineering, structured visual generation workflows, and preparing assets for NFT minting using Bankr’s x402 system.

It is well suited for token PFPs, community memes, launch visuals, and on-chain minting.

## Scripts

The agent should execute the following scripts:

| Script                        | Purpose                                              | Key Parameters |
|-------------------------------|------------------------------------------------------|----------------|
| `scripts/generate.sh`         | Main generation tool with templates and variations   | `--prompt`, `--template`, `--aspect`, `--count`, `--variations` |
| `scripts/enhance-prompt.sh`   | Standalone prompt improvement and rewriting tool     | `--prompt`, `--template`, `--strength` |
| `scripts/discover.sh`         | Discover available x402 visual generation endpoints  | — |
| `scripts/mint.sh`             | Generate rich NFT metadata and minting instructions  | `--image`, `--name`, `--description`, `--royalty`, `--attributes` |

## Recommended Workflow

1. (Optional) Use `enhance-prompt.sh` to improve a weak or vague prompt.
2. Run `generate.sh` with a chosen template and parameters.
3. Execute the suggested command through the `bankr` skill to generate images.
4. Use `mint.sh` to prepare NFT metadata for any outputs the user wants to mint.

## Style Templates

Supported templates: `cyberpunk`, `meme`, `banner`, `pfp`, `logo`, `retro`, `abstract`, `general`.

## Example Usage

```bash
# Generate 4 variations of a cyberpunk PFP
bash /skills/multimodal/scripts/generate.sh \
  --prompt "cyberpunk cat wearing sunglasses" \
  --template cyberpunk \
  --aspect 1:1 \
  --count 4 \
  --variations

# Improve a basic prompt before generation
bash /skills/multimodal/scripts/enhance-prompt.sh \
  -p "a cat" -t cyberpunk --strength high

# Check available visual x402 endpoints
bash /skills/multimodal/scripts/discover.sh

Best Practices

• Always obtain explicit user confirmation before making paid x402 calls or spending gas.
• Use --variations when the user is unsure about the creative direction.
• Combine this skill with the bankr skill for wallet operations and x402 execution.
• Use the opensea or onchainkit skill for actual NFT minting.

Dependencies

• bankr skill (required for x402 payments, wallet operations, and the LLM gateway)
• opensea or onchainkit skill (for NFT minting)
• Network access (required for endpoint discovery)

The scripts do not perform payments or store secrets. They generate prompts, structured data, and guidance for the agent to execute using Bankr’s existing capabilities.