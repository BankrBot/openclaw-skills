// pins.mjs — the reviewed constants every script in this skill trusts.
//
// These are PINS, not discovery. A value here changes only through a reviewed
// skill update, never because a fetched page, a chat message, or an API
// response said something different. If a live surface disagrees with a pin,
// the script refuses — that is the point of the pin.

// Node 20 or newer, by measurement: on Node 18 an ES module has no global
// `crypto`, so @voidly/session's envelopeHash throws "crypto is not defined"
// (which verify-artifacts then blamed on the user's grant) and buildHire
// throws SessionCryptoUnavailableError after three network round trips.
// Refused here, by name, before any script does anything.
if (typeof globalThis.crypto?.subtle?.digest !== "function" || typeof globalThis.crypto?.getRandomValues !== "function") {
  console.error("REFUSED  node_too_old — this skill needs Node 20 or newer (no global WebCrypto in this runtime)");
  process.exit(1);
}

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

/** The same chain, as `eth_chainId` returns it. 0x2105 == 8453. Every RPC in a
 *  settlement quorum must answer with exactly this, or the receipt being read
 *  came off some other chain. */
export const EXPECTED_CHAIN_ID_HEX = "0x2105";

/**
 * Reviewed, independent, public Base mainnet RPC operators — the hosts
 * `verify-settlement.mjs` will read a settlement from.
 *
 * A quorum is worth exactly the independence of its members, so the hosts are
 * pinned like everything else in this file: a --rpc outside this list is
 * refused unless you pass --allow-unpinned-rpc and mean it. Different
 * companies, different infrastructure; naming one operator twice is still one
 * operator, and the script counts by host for that reason.
 *
 * Being allowlisted is permission, not a promise. Observed at review time,
 * all four answering eth_chainId 0x2105 (re-check before relying on any):
 *   - mainnet.base.org       Base (Coinbase). Served the archive receipt.
 *   - base.drpc.org          dRPC. Served the archive receipt.
 *   - base.meowrpc.com       MeowRPC. Archive-capable, rate-limits quickly.
 *   - base-rpc.publicnode.com  Allnodes. NOT archive: HTTP 403 on an older
 *                            receipt, so it can only join a quorum on a
 *                            recent settlement.
 * A non-archive operator fails the run CLOSED (rpc_unanswered, or
 * rpc_divergence if it answers `null` where another returns a receipt) — it
 * can cost you a proof, never fake one.
 */
export const ALLOWED_BASE_RPC_HOSTS = [
  "mainnet.base.org",
  "base.drpc.org",
  "base.meowrpc.com",
  "base-rpc.publicnode.com",
];

/**
 * The one manifest URL this skill will ever fetch — pinned EXACTLY, scheme,
 * host, port and path. Signature verification happens after the fetch, so it
 * cannot undo the fetch: an index answering a different manifest_url used to
 * cause a GET to whatever it named (plaintext, loopback, something internal)
 * before any byte of it was verified. For a one-provider skill the honest fix
 * is a pin: a moved manifest is a reviewed skill update, not a runtime
 * surprise.
 */
export const EXPECTED_MANIFEST_URL =
  "https://intelligence.voidly.ai:8443/.well-known/voidly-session-provider.json";

/**
 * The two URLs INSIDE the verified manifest, pinned exactly. The SDK verifies
 * the manifest's signature and accepts `accept_url` / `worker_base_url` as
 * any non-empty string — and a manifest carries no freshness or revocation,
 * so an older validly-signed document verifies identically. The same reasoning
 * that pinned EXPECTED_MANIFEST_URL applies here: `worker_base_url` is where
 * seal-hire.mjs sends the hirer DID on its one registry lookup, and
 * `accept_url` is where a later submitHire posts the payable hire. Neither
 * may be decided by a document, however well signed; a moved endpoint is a
 * reviewed skill update.
 */
export const EXPECTED_WORKER_BASE_URL = "https://api.voidly.ai";
export const EXPECTED_ACCEPT_URL = "https://intelligence.voidly.ai:8443/session/accept";

