/**
 * ENS Agent Identity — Phase A: AuthResolver read-only verification (FORWARD-DECLARING SCAFFOLD)
 *
 * What is REAL here:
 *   - Resolve an ENS name on L1 mainnet (ENSIP-15 normalized).
 *   - Read auth.credential / auth.capability / auth.revocation records via CCIP-Read.
 *   - Parse the Phase-A JSON payloads and run the LOCAL, read-only structural pre-checks
 *     that mirror the spec's verifyAction ordering (credential present -> validity window
 *     -> revocation presence -> scheme recognized).
 *
 * What is STUBBED (pending M1):
 *   - The actual on-chain AuthResolver.verifyAction(...) call, which performs signature
 *     verification + scheme dispatch via the Verifier contract. The AuthResolverImpl +
 *     Verifier contracts are the unfunded M1 deliverable (target 2026-08-31,
 *     github.com/steg-eth). They are NOT deployed. This script NEVER claims a signature
 *     was cryptographically verified — it verifies the RECORD PLUMBING only.
 *
 * The verifyAction signature below is a DESIGN SKETCH derived from the spec (§5.1) and the
 * Bankr compatibility test, NOT a deployed ABI. See // TODO(M1) markers.
 *
 * Run (Node 24+, strips types and runs directly):
 *   node verify-action.ts <ens-name> [credential-id]
 *
 * Env:
 *   ETH_RPC_URL          (default https://eth.drpc.org) L1 mainnet RPC for ENS resolution.
 *   AUTH_RESOLVER_ADDRESS (optional) per-name AuthResolver proxy on L1. UNSET => demo mode:
 *                         prints "contract not deployed yet; record plumbing verified".
 *   AUTH_MESSAGE         (optional) the signed message digest (hex) the agent produced.
 *   AUTH_SIGNATURE       (optional) the secp256k1 signature (hex) over AUTH_MESSAGE.
 *   BASE_RPC_URL         (optional, default https://base.drpc.org) ONLY for the ERC-8004
 *                        cross-check; not used by the verification path.
 *
 * Output: human-readable progress -> stderr; machine-readable JSON -> stdout.
 */

const { createPublicClient, http } = require("viem");
const { mainnet } = require("viem/chains");
const { normalize, namehash } = require("viem/ens");

// --- Phase-A record shapes (JSON-in-text-record; migrates to CBOR-in-data at M1) ---
interface CredentialRecord {
  scheme: string; // string form; on-chain canonical is keccak256(scheme) (spec §3.2)
  address: string; // DECISION A1: address, not the 64-byte uncompressed pubKey spec §3.2 wants
  notBefore: number; // unix seconds
  notAfter: number; // unix seconds; 0 = no expiry
  capabilityRef?: string; // structural only in v1 (spec §6.1)
  schemaVersion?: string;
}
interface RevocationRecord {
  revokedAt?: number;
  reason?: string;
  schemaVersion?: string;
}

// Schemes the v1 Verifier will register (spec §3.2). Used only for a LOCAL "recognized?"
// pre-check — actual dispatch happens on-chain in the M1 Verifier.
const KNOWN_SCHEMES = new Set(["WebAuthn-ES256", "ECDSA-secp256k1", "EIP-1271"]);

// DenyReason mirror (spec §5.1). Local pre-checks can surface a SUBSET; the authoritative
// decision is the on-chain verifyAction return, which is stubbed here.
type LocalReason =
  | "None"
  | "Unverified" // credential record missing/empty (local) — signature check is on-chain
  | "Stale"
  | "Revoked"
  | "Mismatch" // scheme not recognized locally
  | "ContractNotDeployed"; // Phase-A sentinel: on-chain step not available

/**
 * verifyAction ABI — DESIGN SKETCH ONLY (spec §5.1). NOT a deployed contract.
 * // TODO(M1): replace with the audited AuthResolverImpl ABI once the contract ships
 * //           (github.com/steg-eth). Confirm struct field ordering + DenyReason enum.
 */
