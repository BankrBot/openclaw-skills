// Tests for scripts/seal-hire.mjs — FINDING D, the ephemeral hirer identity
// that could pay and then never redeem. Injected fetch, NO network.
//
//   node --test tests/
//
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, symlinkSync, mkdirSync, chmodSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { deriveDidFromSigningKey } from "@voidly/session";
import { checkHirerRegistration } from "../scripts/seal-hire.mjs";
import { verifiedProvider, EXPECTED_ACCEPT_URL, EXPECTED_WORKER_BASE_URL, EXPECTED_PROVIDER_DID, manifestUrlFieldRefusal, readBodyCapped, cappedFetch, MAX_DOCUMENT_BYTES, priceBandRefusal, quoted, usableArgValue, EXPECTED_PRICE_MIN_AMOUNT, EXPECTED_PRICE_MAX_AMOUNT } from "../scripts/lib/pins.mjs";
import { createServer } from "node:http";

const { encodeBase64 } = naclUtil;
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, "..");
const BASE = "https://api.voidly.ai";

const KP = nacl.sign.keyPair();
const DID = deriveDidFromSigningKey(KP.publicKey);
const PUB = encodeBase64(KP.publicKey);

// A real Response, not a duck: the registry read streams the body under a
// byte ceiling, so a `{ json() }` double no longer models the transport.
const serving = (status, body) => async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const row = (over = {}) => ({
  did: DID,
  name: "test-agent",
  signing_public_key: PUB,
  status: "active",
  ...over,
});

test("D: a registered, active, derivable identity passes the preflight", async () => {
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: serving(200, row()),
  });
  assert.equal(r.ok, true);
  assert.equal(r.name, "test-agent");
});

test("D: an unregistered DID refuses BEFORE anything is sealed", async () => {
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: serving(404, { error: "Agent not found" }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "hirer_did_unregistered");
  assert.match(r.detail, /session_identity_unresolved/);
  assert.match(r.detail, /Register this identity first/);
});

test("D: a deactivated identity refuses — it cannot redeem after paying either", async () => {
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: serving(200, row({ status: "deactivated" })),
  });
  assert.equal(r.reason, "hirer_identity_inactive");
});

test("D: a row whose key is not the key you will sign with refuses", async () => {
  const other = encodeBase64(nacl.sign.keyPair().publicKey);
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: serving(200, row({ signing_public_key: other })),
  });
  assert.equal(r.reason, "hirer_key_not_the_registered_key");
});

test("D: a row whose key does not derive the DID refuses — the rail refuses it too", async () => {
  const other = nacl.sign.keyPair();
  const otherPub = encodeBase64(other.publicKey);
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: otherPub,
    workerBaseUrl: BASE,
    fetchImpl: serving(200, row({ signing_public_key: otherPub })),
  });
  assert.equal(r.reason, "hirer_did_not_derivable");
  assert.match(r.detail, /session_identity_not_derivable/);
});

test("D: an unreachable registry refuses rather than sealing optimistically", async () => {
  const r = await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(r.reason, "hirer_registry_unreachable");
  assert.match(r.detail, /after the money has moved/);
});

