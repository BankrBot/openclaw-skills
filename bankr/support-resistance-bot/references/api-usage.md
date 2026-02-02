# API Usage Optimization

## Efficient Polling Strategy

**Problem**: Default aggressive polling (5s × 240 attempts) = 1,200 requests per job

**Solution**: Patient polling (60s × 15 attempts) = 15 requests per job

**80× reduction in API calls!**

## Request Breakdown

Per 30-minute cycle (3 tokens):

| Phase | Requests | Description |
|-------|----------|-------------|
| Wallet sync | 5 | Get USD balances |
| Sentiment analysis | 5 | Social sentiment scores |
| Technical analysis | 5 | Support/resistance levels |
| Order placement | 0-6 | Only if signals trigger |
| **Total typical** | **~15** | **Not 200+** |

## Timeout Handling

- **Poll interval**: 60 seconds
- **Max attempts**: 15 per job
- **Max wait**: 15 minutes per job
- **Batch timeout**: 15 minutes total

Jobs that need 10+ minutes (TA analysis) now complete instead of timing out.

## Retry Logic

- **Retry attempts**: 1 (minimal)
- **Retry delay**: 60 seconds
- **No exponential backoff** (wastes requests)

## Best Practices

1. **Never reduce poll interval below 30s** — wastes API quota
2. **Never increase max attempts above 20** — diminishing returns
3. **Accept timeout as signal** — move to next cycle
4. **Log all requests** — track usage per run