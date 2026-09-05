#!/usr/bin/env node
// seal-hire.mjs — build and seal a hire LOCALLY. Zero funds required.
//
//   # Step 0, once: mint the hirer identity you will register and reuse.
//   node scripts/seal-hire.mjs --mint-identity ./hirer.json
//   # …register its public key on the rail (the command is printed), then:
//   node scripts/seal-hire.mjs --brief ./brief.json --hirer ./hirer.json --keep ./keep.json
//   # (--keep is required; pass --discard-session-key instead only for a
//   #  deliberate dry run whose result you accept you can never open)
//
// brief.json:
//   {
//     "brief":  "the question you are paying the provider to answer",
//     "payer":  "0x… the Base account the money WOULD leave (no funds needed to seal)",
//     "service": "voidly.observatory.query/v1"        // optional; must EQUAL the pin if given
//   }
//
// ── WHY A HIRER IDENTITY IS REQUIRED, AND WHY THIS USED TO BE A TRAP ────────
//
// This script used to mint a FRESH ephemeral hirer identity on every run and
// seal with it. Sealing worked, and so did paying — but the rail resolves BOTH
// parties from the agent registry at REDEMPTION, which happens AFTER
// settlement. An unregistered DID is refused there with 403
// `session_identity_unresolved`. So the old flow let a user pay for something
// they could never redeem: money gone, brief sealed, no result.
//
// @voidly/session@1.0.0 exports no registration call (there is no
// `registerAgent` in its export surface), and this skill does not POST by
// design. So the fix is the other route named in the
// review: REFUSE TO SEAL until the hirer DID actually resolves on the rail,
// with the remedy named. `--mint-identity` produces the keypair and prints the
// exact registration request for you to run; sealing then requires `--hirer`
// pointing at that file, and performs one read-only GET to confirm the DID
// resolves, is active, and derives from its registered key — the same three
// questions `resolvePartiesOrRefuse` asks at redemption.
//
// What sealing does: verifies the pinned provider (same as discover.mjs),
// confirms your hirer identity resolves, seals the brief to the provider's
// verified encryption key, and prints the resulting wire envelopes. What it
// does NOT do: it never POSTs anything, never signs a payment, never touches a
// wallet.
//
// ── WHO CAN READ THE BRIEF ─────────────────────────────────────────────────
//
// The brief is sealed TO THE PROVIDER's verified encryption key. The provider
// decrypts and reads it — that is how the work gets done. What the seal keeps
// the brief from is the RELAY and anyone on the wire. The only pinned provider
// is Voidly's own first-party daemon, so on this skill's reviewed path the
// party that reads your brief is Voidly. Do not treat sealing as privacy from
// the provider; it is privacy from everyone else.
//
// The session key is the ONE secret this mints that later opens the paid-for
// result. Without --keep it is destroyed on exit (fine for a dry run). With
// --keep FILE, the session key is written to FILE (0600) alongside the wire —
// required to later submit this exact hire and read back its result. The keep
// file is worth at most one payment; treat it like a ticket, not like a wallet
// key.
//
// Exit 0 sealed / 1 refused, by name.

import { closeSync, existsSync, fchmodSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeSync, accessSync, constants as fsConstants } from "node:fs";
import { basename, dirname, join as joinPath, resolve as resolvePath } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
const { encodeBase64, decodeBase64 } = naclUtil;
import {
  MAX_BRIEF_LENGTH,
  buildHire,
  deriveDidFromSigningKey,
  exportSessionKeyBytes,
  destroySessionKey,
  fetchVerifiedProvider,
  x402SessionAccountCaip10,
} from "@voidly/session";
import {
  transportCause,
  CANONICAL_USDC_BASE,
  EXPECTED_CHAIN,
  EXPECTED_PRICE_MAX_AMOUNT,
  EXPECTED_PRICE_MIN_AMOUNT,
  MAX_DOCUMENT_BYTES,
  SERVICE_REF,
  payeeRefusal,
  priceBandRefusal,
  quoted,
  readBodyCapped,
  usableArgValue,
  verifiedProvider,
} from "./lib/pins.mjs";

/**
 * THE PREFLIGHT THE OLD FLOW DID NOT HAVE.
 *
 * Asks the rail the same three questions `resolvePartiesOrRefuse` asks at
 * redemption, using the public read-only identity endpoint:
 *
 *   1. Is there a row for this DID at all?      404 -> not registered
 *   2. Is it active?                            deactivated cannot hire
 *   3. Does its registered key DERIVE the DID?  a non-derivable row is refused
 *      at redemption with its own code, and would strand a paid session
 *
 * Plus one this script can ask and the rail cannot: is the registered key the
 * key you are about to sign with? A mismatch means you are sealing under
 * someone else's name and your signatures will not verify.
 *
 * Read-only, one GET. The only thing transmitted is the DID, which is public
 * and which the rail sees on every leg anyway.
 *
 * @returns {Promise<{ok:true, name?:string} | {ok:false, reason:string, detail:string}>}
 */
