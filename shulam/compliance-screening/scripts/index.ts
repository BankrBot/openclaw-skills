/**
 * Compliance Screening Skill — OFAC/SDN wallet screening via Shulam CaaS API.
 *
 * Zero external dependencies. Uses raw `fetch` only.
 * Status mapping follows ADR-23: clear | held | blocked (NEVER "flagged").
 */

// ── Types ──────────────────────────────────────────────────────

export type ComplianceStatus = 'clear' | 'held' | 'blocked';

export interface ScreeningResult {
  status: ComplianceStatus;
  matchScore: number;
  screenedAt: string;
  listsChecked: string[];
  holdId: string | null;
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

// ── Status mapping ─────────────────────────────────────────────

const STATUS_MAP: Record<string, ComplianceStatus> = {
  clear: 'clear',
  held: 'held',
  blocked: 'blocked',
  pending: 'held',
  error: 'held',
};

function mapStatus(raw: string): ComplianceStatus {
  return STATUS_MAP[raw] ?? 'held';
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

// ── Public API ─────────────────────────────────────────────────

/**
 * Screen a single wallet address against OFAC SDN and sanctions lists.
 */
export async function screenWallet(address: string): Promise<ScreeningResult> {
  const apiKey = getApiKey();
  const baseUrl = getApiUrl();

  const response = await fetchWithBackoff(
    `${baseUrl}/v1/compliance/screen`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ address }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Screening failed (${response.status}): ${body}`);
  }

  const data = await response.json() as Record<string, unknown>;

  return {
    status: mapStatus(data.status as string),
    matchScore: (data.matchScore as number) ?? 0,
    screenedAt: (data.screenedAt as string) ?? new Date().toISOString(),
    listsChecked: (data.listsChecked as string[]) ?? ['OFAC_SDN'],
    holdId: (data.holdId as string) ?? null,
  };
}

/**
 * Screen multiple wallet addresses in a single batch.
 */
export async function screenWallets(
  addresses: string[],
): Promise<ScreeningResult[]> {
  const apiKey = getApiKey();
  const baseUrl = getApiUrl();

  const response = await fetchWithBackoff(
    `${baseUrl}/v1/compliance/screen/batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ addresses }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Batch screening failed (${response.status}): ${body}`);
  }

  const data = await response.json() as { results: Array<Record<string, unknown>> };

  return data.results.map((r) => ({
    status: mapStatus(r.status as string),
    matchScore: (r.matchScore as number) ?? 0,
    screenedAt: (r.screenedAt as string) ?? new Date().toISOString(),
    listsChecked: (r.listsChecked as string[]) ?? ['OFAC_SDN'],
    holdId: (r.holdId as string) ?? null,
  }));
}
