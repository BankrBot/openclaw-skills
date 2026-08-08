#!/usr/bin/env node

const productionBaseUrl = "https://ai2human.io";
const overrideBaseUrl = (process.env.AI2HUMAN_BASE_URL || "").replace(/\/$/, "");
const isLocalOverride = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(overrideBaseUrl);
const baseUrl = overrideBaseUrl || productionBaseUrl;
const apiKey = process.env.AI2HUMAN_API_KEY || "";
const createSmokeTask = process.env.AI2HUMAN_CREATE_SMOKE_TASK === "1";
const allowLocalKey = process.env.AI2HUMAN_ALLOW_LOCAL_KEY === "1";

const expectedPayment = {
  network: "eip155:196",
  asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
  payTo: "0x3f665386b41Fa15c5ccCeE983050a236E6a10108",
  maxAmount: "10000",
  resource: `${productionBaseUrl}/api/x402/agent/tasks/create`
};

function assertPaymentPolicy(challenge) {
  const accepts = Array.isArray(challenge.accepts) ? challenge.accepts : [];
  const match = accepts.find((accept) =>
    accept.scheme === "exact" &&
    accept.network === expectedPayment.network &&
    String(accept.asset || "").toLowerCase() === expectedPayment.asset &&
    String(accept.payTo || "").toLowerCase() === expectedPayment.payTo.toLowerCase() &&
    String(accept.resource || "") === expectedPayment.resource &&
    Number(accept.amount) <= Number(expectedPayment.maxAmount) &&
    Number(accept.maxAmountRequired) <= Number(expectedPayment.maxAmount) &&
    Number(accept.maxTimeoutSeconds) <= 300
  );
  if (!match) {
    throw new Error("x402 challenge does not match the pinned AI2Human payment policy; refusing to continue.");
  }
  return match;
}

async function main() {
  if (overrideBaseUrl && !isLocalOverride) {
    throw new Error("AI2HUMAN_BASE_URL is permitted only for localhost or 127.0.0.1 testing. Do not send live keys to an overridden host.");
  }
  const x402Url = `${baseUrl}/api/x402/agent/tasks/create`;
  const challenge = await fetch(x402Url);
  const challengeJson = await challenge.json().catch(() => ({}));
  console.log("x402 challenge", {
    status: challenge.status,
    hasPaymentRequired: Boolean(challenge.headers.get("PAYMENT-REQUIRED")),
    accepts: Array.isArray(challengeJson.accepts) ? challengeJson.accepts.length : 0
  });

  if (challenge.status !== 402 || !challenge.headers.get("PAYMENT-REQUIRED")) {
    throw new Error("Expected x402 endpoint to return 402 with PAYMENT-REQUIRED.");
  }
  if (!isLocalOverride) {
    const payment = assertPaymentPolicy(challengeJson);
    console.log("x402 policy", {
      network: payment.network,
      asset: payment.asset,
      payTo: payment.payTo,
      amount: payment.amount,
      maxTimeoutSeconds: payment.maxTimeoutSeconds
    });
  }

  if (!createSmokeTask) {
    console.log("Challenge-only test complete. Set AI2HUMAN_CREATE_SMOKE_TASK=1 with an approved secret-store API key to create a real task.");
    return;
  }

  if (!apiKey) throw new Error("AI2HUMAN_API_KEY is required when AI2HUMAN_CREATE_SMOKE_TASK=1.");
  if (isLocalOverride && !allowLocalKey) {
    throw new Error("Refusing to send an API key to a local override without AI2HUMAN_ALLOW_LOCAL_KEY=1.");
  }

  const payload = {
    title: "Bankr skill smoke test: AI2Human mobile review",
    description:
      "Open https://ai2human.io on mobile and submit one screenshot, short notes, and a final verdict. This is a smoke-test task created by the Bankr skill package.",
    category: "digital_task",
    proof_requirements: ["screenshot", "notes", "timestamp"],
    reward_usdc: 1,
    deadline_hours: 24,
    location: "remote",
    agent_name: "Bankr Skill Smoke Test"
  };

  const created = await fetch(`${baseUrl}/api/agent/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });
  const createdJson = await created.json().catch(() => ({}));
  console.log("api-key create", {
    status: created.status,
    ok: createdJson.ok,
    task_id: createdJson.task_id,
    task_url: createdJson.task_url
  });

  if (created.status !== 201 || !createdJson.task_url) {
    throw new Error(`Expected task creation to return 201 with task_url. Got ${created.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
