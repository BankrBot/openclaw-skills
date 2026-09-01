/**
 * ERC-8004 Metadata Parser
 *
 * Safely parses and validates agent metadata from on-chain URIs.
 * Uses JSON.parse only — never eval() or dynamic code execution.
 */

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
}

export interface AgentMetadata {
  type: string;
  name: string;
  description: string;
  image?: string;
  services?: AgentService[];
  x402Support?: boolean;
  active?: boolean;
  registrations?: Array<{
    agentId: number | string;
    agentRegistry: string;
  }>;
  supportedTrust?: string[];
  [key: string]: unknown;
}

/**
 * Parse and validate agent metadata from a JSON string.
 *
 * Uses JSON.parse — never eval(). Metadata is treated as untrusted
 * external input throughout; no dynamic field names are executed.
 *
 * @param raw - Raw JSON string from IPFS, HTTP, or data URI
 * @returns Parsed and validated AgentMetadata
 * @throws Error if the input is not valid JSON or fails structural validation
 */
export function parseMetadata(raw: string): AgentMetadata {
  if (typeof raw !== "string") {
    throw new TypeError("Metadata must be a string");
  }

  // Safe parse — never eval()
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON: metadata could not be parsed");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid metadata: expected a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  // Validate required fields
  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    throw new Error('Invalid metadata: "name" must be a non-empty string');
  }

  if (typeof obj.description !== "string") {
    throw new Error('Invalid metadata: "description" must be a string');
  }

  // Sanitize: strip any field that looks like executable code or injection
  const sanitized: AgentMetadata = {
    type:
      typeof obj.type === "string"
        ? obj.type
        : "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: String(obj.name).trim().slice(0, 256),
    description: String(obj.description).trim().slice(0, 4096),
  };

  if (typeof obj.image === "string") {
    sanitized.image = obj.image.slice(0, 2048);
  }

  if (typeof obj.x402Support === "boolean") {
    sanitized.x402Support = obj.x402Support;
  }

  if (typeof obj.active === "boolean") {
    sanitized.active = obj.active;
  }

  if (Array.isArray(obj.services)) {
    sanitized.services = obj.services
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === "object" && s !== null && !Array.isArray(s)
      )
      .map((s) => {
        const svc: AgentService = {
          name: typeof s.name === "string" ? s.name.trim().slice(0, 64) : "",
          endpoint:
            typeof s.endpoint === "string" ? s.endpoint.trim().slice(0, 2048) : "",
        };
        if (typeof s.version === "string") {
          svc.version = s.version.trim().slice(0, 32);
        }
        return svc;
      })
      .filter((s) => s.name !== "" && s.endpoint !== "");
  }

  if (Array.isArray(obj.supportedTrust)) {
    sanitized.supportedTrust = obj.supportedTrust
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().slice(0, 64));
  }

  if (Array.isArray(obj.registrations)) {
    sanitized.registrations = obj.registrations
      .filter(
        (r): r is Record<string, unknown> =>
          typeof r === "object" && r !== null && !Array.isArray(r)
      )
      .map((r) => ({
        agentId: typeof r.agentId === "number" ? r.agentId : String(r.agentId),
        agentRegistry: typeof r.agentRegistry === "string" ? r.agentRegistry : "",
      }));
  }

  return sanitized;
}

/**
 * Fetch and parse metadata from a URI.
 *
 * Supports ipfs://, https://, http://, and data: URIs.
 * Fetched content is treated as untrusted and parsed safely.
 *
 * @param uri - Agent URI from on-chain registry
 * @returns Parsed AgentMetadata
 */
export async function fetchMetadata(uri: string): Promise<AgentMetadata> {
  if (typeof uri !== "string" || uri.trim() === "") {
    throw new Error("URI must be a non-empty string");
  }

  let raw: string;

  if (uri.startsWith("data:application/json;base64,")) {
    // On-chain data URI — decode base64
    const b64 = uri.slice("data:application/json;base64,".length);
    raw = Buffer.from(b64, "base64").toString("utf8");
  } else if (uri.startsWith("ipfs://")) {
    const cid = uri.slice("ipfs://".length);
    // Try Pinata first, fall back to public gateway
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
    ];
    raw = "";
    for (const gw of gateways) {
      try {
        const res = await fetch(gw);
        if (res.ok) {
          raw = await res.text();
          break;
        }
      } catch {
        // try next gateway
      }
    }
    if (!raw) {
      throw new Error(`Failed to fetch IPFS content for CID: ${cid}`);
    }
  } else if (uri.startsWith("https://") || uri.startsWith("http://")) {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching metadata from ${uri}`);
    }
    raw = await res.text();
  } else {
    throw new Error(`Unsupported URI scheme: ${uri}`);
  }

  return parseMetadata(raw);
}
