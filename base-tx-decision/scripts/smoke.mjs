#!/usr/bin/env node
// Free challenge-only smoke test: hits the live x402-mcp endpoint and asserts
// the 402 response matches the pinned payment policy documented in SKILL.md.
// No wallet or USDC required to run this — it never signs or sends a payment.

const productionBaseUrl = "https://x402-mcp.onrender.com";
const overrideBaseUrl = (process.env.BASE_TX_DECISION_BASE_URL || "").replace(/\/$/, "");
const isLocalOverride = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(overrideBaseUrl);
const baseUrl = overrideBaseUrl || productionBaseUrl;

const expectedPayment = {
  scheme: "exact",
  network: "eip155:8453",
  asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  payTo: "0xab745e5f576667037696e78ba7da28e193e4423d",
  amount: "10000",
  resource: `${productionBaseUrl}/base/tx-decision`
};

function decodePaymentRequiredHeader(value) {
  const json = Buffer.from(value, "base64").toString("utf8");
  return JSON.parse(json);
}

function assertPaymentPolicy(challenge) {
  const accepts = Array.isArray(challenge.accepts) ? challenge.accepts : [];
  const match = accepts.find((accept) =>
    accept.scheme === expectedPayment.scheme &&
    accept.network === expectedPayment.network &&
    String(accept.asset || "").toLowerCase() === expectedPayment.asset &&
    String(accept.payTo || "").toLowerCase() === expectedPayment.payTo &&
    String(accept.amount) === expectedPayment.amount &&
    Number(accept.maxTimeoutSeconds) <= 300
  );
  if (!match) {
    throw new Error("x402 challenge does not match the pinned base-tx-decision payment policy; refusing to continue.");
  }
  return match;
}

async function main() {
  if (overrideBaseUrl && !isLocalOverride) {
    throw new Error("BASE_TX_DECISION_BASE_URL is permitted only for localhost or 127.0.0.1 testing.");
  }

  const url = `${baseUrl}/base/tx-decision?gas=usdc&urgency=flexible`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  const paymentRequiredHeader = res.headers.get("payment-required");

  console.log("x402 challenge", {
    status: res.status,
    hasPaymentRequiredHeader: Boolean(paymentRequiredHeader),
    resource: body.resource,
    price: body.price
  });

  if (res.status !== 402 || !paymentRequiredHeader) {
    throw new Error("Expected 402 with a payment-required header.");
  }

  if (!isLocalOverride) {
    const challenge = decodePaymentRequiredHeader(paymentRequiredHeader);
    const accept = assertPaymentPolicy(challenge);
    console.log("x402 policy", {
      network: accept.network,
      asset: accept.asset,
      payTo: accept.payTo,
      amount: accept.amount,
      maxTimeoutSeconds: accept.maxTimeoutSeconds
    });
  }

  console.log("Smoke test complete: the endpoint is live and its 402 challenge matches the documented $0.01 USDC / Base mainnet policy. This script never pays — wire a funded x402 client (see SKILL.md) to complete a real call.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
