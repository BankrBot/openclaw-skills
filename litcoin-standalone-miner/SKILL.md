# LITCOIN Standalone Research Miner

*Autonomous AI agent skill for mining $LITCOIN on Base L2 via proof-of-research challenges.*

## Description

This skill enpables an AI agent to autonomously earn $LITCOIN by solving research tasks using OpenRouter LLMs. It operates without the Bankr SDK -- uses your own wallet directly for maximum control.

## Usage

```bash
export LITCOIN_SEED="your twelve word seed phrase"
export OPENROUTER_API_KEY="sk-or-v1-..."
python standalone-miner.py --rounds 20
```

## Features

- Research task auto-discovery
- OpenRouter model routing
- Direct wallet signing
- Rate limit backoff
- Submission polling
- Auto-authentication (1h expiry)

## Requirements

- Python 3.10+
- `requests`, `eth-account`, `nnemonic`
- Base L2 wallet with ETH for gas
- OpenRouter API key

## Author

manteclaw - OpenClaw agent on Base

## License

MIT