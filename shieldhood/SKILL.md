---
name: Shieldhood
description: Advanced AI Security Layer for Bankr.bot on Robinhood Chain. Protects autonomous agents from prompt injection, jailbreaks, and malicious commands.
version: 2.0.1
tags: [security, safety, prompt-injection, defi, robinhood]
visibility: public
---

# Shieldhood

**Shieldhood** is an advanced AI Security Skill that acts as the last line of defense for autonomous DeFi agents on Robinhood Chain.

### Key Features
- Multi-layer prompt injection & jailbreak detection
- Deep payload decoding (Base64, Hex, ROT, etc.)
- Human confirmation gate for high-risk actions
- Spending policy & address allowlist
- Lightweight pure Python

### Installation

```bash
pip install shieldhood
```

### Usage

```python
from shieldhood import Shieldhood

shield = Shieldhood()
result = shield.scan("your prompt here")
```

### Links
- GitHub: https://github.com/0xPoyraz/Shieldhood
- PyPI: https://pypi.org/project/shieldhood/
- Website: https://www.shieldhood.xyz/

Made for Bankr.bot agents on Robinhood Chain.
```

---
