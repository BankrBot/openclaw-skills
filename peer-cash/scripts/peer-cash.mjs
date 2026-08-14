#!/usr/bin/env node

import { createCashClient, isCashError, usdc } from "@zkp2p/cash";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const BANKR_API = "https://api.bankr.bot";
const publicClient = createPublicClient({ chain: base, transport: http() });

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positionals = [];
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }

  return { command, positionals, flags };
}

function required(value, label) {
  if (value === undefined || value === true || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

function asJson(value) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2);
}

function output(value) {
  process.stdout.write(`${asJson(value)}\n`);
}

function cashClient() {
  return createCashClient({
    environment: process.env.PEER_CASH_ENVIRONMENT ?? "production",
    referrer: "bankr",
    ...(process.env.PEER_CASH_REFERRAL_CODE
      ? { referralCode: process.env.PEER_CASH_REFERRAL_CODE }
      : {}),
  });
}

async function bankrRequest(path, init = {}) {
  const apiKey = required(process.env.BANKR_API_KEY, "BANKR_API_KEY");
  const response = await fetch(`${BANKR_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = body.error ?? body.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`Bankr ${path} failed: ${detail}`);
  }
  return body;
}

async function bankrAddress() {
  const wallet = await bankrRequest("/wallet/me");
  const address = wallet.address ?? wallet.wallet?.address;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
    throw new Error("Bankr /wallet/me did not return an EVM address");
  }
  return address;
}

async function submitPrepared(tx, description) {
  if (tx.chainId !== base.id) {
    throw new Error(`Refusing non-Base transaction for Peer Cash: chain ${tx.chainId}`);
  }
  const response = await bankrRequest("/wallet/submit", {
    method: "POST",
    body: JSON.stringify({
      transaction: {
        to: tx.to,
        data: tx.data,
        value: tx.value.toString(),
        chainId: tx.chainId,
      },
      description,
      waitForConfirmation: true,
    }),
  });
  const transactionHash = response.transactionHash ?? response.hash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? "")) {
    throw new Error("Bankr submit succeeded without a transaction hash; inspect wallet activity before retrying");
  }
  return publicClient.waitForTransactionReceipt({ hash: transactionHash });
}

function requireConfirmation(flags, preview) {
  if (flags.confirm !== true) {
    throw new Error(`Write not confirmed. Show this preview to the user, then rerun with --confirm:\n${asJson(preview)}`);
  }
}

async function submitPlan(txs, steps) {
  const receipts = [];
  for (let index = 0; index < txs.length; index += 1) {
    receipts.push(await submitPrepared(txs[index], steps[index]?.description ?? "Peer Cash transaction"));
  }
  return receipts;
}

async function cashout(cash, flags) {
  const amount = required(flags.amount, "--amount");
  const platform = required(flags.platform, "--platform");
  const currency = required(flags.currency, "--currency").toUpperCase();
  const payee = required(flags.payee, "--payee");
  const input = { amount: usdc(amount), receive: { platform, currency, payee } };
  const estimate = await cash.estimate({ amount: usdc(amount), currency });
  const preview = {
    action: "cashout",
    chain: "Base",
    asset: "USDC",
    amount,
    receive: { platform, currency, payee },
    estimate,
    warning: "The rate is an oracle estimate. The binding rate resolves when a buyer fills.",
  };
  requireConfirmation(flags, preview);

  const plan = await cash.prepare(input);
  const receipts = await submitPlan(plan.txs, plan.steps);
  const createDepositReceipt = receipts.at(-1);
  const result = cash.finalizePreparedCashout({
    transactionHash: createDepositReceipt.transactionHash,
    status: createDepositReceipt.status,
    logs: createDepositReceipt.logs,
  });

  let accessPolicyTxHash;
  if (plan.accessPolicyRequired) {
    const policy = cash.prepareAccessPolicy(result.depositId);
    const receipt = await submitPrepared(policy, "Restrict Peer Cash order access to verified buyer groups");
    accessPolicyTxHash = receipt.transactionHash;
  }

  output({ ...result, ...(accessPolicyTxHash ? { accessPolicyTxHash } : {}) });
}

async function withdraw(cash, depositId, flags) {
  required(depositId, "deposit id");
  const current = await cash.order(depositId);
  const amount = flags.amount ? usdc(flags.amount) : undefined;
  requireConfirmation(flags, {
    action: amount ? "partial-withdraw" : "close-and-withdraw",
    depositId,
    amount: flags.amount ?? "all unlocked funds",
    currentState: current.state,
    nextActions: current.nextActions,
  });
  const plan = await cash.prepareWithdraw(depositId, amount ? { amount } : undefined);
  const receipts = await submitPlan(plan.txs, plan.steps);
  output({ depositId, transactionHashes: receipts.map((receipt) => receipt.transactionHash) });
}

async function topUp(cash, depositId, flags) {
  required(depositId, "deposit id");
  const amount = required(flags.amount, "--amount");
  const current = await cash.order(depositId);
  requireConfirmation(flags, {
    action: "top-up",
    depositId,
    amount,
    asset: "Base USDC",
    currentState: current.state,
  });
  const plan = await cash.prepareTopUp(depositId, usdc(amount));
  const receipts = await submitPlan(plan.txs, plan.steps);
  output({ depositId, transactionHashes: receipts.map((receipt) => receipt.transactionHash) });
}

async function main() {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  const cash = cashClient();

  switch (command) {
    case "capabilities":
      output(cash.capabilities());
      return;
    case "estimate":
      output(await cash.estimate({ amount: usdc(required(positionals[0], "amount")), currency: required(positionals[1], "currency").toUpperCase() }));
      return;
    case "cashout":
      await cashout(cash, flags);
      return;
    case "status":
      output(await cash.order(required(positionals[0], "deposit id")));
      return;
    case "orders":
      output(await cash.orders(await bankrAddress(), { inFlight: flags.all !== true }));
      return;
    case "withdraw":
      await withdraw(cash, positionals[0], flags);
      return;
    case "top-up":
      await topUp(cash, positionals[0], flags);
      return;
    default:
      throw new Error("Usage: peer-cash.mjs capabilities | estimate <amount> <currency> | cashout --amount N --platform ID --currency CODE --payee HANDLE [--confirm] | status <depositId> | orders [--all] | withdraw <depositId> [--amount N] [--confirm] | top-up <depositId> --amount N [--confirm]");
  }
}

main().catch((error) => {
  const payload = isCashError(error)
    ? error.toJSON()
    : { error: error instanceof Error ? error.message : String(error) };
  process.stderr.write(`${asJson(payload)}\n`);
  process.exitCode = 1;
});
