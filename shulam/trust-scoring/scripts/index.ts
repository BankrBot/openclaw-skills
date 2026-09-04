/**
 * Trust Scoring Skill — Wallet trust scores via Shulam Agent Passport API.
 *
 * Zero external dependencies. Uses raw `fetch` only.
 * Field mapping mirrors packages/agent-skills/src/handlers/trust-score.ts.
 */

// ── Types ──────────────────────────────────────────────────────

export type TrustTier = 'unknown' | 'new' | 'established' | 'trusted' | 'exemplary';

export interface TrustBreakdown {
  volume: number;
  reliability: number;
  compliance: number;
  diversity: number;
  longevity: number;
  stability: number;
}

export interface TrustScoreResult {
  wallet: string;
  score: number;
  tier: TrustTier;
  breakdown: TrustBreakdown;
  calculatedAt: string;
  meetsThreshold: boolean;
}

export type ComplianceStatus = 'clear' | 'held' | 'blocked';

export interface ScreeningResult {
  status: ComplianceStatus;
  matchScore: number;
  screenedAt: string;
}

export interface CombinedCheckResult {
  compliance: ScreeningResult;
  trust: TrustScoreResult;
}

// ── Config ─────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.SHULAM_API_KEY;
  if (!key) {
    throw new Error(
      'SHULAM_API_KEY not set. Get a free key at https://api.shulam.xyz/register',
    );
  }
  return key;
}

function getApiUrl(): string {
  return process.env.SHULAM_API_URL ?? 'https://api.shulam.xyz';
}

function getMinTrustScore(): number {
  const val = process.env.MIN_TRUST_SCORE;
  if (!val) return 0;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
}

// ── Cache ──────────────────────────────────────────────────────

interface CacheEntry {
  result: TrustScoreResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

function getCached(address: string): TrustScoreResult | null {
  const entry = cache.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(address.toLowerCase());
    return null;
  }
  return entry.result;
}

function setCache(address: string, result: TrustScoreResult): void {
  cache.set(address.toLowerCase(), { result, cachedAt: Date.now() });
}

/** Clear the cache (for testing). */
export function clearCache(): void {
  cache.clear();
}

// ── Backoff ────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * 2 ** attempt, 30_000);
        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(Math.min(1000 * 2 ** attempt, 30_000));
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

// ── Status mapping (for combinedCheck) ─────────────────────────

const STATUS_MAP: Record<string, ComplianceStatus> = {
  clear: 'clear',
  held: 'held',
  blocked: 'blocked',
  pending: 'held',
  error: 'held',
};

// ── Public API ─────────────────────────────────────────────────

/**
 * Get the trust score for a wallet address.
 * Results are cached for 60 seconds.
 */
export async function getTrustScore(address: string): Promise<TrustScoreResult> {
  const cached = getCached(address);
  if (cached) return cached;

  const apiKey = getApiKey();
  const baseUrl = getApiUrl();
  const minScore = getMinTrustScore();

  const response = await fetchWithBackoff(
    `${baseUrl}/v1/trust/score/${encodeURIComponent(address)}`,
    {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trust score lookup failed (${response.status}): ${body}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const passport = (data.passport ?? data) as Record<string, unknown>;
  const breakdownRaw = (passport.breakdown ?? {}) as Record<string, number>;

  const result: TrustScoreResult = {
    wallet: address,
    score: (passport.trustScore as number) ?? 0,
    tier: ((passport.trustTier as string) ?? 'unknown') as TrustTier,
    breakdown: {
      volume: breakdownRaw.volume ?? 0,
      reliability: breakdownRaw.reliability ?? 0,
      compliance: breakdownRaw.compliance ?? 0,
      diversity: breakdownRaw.diversity ?? 0,
      longevity: breakdownRaw.longevity ?? 0,
      stability: breakdownRaw.stability ?? 0,
    },
    calculatedAt: (passport.lastSeen as string) ?? new Date().toISOString(),
    meetsThreshold: ((passport.trustScore as number) ?? 0) >= minScore,
  };

  setCache(address, result);
  return result;
}

/**
 * Combined check: run compliance screening and trust scoring in parallel.
 */
export async function combinedCheck(address: string): Promise<CombinedCheckResult> {
  const apiKey = getApiKey();
  const baseUrl = getApiUrl();

  const [screenResponse, trustResult] = await Promise.all([
    fetchWithBackoff(`${baseUrl}/v1/compliance/screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ address }),
    }),
    getTrustScore(address),
  ]);

  if (!screenResponse.ok) {
    const body = await screenResponse.text();
    throw new Error(`Screening failed (${screenResponse.status}): ${body}`);
  }

  const screenData = await screenResponse.json() as Record<string, unknown>;

  return {
    compliance: {
      status: STATUS_MAP[screenData.status as string] ?? 'held',
      matchScore: (screenData.matchScore as number) ?? 0,
      screenedAt: (screenData.screenedAt as string) ?? new Date().toISOString(),
    },
    trust: trustResult,
  };
}
