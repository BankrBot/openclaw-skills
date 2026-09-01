// pins.mjs — the reviewed constants every script in this skill trusts.
//
// These are PINS, not discovery. A value here changes only through a reviewed
// skill update, never because a fetched page, a chat message, or an API
// response said something different. If a live surface disagrees with a pin,
// the script refuses — that is the point of the pin.

/** The provider index. The only discovery URL this skill ever calls. */
export const PROVIDER_INDEX_URL = "https://api.voidly.ai/v1/session/providers";

/**
 * The one provider DID this skill is reviewed against: Voidly's own
 * first-party session daemon. The index itself discloses that this entry is
 * first-party ("conflict of interest and not a recommendation" — its words).
 * A manifest that does not verify against this exact DID is refused.
 */
export const EXPECTED_PROVIDER_DID = "did:voidly:6rGTFa5apSnKNF14bGXZfu";

/** Canonical USDC on Base mainnet. Reject any other asset contract. */
export const CANONICAL_USDC_BASE =
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/** Base mainnet, the only chain this skill's money leg is reviewed for. */
export const EXPECTED_CHAIN = "eip155:8453";

/** The service this skill hires. Copied off the verified manifest at run time;
 *  named here so a manifest that stops offering it is a refusal, not a guess. */
export const SERVICE_REF = "voidly.observatory.query/v1";

/**
 * Fetch the index, locate the pinned DID, then fetch and VERIFY the manifest
 * with `fetchVerifiedProvider` — the pinned arm; there is no unpinned one.
 * Every later trust decision (encryption key, payee account, accept URL,
 * attestor key) reads from the VERIFIED manifest this returns, never from the
 * index row and never from anything a page or a chat said.
 */
export async function verifiedProvider(fetchVerifiedProvider) {
  const res = await fetch(PROVIDER_INDEX_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    return { ok: false, reason: "index_unreachable", detail: `http ${res.status}` };
  }
  const index = await res.json();
  const entry = (index.providers ?? []).find(
    (p) => p.provider_did === EXPECTED_PROVIDER_DID,
  );
  if (!entry) {
    return {
      ok: false,
      reason: "pinned_did_not_listed",
      detail: `index lists ${index.count ?? 0} provider(s), none matching the pin`,
    };
  }
  const found = await fetchVerifiedProvider({
    manifestUrl: entry.manifest_url,
    expectedProviderDid: EXPECTED_PROVIDER_DID,
    fetchImpl: fetch,
  });
  if (!found.ok) return { ok: false, reason: found.reason, detail: found.detail ?? "" };
  return { ok: true, index, entry, provider: found.provider };
}