/**
 * Compare a manifest URL field to its pin. Exact string equality — no
 * normalization, so a scheme swap, a whitespace or newline payload, a port
 * change or a path suffix all refuse. Returns a refusal or null.
 */
export function manifestUrlFieldRefusal(manifest, field, pin) {
  const value = manifest?.[field];
  if (value !== pin) {
    return {
      ok: false,
      reason: `manifest_${field}_not_pinned`,
      // The value is never echoed: it is attacker-influenced text when it is
      // not the pin.
      detail: `the verified manifest's ${field} is not the pinned ${pin} — a moved endpoint is a reviewed skill update, not a runtime surprise`,
    };
  }
  return null;
}

/** The service this skill hires. Copied off the verified manifest at run time;
 *  named here so a manifest that stops offering it is a refusal, not a guess. */
export const SERVICE_REF = "voidly.observatory.query/v1";

/**
 * The price band, pinned. Provider, chain, asset, service and every URL are
 * pins; the amount and the PAYEE were the two money fields still taken from
 * the document — and the same reasoning applies to both: a manifest carries
 * no freshness or revocation, so an older validly-signed one naming a higher
 * floor or another payee verifies identically, and seal-hire would seal it.
 * 0.05–5 USDC, in atomic units. A repriced service is a reviewed skill update.
 */
export const EXPECTED_PRICE_MIN_AMOUNT = "50000";
export const EXPECTED_PRICE_MAX_AMOUNT = "5000000";

/**
 * The account the money goes to, pinned — the last money field that was read
 * off the signed document. Lowercase CAIP-10, exactly as the manifest spells
 * it and as the SDK freezes it into every grant. A moved payee is a reviewed
 * skill update, never a runtime surprise.
 */
export const EXPECTED_PAYEE_ACCOUNT = "eip155:8453:0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912";

/** The offering's payee must equal the pin, exact string. Returns a refusal or null. */
export function payeeRefusal(offering) {
  if (offering?.price?.payee_account !== EXPECTED_PAYEE_ACCOUNT) {
    return {
      ok: false,
      reason: "payee_not_pinned",
      // Never echoed: when it is not the pin it is the attacker's account.
      detail: `the offering's payee_account is not the pinned ${EXPECTED_PAYEE_ACCOUNT} — a moved payee is a reviewed skill update, not a runtime surprise`,
    };
  }
  return null;
}

/** The offering's band must equal the pin, exact strings. Returns a refusal or null. */
export function priceBandRefusal(offering) {
  const min = offering?.price?.min_amount;
  const max = offering?.price?.max_amount;
  if (min !== EXPECTED_PRICE_MIN_AMOUNT || max !== EXPECTED_PRICE_MAX_AMOUNT) {
    return {
      ok: false,
      reason: "price_band_not_pinned",
      // Values described by shape only — the offending document is the one
      // thing not to print.
      detail: `the verified manifest prices ${SERVICE_REF} at a band other than the pinned ${EXPECTED_PRICE_MIN_AMOUNT}..${EXPECTED_PRICE_MAX_AMOUNT} atomic USDC — a repriced service is a reviewed skill update, not something to seal`,
    };
  }
  return null;
}

/**
 * A remote or file-supplied string, made safe for ONE terminal line:
 * JSON-quoted, then U+2028/U+2029/U+0085 and every format character (which
 * JSON.stringify leaves raw and a multiline regex or splitlines() treats as
 * a line break) escaped as \uXXXX, and cut at `max` characters.
 */
export function quoted(value, max = 512) {
  if (typeof value !== "string") return `(not a string: ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value})`;
  const cut = value.length > max ? value.slice(0, max) + "…" : value;
  // \p{Cc} covers the C1 range (U+0080–U+009F: CSI, OSC, RI…) and DEL, which
  // JSON.stringify leaves raw and which VTE/xterm-class terminals execute
  // when UTF-8-encoded — a fake VERIFIED line painted over the real one.
  return JSON.stringify(cut).replace(/[\p{Cc}\u2028\u2029\p{Cf}]/gu, (c) => "\\u" + c.codePointAt(0).toString(16).padStart(4, "0"));
}

