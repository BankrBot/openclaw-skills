// Tests for the SKILL's prose — FINDINGS E and F.
//
// E and F are honesty defects, not code defects, so the tests are assertions
// about what the shipped documentation may and may not say. They exist because
// both defects were introduced by a sentence that read well and was false, and
// a sentence is exactly the kind of thing that comes back.
//
//   node --test tests/
//
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, "..");
const read = (p) => readFileSync(join(SKILL, p), "utf8");

const SKILL_MD = read("SKILL.md");
const HIRE_MD = read("references/encrypted-hire.md");
const PROOF_MD = read("references/settlement-proof.md");
const ALL_PROSE = [
  ["SKILL.md", SKILL_MD],
  ["references/encrypted-hire.md", HIRE_MD],
  ["references/settlement-proof.md", PROOF_MD],
];

// The scripts PRINT prose. seal-hire.mjs carried the same false "can never be
// opened by anyone" sentence as the doc did, and this file could not see it
// because it only ever read .md. A claim a user reads on their terminal is a
// shipped claim.
const SPOKEN = [
  ["scripts/seal-hire.mjs", read("scripts/seal-hire.mjs")],
  ["scripts/verify-settlement.mjs", read("scripts/verify-settlement.mjs")],
  ["scripts/verify-artifacts.mjs", read("scripts/verify-artifacts.mjs")],
  ["scripts/discover.mjs", read("scripts/discover.mjs")],
];
const EVERYTHING_A_USER_READS = [...ALL_PROSE, ...SPOKEN];

// EVERY forbidden-claim scan runs over the full corpus, not ALL_PROSE.
// When SPOKEN was introduced it was wired into only the two assertions that
// needed it that day, so the commit message said "the guard now reads the four
// scripts as prose too" while eleven of thirteen assertions still read three
// .md files — and the sentences fixed the commit before could be reintroduced
// verbatim in a script and stay green. A corpus that some assertions use is
// not a corpus.

// ═══════════════════════════════════════════════════════════════════════════
// FINDING E — "the provider does not see the brief" was false.
// ═══════════════════════════════════════════════════════════════════════════
//
// The manifest's claim is about the RELAY. The code seals the brief to the
// PROVIDER's manifest encryption key, and the only pinned provider is Voidly's
// own daemon. Telling a user their brief is private from us was the worst
// claim in the set.

test("E: no document claims the provider cannot see the brief", () => {
  // The exact shipped sentence, and the family it belongs to. A prohibition
  // ("Do not tell a user their brief is private from the provider") is the
  // opposite of the claim, so the Do-NOT bullets are removed before scanning —
  // otherwise the fix would trip its own guard.
  const claimsOnly = (text) =>
    text
      .split("\n")
      .filter((l) => !/^\s*-?\s*\*{0,2}Do not\b/i.test(l))
      .join("\n");
  const forbidden = [
    /what the provider and relay see[^.]*not\*{0,2} the brief/is,
    /provider[^.\n]{0,60}(does not|cannot|never)[^.\n]{0,40}(see|read)[^.\n]{0,30}brief/i,
    /brief[^.\n]{0,60}(hidden|private|invisible)[^.\n]{0,20}from the provider/i,
  ];
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    for (const re of forbidden) {
      assert.doesNotMatch(claimsOnly(text), re, `${name} makes a provider-blindness claim: ${re}`);
    }
  }
});

test("E: SKILL.md states plainly that the provider CAN read the brief", () => {
  assert.match(SKILL_MD, /### Who can read the brief/);
  assert.match(SKILL_MD, /\*\*The provider CAN read it\.\*\*/);
  assert.match(SKILL_MD, /\*\*The relay cannot read it\.\*\*/);
});

test("E: the relay claim is attributed to the manifest, verbatim", () => {
  // Quoted from the live manifest's notes[1] and the index's provider_notes[1].
  const verbatim =
    "The relay operator sees both DIDs, the\n  grant/offer/capsule hashes, the price band, the settlement pointer and the\n  timings. It does NOT see the brief or the result.";
  assert.ok(
    SKILL_MD.includes(verbatim),
    "SKILL.md must quote the manifest's relay sentence rather than paraphrase it into a provider claim",
  );
});

test("E: the first-party consequence is named, not left to inference", () => {
  assert.match(
    SKILL_MD,
    /only pinned provider is Voidly's own first-party daemon/i,
    "the reader must be told that the party reading the brief is Voidly",
  );
  assert.match(SKILL_MD, /does not buy\s+privacy from us/i);
  assert.match(HIRE_MD, /the party that reads your brief is Voidly/i);
});

test("E: no provider-blind encryption is claimed that the rail does not have", () => {
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    assert.doesNotMatch(text, /provider-blind (encryption|mode) (is|works|available)/i, name);
  }
  assert.match(SKILL_MD, /no\s+provider-blind mode on this rail/i);
});