const VERIFY_ACTION_ABI = [
  {
    type: "function",
    name: "verifyAction",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "credentialId", type: "string" },
      { name: "message", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "allowed", type: "bool" },
          { name: "reason", type: "uint8" },
          { name: "resolvedAt", type: "uint64" },
          { name: "stateHash", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

/**
 * STUB: the on-chain verifyAction call. The AuthResolver + Verifier are not deployed,
 * so this never executes a real signature verification. It exists to mark exactly where
 * the M1 contract call slots in, and to keep the call site honest.
 *
 * // TODO(M1): when AuthResolverImpl is deployed, replace the throw with:
 * //   return client.readContract({ address, abi: VERIFY_ACTION_ABI,
 * //     functionName: "verifyAction", args: [node, credentialId, message, signature] });
 */
function verifyActionOnChain(_args: {
  node: `0x${string}`;
  credentialId: string;
  message: `0x${string}`;
  signature: `0x${string}`;
  resolver: string;
}): never {
  throw new Error(
    "AuthResolver.verifyAction is not deployed (M1 deliverable). " +
      "Phase A verifies record plumbing only; signature verification + scheme dispatch happen on-chain at M1.",
  );
}

async function main() {
  const ensName = process.argv[2];
  const credentialId = process.argv[3] || "primary";
  if (!ensName) {
    console.error("Usage: node verify-action.ts <ens-name> [credential-id]");
    process.exit(2);
  }

  const rpcUrl = process.env.ETH_RPC_URL || "https://eth.drpc.org";
  const resolverAddr = process.env.AUTH_RESOLVER_ADDRESS || "";
  const message = process.env.AUTH_MESSAGE || "";
  const signature = process.env.AUTH_SIGNATURE || "";

  console.error("=== Phase A: AuthResolver read-only verification (SCAFFOLD) ===");
  console.error(`ENS name:      ${ensName}`);
  console.error(`Credential id: ${credentialId}`);
  console.error(`L1 RPC:        ${rpcUrl}`);
  console.error("");

  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

  // F8: normalize user-typed name via ENSIP-15 before namehash.
  const name = normalize(ensName);
  const node = namehash(name) as `0x${string}`;

  console.error("Step 1: Resolving ENS name (L1)...");
  const address = await client.getEnsAddress({ name }).catch(() => null);
  console.error(`  address: ${address || "(none)"}`);

  console.error("Step 2: Reading auth.* records (CCIP-Read)...");
  const credKey = `auth.credential[${credentialId}]`;
  const capKey = `auth.capability[${credentialId}]`;
  const revKey = `auth.revocation[${credentialId}]`;

  const [credRaw, capRaw, revRaw] = await Promise.all([
    client.getEnsText({ name, key: credKey }).catch(() => null),
    client.getEnsText({ name, key: capKey }).catch(() => null),
    client.getEnsText({ name, key: revKey }).catch(() => null),
  ]);
  console.error(`  ${credKey}: ${credRaw ? "present" : "(empty)"}`);
  console.error(`  ${capKey}: ${capRaw ? "present" : "(empty)"}`);
  console.error(`  ${revKey}: ${revRaw ? "present" : "(empty)"}`);
  console.error("");

  // --- LOCAL read-only pre-checks (mirror spec §5.2 ordering; NOT the authoritative call) ---
  console.error("Step 3: Local structural pre-checks (read-only mirror of §5.2)...");
  const plumbing = {
    resolved: !!address,
    credentialFound: !!credRaw,
    credentialParsed: false,
    validityWindowOk: false,
    revoked: !!revRaw,
    schemeRecognized: false,
  };
  let localReason: LocalReason = "None";
  let credential: CredentialRecord | null = null;

  if (!credRaw) {
    localReason = "Unverified"; // step 1: credential missing/empty
  } else {
    try {
      credential = JSON.parse(credRaw) as CredentialRecord;
      plumbing.credentialParsed = true;
    } catch {
      localReason = "Unverified"; // step 2: decode failure
    }
  }

  if (credential) {
    const now = Math.floor(Date.now() / 1000);
    const okWindow =
      now >= (credential.notBefore ?? 0) &&
      (credential.notAfter === 0 || credential.notAfter === undefined || now <= credential.notAfter);
    plumbing.validityWindowOk = okWindow;
    plumbing.schemeRecognized = KNOWN_SCHEMES.has(credential.scheme);

    if (!okWindow) localReason = "Stale"; // step 3
    else if (plumbing.revoked) localReason = "Revoked"; // step 4 (presence of bytes => revoked)
    else if (!plumbing.schemeRecognized) localReason = "Mismatch"; // step 5
    // steps 6 (signature verify) + 7 (success) are on-chain — see below.
  }

  console.error(`  resolved=${plumbing.resolved} credentialFound=${plumbing.credentialFound} ` +
    `parsed=${plumbing.credentialParsed} validityWindow=${plumbing.validityWindowOk} ` +
    `revoked=${plumbing.revoked} schemeRecognized=${plumbing.schemeRecognized}`);
  if (localReason !== "None") {
    console.error(`  local pre-check would DENY before reaching on-chain verify: ${localReason}`);
  }
  console.error("");

  // --- The on-chain step: STUBBED (pending M1) ---
  console.error("Step 4: On-chain AuthResolver.verifyAction (signature verify + scheme dispatch)...");
  let onChain: { attempted: boolean; note: string } = { attempted: false, note: "" };

  if (!resolverAddr) {
    // Demo mode: contract address not provided => not deployed yet. Exit cleanly (non-error).
    onChain.note = "contract not deployed yet; record plumbing verified";
    console.error(`  AUTH_RESOLVER_ADDRESS unset => ${onChain.note}`);
  } else {
    // Address provided, but the contract + ABI are a design sketch — do NOT pretend to verify.
    onChain.attempted = true;
    try {
      verifyActionOnChain({
        node,
        credentialId,
        message: (message || "0x") as `0x${string}`,
        signature: (signature || "0x") as `0x${string}`,
        resolver: resolverAddr,
      });
    } catch (e: any) {
      onChain.note = e.message;
      console.error(`  STUBBED: ${e.message}`);
    }
  }
  console.error("");

  // verified is INTENTIONALLY null: no end-to-end verification is possible pre-M1.
  const result = {
    phase: "A",
    verified: null as null, // null => not determinable until M1 contract is deployed
    reason: resolverAddr ? "ContractNotDeployed" : "ContractNotDeployed",
    localPreCheckReason: localReason,
    credentialId,
    name,
    address,
    recordPlumbing: plumbing,
    onChain,
    note: "Phase-A scaffold: record plumbing verified; signature verification is the M1 on-chain step (not deployed).",
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