/**
 * Is this a usable command-line VALUE (a filename, a hash, a URL)? Empty
 * once whitespace, separators and format characters are stripped → no. A
 * leading dash of ANY kind — every Unicode `Pd` dash, the minus sign, the
 * fullwidth and small hyphens, box-drawing rules, braille blanks — → no: it
 * is a flag typed wrong, not a file, and it used to become one in cwd.
 */
export const usableArgValue = (v) => {
  if (typeof v !== "string") return false;
  // A bidi control anywhere (U+202A–U+202E, U+2066–U+2069) is never part of a
  // filename typed on purpose; it exists to make "nosj.k" render as "k.json".
  if (/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(v)) return false;
  // Marks (\p{M}) are stripped too: a value made only of combining marks or
  // variation selectors is invisible on a terminal and is not a filename.
  // A value whose FIRST code point is invisible (a control, a format
  // character, a space, a mark) was typed by nobody: `\u0085--keep.json`
  // and `\u200bkeep.json` became files in the working directory.
  // Default_Ignorable covers every Hangul filler, tag, variation selector and
  // BOM; \p{Co} is private use (renders as nothing); unassigned code points
  // render as nothing or a box. None of them begins a filename anyone typed.
  if (/^[\p{Cc}\p{Cf}\p{Zs}\p{M}\p{Default_Ignorable_Code_Point}\p{Co}\p{Cn}\uFFFC\uFFFD\u2800]/u.test(v)) return false;
  const stripped = v.replace(/[\s\p{Cf}\p{M}\p{Z}\p{Default_Ignorable_Code_Point}\p{Co}\p{Cn}\u2800\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, "");
  if (stripped.length === 0) return false;
  // U+2043 HYPHEN BULLET is Po, not Pd, and renders as a dash; named explicitly,
  // along with the other dash-rendering code points outside \p{Pd}: modifier
  // minus U+02D7, superscript minus U+207B, heavy minus U+2796, katakana and
  // halfwidth prolonged sound marks U+30FC/U+FF70, overline U+203E, macron
  // U+00AF, small dashed low line U+FE49.
  // ...plus subscript minus U+208B, the horizontal-line graphics U+23AF/U+23BC/
  // U+23BD and the block-element bars U+2581/U+2594, the modifier letters
  // U+02C9/U+02CD, fullwidth low line U+FF3F, double low line U+2017, the
  // dashed/centreline low lines U+FE4D-U+FE4F, and the Hangul letter EU
  // (U+3161 / U+1173), which is one horizontal stroke.
  // …and their siblings: U+23BA/U+23BB horizontal scan lines, U+0640 tatweel,
  // U+2F00 Kangxi radical one, U+31D0 CJK stroke H, U+FFE3 fullwidth macron,
  // U+2580/2582/2583 block bars, U+1FB02 and U+1FB76–U+1FB7B block strokes,
  // U+2053 swung dash, U+3030 wavy dash.
  return !/^[\p{Pd}\-\u2043\u2212\uFE58\uFE63\uFF0D\u2500-\u257F\u2010-\u2015\u02D7\u207B\u2796\u30FC\uFF70\u203E\u00AF\uFE49\u208B\u23AF\u23BA-\u23BD\u2580-\u2583\u2594\u02C9\u02CD\uFF3F\u2017\uFE4D-\uFE4F\u3161\u1173\u0640\u2F00\u31D0\uFFE3\u2053\u3030\u{1FB02}\u{1FB76}-\u{1FB7B}]/u.test(stripped);
};

/**
 * Read a response body with a byte ceiling, on the wire. `res.json()` reads
 * whatever the server sends; the index, the registry row and the manifest
 * are all small documents, and a hostile edge answering gigabytes is a
 * memory exhaustion, not a refusal. Content-Encoding is left alone by the
 * request (`accept-encoding: identity`), so the count is of real bytes.
 * Returns the text, or throws an Error with code BODY_TOO_LARGE.
 */
export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export async function readBodyCapped(res, cap = MAX_DOCUMENT_BYTES) {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > cap) throw Object.assign(new Error(`body too large (${declared} bytes, cap ${cap})`), { code: "BODY_TOO_LARGE" });
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      try { await reader.cancel(); } catch { /* already gone */ }
      throw Object.assign(new Error(`body too large (>${cap} bytes)`), { code: "BODY_TOO_LARGE" });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * A fetch whose response body is capped BEFORE the caller (or the SDK) can
 * parse it: the body is read here under the ceiling and handed back as a new
 * Response with the same status and headers. Redirects refused, 15 s budget.
 */
export const cappedFetch = async (url, init = {}) => {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), "accept-encoding": "identity" },
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
    const text = await readBodyCapped(res);
    // 204/304 and friends may carry no body: the Response constructor throws
    // on a body for those statuses, which surfaced as "unreachable". A
    // bodiless answer is handed back as such and refused as unparseable.
    const nullBody = res.status === 204 || res.status === 205 || res.status === 304 || (res.status >= 100 && res.status < 200);
    return new Response(nullBody ? null : text, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (e) {
    // The SDK's fetchVerifiedProvider catches this and reports only the
    // error's NAME; the code and message survive here for verifiedProvider.
    lastFetchError = e;
    throw e;
  }
};
/** The last error cappedFetch threw — the SDK swallows it, so it is kept here. */
let lastFetchError = null;
export const takeLastFetchError = () => {
  const e = lastFetchError;
  lastFetchError = null;
  return e;
};

