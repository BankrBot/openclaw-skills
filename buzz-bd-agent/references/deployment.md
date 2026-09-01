# Buzz BD Agent — Deployment Guide

## Akash Network Deployment

Buzz runs on Akash decentralized cloud at approximately $5-8/month.

### Prerequisites

- Akash wallet with AKT for deployment
- Docker image: `ghcr.io/buzzbysolcex/buzz-bd-agent:latest`
- Akash Console access (console.akash.network)

### SDL Template

```yaml
version: "2.0"
services:
  buzz:
    image: ghcr.io/buzzbysolcex/buzz-bd-agent:latest
    env:
      - OPENCLAW_STATE_DIR=/data/.openclaw
      - OPENCLAW_WORKSPACE_DIR=/data/workspace
    expose:
      - port: 18789
        as: 18789
        to:
          - global: true
    params:
      storage:
        data:
          mount: /data
          readOnly: false

profiles:
  compute:
    buzz:
      resources:
        cpu:
          units: 2
        memory:
          size: 4Gi
        storage:
          - name: data
            size: 10Gi
            attributes:
              persistent: true
              class: beta3

  placement:
    dcloud:
      pricing:
        buzz:
          denom: uakt
          amount: 10000

deployment:
  buzz:
    dcloud:
      profile: buzz
      count: 1
```

### Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 2 GB | 4 GB |
| Storage | 5 GB | 10 GB persistent |
| Network | Outbound HTTPS | Outbound HTTPS |

### Persistent Storage

Data stored in `/data/` survives container restarts (but NOT deployment closure):

```
/data/
├── .openclaw/           # OpenClaw state + config
│   └── openclaw.json    # Auto-generated on boot
└── workspace/
    ├── BOOT.md          # Agent identity
    ├── DIRECTIVE.md     # Operations manual
    ├── skills/          # Deployed skills
    ├── memory/
    │   ├── experience.json
    │   ├── pipeline/
    │   │   └── active.json
    │   ├── atv/
    │   │   ├── atv-cache.json
    │   │   └── atv-usage.json
    │   └── cron-schedule.json
    └── twitter-scan-history.json
```

### Development Workflow

```
Mac laptop → Docker build → GHCR push → Akash deploy
```

1. Edit code locally in `~/buzz-bd-agent/`
2. `docker build -t ghcr.io/buzzbysolcex/buzz-bd-agent:vX.Y.Z .`
3. `docker push ghcr.io/buzzbysolcex/buzz-bd-agent:vX.Y.Z`
4. Update SDL image tag → Create New Deployment on Akash Console

### Workspace File Deployment

For skills and configs (no Docker rebuild needed):

```bash
# Compress + encode
gzip -c your-skill.js | base64 -w0 > /tmp/skill-b64.txt

# Split into ~2KB chunks (Akash shell truncates >3KB)
split -b 2000 /tmp/skill-b64.txt /tmp/chunk-

# Paste chunks in Akash Console Shell
echo -n 'CHUNK1...' > /tmp/file-b64.txt
echo -n 'CHUNK2...' >> /tmp/file-b64.txt
# etc.

# Decode + deploy
base64 -d /tmp/file-b64.txt | gunzip > /data/workspace/skills/your-skill.js
```
