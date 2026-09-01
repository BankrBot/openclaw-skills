# Multimodal

Executable scripts and workflows for image, meme, PFP, banner, and visual generation using Bankr’s x402 system + sandbox execution.

## Overview

This skill gives Bankr agents **real executable tools** (thin shell scripts) for high-quality visual creation and NFT workflows.

**Best for:**
- Token PFPs & avatars
- Community memes & viral content
- Launch banners & marketing visuals
- End-to-end on-chain minting

## Installation

```bash
install the multimodal skill from https://github.com/BankrBot/skills/tree/main/multimodal
## Installation

Install the skill using the following command in Bankr:

```bash
install the multimodal skill from https://github.com/BankrBot/skills/tree/main/multimodal

Quick Start

After installing, you can ask the agent to use the skill. Example prompts:

• "Generate a cyberpunk PFP for my token using the multimodal skill"
• "Create 4 meme variations about Base memecoins"
• "Improve this prompt and generate an image: a futuristic cat"

Available Scripts

┌───────────────────┬───────────────────────────────────────────────────────────────────┐
│ Script            │ Description                                                       │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ generate.sh       │ Main generation script with style templates and variation support │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ enhance-prompt.sh │ Standalone tool for rewriting and improving prompts               │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ discover.sh       │ Discovers available x402 visual generation endpoints              │
├───────────────────┼───────────────────────────────────────────────────────────────────┤
│ mint.sh           │ Prepares rich NFT metadata and minting instructions               │
└───────────────────┴───────────────────────────────────────────────────────────────────┘

Usage Examples

# Generate images with variations
bash /skills/multimodal/scripts/generate.sh \
  --prompt "cyberpunk cat" \
  --template cyberpunk \
  --count 4 \
  --variations

# Enhance a prompt before generation
bash /skills/multimodal/scripts/enhance-prompt.sh \
  -p "a cat" -t cyberpunk --strength high

# Discover current visual x402 services
bash /skills/multimodal/scripts/discover.sh

Requirements

This skill depends on the following Bankr skills:

• bankr (for x402 execution, wallet operations, and the LLM gateway)
• opensea or onchainkit (for NFT minting)

The scripts require bash, curl, and jq to be available in the environment.

Notes

• The scripts do not handle payments or store any secrets.
• All actual image generation and wallet interactions are delegated to the core bankr skill.
• Always confirm with the user before making paid calls or spending gas.

Repository

Source: github.com/0xcalibrated/skills (https://github.com/0xcalibrated/skills/tree/multimodal-skill/multimodal)