/** undici says "fetch failed" and keeps the reason in `cause`; the reason is what the user needs. */
export const transportCause = (e) => {
  const cause = e && e.cause ? e.cause : null;
  const inner = cause ? String(cause.code ?? cause.message ?? "").slice(0, 60) : "";
  const outer = e && e.message ? String(e.message).slice(0, 60) : "fetch failed";
  return inner && inner !== outer ? `${outer} (${inner})` : outer;
};

/** The manifest leg's transport failure, named by cause. */
const manifestFetchRefusal = (e) => {
  if (e && e.code === "BODY_TOO_LARGE") {
    return { ok: false, reason: "manifest_too_large", detail: `${EXPECTED_MANIFEST_URL}: the manifest answered more than ${MAX_DOCUMENT_BYTES} bytes` };
  }
  const timedOut = e && (e.name === "TimeoutError" || e.name === "AbortError" || /timed out|aborted/i.test(String(e?.message ?? "")));
  return {
    ok: false,
    reason: "manifest_unreachable",
    detail: `${EXPECTED_MANIFEST_URL}: ${timedOut ? "timed out after 15s" : `${transportCause(e)}`}`,
  };
};

/**
 * Fetch the index, locate the pinned DID, then fetch and VERIFY the manifest
 * with `fetchVerifiedProvider` — the pinned arm; there is no unpinned one.
 * Every later trust decision (encryption key, payee account, accept URL,
 * attestor key) reads from the VERIFIED manifest this returns, never from the
 * index row and never from anything a page or a chat said.
 */