test("E: the Do-NOT list carries the claim as a standing prohibition", () => {
  assert.match(SKILL_MD, /Do not tell a user their brief is private from the provider/);
});

// ═══════════════════════════════════════════════════════════════════════════
// FINDING F — the pin rule was stated as if it covered replay. It does not.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// FINDING R — the E defect again, one paragraph earlier, about the RESULT.
// ═══════════════════════════════════════════════════════════════════════════
//
// The E fix taught this file to police who can read the BRIEF. SKILL.md's very
// first paragraph was making the same kind of claim about the RESULT — "a
// sealed capsule only the hirer can open" — and no pattern here looked at it.
// It is false by the published type surface, not by inference:
//
//   ProviderOpenResult = { kind: "opened"; brief: string; sessionKey: SessionKey }
//   openDeliveredResult({ ..., sessionKey })  ->  opens the result
//
// openBrief hands the provider the session key, and openDeliveredResult needs
// nothing else. So the provider can open the result it produced.

test("R: no document claims the result is hirer-only", () => {
  const claimsOnly = (text) =>
    text.split("\n").filter((l) => !/^\s*-?\s*\*{0,2}Do not\b/i.test(l)).join("\n");
  const forbidden = [
    /only the hirer can (open|read)/i,
    /result[^.\n]{0,60}only you can (open|read)/i,
    /provider[^.\n]{0,60}(does not|cannot|can't|never)[^.\n]{0,30}(open|read|see)[^.\n]{0,30}result/i,
    /result[^.\n]{0,40}(sealed|readable)[^.\n]{0,20}only to the hirer/i,
  ];
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    for (const re of forbidden) {
      assert.doesNotMatch(claimsOnly(text), re, `${name} claims the result is hirer-only, but the provider holds the same session key: ${re}`);
    }
  }
});

test("R: SKILL.md states plainly that the provider holds the session key", () => {
  // Silence is the failure mode here. With the old headline removed, saying
  // nothing about who opens the result still reads as provider-blindness.
  assert.match(
    SKILL_MD,
    /provider holds that\s+\n?\s*key too|provider holds the session key/i,
    "SKILL.md must say the provider holds the session key, not merely stop claiming otherwise",
  );
  assert.match(
    SKILL_MD,
    /openDeliveredResult/,
    "the claim must cite the published type that establishes it, so a reader can check it themselves",
  );
});

