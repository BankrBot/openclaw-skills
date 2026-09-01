# multimodal skill (v1.5)

Powerful thin-script skill for high-quality image, meme, PFP, and NFT generation using Bankr's x402 ecosystem.

## Scripts

| Script                    | Power Level | What It Does |
|---------------------------|-------------|--------------|
| `generate.sh`             | High        | Full orchestrator with templates, meme text, variations, multiple output modes |
| `enhance-prompt.sh`       | High        | Standalone world-class prompt rewriter |
| `discover.sh`             | Medium-High | Tries live x402 registry discovery + excellent fallbacks |
| `mint.sh`                 | Medium-High | Rich ERC-721 metadata + complete minting workflow |

All scripts live in `scripts/` and can be executed directly by the agent.

## Quick Start (in Bankr)

```bash
install the multimodal skill from https://github.com/0xcalibrated/skills/tree/multimodal-skill/multimodal
```

Then tell the agent:

> Use the multimodal skill to generate a cyberpunk cat PFP for $CATZ

## Development

After editing scripts, re-install the skill so the agent's sandbox gets the updated versions.

The scripts are designed to be read (`use_skill_file`) or executed by the agent.
