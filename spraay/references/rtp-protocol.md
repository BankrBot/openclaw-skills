# Robot Task Protocol (RTP) Reference

## Overview

RTP is an open standard for AI agents to discover, hire, and pay physical robots using x402 USDC micropayments. Part of the Spraay gateway (Category 15, v3.4.0).

**The idea:** Just as x402 lets agents pay for API calls, RTP lets agents pay for physical-world tasks — delivery, inspection, manufacturing, agriculture, and more.

## Architecture

```
AI Agent → Spraay Gateway (RTP endpoints) → Robot Registry → Physical Robot
                    ↓
           x402 USDC payment on Base
```

## Endpoints (8 total)

### Discover Robots
```
GET https://gateway.spraay.app/api/rtp/discover
  ?capability=delivery
  &location=33.77,-117.87
  &radius=10km
```

Response:
```json
{
  "robots": [
    {
      "robotId": "robot_abc123",
      "name": "DeliveryBot-7",
      "capabilities": ["delivery", "pickup"],
      "location": {"lat": 33.78, "lng": -117.86},
      "status": "available",
      "pricePerTask": "2.50",
      "rating": 4.8,
      "completedTasks": 142
    }
  ]
}
```

### Commission a Task
```
POST https://gateway.spraay.app/api/rtp/commission
```

Request:
```json
{
  "robotId": "robot_abc123",
  "task": "delivery",
  "params": {
    "pickup": "123 Main St, Irvine, CA",
    "dropoff": "456 Oak Ave, Irvine, CA",
    "item": "Package, 2kg",
    "deadline": "2025-03-20T15:00:00Z"
  },
  "maxPrice": "5.00"
}
```

Response:
```json
{
  "taskId": "task_xyz789",
  "robotId": "robot_abc123",
  "status": "commissioned",
  "price": "2.50",
  "paymentTx": "0xdef...",
  "estimatedCompletion": "2025-03-20T14:30:00Z"
}
```

### Check Task Status
```
GET https://gateway.spraay.app/api/rtp/status/:taskId
```

Response:
```json
{
  "taskId": "task_xyz789",
  "status": "in_progress",
  "robotLocation": {"lat": 33.775, "lng": -117.865},
  "progress": 0.6,
  "estimatedCompletion": "2025-03-20T14:30:00Z"
}
```

Task statuses: `commissioned` → `accepted` → `in_progress` → `completed` / `failed` / `cancelled`

### Cancel a Task
```
POST https://gateway.spraay.app/api/rtp/cancel/:taskId
```

### List Robot Capabilities
```
GET https://gateway.spraay.app/api/rtp/capabilities
```

Returns all registered robot capability types (delivery, inspection, agriculture, manufacturing, etc.).

### Verify Task Completion
```
GET https://gateway.spraay.app/api/rtp/verify/:taskId
```

Returns proof-of-completion data (photos, sensor readings, GPS trail) for the task.

### Get Payment Receipt
```
GET https://gateway.spraay.app/api/rtp/receipt/:taskId
```

Returns x402 payment receipt with on-chain transaction details.

### Register on XMTP Mesh
```
POST https://gateway.spraay.app/api/rtp/mesh/register
```

Registers a robot or agent on the XMTP-based RTP mesh network for peer-to-peer task negotiation.

## Pricing

| Endpoint | Price |
|----------|-------|
| `/api/rtp/discover` | $0.005 |
| `/api/rtp/commission` | $0.10 |
| `/api/rtp/status/:taskId` | $0.001 |
| `/api/rtp/cancel/:taskId` | $0.01 |
| `/api/rtp/capabilities` | $0.001 |
| `/api/rtp/verify/:taskId` | $0.005 |
| `/api/rtp/receipt/:taskId` | $0.001 |
| `/api/rtp/mesh/register` | $0.01 |

Robot task payments are separate and go directly to the robot operator.

## Open Source Repos

| Repo | Description |
|------|-------------|
| `plagtech/rtp-spec` | Protocol specification |
| `plagtech/rtp-sdk` | JavaScript/TypeScript SDK |
| `plagtech/rtp-python-sdk` | Python SDK |
| `plagtech/rtp-pi-demo` | Raspberry Pi 5 demo build |
| `plagtech/rtp-xmtp-mesh` | XMTP mesh networking layer |
| `plagtech/awesome-rtp` | Curated RTP resources |

## Competitive Landscape

RTP is complementary to (not competing with):
- **peaq** — DePIN Layer 1 (RTP can use peaq for device identity)
- **Auki** — Spatial AR computing (RTP can use Auki for robot localization)

## Bankr Integration

For Bankr users who want to commission physical-world tasks:

```javascript
// Find a delivery robot near a location
const robots = await fetch(
  "https://gateway.spraay.app/api/rtp/discover?capability=delivery&location=33.77,-117.87"
).then(r => r.json());

// Commission the top-rated available robot
const bestRobot = robots.robots
  .filter(r => r.status === "available")
  .sort((a, b) => b.rating - a.rating)[0];

const task = await fetch("https://gateway.spraay.app/api/rtp/commission", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    robotId: bestRobot.robotId,
    task: "delivery",
    params: {pickup: "123 Main St", dropoff: "456 Oak Ave"},
    maxPrice: "5.00"
  })
}).then(r => r.json());
```