test("R: nothing makes a sweeping keyless claim now that --mint-identity writes a secret", () => {
  // `seal-hire.mjs --mint-identity` writes a 64-byte Ed25519 secret at 0600 and
  // signs the offer and grant envelopes with it. "Keyless" told a reader there
  // was no secret on disk to protect. It stays true of the discovery GETs, so
  // only the sweeping form is banned.
  const sweeping = [
    /scripts are Node-only and keyless/i,
    /Everything on this page runs keyless/i,
    /all scripts[^.\n]{0,30}keyless/i,
  ];
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    for (const re of sweeping) {
      assert.doesNotMatch(text, re, `${name} makes a sweeping "keyless" claim, but --mint-identity writes an Ed25519 secret to disk`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The claim audit — 80 falsifiable claims checked against the code.
// ═══════════════════════════════════════════════════════════════════════════

test("K: nothing says a sealed hire can never be opened", () => {
  // The capsule carries wrapped_session_key_base64 — the session key wrapped to
  // the PROVIDER's X25519 key. Destroying the hirer's copy blinds the hirer and
  // nobody else. The doc and the script both said otherwise, in the same words.
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    assert.doesNotMatch(
      text,
      /never be opened by anyone/i,
      `${name}: the provider opens the brief with its own secret; destroying your session key blinds only you`,
    );
  }
});

test("K: the --keep branch says who CAN still open it", () => {
  assert.match(HIRE_MD, /wrapped_session_key_base64/,
    "encrypted-hire.md must name the field that makes the provider's copy possible");
  assert.match(read("scripts/seal-hire.mjs"), /provider still can/i,
    "the no---keep branch must tell the user the provider is unaffected");
});

test("M: SKILL.md does not claim discover.mjs prints the manifest URL", () => {
  // Measured: discover.mjs prints the INDEX url, and of the two fields the
  // freshness advice tells you to diff it shows only payee_account. The
  // encryption key is in the manifest alone.
  assert.doesNotMatch(SKILL_MD, /from the URL the index gives\s*\n?\s*\(`discover\.mjs` prints both\)/i,
    "SKILL.md sends the reader to discover.mjs for a URL and a key it does not print");
  assert.match(SKILL_MD, /manifest_url/,
    "SKILL.md must name the field that actually carries the manifest URL");
});

test("O: attestation mode is never called offline", () => {
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    assert.doesNotMatch(text, /^## Offline artifacts\s*$/m,
      `${name}: that heading introduces the attestation block, which fetches`);
    assert.doesNotMatch(text, /redemption attestation — `verify-artifacts\.mjs`, offline/i,
      `${name}: attestation mode fetches the pinned index and manifest`);
  }
  assert.match(PROOF_MD, /only one of them is offline|only one .{0,20}offline/i,
    "settlement-proof.md must distinguish the receipt check from the attestation check");
});

test("P: the receipt refusal order is stated as the code runs it", () => {
  // verifyDeliveryReceipt: validateGrant -> validateDeliveryReceipt (shape) ->
  // grant_hash/offer_hash binding -> signature. The binding is checked AFTER
  // the shape; the doc said before.
  assert.doesNotMatch(PROOF_MD, /grant binding is checked before the schema/i,
    "the binding is checked after the shape — validateGrant first, then validateDeliveryReceipt");
  assert.match(PROOF_MD, /binding is checked after the shape/i,
    "state the real order, so a reader can predict the refusal they will see");
});

test("Q: the base64 DID mistake is described as the throw it is", () => {
  // 200/200 real keys throw SyntaxError from BigInt. It never silently derives
  // a DID from wrong bytes — and this sits under "Each refusal below is
  // captured, not paraphrased".
  assert.doesNotMatch(HIRE_MD, /derive a DID from the wrong bytes/i,
    "deriveDidFromSigningKey throws on a base64 string; it does not return a wrong DID");
  assert.doesNotMatch(HIRE_MD, /\/\/ string — wrong bytes/,
    "the code comment must match the observed behaviour");
  assert.match(HIRE_MD, /throws before any DID exists|Cannot convert 0x/,
    "name the actual failure, since this section promises captured output");
});

test("F: the index's own freshness limit is quoted", () => {
  // limits[6] of https://api.voidly.ai/v1/session/providers, read live.
  assert.match(SKILL_MD, /A MANIFEST CARRIES NO FRESHNESS AND NO REVOCATION/);
  assert.match(SKILL_MD, /no issued_at, no\n> expires_at, no nonce and no key epoch/);
  assert.match(SKILL_MD, /a captured older document verifies\n> identically/);
});

test("F: the refusal rule is scoped to a DISAGREEING surface, never a replayed one", () => {
  // The unqualified form was the false claim.
  assert.doesNotMatch(
    SKILL_MD,
    /^Every trust decision below reduces to these pins\. A live surface that\ndisagrees with a pin is a refusal, not an update:$/m,
    "the unqualified original assertion must not come back",
  );
  assert.match(SKILL_MD, /\*\*disagrees\*\* with a pin is a refusal/);
  assert.match(SKILL_MD, /replaying an older, genuinely signed\*\*\s*\n?manifest is not refused/);
});

test("F: the consequence is tied to sealing, where it actually bites", () => {
  assert.match(SKILL_MD, /Refusing to\n  pay afterwards does not un-disclose a brief/);
  assert.match(SKILL_MD, /sealed\n  to a retired key/);
  assert.match(HIRE_MD, /Refusing to pay does not un-disclose a brief/);
});

test("F: no mitigation is invented for a field that does not exist", () => {
  assert.match(
    SKILL_MD,
    /There is no mitigation inside this skill for a document that carries no\nfreshness field/,
  );
});

// ── The rest of the prose must keep up with the code ────────────────────────

test("SKILL.md documents the registration precondition (D) in the Leg 1 flow", () => {
  assert.match(SKILL_MD, /--mint-identity/);
  assert.match(SKILL_MD, /--hirer \.\/hirer\.json/);
  assert.match(SKILL_MD, /session_identity_unresolved/);
  assert.match(SKILL_MD, /Do not pay from an unregistered hirer DID/);
});

test("SKILL.md no longer calls attestation verification offline", () => {
  assert.doesNotMatch(
    SKILL_MD,
    /redemption attestation[^.]{0,40}offline/i,
    "attestation mode fetches the verified manifest; calling it offline is now false",
  );
  assert.match(SKILL_MD, /Attestation mode needs your grant and is not offline/);
  assert.match(SKILL_MD, /attestor_key_not_the_manifest_key/);
});

test("SKILL.md documents the pairing and identity rules (A and B)", () => {
  assert.match(SKILL_MD, /PAIRED to the authorization by log index, not searched for/);
  assert.match(SKILL_MD, /receipt_not_for_this_tx/);
  assert.match(PROOF_MD, /Receipt identity/);
  assert.match(PROOF_MD, /the batched-transaction hole/i);
});

test("the captured PROVEN block matches what the script prints today", async () => {
  // This guard's name promised a whole-block comparison twice while its body
  // pinned two substrings, and the capture drifted both times. Now the script
  // exports its printer, so the comparison is line-for-line against
  // renderVerdict over the one settlement on record — offline, and only the
  // confirmation count (the one number that legitimately moves) is normalized.
  const { renderVerdict } = await import("../scripts/verify-settlement.mjs");
  const fence = /```\n(PROVEN\n[\s\S]*?)```/.exec(SKILL_MD);
  assert.ok(fence, "SKILL.md must still carry a captured PROVEN block");
  const captured = fence[1].trimEnd().split("\n");
  const rendered = renderVerdict({
    tx: "0xb1ac733095c19e2e4829a3d448a02b8297d08e55f98678adfcba2e3e92747a3a",
    grantHash: "5e63f8c4f11b989bac73b4306bb1a7975b91571a586989127b35f812c31daea6",
    nonce: "0x02467d7f0144886c4d5d66c0395a43158b073a380cd49b727566eafc5c7f8e4d",
    authLogIndex: 131,
    transferLogIndex: 132,
    value: "50000",
    payer: "0x5cad296e06a976886a5d5bef831520c3d5965af0",
    payee: "0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912",
    blockNumber: 50498854,
    confirmations: 0,
    chain: "0x2105",
    rpcHosts: ["mainnet.base.org", "base.gateway.tenderly.co"],
    headOperators: 2,
  });
  const norm = (l) => l.replace(/confirmations: \d+/, "confirmations: N");
  assert.equal(
    captured.length,
    rendered.length,
    "the captured block and the script's printer disagree on the number of lines",
  );
  for (let i = 0; i < rendered.length; i += 1) {
    assert.equal(
      norm(captured[i]),
      norm(rendered[i]),
      `line ${i + 1} of the captured PROVEN block is not what the script prints`,
    );
  }
});

test("no testnet vocabulary and no legacy pay endpoints crept in", () => {
  for (const [name, text] of EVERYTHING_A_USER_READS) {
    assert.doesNotMatch(text, /sepolia|testnet|goerli|holesky/i, name);
    assert.doesNotMatch(text, /\/v1\/pay\//, name);
  }
});

test("S: the captured PROVEN block matches the shape the script prints", () => {
  // SKILL.md calls this block "Literal output, captured live". It had drifted:
  // the script began appending "(lowest head of N operators)" and the capture
  // did not have it, so the partner's reference output was not what they would
  // see. Re-capturing alone drifts again on the next change — this compares
  // the two, and it is the comparison that has to exist.
  const script = read("scripts/verify-settlement.mjs");
  const fence = /```\n(PROVEN\n[\s\S]*?)```/.exec(SKILL_MD);
  assert.ok(fence, "SKILL.md must still carry a captured PROVEN block");
  const captured = fence[1].trimEnd().split("\n");

  // Every label in the capture must be a label the script actually prints.
  for (const line of captured.slice(1)) {
    const label = /^\s{2}([a-z_ ]+):/.exec(line);
    if (!label) continue;
    assert.ok(
      script.includes(`${label[1]}:`),
      `SKILL.md's captured block has a "${label[1]}:" line the script never prints`,
    );
  }

  // And the annotations the script ALWAYS emits must be present, which is the
  // half that catches an append like this one.
  const blockLine = captured.find((l) => l.trimStart().startsWith("block:"));
  assert.ok(blockLine, "the captured block must have a block: line");
  assert.match(
    blockLine,
    /\(lowest head of \d+ operators?\)/,
    "the script appends the head-operator count to every block: line; the capture must show it",
  );

  // "Literal output" must be true of every byte inside the fence — no prose,
  // no shell comments explaining that a number moves.
  for (const line of captured) {
    assert.doesNotMatch(line, /\s#\s/, `the fence is captured output, so this annotation belongs outside it: ${line}`);
  }
});