export async function checkHirerRegistration({
  did,
  signingPublicKeyBase64,
  workerBaseUrl,
  fetchImpl = fetch,
  deriveDid = deriveDidFromSigningKey,
}) {
  const bad = (reason, detail) => ({ ok: false, reason, detail });
  // The rail routes on the RAW DID — `did%3Avoidly%3A…` is a 404 there, so
  // percent-encoding would turn every registered identity into "unregistered".
  // The DID is therefore shape-checked instead of escaped: base58 body only,
  // which cannot carry a `/`, a `?` or a `..` into the path.
  if (!/^did:voidly:[1-9A-HJ-NP-Za-km-z]{1,64}$/.test(String(did))) {
    return bad("hirer_did_malformed", `${did} is not a did:voidly base58 identifier`);
  }
  const url = `${String(workerBaseUrl).replace(/\/+$/, "")}/v1/agent/identity/${did}`;
  let res;
  try {
    // `redirect: "error"`: the registry lookup goes to the verified manifest's
    // worker_base_url and nowhere a 3xx points.
    res = await fetchImpl(url, {
      headers: { accept: "application/json", "accept-encoding": "identity" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch (e) {
    return bad(
      "hirer_registry_unreachable",
      `${transportCause(e)} — this check is not optional: an unresolvable hirer is refused at redemption, after the money has moved`,
    );
  }
  if (res.status === 404) {
    return bad(
      "hirer_did_unregistered",
      `${did} has no identity on the rail. The rail resolves BOTH parties from the agent registry at REDEMPTION — after settlement — and answers 403 session_identity_unresolved for a DID it does not know. Register this identity first (see --mint-identity), then re-run.`,
    );
  }
  if (!res.ok) {
    return bad("hirer_registry_error", `http ${res.status} from the identity endpoint`);
  }
  let row;
  try {
    // Under a byte ceiling: a registry row is a few hundred bytes.
    let text;
    try {
      text = await readBodyCapped(res);
    } catch (e) {
      return bad(
        e && e.code === "BODY_TOO_LARGE" ? "hirer_registry_too_large" : "hirer_registry_unreachable",
        e && e.code === "BODY_TOO_LARGE" ? `the registry answered more than ${MAX_DOCUMENT_BYTES} bytes for one row` : "the registry body could not be read",
      );
    }
    row = JSON.parse(text);
  } catch (e) {
    return bad("hirer_registry_unparseable", "the registry answered a body that is not JSON (its text is withheld — it is the registry's, not this script's)");
  }
  if (row?.status !== "active") {
    return bad(
      "hirer_identity_inactive",
      `registry status is ${typeof row?.status === "string" && /^[a-z_]{1,32}$/.test(row.status) ? row.status : `(${row?.status === null ? "null" : typeof row?.status}, not a status word)`} — a deactivated identity cannot hire, and redemption would refuse after payment`,
    );
  }
  const registeredKey = row?.signing_public_key;
  if (typeof registeredKey !== "string") {
    return bad("hirer_registry_row_malformed", "no signing_public_key on the registry row");
  }
  if (registeredKey !== signingPublicKeyBase64) {
    return bad(
      "hirer_key_not_the_registered_key",
      "the rail has a different signing key registered for this DID; your signatures would not verify against the key it resolves",
    );
  }
  let derived;
  try {
    derived = deriveDid(decodeBase64(registeredKey));
  } catch (e) {
    return bad("hirer_key_undecodable", e.message);
  }
  if (derived !== did) {
    return bad(
      "hirer_did_not_derivable",
      `the registered key derives ${derived}, not ${did} — redemption refuses this row with session_identity_not_derivable`,
    );
  }
  return { ok: true, name: typeof row?.name === "string" ? row.name : undefined };
}

/**
 * Never clobber. `writeFileSync` overwrote an existing keep file, and the keep
 * file is the only hirer-side key to a hire that may already have been PAID
 * for — a second `--keep ./keep.json` destroyed the ability to read back work
 * already bought. Same for an identity file, which is the DID's only secret.
 *
 * `flag: "wx"` makes the kernel the authority. A pre-check would be a race, and
 * this is exactly the kind of file two terminals reach for at once.
 */
const writeNewFileOrDie = (typedPath, value, die, what) => {
  // The pre-flight resolved the typed path through the real filesystem; the
  // write goes to THAT location, not to whatever the typed path resolves to
  // now (a parent swapped for a symlink between the two landed the key
  // elsewhere while the output named the typed path).
  const path = realTarget(typedPath);
  const json = JSON.stringify(value, null, 2);
  // Written through a descriptor so the file's identity (device + inode) is
  // known from the write itself. Every check below compares identities, never
  // path strings: HFS+ hands back NFD for an NFC name, APFS folds case, and a
  // string comparison called both "moved".
  let fd = null;
  let identity;
  try {
    fd = openSync(path, "wx", 0o600);
    writeSync(fd, json);
    const st = fstatSync(fd);
    identity = { dev: st.dev, ino: st.ino };
  } catch (e) {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* nothing to do */ }
    }
    if (e && e.code === "EEXIST") {
      die(
        `${what}_file_exists`,
        `${safePath(path)} already exists and was NOT overwritten. ` +
          (what === "keep"
            ? "A keep file is the only key to its hire — if that hire is paid for, replacing it loses the result. Choose another path, or delete it deliberately."
            : what === "grant"
              ? "The keep file for THIS hire was already written; its grant envelope is inside it at wire.grant. Delete the stale grant file deliberately, or choose another --keep path next time."
              : "An identity file is the DID's only secret. Choose another path, or delete it deliberately."),
      );
    }
    // Every other failure is ALSO a named refusal. `throw e` here surfaced as
    // an uncaught stack trace after the seal — ENOTDIR through a file, EACCES
    // on a directory with w but not x, ENOENT past a trailing slash — which
    // is the one exit shape "refused, by name" rules out.
    die(
      `${what}_unwritable`,
      `${safePath(path)} could not be written (${e && e.code ? e.code : "error"}); nothing was overwritten` +
        (what === "keep" ? ", and no wire was printed for a hire whose key could not be kept" : ""),
    );
  }
  try {
    fchmodSync(fd, 0o600);
  } catch (e) {
    try { closeSync(fd); } catch { /* nothing to do */ }
    die(
      `${what}_mode_unsettable`,
      `${safePath(path)} was written but its mode could not be set to 0600 (${e && e.code ? e.code : "error"}); a file holding it exists — fix its permissions or delete it deliberately; nothing was printed`,
    );
  }
  try { closeSync(fd); } catch { /* nothing to do */ }
  // The file must be reachable, as THIS inode, both at the pre-flighted path
  // and at the path the user typed. A parent that became a symlink after the
  // pre-flight fails the first; a retargeted symlink whose new target holds
  // a planted decoy fails the second (the printed path would name the decoy
  // while the real key sat elsewhere). Only a file that IS this inode is ever
  // removed — the remedy must not delete a file this script did not write.
  const sameInode = (p) => {
    try {
      const st = statSync(p);
      return st.isFile() && st.dev === identity.dev && st.ino === identity.ino;
    } catch {
      return false;
    }
  };
  if (!sameInode(path) || !sameInode(typedPath)) {
    let removed = "a file holding it exists at a location this script can no longer name — nothing was printed";
    for (const candidate of [path, typedPath]) {
      if (sameInode(candidate)) {
        try {
          unlinkSync(candidate);
          removed = "the misplaced file was removed";
          break;
        } catch {
          /* leave the honest wording */
        }
      }
    }
    die(
      `${what}_moved`,
      `${safePath(path)} is no longer the file that was written (a parent changed under it after the pre-flight); ${removed}, nothing was printed` +
        (what === "keep" ? ", and no wire exists for this hire" : what === "grant" ? "; the keep file for this hire was already written" : ""),
    );
  }
};

/**
 * Pre-flight for a path this script is about to CREATE: the parent must be a
 * real, enterable, writable directory, and nothing — file, directory, or
 * symlink, dangling or not — may already sit at the path. `existsSync` follows
 * links, so a dangling symlink passed it and then surfaced from the wx write
 * as "already exists" for a file that did not; `accessSync(W_OK)` on a
 * directory without x passed and then failed EACCES after three network round
 * trips. Refuses BEFORE anything is fetched, minted, or sealed.
 */
/**
 * A path printed back to the user is argv, and argv used to reach stdout
 * verbatim — a newline in `--keep` painted a fake SEALED line. Plainly spelled
 * paths print; anything else is described.
 */
const safePath = (p) => (/^[A-Za-z0-9._~\/\-]{1,512}$/.test(String(p)) ? String(p) : `(a path with unusual characters, ${String(p).length} chars — not printed)`);

/** The SDK refuses a brief longer than MAX_BRIEF_LENGTH (16,217 characters in @voidly/session@1.0.0, brief_too_long); the file that carries it is capped at 1 MiB, far above that. */
const MAX_BRIEF_FILE_BYTES = 1024 * 1024;
/** An identity file is four base64 keys and a DID. */
const MAX_IDENTITY_FILE_BYTES = 64 * 1024;

/** typed path -> the real absolute path the pre-flight resolved; every write uses the latter. */
const preflightedPaths = new Map();
const realTarget = (path) => preflightedPaths.get(String(path)) ?? String(path);

const preflightNewFile = (path, die, what) => {
  if (/[\\/]$/.test(String(path))) {
    die(`${what}_path_not_a_file`, `${safePath(path)} ends in a path separator; --${what === "identity" ? "mint-identity" : "keep"} needs a FILE path`);
  }
  // The parent is resolved the way the KERNEL will resolve it — realpath of
  // the parent AS TYPED, not `path.resolve`, which drops `nodir/..` lexically
  // and answers for a directory that is not the one the write will land in
  // (`link/../k.json` wrote into the link target's parent while reporting the
  // typed path). Only ENOENT means "absent"; every other answer is named.
  const typedDir = dirname(String(path)) || ".";
  let dir;
  try {
    // `.native`: Node's JavaScript realpath normalizes `link/..` LEXICALLY
    // before it looks at the filesystem, which is exactly the answer the
    // kernel does not give. libc's realpath walks the link first.
    dir = realpathSync.native(typedDir);
  } catch (e) {
    const code = e && e.code ? e.code : "error";
    die(
      `${what}_dir_unwritable`,
      code === "ENOENT"
        ? `${safePath(typedDir)} does not exist — the ${what} file could not be written there; nothing was fetched or sealed`
        : code === "EACCES"
          ? `${safePath(typedDir)} cannot be entered (permission denied); nothing was fetched or sealed`
          : `${safePath(typedDir)} could not be resolved (${code}); nothing was fetched or sealed`,
    );
  }
  let st;
  try {
    st = statSync(dir);
  } catch (e) {
    die(`${what}_dir_unwritable`, `${safePath(typedDir)} could not be read (${e && e.code ? e.code : "error"}); nothing was fetched or sealed`);
  }
  if (!st.isDirectory()) {
    die(`${what}_dir_unwritable`, `${safePath(typedDir)} is not a directory; nothing was fetched or sealed`);
  }
  try {
    accessSync(dir, fsConstants.W_OK | fsConstants.X_OK);
  } catch {
    die(`${what}_dir_unwritable`, `${safePath(typedDir)} is not writable and enterable; nothing was fetched or sealed`);
  }
  const abs = joinPath(dir, basename(String(path)));
  preflightedPaths.set(String(path), abs);
  let occupied = false;
  try {
    lstatSync(abs);
    occupied = true;
  } catch (e) {
    if (!(e && e.code === "ENOENT")) {
      die(`${what}_unwritable`, `${safePath(path)} could not be checked (${e && e.code ? e.code : "error"}); nothing was fetched or sealed`);
    }
  }
  if (occupied) {
    die(
      `${what}_file_exists`,
      `${safePath(path)} already exists (a file, directory or symlink — dangling links count) and would NOT be overwritten — refusing before sealing anything, and before anything is fetched. ` +
        (what === "keep"
          ? "A keep file is the only key to its hire; if that hire is paid for, replacing it loses the result. Choose another --keep path, or delete the file deliberately."
          : what === "grant"
            ? "Choose another --keep path, or delete the stale grant file deliberately."
            : "An identity file is the DID's only secret. Choose another path, or delete it deliberately."),
    );
  }
};

/**
 * Is this file the program, or an import? Node realpaths the main module, so
 * `pathToFileURL(process.argv[1]).href === import.meta.url` was FALSE whenever
 * the invocation path went through a symlink — a symlinked skill directory is
 * the common install shape — and the script then did nothing and exited 0.
 * Both sides are realpathed here; a path that cannot be realpathed is not the
 * program.
 */
export const invokedAsMain = (argv1, metaUrl) => {
  try {
    return typeof argv1 === "string" && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
};
const isMain = invokedAsMain(process.argv[1], import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const die = (name, detail) => {
    console.error(`REFUSED  ${name}${detail ? ` — ${detail}` : ""}`);
    process.exit(1);
  };
  // The argv contract, enforced once for every flag: a value that is missing
  // or looks like a flag (any leading dash, including the unicode ones) is a
  // usage error, an EMPTY value — whitespace or zero-width characters only —
  // is missing, `--name=value` is not a form this parser reads (refused rather
  // than silently ignored), a flag given twice refuses rather than
  // first-one-wins deciding which file holds a key, flags that contradict each
  // other refuse, and an argument that is neither a known flag nor the value
  // after one refuses rather than being ignored.
  const VALUED = ["--brief", "--hirer", "--keep", "--mint-identity"];
  const VALUELESS = ["--discard-session-key"];
  const usable = usableArgValue;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (/^--[a-z-]+=/.test(a)) {
      die("flag_form_unsupported", `${a.split("=")[0]}=… is not read; write ${a.split("=")[0]} VALUE with a space`);
    }
    if (VALUED.includes(a)) {
      i += 1; // its value, checked by flag()
      continue;
    }
    if (VALUELESS.includes(a)) continue;
    die("unknown_argument", `argument ${i + 1} is neither a flag this script reads nor the value after one (value withheld)`);
  }
  for (const name of [...VALUED, ...VALUELESS]) {
    if (args.filter((a) => a === name).length > 1) {
      die("flag_duplicated", `${name} was given more than once; which value binds is not guessable`);
    }
  }
  if (args.includes("--mint-identity") && [...VALUED, ...VALUELESS].some((n) => n !== "--mint-identity" && args.includes(n))) {
    die("flag_conflict", "--mint-identity seals nothing; --brief, --hirer, --keep and --discard-session-key have no meaning beside it and were not silently dropped");
  }
  if (args.includes("--keep") && args.includes("--discard-session-key")) {
    die("flag_conflict", "--keep and --discard-session-key contradict each other; say which one you mean");
  }
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const value = args[i + 1];
    if (!usable(value)) return null;
    return value;
  };
  const flagGiven = (name) => args.includes(name);

  // ── Mode 0: mint an identity to register. Seals nothing. ─────────────────
  const mintPath = flag("--mint-identity");
  if (mintPath) {
    preflightNewFile(mintPath, die, "identity");
    const kp = nacl.sign.keyPair();
    // The registration this command prints requires an `encryption_public_key`,
    // and minting produced only the Ed25519 signing pair — so the line ended in
    // the placeholder `<your-x25519-pubkey-base64>` and the documented flow
    // could not be completed from this skill at all. The X25519 pair is minted
    // here, written to the same 0600 file, and printed into the command.
    const enc = nacl.box.keyPair();
    const did = deriveDidFromSigningKey(kp.publicKey);
    const identity = {
      _what:
        "A hirer identity for the Voidly session rail. REGISTER both public keys before sealing: the rail resolves both parties from the agent registry at redemption, and an unregistered DID is refused 403 after the money has moved.",
      version: 1,
      did,
      signing_public_key_base64: encodeBase64(kp.publicKey),
      signing_secret_key_base64: encodeBase64(kp.secretKey),
      encryption_public_key_base64: encodeBase64(enc.publicKey),
      encryption_secret_key_base64: encodeBase64(enc.secretKey),
    };
    writeNewFileOrDie(mintPath, identity, die, "identity");
    console.log(`MINTED   ${did}`);
    console.log(`kept:    ${safePath(mintPath)} (0600 — signing AND encryption identity, never transmitted by this skill)`);
    console.log("");
    console.log("REGISTER IT BEFORE YOU SEAL — AFTER THE HUMAN SAYS YES. This skill will not POST");
    console.log("for you; nothing it transmits goes beyond one registry lookup. The command below");
    console.log("publishes a PERSISTENT, UNAUTHENTICATED record on Voidly's rail: this DID, both");
    console.log("public keys, the name, and an active status (anyone can read it back). The index");
    console.log("says so itself: \"REGISTRATION ON THIS RAIL IS OPEN\". Ask the human to choose the");
    console.log("name — the placeholder below is not a default — and run it only on an explicit yes:");
    console.log("");
    console.log(`  curl -X POST https://api.voidly.ai/v1/agent/register \\`);
    console.log(`    -H 'content-type: application/json' \\`);
    console.log(
      `    -d '{"name":"<NAME THE HUMAN CHOSE>","signing_public_key":"${identity.signing_public_key_base64}","encryption_public_key":"${identity.encryption_public_key_base64}"}'`,
    );
    console.log("");
    console.log(`Then: node scripts/seal-hire.mjs --brief ./brief.json --hirer ${safePath(mintPath)} --keep ./keep.json`);
    process.exit(0);
  }

  const briefPath = flag("--brief");
  const keepPath = flag("--keep");
  // `flag()` is args[indexOf(name)+1], so a trailing `--keep` binds to
  // undefined and falls into the no-keep branch — destroying the session key
  // and then telling the user "no --keep given", which is false on its face.
  for (const name of ["--keep", "--hirer", "--brief", "--mint-identity"]) {
    if (flagGiven(name) && flag(name) === null) {
      die(
        "flag_value_missing",
        `${name} was given with no usable file after it (missing, empty, or another flag); nothing was written`,
      );
    }
  }
  const hirerPath = flag("--hirer");
  if (!briefPath) {
    die(
      "missing_brief",
      "usage: node scripts/seal-hire.mjs --brief ./brief.json --hirer ./hirer.json (--keep ./keep.json | --discard-session-key)",
    );
  }
  if (!hirerPath) {
    die(
      "hirer_identity_required",
      "sealing needs a REGISTERED hirer identity, because the rail resolves both parties from the agent registry at redemption — after settlement. A fresh ephemeral identity seals fine and then cannot redeem, which means paying for something unreadable. Run: node scripts/seal-hire.mjs --mint-identity ./hirer.json, register the printed key, then pass --hirer ./hirer.json",
    );
  }

  // The keep pre-flight, BEFORE anything is read, fetched, sealed or printed.
  // The wx write at the bottom stays as the race-free backstop, but refusing
  // only there means refusing AFTER the wire is on the terminal — an openable
  // capsule for a hire whose session key just went nowhere. And a run with no
  // --keep at all used to print that same wire and then destroy the key by
  // default; destroying the only way to open a result you might pay for is
  // now something you have to ask for by name.
  const grantPathOf = (keepFile) => keepFile.replace(/\.json$/i, "") + ".grant.json";
  if (keepPath) {
    // The directory must exist and be writable NOW. The keep write happens
    // after the network round trips; a missing directory or a read-only one
    // used to surface only then — and the wx write is the last thing that
    // runs, so the failure was not a race but a certainty discovered late.
    preflightNewFile(keepPath, die, "keep");
    preflightNewFile(grantPathOf(keepPath), die, "grant");
  } else if (!args.includes("--discard-session-key")) {
    die(
      "keep_required",
      "no --keep FILE given. The session key minted at sealing is the only hirer-side way to open the paid-for result; without --keep it is destroyed on exit, and the printed wire is a hire you could pay for and never read. Pass --keep ./keep.json, or pass --discard-session-key to make a deliberate dry run.",
    );
  }

  // A FIFO or a device at --brief/--hirer blocks readFileSync forever with no
  // output; only a regular file is read.
  for (const [p, what] of [[briefPath, "brief"], [hirerPath, "hirer"]]) {
    let st;
    try {
      st = lstatSync(p);
    } catch (e) {
      die(`${what}_unreadable`, `--${what} could not be read (${e && e.code ? e.code : "error"})`);
    }
    if (st.isSymbolicLink()) {
      try {
        st = statSync(p);
      } catch (e) {
        die(`${what}_unreadable`, `--${what} could not be read (${e && e.code ? e.code : "error"})`);
      }
    }
    if (!st.isFile()) die(`${what}_not_a_file`, `--${what} is not a regular file`);
    // A 600 MB --brief reached 1.76 GB of RSS before ERR_STRING_TOO_LONG.
    const cap = what === "brief" ? MAX_BRIEF_FILE_BYTES : MAX_IDENTITY_FILE_BYTES;
    if (st.size > cap) die(`${what}_too_large`, `--${what} is ${st.size} bytes; a ${what} file is under ${cap}`);
  }
  let spec;
  try {
    spec = JSON.parse(readFileSync(briefPath, "utf8"));
  } catch (e) {
    die("brief_unreadable", e && e.code ? `--brief could not be read (${e.code})` : "--brief is not valid JSON");
  }
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    die("brief_not_object", "brief.json must be a JSON object with a \"brief\" string and a \"payer\" address");
  }
  if (typeof spec.brief !== "string" || spec.brief.length === 0) {
    die("brief_missing_text", 'brief.json needs a non-empty "brief" string');
  }
  // The SDK's own ceiling, checked here BEFORE the three GETs rather than
  // inside buildHire after them — with the number, so the remedy is obvious.
  if (spec.brief.length > MAX_BRIEF_LENGTH) {
    die("brief_too_long", `brief.json's "brief" is ${spec.brief.length} characters; the SDK accepts at most ${MAX_BRIEF_LENGTH}`);
  }
  if (typeof spec.payer !== "string") {
    die(
      "payer_missing",
      'brief.json needs "payer": the 0x account the money would leave. No funds are needed to seal.',
    );
  }
  // The shape the SDK will refuse anyway, refused here before any fetch.
  if (!/^0x[0-9a-fA-F]{40}$/.test(spec.payer)) {
    die("payer_account_unusable", 'brief.json "payer" is not a plain 0x + 40-hex EVM address (no whitespace, no chain prefix); nothing was fetched');
  }
  // The service is a PIN (SERVICE_REF), not a brief field. A brief naming a
  // different manifest service used to silently hire it — different terms,
  // different price band, zero review — through a file nobody reads as a
  // trust surface. Naming the pinned service explicitly is fine; naming any
  // other is a refusal, not a selection.
  if (spec.service !== undefined && spec.service !== SERVICE_REF) {
    die(
      "service_not_pinned",
      `brief.json names a service ${typeof spec.service === "string" ? `(${spec.service.length} chars, not printed)` : `of type ${typeof spec.service}`} that is not the pinned ${SERVICE_REF}. Remove the field, or update the skill deliberately.`,
    );
  }
  const serviceRef = SERVICE_REF;

  let identity;
  try {
    identity = JSON.parse(readFileSync(hirerPath, "utf8"));
  } catch (e) {
    die("hirer_unreadable", e && e.code ? `--hirer could not be read (${e.code})` : "--hirer is not valid JSON");
  }
  if (identity === null || typeof identity !== "object" || Array.isArray(identity)) {
    die("hirer_not_object", "--hirer must be the JSON object --mint-identity wrote");
  }
  let kp;
  try {
    const secret = decodeBase64(identity.signing_secret_key_base64);
    if (secret.length !== 64) throw new Error(`signing_secret_key_base64 is ${secret.length} bytes, need 64`);
    kp = nacl.sign.keyPair.fromSecretKey(secret);
  } catch (e) {
    die("hirer_key_unusable", e.message);
  }
  const did = deriveDidFromSigningKey(kp.publicKey);
  const publicKeyBase64 = encodeBase64(kp.publicKey);
  if (typeof identity.did === "string" && identity.did !== did) {
    die(
      "hirer_did_inconsistent",
      `file says ${/^did:voidly:[1-9A-HJ-NP-Za-km-z]{1,64}$/.test(identity.did) ? identity.did : "(a value that is not a DID)"}, its secret key derives ${did}`,
    );
  }
  const sign = (bytes) => nacl.sign.detached(bytes, kp.secretKey);

  // 1. VERIFY the provider. The brief is sealed to whatever key this returns —
  //    which is exactly why an unverified manifest is a refusal, not a warning.
  const out = await verifiedProvider(fetchVerifiedProvider);
  if (!out.ok) die(out.reason, out.detail);
  const provider = out.provider;
  const offering = provider.manifest.services.find((s) => s.ref === serviceRef);
  if (!offering) {
    die("service_not_offered", `verified manifest does not offer ${serviceRef}`);
  }
  // SKILL.md pledges Base mainnet + canonical USDC on every leg. Enforce it
  // here, before anything is sealed against the offering.
  if (offering.price.chain !== EXPECTED_CHAIN) {
    die("chain_not_base", `offering is on ${offering.price.chain}, this skill is reviewed only for ${EXPECTED_CHAIN}`);
  }
  if (offering.price.asset !== `${EXPECTED_CHAIN}/erc20:${CANONICAL_USDC_BASE}`) {
    die("asset_not_canonical_usdc", `offering asset is ${offering.price.asset}`);
  }
  // The band is a pin: a signed manifest naming a higher floor used to be
  // sealed as-is, with no amount printed anywhere but inside the wire JSON.
  const bandRefusal = priceBandRefusal(offering);
  if (bandRefusal) die(bandRefusal.reason, bandRefusal.detail);
  // The payee too: the last money field that was read off the document.
  const payeeMismatch = payeeRefusal(offering);
  if (payeeMismatch) die(payeeMismatch.reason, payeeMismatch.detail);

  // 2. THE REDEMPTION PREFLIGHT. Before a single byte is sealed: can this
  //    hirer actually redeem what it is about to pay for?
  const registered = await checkHirerRegistration({
    did,
    signingPublicKeyBase64: publicKeyBase64,
    workerBaseUrl: provider.manifest.worker_base_url,
  });
  if (!registered.ok) die(registered.reason, registered.detail);

  // 3. SEAL. Every money field is copied VERBATIM off the verified manifest —
  //    chain, asset, payee, both bounds. The one field that is ours is the payer
  //    account, and it goes through x402SessionAccountCaip10, which lowercases:
  //    a checksummed CAIP-10 assembled by hand is refused by buildHire below
  //    (grant_payer_account_not_canonical) before anything is sealed.
  const payerAccount = x402SessionAccountCaip10(offering.price.chain, spec.payer);
  if (payerAccount === null) {
    die("payer_account_unusable", "not a plain 0x…40-hex EVM address");
  }

  let hire;
  try {
    hire = await buildHire({
    hirer: { did, signingPublicKeyBase64: publicKeyBase64, sign },
    provider,
    service: { ref: serviceRef },
    task: { brief: spec.brief },
    price: {
      chain: offering.price.chain,
      asset: offering.price.asset,
      payerAccount,
      payeeAccount: offering.price.payee_account,
      minAmount: offering.price.min_amount,
      maxAmount: offering.price.max_amount,
    },
    ttl: { offerMs: 30 * 60_000, grantMs: 10 * 60_000 },
    nowMs: Date.now(),
  });
  } catch (e) {
    // The SDK threw instead of refusing (an unsupported runtime, a hostile
    // object shape): a named refusal, class name only.
    die("sdk_threw", `the SDK threw ${/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(String(e?.constructor?.name ?? "")) ? e.constructor.name : "an error"} while building the hire; nothing was sealed`);
  }
  if (!hire.ok) die(hire.reason);

  // PERSIST BEFORE PRINTING. The wire below is transmit-ready and payable; the
  // keep file is the only hirer-side way to open what that payment buys. If
  // the write fails — ENOSPC, EACCES, a directory removed since the
  // pre-flight — the refusal has to come BEFORE a payable wire is on the
  // terminal, or the user is left holding a hire they can pay for and never
  // read. So: write, verify the bytes read back, and only then print.
  let keptLines = [];
  if (keepPath) {
    const sessionKeyBytes = exportSessionKeyBytes(hire.keep.sessionKey);
    if (sessionKeyBytes === null) die("session_key_unexportable");
    const keep = {
      _what:
        "Everything needed to later submit THIS hire and open THIS result: the session key, plus a pointer to the registered hirer identity that must sign the submission. Local file, never transmitted. Worth at most one payment.",
      version: 2,
      grant_hash: hire.keep.grant_hash,
      endpoint_base_url: provider.manifest.worker_base_url,
      // submitHire posts to the provider's accept_url, which is NOT the
      // worker base — a keep file that recorded only the latter sent a user
      // to the wrong host. Both are copied off the VERIFIED manifest here;
      // re-run discover.mjs before submitting and refuse if either moved.
      accept_url: provider.manifest.accept_url,
      wire: hire.wire,
      session_key_base64: encodeBase64(sessionKeyBytes),
      hirer: {
        did,
        signing_public_key_base64: publicKeyBase64,
        // Absolute, so the keep file still points at the identity from
        // another working directory.
        identity_file: resolvePath(hirerPath),
        _note:
          "The signing SECRET stays in identity_file — this keep file does not copy it, so one leaked keep file cannot impersonate the identity across other hires.",
      },
    };
    writeNewFileOrDie(keepPath, keep, die, "keep");
    // Read back and compare: a write that returned is not yet a file that
    // holds the key.
    let back;
    try {
      back = JSON.parse(readFileSync(realTarget(keepPath), "utf8"));
    } catch (e) {
      die("keep_unverifiable", `${safePath(keepPath)} was written but cannot be read back (${e && e.code ? e.code : "error"}); refusing to print a payable wire for a hire whose key is not safely kept`);
    }
    if (back === null || typeof back !== "object" || Array.isArray(back) || back.session_key_base64 !== keep.session_key_base64 || back.grant_hash !== keep.grant_hash) {
      die("keep_unverifiable", `${safePath(keepPath)} read back differs from what was written; refusing to print a payable wire for a hire whose key is not safely kept`);
    }
    // The grant envelope, as its own file. verify-artifacts.mjs takes --grant,
    // and before this file existed nothing the skill wrote was named as that
    // input — users passed keep.json (the file they had) and got a hash
    // mismatch that named no remedy. The envelope is a COPY of wire.grant:
    // not secret, but it names the hire, so it gets the same 0600.
    const grantPath = grantPathOf(keepPath);
    writeNewFileOrDie(grantPath, hire.wire.grant, die, "grant");
    keptLines = [
      `kept:    ${safePath(keepPath)} (0600 — session key + wire; the signing secret stays in ${safePath(hirerPath)})`,
      `grant:   ${safePath(grantPath)} (the task-grant envelope — this is the --grant file for verify-artifacts.mjs; it is keep.json's wire.grant)`,
    ];
  } else {
    destroySessionKey(hire.keep.sessionKey);
    keptLines = [
      "kept:    nothing — --discard-session-key given, session key destroyed. YOU can no longer\n" +
        "         open the eventual result. The provider still can: the wire above\n" +
        "         carries the session key wrapped to its X25519 key. Pass --keep FILE\n" +
        "         before building a hire you intend to pay for.",
    ];
  }

  console.log(`SEALED   grant_hash ${hire.keep.grant_hash}`);
  console.log(
    `hirer:   ${did} (registered on the rail${registered.name ? ` as ${quoted(registered.name, 128)}` : ""}, active, key derives the DID)`,
  );
  console.log(`sealed to: ${provider.manifest.provider_did} (verified)`);
  console.log(
    `amount:  ${EXPECTED_PRICE_MIN_AMOUNT}..${EXPECTED_PRICE_MAX_AMOUNT} atomic USDC (${(Number(EXPECTED_PRICE_MIN_AMOUNT) / 1e6).toFixed(6)}..${(Number(EXPECTED_PRICE_MAX_AMOUNT) / 1e6).toFixed(6)} USDC) — the pinned band; the SDK signs the floor`,
  );
  console.log("readable by: that provider — sealing hides the brief from the relay and the wire, NOT from the provider.");
  console.log("");
  console.log("wire (transmit-safe — the brief inside is sealed to the provider):");
  console.log(JSON.stringify(hire.wire, null, 2));
  console.log("");

  for (const line of keptLines) console.log(line);
  console.log("");
  console.log(
    "Nothing was transmitted but your DID, on one read-only registry lookup. Sealing costs nothing.",
  );
}
