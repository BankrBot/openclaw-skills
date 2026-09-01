/**
 * ERC-8004 Agent Capabilities
 *
 * Defines well-known capability identifiers and provides a validation
 * layer that prevents agents from claiming arbitrary unverified capabilities.
 *
 * Capability Policy:
 * Capabilities are self-declared strings in the registration metadata.
 * Since there is currently no on-chain proof system for capability
 * verification, this module:
 *   1. Restricts claims to a well-known allowlist of recognized capability IDs
 *   2. Flags unrecognized claims so consumers can treat them with lower trust
 *   3. Documents what each capability means so consumers can verify behavior
 *
 * Future: capability proofs or on-chain demonstrations should be implemented
 * in the ERC-8004 Validation Registry before high-stakes trust decisions
 * are made based on capability claims alone.
 */

/**
 * Well-known capability identifiers for ERC-8004 agents.
 * Only these strings are recognized as verified claim types.
 * Claims outside this set are flagged as UNVERIFIED.
 */
export const KNOWN_CAPABILITIES = {
  /** Agent exposes an Agent-to-Agent (A2A) endpoint */
  A2A: "a2a",
  /** Agent supports the Model Context Protocol (MCP) */
  MCP: "mcp",
  /** Agent accepts x402 micropayments */
  X402: "x402",
  /** Agent has a resolvable ENS name */
  ENS: "ens",
  /** Agent has on-chain reputation signals in ERC-8004 Reputation Registry */
  REPUTATION: "reputation",
  /** Agent exposes a public web interface */
  WEB: "web",
} as const;

export type KnownCapability = (typeof KNOWN_CAPABILITIES)[keyof typeof KNOWN_CAPABILITIES];

const KNOWN_SET = new Set<string>(Object.values(KNOWN_CAPABILITIES));

export interface CapabilityEntry {
  id: string;
  /** true = recognized well-known capability; false = unverified/unknown claim */
  verified: boolean;
  /** Human-readable description for known capabilities */
  description?: string;
}

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  [KNOWN_CAPABILITIES.A2A]:
    "Agent exposes an Agent-to-Agent (A2A) compatible endpoint for machine-to-machine communication.",
  [KNOWN_CAPABILITIES.MCP]:
    "Agent implements the Model Context Protocol (MCP) for tool/resource exposure.",
  [KNOWN_CAPABILITIES.X402]:
    "Agent accepts x402 HTTP micropayments for metered service access.",
  [KNOWN_CAPABILITIES.ENS]:
    "Agent has a verified ENS primary name resolving to its registered address.",
  [KNOWN_CAPABILITIES.REPUTATION]:
    "Agent has on-chain reputation signals recorded in the ERC-8004 Reputation Registry.",
  [KNOWN_CAPABILITIES.WEB]:
    "Agent exposes a public web interface for human interaction.",
};

/**
 * Validate a list of capability claims from agent metadata.
 *
 * Recognized claims are marked verified:true.
 * Unrecognized claims are marked verified:false and should be treated
 * with skepticism — the agent is claiming something we cannot validate.
 *
 * @param claims - Raw capability strings from agent metadata
 * @returns Annotated capability entries
 */
export function validateCapabilities(claims: string[]): CapabilityEntry[] {
  if (!Array.isArray(claims)) {
    return [];
  }

  return claims
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => {
      const normalized = c.trim().toLowerCase();
      const isKnown = KNOWN_SET.has(normalized);
      return {
        id: normalized,
        verified: isKnown,
        description: isKnown ? CAPABILITY_DESCRIPTIONS[normalized] : undefined,
      };
    });
}

/**
 * Filter to only the capabilities that can be partially verified by
 * cross-referencing the agent's service list in its metadata.
 *
 * For example:
 * - "a2a" claim is plausible only if an A2A service endpoint is present
 * - "mcp" claim is plausible only if an MCP service endpoint is present
 * - "x402" claim is plausible only if x402Support=true in metadata
 *
 * This is not cryptographic proof — it only checks internal consistency.
 * True verification requires an external oracle or on-chain demonstration.
 *
 * @param claims - Capability claims from metadata
 * @param metadata - Full parsed metadata object for cross-reference
 * @returns Capability entries with consistency check results
 */
export function crossCheckCapabilities(
  claims: string[],
  metadata: {
    services?: Array<{ name: string; endpoint?: string }>;
    x402Support?: boolean;
  }
): CapabilityEntry[] {
  const entries = validateCapabilities(claims);

  const serviceNames = new Set(
    (metadata.services ?? []).map((s) => s.name.toLowerCase())
  );

  return entries.map((entry) => {
    if (!entry.verified) return entry;

    // Cross-check internal consistency
    let consistent = true;
    let note: string | undefined;

    switch (entry.id) {
      case KNOWN_CAPABILITIES.A2A:
        consistent = serviceNames.has("a2a");
        note = consistent
          ? undefined
          : "Claims A2A but no A2A service endpoint found in metadata";
        break;
      case KNOWN_CAPABILITIES.MCP:
        consistent = serviceNames.has("mcp");
        note = consistent
          ? undefined
          : "Claims MCP but no MCP service endpoint found in metadata";
        break;
      case KNOWN_CAPABILITIES.X402:
        consistent = metadata.x402Support === true;
        note = consistent
          ? undefined
          : "Claims x402 but x402Support is not true in metadata";
        break;
      case KNOWN_CAPABILITIES.WEB:
        consistent = serviceNames.has("web");
        note = consistent
          ? undefined
          : "Claims web but no web service endpoint found in metadata";
        break;
      // ENS and REPUTATION require external on-chain lookup to verify
      default:
        break;
    }

    return {
      ...entry,
      verified: consistent,
      description: note ?? entry.description,
    };
  });
}