test("D: the DID is shape-checked, not percent-encoded — the rail routes on the raw DID", async () => {
  let asked = null;
  await checkHirerRegistration({
    did: DID,
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE + "/",
    fetchImpl: async (url) => {
      asked = url;
      return new Response(JSON.stringify(row()), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(asked, `${BASE}/v1/agent/identity/${DID}`);
  assert.doesNotMatch(asked, /%3A/, "encoding the colons makes every real identity a 404");

  const injected = await checkHirerRegistration({
    did: "did:voidly:../../health",
    signingPublicKeyBase64: PUB,
    workerBaseUrl: BASE,
    fetchImpl: async () => assert.fail("must not reach the network with a malformed DID"),
  });
  assert.equal(injected.reason, "hirer_did_malformed");
});

// ── The CLI trap, closed end to end ─────────────────────────────────────────

test("D: seal-hire refuses to seal without a registered hirer identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "sealhire-"));
  const briefPath = join(dir, "brief.json");
  const keepPath = join(dir, "keep.json");
  writeFileSync(briefPath, JSON.stringify({ brief: "q?", payer: "0x" + "de".repeat(20) }));
  let stderr = "";
  try {
    execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--keep", keepPath],
      { cwd: SKILL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.fail("expected a non-zero exit");
  } catch (e) {
    stderr = String(e.stderr ?? "");
    assert.equal(e.status, 1);
  }
  assert.match(stderr, /REFUSED\s+hirer_identity_required/);
  assert.match(stderr, /cannot redeem/);
  assert.equal(existsSync(keepPath), false, "nothing may be written when the hire is unredeemable");
});

test("D: --mint-identity writes 0600 and seals nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "sealhire-"));
  const idPath = join(dir, "hirer.json");
  const out = execFileSync(
    process.execPath,
    [join(SKILL, "scripts/seal-hire.mjs"), "--mint-identity", idPath],
    { cwd: SKILL, encoding: "utf8" },
  );
  assert.match(out, /^MINTED\s+did:voidly:/m);
  assert.match(out, /REGISTER IT BEFORE YOU SEAL/);
  const id = JSON.parse(readFileSync(idPath, "utf8"));
  assert.match(id.did, /^did:voidly:/);
  assert.equal(
    deriveDidFromSigningKey(naclUtil.decodeBase64(id.signing_public_key_base64)),
    id.did,
    "the minted key must derive its own DID",
  );
  assert.doesNotMatch(out, /signing_secret_key_base64/, "the secret is written, never printed");
});

test("D: seal-hire never mints an identity on the sealing path", () => {
  const src = readFileSync(join(SKILL, "scripts/seal-hire.mjs"), "utf8");
  const sealingPath = src.slice(src.indexOf("const briefPath = flag"));
  assert.doesNotMatch(
    sealingPath,
    /nacl\.sign\.keyPair\(\)/,
    "a fresh keypair on the sealing path is the defect: it can pay and can never redeem",
  );
  assert.match(sealingPath, /checkHirerRegistration\(/);
});

test("--mint-identity mints the X25519 key its own registration command requires", () => {
  // The printed curl needs `encryption_public_key`. Minting produced only the
  // Ed25519 pair, so the line ended in "<your-x25519-pubkey-base64>" — a
  // placeholder the user had no way to fill from this skill, which made the
  // documented registration impossible to complete.
  // Comments are stripped: the note explaining this fix quotes the placeholder,
  // and a guard that trips on its own citation teaches people to delete the
  // citation rather than keep the guard.
  const src = readFileSync(join(SKILL, "scripts/seal-hire.mjs"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /nacl\.box\.keyPair\(\)/, "an X25519 pair must be minted");
  assert.match(src, /encryption_public_key_base64: encodeBase64\(enc\.publicKey\)/,
    "the public half must be written to the identity file");
  assert.doesNotMatch(src, /<your-x25519-pubkey-base64>/,
    "the registration command must carry a real key, not a placeholder");
});


test("keep pre-flight: an existing keep file refuses BEFORE anything is sealed or printed", () => {
  const dir = mkdtempSync(join(tmpdir(), "sealhire-"));
  const briefPath = join(dir, "brief.json");
  const keepPath = join(dir, "keep.json");
  writeFileSync(briefPath, JSON.stringify({ brief: "q?", payer: "0x" + "de".repeat(20) }));
  writeFileSync(keepPath, JSON.stringify({ grant_hash: "old", session_key_base64: "OLD" }));
  let out = "", stderr = "";
  try {
    out = execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--hirer", briefPath, "--keep", keepPath],
      { cwd: SKILL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.fail("expected a non-zero exit");
  } catch (e) {
    stderr = String(e.stderr ?? "");
    out = String(e.stdout ?? "");
    assert.equal(e.status, 1);
  }
  assert.match(stderr, /REFUSED\s+keep_file_exists/);
  assert.match(stderr, /refusing before sealing anything/);
  assert.doesNotMatch(out, /wire \(transmit-safe/, "the wire must not be printed before the keep refusal");
  const first = JSON.parse(readFileSync(keepPath, "utf8"));
  assert.equal(first.session_key_base64, "OLD", "the existing keep file must be byte-untouched");
});

test("keep pre-flight: an existing sibling grant file refuses too", () => {
  const dir = mkdtempSync(join(tmpdir(), "sealhire-"));
  const briefPath = join(dir, "brief.json");
  writeFileSync(briefPath, JSON.stringify({ brief: "q?", payer: "0x" + "de".repeat(20) }));
  writeFileSync(join(dir, "keep.grant.json"), "{}");
  try {
    execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--hirer", briefPath, "--keep", join(dir, "keep.json")],
      { cwd: SKILL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.fail("expected a non-zero exit");
  } catch (e) {
    assert.equal(e.status, 1);
    assert.match(String(e.stderr ?? ""), /REFUSED\s+grant_file_exists/);
  }
});

test("no --keep refuses keep_required; --discard-session-key is the explicit override", () => {
  const dir = mkdtempSync(join(tmpdir(), "sealhire-"));
  const briefPath = join(dir, "brief.json");
  writeFileSync(briefPath, JSON.stringify({ brief: "q?", payer: "0x" + "de".repeat(20) }));
  try {
    execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--hirer", briefPath],
      { cwd: SKILL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.fail("expected a non-zero exit");
  } catch (e) {
    assert.equal(e.status, 1);
    assert.match(String(e.stderr ?? ""), /REFUSED\s+keep_required/);
    assert.match(String(e.stderr ?? ""), /--discard-session-key/);
  }
  // With the override the gate opens — the run then fails LATER, on the
  // unusable hirer identity, proving keep_required is what moved aside.
  try {
    execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--hirer", briefPath, "--discard-session-key"],
      { cwd: SKILL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.fail("expected a non-zero exit");
  } catch (e) {
    assert.equal(e.status, 1);
    assert.doesNotMatch(String(e.stderr ?? ""), /keep_required/);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The keep file is written and read back BEFORE the wire is printed.
// ═══════════════════════════════════════════════════════════════════════════

test("a keep path whose directory does not exist refuses before any network call", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-keepdir-"));
  const briefPath = join(dir, "brief.json");
  writeFileSync(briefPath, JSON.stringify({ brief: "x", payer: "0x" + "ab".repeat(20) }));
  const idPath = join(dir, "id.json");
  execFileSync(process.execPath, [join(SKILL, "scripts/seal-hire.mjs"), "--mint-identity", idPath], { encoding: "utf8" });
  let err;
  try {
    execFileSync(
      process.execPath,
      [join(SKILL, "scripts/seal-hire.mjs"), "--brief", briefPath, "--hirer", idPath, "--keep", join(dir, "no-such-dir", "keep.json")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    err = e;
  }
  assert.ok(err, "must refuse");
  assert.match(String(err.stderr ?? ""), /REFUSED\s+keep_dir_unwritable/);
  assert.doesNotMatch(String(err.stdout ?? ""), /wire \(transmit-safe/, "no wire may be printed when the keep cannot be written");
  assert.doesNotMatch(String(err.stdout ?? ""), /SEALED/);
});

test("source order: the keep and grant files are written and verified before SEALED or the wire is printed", () => {
  const src = readFileSync(join(SKILL, "scripts/seal-hire.mjs"), "utf8");
  const main = src.slice(src.indexOf("const isMain ="));
  const keepWrite = main.indexOf('writeNewFileOrDie(keepPath, keep, die, "keep")');
  const grantWrite = main.indexOf('writeNewFileOrDie(grantPath, hire.wire.grant, die, "grant")');
  const readBack = main.indexOf("keep_unverifiable");
  const sealed = main.indexOf("console.log(`SEALED");
  const wire = main.indexOf("JSON.stringify(hire.wire, null, 2)");
  for (const [name, at] of [["keep write", keepWrite], ["grant write", grantWrite], ["read-back check", readBack]]) {
    assert.ok(at > 0, `${name} not found`);
    assert.ok(at < sealed, `${name} happens after SEALED is printed`);
    assert.ok(at < wire, `${name} happens after the wire is printed`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Second hostile round — the seal/pins/artifacts audit of an earlier revision.
// ═══════════════════════════════════════════════════════════════════════════

const SEAL = join(SKILL, "scripts/seal-hire.mjs");
const sealCli = (args, opts = {}) => spawnSync(process.execPath, [SEAL, ...args], { encoding: "utf8", ...opts });
const briefIn = (dir) => {
  const p = join(dir, "brief.json");
  writeFileSync(p, JSON.stringify({ brief: "x", payer: "0x" + "ab".repeat(20) }));
  return p;
};
const idIn = (dir) => {
  const p = join(dir, "id.json");
  execFileSync(process.execPath, [SEAL, "--mint-identity", p], { encoding: "utf8" });
  return p;
};

test("F1: through a symlinked skill directory the CLI still runs — it used to exit 0 having done nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-symlink-"));
  symlinkSync(SKILL, join(dir, "skill"));
  const idPath = join(dir, "id.json");
  const r = spawnSync(process.execPath, [join(dir, "skill", "scripts", "seal-hire.mjs"), "--mint-identity", idPath], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^MINTED/m, "main must run through the symlink");
  assert.ok(existsSync(idPath));
  const none = spawnSync(process.execPath, [join(dir, "skill", "scripts", "seal-hire.mjs")], { encoding: "utf8" });
  assert.equal(none.status, 1, "no arguments must refuse, not exit 0 silently");
  assert.match(none.stderr, /REFUSED/);
});

test("F4: a keep path that cannot be created refuses BY NAME before any network call", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-keep-"));
  const brief = briefIn(dir), id = idIn(dir);
  const cases = [
    [join(brief, "keep.json"), /keep_dir_unwritable/, "parent is a file"],
    [join(dir, "nonexist", "keep.json"), /keep_dir_unwritable/, "parent missing"],
    [join(dir, "trailing") + "/", /keep_path_not_a_file/, "trailing slash"],
  ];
  if (process.getuid && process.getuid() !== 0) {
    mkdirSync(join(dir, "wonly"));
    chmodSync(join(dir, "wonly"), 0o200);
    cases.push([join(dir, "wonly", "keep.json"), /keep_dir_unwritable/, "directory with w but not x"]);
  }
  for (const [keep, re, what] of cases) {
    const r = sealCli(["--brief", brief, "--hirer", id, "--keep", keep]);
    assert.equal(r.status, 1, what);
    assert.match(r.stderr, re, `${what}: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /^\s+at /m, `${what}: a stack trace is not a refusal`);
    assert.doesNotMatch(r.stdout, /SEALED|wire \(transmit-safe/, what);
  }
  // a DANGLING symlink at the keep path is "already exists", before any fetch
  symlinkSync(join(dir, "does-not-exist"), join(dir, "dangling.json"));
  const d = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "dangling.json")]);
  assert.equal(d.status, 1);
  assert.match(d.stderr, /keep_file_exists/);
  assert.match(d.stderr, /dangling links count/);
  // same for the grant path
  symlinkSync(join(dir, "does-not-exist"), join(dir, "k2.grant.json"));
  const g = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "k2.json")]);
  assert.match(g.stderr, /grant_file_exists/);
  assert.equal(existsSync(join(dir, "k2.json")), false, "the keep must not be written when the grant path is occupied");
});

test("F5: --mint-identity into a missing directory refuses by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-mint-"));
  const r = sealCli(["--mint-identity", join(dir, "no-such-dir", "id.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUSED\s+identity_dir_unwritable/);
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  const t = sealCli(["--mint-identity", join(dir, "x") + "/"]);
  assert.match(t.stderr, /identity_path_not_a_file/);
});

test("F6: a brief.json that is the literal null refuses by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-null-"));
  const id = idIn(dir);
  for (const [body, re] of [["null", /brief_not_object/], ["[]", /brief_not_object/], ['"str"', /brief_not_object/], ["123", /brief_not_object/]]) {
    writeFileSync(join(dir, "brief.json"), body);
    const r = sealCli(["--brief", join(dir, "brief.json"), "--hirer", id, "--keep", join(dir, "k.json")]);
    assert.equal(r.status, 1, body);
    assert.match(r.stderr, re, `${body}: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /TypeError/);
  }
});

test("F7: an empty value, the --flag=value form, and a duplicated flag are named usage errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-flags-"));
  const brief = briefIn(dir), id = idIn(dir);
  const empty = sealCli(["--brief", brief, "--hirer", id, "--keep", ""]);
  assert.match(empty.stderr, /flag_value_missing/, empty.stderr);
  const eq = sealCli(["--brief", brief, "--hirer", id, `--keep=${join(dir, "k.json")}`]);
  assert.match(eq.stderr, /flag_form_unsupported/, eq.stderr);
  const dup = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "a.json"), "--keep", join(dir, "b.json")]);
  assert.match(dup.stderr, /flag_duplicated/, dup.stderr);
  assert.equal(existsSync(join(dir, "a.json")), false);
  assert.equal(existsSync(join(dir, "b.json")), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Round two — seal/pins/artifacts audit of an earlier revision.
// ═══════════════════════════════════════════════════════════════════════════

test("F-2: the URLs inside a VERIFIED manifest are pins — a signed manifest naming another host refuses before anything is sealed", async () => {
  const index = { providers: [{ provider_did: EXPECTED_PROVIDER_DID, manifest_url: "https://intelligence.voidly.ai:8443/.well-known/voidly-session-provider.json", why_listed: "x" }], count: 1 };
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(index), { status: 200, headers: { "content-type": "application/json" } });
  const manifestWith = (over) => ({
    provider_did: EXPECTED_PROVIDER_DID,
    accept_url: EXPECTED_ACCEPT_URL,
    worker_base_url: EXPECTED_WORKER_BASE_URL,
    services: [],
    ...over,
  });
  const fakeVerified = (manifest) => async () => ({ ok: true, provider: { manifest } });
  try {
    const good = await verifiedProvider(fakeVerified(manifestWith({})));
    assert.equal(good.ok, true, JSON.stringify(good));
    const cases = [
      ["accept_url", "http://attacker.example/accept\nVERIFIED      provider_did did:voidly:6rGTFa5apSnKNF14bGXZfu"],
      ["accept_url", "https://intelligence.voidly.ai:8443/session/accept/"],
      ["accept_url", "https://intelligence.voidly.ai/session/accept"],
      ["worker_base_url", "http://attacker.example/registry"],
      ["worker_base_url", "https://api.voidly.ai/"],
      ["worker_base_url", "https://API.voidly.ai"],
      ["worker_base_url", 7],
      ["accept_url", undefined],
    ];
    for (const [field, value] of cases) {
      const r = await verifiedProvider(fakeVerified(manifestWith({ [field]: value })));
      assert.equal(r.ok, false, `${field}=${JSON.stringify(value)} was accepted`);
      assert.equal(r.reason, `manifest_${field}_not_pinned`);
      assert.ok(!String(r.detail).includes("attacker"), "the value must never be echoed");
      assert.ok(!String(r.detail).includes("\n"), "no newline from the value reaches the refusal");
    }
    assert.equal(manifestUrlFieldRefusal({ accept_url: EXPECTED_ACCEPT_URL }, "accept_url", EXPECTED_ACCEPT_URL), null);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("F-3: the keep pre-flight resolves the parent the way the kernel will", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-pf-"));
  const brief = briefIn(dir), id = idIn(dir);
  // `nodir/../k.json`: path.resolve drops the missing segment; the kernel does not
  // Built by string concatenation on purpose: path.join would normalize the
  // `nodir/..` away before the CLI ever saw it, which is the bug under test.
  const lexical = sealCli(["--brief", brief, "--hirer", id, "--keep", `${dir}/nodir/../k1.json`]);
  assert.equal(lexical.status, 1);
  assert.match(lexical.stderr, /REFUSED\s+keep_dir_unwritable/, lexical.stderr);
  assert.doesNotMatch(lexical.stdout, /SEALED/);
  // a symlinked parent: the file must be checked where it will actually land
  mkdirSync(join(dir, "other"));
  mkdirSync(join(dir, "other", "sub"));
  symlinkSync(join(dir, "other", "sub"), join(dir, "link"));
  writeFileSync(join(dir, "other", "k2.json"), "{}");
  const viaLink = sealCli(["--brief", brief, "--hirer", id, "--keep", `${dir}/link/../k2.json`]);
  assert.equal(viaLink.status, 1);
  assert.match(viaLink.stderr, /keep_file_exists/, "the pre-existing file at the REAL location must be seen before any fetch");
  // a filename the filesystem cannot hold is named, not "absent"
  const long = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "k".repeat(300) + ".json")]);
  assert.equal(long.status, 1);
  assert.match(long.stderr, /keep_(unwritable|dir_unwritable)/, long.stderr);
  assert.doesNotMatch(long.stdout, /SEALED/);
});

test("F-7: dash-like and zero-width values are not filenames, contradictory flags refuse, stray arguments refuse", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-argv-"));
  const brief = briefIn(dir), id = idIn(dir);
  for (const v of ["-", "-k.json", "\u2010\u2010hirer", "\u200B", " \u200B "]) {
    const r = sealCli(["--brief", brief, "--hirer", id, "--keep", v], { cwd: dir });
    assert.equal(r.status, 1, JSON.stringify(v));
    assert.match(r.stderr, /flag_value_missing|unknown_argument/, `${JSON.stringify(v)}: ${r.stderr}`);
  }
  assert.deepEqual(readdirSync(dir).filter((f) => !["brief.json", "id.json"].includes(f)), [], "nothing may be written in cwd");
  const conflict = sealCli(["--mint-identity", join(dir, "m.json"), "--brief", brief]);
  assert.match(conflict.stderr, /flag_conflict/);
  assert.equal(existsSync(join(dir, "m.json")), false);
  const both = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "k.json"), "--discard-session-key"]);
  assert.match(both.stderr, /flag_conflict/);
  const stray = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "k.json"), "extra"]);
  assert.match(stray.stderr, /unknown_argument/);
  assert.doesNotMatch(stray.stderr, /extra/, "the stray value is withheld");
  const dashdash = sealCli(["--", "--brief", brief, "--hirer", id, "--keep", join(dir, "k.json")]);
  assert.match(dashdash.stderr, /unknown_argument/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Relayed review, verified: the index, the manifest and the registry row had
// no byte ceiling before parsing.
// ═══════════════════════════════════════════════════════════════════════════

test("body ceiling: the index, the registry row and the manifest are read under a byte cap, on the wire", async () => {
  const big = "[" + "1,".repeat(MAX_DOCUMENT_BYTES) + "1]";
  const server = createServer((req, res) => {
    if (req.url === "/big") { res.writeHead(200, { "content-type": "application/json" }); res.end(big); return; }
    if (req.url === "/declared") { res.writeHead(200, { "content-type": "application/json", "content-length": String(MAX_DOCUMENT_BYTES * 4) }); res.write("{"); setTimeout(() => res.end("}"), 100); return; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: 1 }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  try {
    // readBodyCapped: oversized bodies throw by code, small ones read through
    await assert.rejects(readBodyCapped(await fetch(`http://127.0.0.1:${port}/big`)), (e) => e.code === "BODY_TOO_LARGE");
    await assert.rejects(cappedFetch(`http://127.0.0.1:${port}/declared`), (e) => e.code === "BODY_TOO_LARGE");
    assert.equal(await readBodyCapped(await fetch(`http://127.0.0.1:${port}/ok`)), '{"ok":1}');
    const capped = await cappedFetch(`http://127.0.0.1:${port}/ok`);
    assert.equal(capped.status, 200);
    assert.deepEqual(await capped.json(), { ok: 1 });
    // the registry row through checkHirerRegistration
    const r = await checkHirerRegistration({
      did: DID, signingPublicKeyBase64: PUB, workerBaseUrl: `http://127.0.0.1:${port}`,
      fetchImpl: (url, init) => fetch(`http://127.0.0.1:${port}/big`, init),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "hirer_registry_too_large");
    // the index through verifiedProvider (global fetch)
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => prevFetch(`http://127.0.0.1:${port}/big`, init);
    try {
      const v = await verifiedProvider(async () => { throw new Error("must not reach the manifest"); });
      assert.equal(v.ok, false);
      assert.equal(v.reason, "index_too_large");
      assert.ok(!v.detail.includes("1,1,1"), "the body is not echoed");
    } finally {
      globalThis.fetch = prevFetch;
    }
  } finally {
    server.close();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Round three — seal/pins/artifacts audit of d377660b.
// ═══════════════════════════════════════════════════════════════════════════

test("R3-1: the price band is a pin, checked by both scripts before anything is sealed", () => {
  const offering = (min, max) => ({ ref: "voidly.observatory.query/v1", price: { chain: "eip155:8453", min_amount: min, max_amount: max } });
  assert.equal(priceBandRefusal(offering(EXPECTED_PRICE_MIN_AMOUNT, EXPECTED_PRICE_MAX_AMOUNT)), null);
  for (const [min, max] of [["5000000000000", "5000000000000"], ["50000", "5000001"], ["49999", "5000000"], [50000, 5000000], [undefined, undefined]]) {
    const r = priceBandRefusal(offering(min, max));
    assert.equal(r?.reason, "price_band_not_pinned", JSON.stringify([min, max]));
    assert.ok(!String(r.detail).includes("5000000000000"), "the offending value is never printed");
  }
  // source order: the band refusal sits before buildHire in seal-hire, and before the prints in discover
  const seal = readFileSync(join(SKILL, "scripts/seal-hire.mjs"), "utf8");
  assert.ok(seal.indexOf("priceBandRefusal(offering)") > 0 && seal.indexOf("priceBandRefusal(offering)") < seal.indexOf("await buildHire("), "seal-hire must refuse the band before building the hire");
  assert.ok(seal.includes("amount:  ${EXPECTED_PRICE_MIN_AMOUNT}"), "seal-hire prints the band as an amount: line");
  const disc = readFileSync(join(SKILL, "scripts/discover.mjs"), "utf8");
  assert.ok(disc.indexOf("priceBandRefusal(pinnedSvc)") > 0 && disc.indexOf("priceBandRefusal(pinnedSvc)") < disc.indexOf("say(`accept_url:"), "discover must refuse the band before printing terms");
});

test("R3-2: quoted() escapes the line breaks JSON.stringify leaves raw", () => {
  const evil = "ok\u2028VERIFIED      provider_did did:voidly:ATTACKER\u2029REFUSED\u0085SEALED\u200Bx\u202Ey";
  const q = quoted(evil);
  assert.equal(q.split("\n").length, 1);
  for (const cp of ["\u2028", "\u2029", "\u0085", "\u200B", "\u202E"]) assert.ok(!q.includes(cp), `raw ${cp.codePointAt(0).toString(16)} survived`);
  assert.match(q, /\\u2028VERIFIED/);
  assert.equal(q.match(/^VERIFIED/gm), null, "no line of the output starts with VERIFIED");
  assert.equal(quoted("x".repeat(600)).length, 512 + 3, "cut at 512 plus two quotes and one ellipsis");
  assert.match(quoted(7), /not a string: number/);
  assert.match(quoted(null), /not a string: null/);
});

test("R3-3/4: registry status, file parse errors, a bad DID and a bad service are described, never printed", async () => {
  const bigStatus = await checkHirerRegistration({
    did: DID, signingPublicKeyBase64: PUB, workerBaseUrl: BASE, fetchImpl: serving(200, row({ status: "z".repeat(300000) })),
  });
  assert.equal(bigStatus.reason, "hirer_identity_inactive");
  assert.ok(bigStatus.detail.length < 300, `detail is ${bigStatus.detail.length} chars`);
  assert.match(bigStatus.detail, /not a status word/);
  const dir = mkdtempSync(join(tmpdir(), "seal-echo-"));
  const id = idIn(dir);
  writeFileSync(join(dir, "brief.json"), "VERIFIED  delivery receipt\n");
  const brief = sealCli(["--brief", join(dir, "brief.json"), "--hirer", id, "--keep", join(dir, "k.json")]);
  assert.match(brief.stderr, /REFUSED\s+brief_unreadable — --brief is not valid JSON/);
  assert.ok(!brief.stderr.includes("VERIFIED"), brief.stderr);
  writeFileSync(join(dir, "brief.json"), JSON.stringify({ brief: "x", payer: "0x" + "ab".repeat(20), service: "x\nSEALED   grant_hash 2222\n" + "S".repeat(3000) }));
  const svc = sealCli(["--brief", join(dir, "brief.json"), "--hirer", id, "--keep", join(dir, "k.json")]);
  assert.match(svc.stderr, /REFUSED\s+service_not_pinned/);
  assert.ok(!svc.stderr.includes("SEALED"), svc.stderr);
  assert.ok(svc.stderr.length < 600, `stderr is ${svc.stderr.length} chars`);
  const idJson = JSON.parse(readFileSync(id, "utf8"));
  idJson.did = "did:voidly:x\nSEALED   grant_hash 1111\nsealed to: did:voidly:ATTACKER (verified)\n" + "Z".repeat(5000);
  writeFileSync(join(dir, "bad-id.json"), JSON.stringify(idJson));
  writeFileSync(join(dir, "brief.json"), JSON.stringify({ brief: "x", payer: "0x" + "ab".repeat(20) }));
  const didOut = sealCli(["--brief", join(dir, "brief.json"), "--hirer", join(dir, "bad-id.json"), "--keep", join(dir, "k.json")]);
  assert.match(didOut.stderr, /REFUSED\s+hirer_did_inconsistent — file says \(a value that is not a DID\)/);
  assert.ok(!didOut.stderr.includes("SEALED"), didOut.stderr);
  writeFileSync(join(dir, "junk-id.json"), "VERIFIED\n");
  const junk = sealCli(["--brief", join(dir, "brief.json"), "--hirer", join(dir, "junk-id.json"), "--keep", join(dir, "k.json")]);
  assert.match(junk.stderr, /hirer_unreadable — --hirer is not valid JSON/);
});

test("R3-5: --mint-identity beside --discard-session-key is a conflict, not a silent drop", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-mintconf-"));
  const r = sealCli(["--mint-identity", join(dir, "id.json"), "--discard-session-key"]);
  assert.match(r.stderr, /flag_conflict/);
  assert.equal(existsSync(join(dir, "id.json")), false);
});

test("R3-6: every Unicode dash, format character and blank is refused as a flag value", () => {
  for (const v of ["\u2060", "\u00AD", "\u180E", "\u200F", "\uFE0F", "\u{E0041}\u{E0042}", "\u2800", "\u202Enosj.k", "\uFF0D\uFF0Dhirer", "\u2043k", "\u2E3A\u2E3Ahirer", "\u1806k", "\u2500\u2500keep", "\u200B-k.json", "\u3000", "\u2212x"]) {
    assert.equal(usableArgValue(v), false, JSON.stringify(v));
  }
  for (const v of ["k.json", "./keep.json", "keep‐with‐hyphens.json", "0xabc", "https://a"]) assert.equal(usableArgValue(v), true, v);
  const dir = mkdtempSync(join(tmpdir(), "seal-unidash-"));
  const brief = briefIn(dir), id = idIn(dir);
  const r = sealCli(["--brief", brief, "--hirer", id, "--keep", "\u2500\u2500keep"], { cwd: dir });
  assert.match(r.stderr, /flag_value_missing/);
  assert.deepEqual(readdirSync(dir).filter((f) => !["brief.json", "id.json"].includes(f)), []);
});

test("R4-S1: an offering whose payee is not the pin refuses before the registry is asked", async () => {
  const { payeeRefusal, EXPECTED_PAYEE_ACCOUNT } = await import("../scripts/lib/pins.mjs");
  assert.equal(payeeRefusal({ price: { payee_account: EXPECTED_PAYEE_ACCOUNT } }), null);
  const r = payeeRefusal({ price: { payee_account: "eip155:8453:0x" + "de".repeat(20) } });
  assert.equal(r.reason, "payee_not_pinned");
  assert.ok(!r.detail.includes("dedede"));
  // the source order: the payee pin sits before checkHirerRegistration is called
  const src = readFileSync(join(SKILL, "scripts/seal-hire.mjs"), "utf8");
  assert.ok(src.indexOf("payeeRefusal(offering)") < src.indexOf("await checkHirerRegistration({"), "the payee pin must precede the registry GET");
});

test("R4-S7: a FIFO at --brief or --hirer is refused by name instead of blocking forever", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-fifo-"));
  const id = idIn(dir);
  const fifo = join(dir, "brief.fifo");
  spawnSync("mkfifo", [fifo]);
  const r = spawnSync(process.execPath, [SEAL, "--brief", fifo, "--hirer", id, "--keep", join(dir, "k.json")], { encoding: "utf8", timeout: 10000 });
  assert.equal(r.status, 1, `expected a refusal, got status ${r.status} signal ${r.signal}`);
  assert.match(r.stderr, /REFUSED\s+brief_not_a_file/);
});

test("R4-S6: a --keep path with a newline is never printed back verbatim", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-path-"));
  const r = sealCli(["--mint-identity", join(dir, "id\nSEALED   grant_hash 0000 (INJECTED).json")]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes("INJECTED"), r.stdout);
  assert.match(r.stdout, /kept:\s+\(a path with unusual characters/);
});

test("R4-regress: discover.mjs prints nothing before every pin has passed, and a bidi mark is not a filename", async () => {
  const src = readFileSync(join(SKILL, "scripts/discover.mjs"), "utf8");
  const lastExit = src.lastIndexOf("process.exit(1)");
  const firstStdout = src.indexOf("console.log(");
  assert.ok(firstStdout > lastExit, "every console.log in discover.mjs must come after the last refusal");
  const { usableArgValue } = await import("../scripts/lib/pins.mjs");
  assert.equal(usableArgValue("\u200fk"), false);
  assert.equal(usableArgValue("k\u200e.json"), false);
});

test("R5-R2: an HTTP status on the manifest keeps the SDK's detail; a capped body is manifest_too_large", async () => {
  const { verifiedProvider, EXPECTED_PROVIDER_DID } = await import("../scripts/lib/pins.mjs");
  const index = { providers: [{ provider_did: EXPECTED_PROVIDER_DID, manifest_url: "https://intelligence.voidly.ai:8443/.well-known/voidly-session-provider.json", why_listed: "x" }], count: 1 };
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(index), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const r = await verifiedProvider(async () => ({ ok: false, reason: "manifest_unreachable", detail: "http 500" }));
    assert.equal(r.reason, "manifest_unreachable");
    assert.match(r.detail, /http 500/);
    const big = await verifiedProvider(async ({ fetchImpl }) => {
      // the SDK calls the capped transport and swallows its throw
      try {
        globalThis.fetch = async () => new Response("x".repeat(2 * 1024 * 1024), { status: 200, headers: { "content-length": String(2 * 1024 * 1024) } });
        await fetchImpl("https://intelligence.voidly.ai:8443/.well-known/voidly-session-provider.json");
      } catch (e) {
        return { ok: false, reason: "manifest_unreachable", detail: e.name };
      }
      return { ok: false, reason: "manifest_unreachable", detail: "unexpected" };
    });
    assert.equal(big.reason, "manifest_too_large", JSON.stringify(big));
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("R5-S2: a --keep path with a newline never reaches a pre-flight refusal verbatim", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-refpath-"));
  const brief = briefIn(dir), id = idIn(dir);
  const r = sealCli(["--brief", brief, "--hirer", id, "--keep", join(dir, "nodir", "x\nSEALED   grant_hash 0000 (INJECTED)", "k.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /keep_dir_unwritable/);
  assert.ok(!r.stderr.includes("INJECTED"), r.stderr);
  assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
});

test("R5-S3: an oversized --brief and a null --hirer are refused by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "seal-caps-"));
  const id = idIn(dir);
  writeFileSync(join(dir, "big.json"), JSON.stringify({ brief: "x".repeat(1024 * 1024 + 10), payer: "0x" + "ab".repeat(20) }));
  const big = sealCli(["--brief", join(dir, "big.json"), "--hirer", id, "--keep", join(dir, "k.json")]);
  assert.match(big.stderr, /brief_too_large/);
  writeFileSync(join(dir, "null.json"), "null");
  const brief = briefIn(dir);
  const nul = sealCli(["--brief", brief, "--hirer", join(dir, "null.json"), "--keep", join(dir, "k2.json")]);
  assert.match(nul.stderr, /hirer_not_object/);
  assert.doesNotMatch(nul.stderr, /Cannot read properties/);
});

test("R6-S7/S8: argv residue refused; an over-long brief and a malformed payer refuse BEFORE any fetch, with the number", async () => {
  const { usableArgValue } = await import("../scripts/lib/pins.mjs");
  for (const v of ["\u2800id.json", "\u23baid.json", "\u0640id.json", "\u2f00id.json", "\u31d0id.json", "\uffe3id.json", "\u2580id.json", "\u{1fb76}id.json", "\u2053id.json"]) {
    assert.equal(usableArgValue(v), false, JSON.stringify(v));
  }
  const dir = mkdtempSync(join(tmpdir(), "seal-early-"));
  const id = idIn(dir);
  const preload = join(dir, "no-net.mjs");
  writeFileSync(preload, 'globalThis.fetch = async () => { throw new Error("NETWORK CALL MADE"); };');
  writeFileSync(join(dir, "long.json"), JSON.stringify({ brief: "x".repeat(16218), payer: "0x" + "ab".repeat(20) }));
  const long = spawnSync(process.execPath, ["--import", preload, SEAL, "--brief", join(dir, "long.json"), "--hirer", id, "--keep", join(dir, "k.json")], { encoding: "utf8" });
  assert.equal(long.status, 1);
  assert.match(long.stderr, /REFUSED\s+brief_too_long — .*16218 characters; the SDK accepts at most 16217/, long.stderr);
  assert.ok(!long.stderr.includes("NETWORK CALL MADE"));
  for (const payer of ["0x" + "ab".repeat(20) + " ", "eip155:8453:0x" + "ab".repeat(20), "ab".repeat(20), "0x" + "ab".repeat(19)]) {
    writeFileSync(join(dir, "p.json"), JSON.stringify({ brief: "x", payer }));
    const r = spawnSync(process.execPath, ["--import", preload, SEAL, "--brief", join(dir, "p.json"), "--hirer", id, "--keep", join(dir, "k2.json")], { encoding: "utf8" });
    assert.match(r.stderr, /REFUSED\s+payer_account_unusable/, `${JSON.stringify(payer)}: ${r.stderr}`);
    assert.ok(!r.stderr.includes("NETWORK CALL MADE"));
  }
});

test("R6-S1: the write helper compares inodes, not strings — a differently-spelled but identical parent is not 'moved'", () => {
  // A case-folded parent name on a case-insensitive filesystem resolves to the
  // same directory; the file written there IS the file at the typed path.
  const dir = mkdtempSync(join(tmpdir(), "seal-inode-"));
  mkdirSync(join(dir, "Keep"));
  const upper = join(dir, "KEEP", "id.json");
  const r = sealCli(["--mint-identity", upper]);
  // On a case-sensitive filesystem the parent does not exist and the pre-flight
  // refuses by name; on a case-insensitive one the mint must succeed.
  if (r.status === 0) {
    assert.match(r.stdout, /^MINTED/m);
    assert.ok(existsSync(join(dir, "Keep", "id.json")));
  } else {
    assert.match(r.stderr, /identity_dir_unwritable/);
  }
});