export async function verifiedProvider(fetchVerifiedProvider) {
  // Both callers promise "Exit 1: refused, by name". These two awaits were
  // outside any try, so the three commonest real failures — host down, request
  // timed out, body not JSON — exited with an uncaught stack trace and no
  // named reason. `index_unreachable` fired only when the index WAS reachable
  // and answered a non-2xx, which is the rarest of the four.
  let res;
  try {
    // `redirect: "error"`: this is "the only discovery URL this skill ever
    // calls" — a 3xx would silently make it a different one. The body is
    // read under a byte ceiling before anything parses it.
    res = await cappedFetch(PROVIDER_INDEX_URL, { headers: { accept: "application/json" } });
  } catch (e) {
    return {
      ok: false,
      reason: e && e.code === "BODY_TOO_LARGE" ? "index_too_large" : "index_unreachable",
      detail: `${PROVIDER_INDEX_URL}: ${e.name === "TimeoutError" ? "timed out after 15s" : e && e.code === "BODY_TOO_LARGE" ? `the index answered more than ${MAX_DOCUMENT_BYTES} bytes` : transportCause(e)}`,
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "index_unreachable", detail: `http ${res.status}` };
  }
  let index;
  try {
    index = await res.json();
  } catch (e) {
    // The parser's message quotes the body's own bytes; the body is the index's, not ours.
    return { ok: false, reason: "index_unparseable", detail: "the index answered a body that is not JSON" };
  }
  // Parsing succeeded is not the same as the document being an index. Valid
  // JSON of the wrong shape — `null`, `[]`, `"maintenance"`, an error object —
  // reached `index.providers` and threw a TypeError, which is exactly the
  // uncaught exit the "refused, by name" promise rules out.
  if (index === null || typeof index !== "object" || Array.isArray(index)) {
    return {
      ok: false,
      reason: "index_unparseable",
      detail: `the index answered valid JSON that is not an object (${index === null ? "null" : Array.isArray(index) ? "array" : typeof index})`,
    };
  }
  if (!Array.isArray(index.providers)) {
    return {
      ok: false,
      reason: "index_unparseable",
      detail: `the index has no providers array (providers is ${index.providers === undefined ? "absent" : typeof index.providers})`,
    };
  }
  const entry = index.providers.find(
    (p) => p && p.provider_did === EXPECTED_PROVIDER_DID,
  );
  if (!entry) {
    return {
      ok: false,
      reason: "pinned_did_not_listed",
      // `count` is an unsigned index field: printed only when it is an integer,
      // never as text — a string here reached the terminal verbatim, newlines
      // and all, and could spell a fake VERIFIED line into an agent's context.
      detail: `index lists ${Number.isInteger(index.count) ? index.count : "?"} provider(s), none matching the pin`,
    };
  }
  // The manifest URL is a PIN, not a discovery result. The index's value is
  // compared to the pin and then the PIN is fetched — being served from the
  // index earns a URL nothing, because the signature check that would catch a
  // forged manifest runs only AFTER the request has already gone somewhere.
  // The index-supplied value is also never interpolated into output: a
  // disagreeing URL is attacker-influenced text.
  if (entry.manifest_url !== EXPECTED_MANIFEST_URL) {
    return {
      ok: false,
      reason: "manifest_url_not_pinned",
      detail: `the index names a manifest_url that is not the pinned ${EXPECTED_MANIFEST_URL} — a moved manifest is a reviewed skill update, not a runtime surprise`,
    };
  }
  // The index GET budgets 15s and so does the registry GET in seal-hire.mjs;
  // this one passed bare `fetch`, so a stalled manifest host wedged discover
  // and seal indefinitely with no output and no way to know why.
  // `redirect: "error"` keeps the request AT the pin: a redirect is a second
  // URL nothing reviewed.
  // The manifest GET goes through the same capped reader: the SDK parses
  // whatever body it is handed, so the ceiling has to sit in front of it.
  const timedFetch = (url, init = {}) => cappedFetch(url, init);
  takeLastFetchError();
  let found;
  try {
    found = await fetchVerifiedProvider({
      manifestUrl: EXPECTED_MANIFEST_URL,
      expectedProviderDid: EXPECTED_PROVIDER_DID,
      fetchImpl: timedFetch,
    });
  } catch (e) {
    return manifestFetchRefusal(e);
  }
  // The SDK reports a thrown fetch as `manifest_unreachable` with only the
  // error's name; the real cause (body over the cap, timeout) is recovered
  // from the transport and named.
  if (!found.ok && found.reason === "manifest_unreachable") {
    // The transport threw (cap, timeout): named by cause. Otherwise the SDK
    // saw an HTTP status and its own detail ("http 500") is the true one.
    const transportError = takeLastFetchError();
    if (transportError) return manifestFetchRefusal(transportError);
    return { ok: false, reason: "manifest_unreachable", detail: `${EXPECTED_MANIFEST_URL}: ${String(found.detail ?? "http error").slice(0, 120)}` };
  }
  if (!found.ok) return { ok: false, reason: found.reason, detail: found.detail ?? "" };
  // The signature is verified; the URLs inside are still pins.
  for (const [field, pin] of [
    ["worker_base_url", EXPECTED_WORKER_BASE_URL],
    ["accept_url", EXPECTED_ACCEPT_URL],
  ]) {
    const refusal = manifestUrlFieldRefusal(found.provider.manifest, field, pin);
    if (refusal) return refusal;
  }
  return { ok: true, index, entry, provider: found.provider };
}
