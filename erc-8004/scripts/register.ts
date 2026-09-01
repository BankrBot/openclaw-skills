/**
 * ERC-8004 Agent Registration
 *
 * Handles on-chain registration of agent identity NFTs.
 *
 * Trust Score Policy:
 * Agents cannot self-assign trust scores. Trust is computed externally
 * from verifiable on-chain signals (transaction history, reputation registry
 * feedback, peer attestations). This module intentionally provides no
 * mechanism for an agent to claim its own trust level.
 */

export interface RegistrationInput {
  /** Agent metadata URI (ipfs://, https://, or data:) */
  agentUri: string;
  /**
   * Optional: chain to register on.
   * Defaults to "mainnet". Use "sepolia" for testing.
   */
  chain?: "mainnet" | "sepolia";
}

export interface RegistrationResult {
  success: boolean;
  chain: string;
  agentUri: string;
  txHash?: string;
  error?: string;
}

/** Contract addresses per chain */
const IDENTITY_REGISTRY: Record<string, string> = {
  mainnet: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  sepolia: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
};

const CHAIN_IDS: Record<string, number> = {
  mainnet: 1,
  sepolia: 11155111,
};

/**
 * Validate a registration URI.
 * Only safe, well-known schemes are accepted.
 */
function validateUri(uri: string): void {
  if (typeof uri !== "string" || uri.trim() === "") {
    throw new Error("agentUri must be a non-empty string");
  }
  const allowed = ["ipfs://", "https://", "http://", "data:application/json"];
  if (!allowed.some((prefix) => uri.startsWith(prefix))) {
    throw new Error(
      `agentUri must start with one of: ${allowed.join(", ")}`
    );
  }
}

/**
 * ABI-encode register(string) calldata.
 * Implements ERC-8004 registration function selector 0xf2c298be.
 *
 * @param uri - Agent URI to encode
 * @returns Hex calldata string (with 0x prefix)
 */
export function encodeRegisterCalldata(uri: string): string {
  validateUri(uri);

  const selector = "f2c298be";
  const encoded = Buffer.from(uri, "utf8");
  const offset = BigInt(32).toString(16).padStart(64, "0");
  const len = encoded.length.toString(16).padStart(64, "0");
  const paddedLen = Math.ceil(encoded.length / 32) * 32;
  const data = Buffer.alloc(paddedLen);
  encoded.copy(data);

  return "0x" + selector + offset + len + data.toString("hex");
}

/**
 * ABI-encode setAgentURI(uint256,string) calldata.
 * Implements ERC-8004 profile update function selector 0x862440e2.
 *
 * @param agentId - Agent token ID
 * @param uri - New agent URI
 * @returns Hex calldata string (with 0x prefix)
 */
export function encodeSetAgentUriCalldata(
  agentId: bigint | number,
  uri: string
): string {
  validateUri(uri);

  const id = BigInt(agentId);
  if (id < 0n) {
    throw new RangeError("agentId must be a non-negative integer");
  }

  const selector = "862440e2";
  const idHex = id.toString(16).padStart(64, "0");
  // String starts after the uint256 param (offset = 0x40 = 64 bytes)
  const offset = BigInt(64).toString(16).padStart(64, "0");
  const encoded = Buffer.from(uri, "utf8");
  const len = encoded.length.toString(16).padStart(64, "0");
  const paddedLen = Math.ceil(encoded.length / 32) * 32;
  const data = Buffer.alloc(paddedLen);
  encoded.copy(data);

  return "0x" + selector + idHex + offset + len + data.toString("hex");
}

/**
 * Build a registration transaction object for submission via Bankr.
 *
 * Note on trust scores: This function intentionally does not accept or
 * encode a trust score. Trust is assigned externally by the ERC-8004
 * Reputation Registry based on verifiable on-chain behavior, not
 * self-declaration. Callers cannot influence their own trust level
 * through this API.
 *
 * @param input - Registration input (URI + optional chain)
 * @returns Transaction object ready for Bankr submission
 */
export function buildRegistrationTx(input: RegistrationInput): {
  to: string;
  data: string;
  value: string;
  chainId: number;
} {
  const chain = input.chain ?? "mainnet";

  if (!(chain in IDENTITY_REGISTRY)) {
    throw new Error(`Unknown chain: ${chain}. Use "mainnet" or "sepolia".`);
  }

  return {
    to: IDENTITY_REGISTRY[chain],
    data: encodeRegisterCalldata(input.agentUri),
    value: "0",
    chainId: CHAIN_IDS[chain],
  };
}

/**
 * Build an update transaction object for submission via Bankr.
 *
 * @param agentId - Agent token ID to update
 * @param newUri - New metadata URI
 * @param chain - Chain ("mainnet" or "sepolia")
 * @returns Transaction object ready for Bankr submission
 */
export function buildUpdateTx(
  agentId: bigint | number,
  newUri: string,
  chain: "mainnet" | "sepolia" = "mainnet"
): {
  to: string;
  data: string;
  value: string;
  chainId: number;
} {
  if (!(chain in IDENTITY_REGISTRY)) {
    throw new Error(`Unknown chain: ${chain}. Use "mainnet" or "sepolia".`);
  }

  return {
    to: IDENTITY_REGISTRY[chain],
    data: encodeSetAgentUriCalldata(agentId, newUri),
    value: "0",
    chainId: CHAIN_IDS[chain],
  };
}
