# mythosforge-imagegen

Open-source, self-contained image generation for AI agents. Turn a text prompt into
an image file with one command — **you bring your own [Replicate](https://replicate.com)
API key**, so there is no MythosForge account, wallet, or payment layer involved.

This is the render engine from [MythosForge](https://www.mythosforge.xyz)'s paid Bankr/x402
image services, lifted out of the paywall into a dead-simple MIT script that any AI agent
can drop in and self-serve.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=r8_your_token   # https://replicate.com/account/api-tokens

node generate.mjs --prompt "a foggy neon city at dusk, cinematic" --model flux --aspect landscape
# -> writes out/flux-schnell-landscape.webp and prints a JSON result line
```

Preview the request without spending anything (no token needed):

```bash
node generate.mjs --prompt "a cozy pixel-art cabin" --model retro --dry-run
```

## Models

| `--model` | Replicate model                | Best for                      | Output |
|-----------|--------------------------------|-------------------------------|--------|
| `flux`    | black-forest-labs/flux-schnell | fast general images (default) | webp   |
| `retro`   | retro-diffusion/rd-plus        | pixel-art sprites / tiles     | png    |
| `nano`    | google/nano-banana-2           | high-detail 2K images         | png    |

## Options

| Flag       | Values                              | Default                      |
|------------|-------------------------------------|------------------------------|
| `--prompt` | text, max 2000 chars (**required**) | —                            |
| `--model`  | `flux` \| `retro` \| `nano`         | `flux`                       |
| `--aspect` | `square` \| `landscape` \| `portrait` | `square`                   |
| `--out`    | output file path                    | `out/<model>-<aspect>.<ext>` |
| `--dry-run`| print request, spend nothing        | off                          |

## Using it as an agent Skill

Drop this folder into your agent's skills directory. `SKILL.md` carries the
frontmatter (`name` + `description`) and the operational steps an agent follows.

## Licensing

- The wrapper (`generate.mjs`, docs) is **MIT** — use it freely.
- Generation runs on **your** Replicate account/key. Each underlying model carries
  its own Replicate model terms, which are your responsibility as the key holder.
- No model weights are redistributed — only the API-calling wrapper.
