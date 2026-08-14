#!/usr/bin/env node

import {
  cashout,
  close,
  createOfframp,
  deposits,
  isCashError,
  usdc,
} from "@usdctofiat/offramp";
import { createPublicClient, createWalletClient, custom, http } from "viem";
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

function requireMode(value) {
  const mode = String(required(value, "--mode")).toLowerCase();
  if (mode !== "fast" && mode !== "best") {
    throw new Error('cashout requires --mode fast or --mode best');
  }
  return mode;
}

function isBestDepositId(depositId) {
  return /^\d+$/.test(depositId);
}

function offramp() {
  return createOfframp({ integratorId: "bankr" });
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

async function submitViaBankr(tx, description) {
  const chainId = Number(tx.chainId ?? base.id);
  if (chainId !== base.id) {
    throw new Error(`Refusing non-Base transaction for USDCtoFiat: chain ${chainId}`);
  }
  const response = await bankrRequest("/wallet/submit", {
    method: "POST",
    body: JSON.stringify({
      transaction: {
        to: tx.to,
        data: tx.data ?? "0x",
        value: (tx.value ?? 0n).toString(),
        chainId,
      },
      description,
      waitForConfirmation: true,
    }),
  });
  const transactionHash = response.transactionHash ?? response.hash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? "")) {
    throw new Error("Bankr submit succeeded without a transaction hash; inspect wallet activity before retrying");
  }
  return transactionHash;
}

async function bankrSigner() {
  const address = await bankrAddress();
  return createWalletClient({
    account: address,
    chain: base,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          return [address];
        }
        if (method === "eth_chainId") {
          return `0x${base.id.toString(16)}`;
        }
        if (method === "eth_sendTransaction") {
          const tx = params?.[0] ?? {};
          return submitViaBankr(
            {
              to: tx.to,
              data: tx.data,
              value: tx.value != null ? BigInt(tx.value) : 0n,
              chainId: tx.chainId ?? base.id,
            },
            "USDCtoFiat cashout",
          );
        }
        return publicClient.request({ method, params });
      },
    }),
  });
}

function requireConfirmation(flags, preview) {
  if (flags.confirm !== true) {
    throw new Error(`Write not confirmed. Show this preview to the user, then rerun with --confirm:\n${asJson(preview)}`);
  }
}

function rejectWise(platform) {
  if (String(platform).toLowerCase() === "wise") {
    throw new Error("USDCtoFiat will not create a Wise cash-out while Wise prohibits P2P crypto-sale payments.");
  }
}

async function runCashout(flags) {
  const mode = requireMode(flags.mode);
  const amount = required(flags.amount, "--amount");
  const platform = required(flags.platform, "--platform");
  const currency = required(flags.currency, "--currency").toUpperCase();
  const payee = required(flags.payee, "--payee");
  rejectWise(platform);

  const estimate = await offramp().estimate({ amount: usdc(amount), currency });
  const preview = {
    action: "cashout",
    product: "USDCtoFiat",
    mode,
    chain: "Base",
    asset: "USDC",
    amount,
    receive: { platform, currency, payee },
    estimate,
    fee:
      mode === "fast"
        ? "0% spread. TOFIAT attribution is locked by @usdctofiat/offramp."
        : "Delegate strategy. 10 bps on fill, taken from USDC released to the taker.",
    warning: "The rate is an oracle estimate. The binding rate resolves when a buyer fills.",
  };
  requireConfirmation(flags, preview);

  const signer = await bankrSigner();
  const result = await cashout({
    mode,
    signer,
    amount,
    platform,
    currency,
    payee,
  });
  output(result);
}

async function runWithdraw(depositId, flags) {
  required(depositId, "deposit id");
  const client = offramp();
  const best = isBestDepositId(depositId);
  let current;
  if (best) {
    const address = await bankrAddress();
    current = (await deposits(address)).find((row) => row.depositId === depositId) ?? { depositId };
  } else {
    current = await client.order(depositId);
  }
  requireConfirmation(flags, {
    action: flags.amount ? "partial-withdraw" : "close-and-withdraw",
    product: "USDCtoFiat",
    mode: best ? "best" : "fast",
    depositId,
    amount: flags.amount ?? "all unlocked funds",
    current,
  });

  const signer = await bankrSigner();
  if (best) {
    if (flags.amount) {
      throw new Error("Best-mode close() withdraws remaining unlocked USDC. Omit --amount or use a Fast depositId for a partial withdraw.");
    }
    const txHash = await close(signer, depositId);
    output({ depositId, mode: "best", transactionHashes: [txHash] });
    return;
  }

  const result = await client.withdraw(depositId, {
    signer,
    ...(flags.amount ? { amount: usdc(flags.amount) } : {}),
  });
  output({ depositId, mode: "fast", ...result });
}

async function runTopUp(depositId, flags) {
  required(depositId, "deposit id");
  if (isBestDepositId(depositId)) {
    throw new Error("top-up is a Fast-order action. For Best, create a new cashout --mode best.");
  }
  const amount = required(flags.amount, "--amount");
  const current = await offramp().order(depositId);
  requireConfirmation(flags, {
    action: "top-up",
    product: "USDCtoFiat",
    mode: "fast",
    depositId,
    amount,
    asset: "Base USDC",
    currentState: current.state,
  });
  const result = await offramp().topUp(depositId, usdc(amount), { signer: await bankrSigner() });
  output({ depositId, mode: "fast", ...result });
}

async function runStatus(depositId) {
  required(depositId, "deposit id");
  if (isBestDepositId(depositId)) {
    const address = await bankrAddress();
    const match = (await deposits(address)).find((row) => row.depositId === depositId);
    if (!match) {
      throw new Error(`No Best deposit ${depositId} for this Bankr wallet`);
    }
    output({ mode: "best", ...match });
    return;
  }
  output({ mode: "fast", ...(await offramp().order(depositId)) });
}

async function runOrders(flags) {
  const address = await bankrAddress();
  const [fast, best] = await Promise.all([
    offramp().orders(address, { inFlight: flags.all !== true }),
    deposits(address),
  ]);
  output({
    address,
    fast,
    best: flags.all === true ? best : best.filter((row) => row.status === "active"),
  });
}

function usage() {
  return [
    "Usage: usdctofiat.mjs",
    "  capabilities",
    "  estimate <amount> <currency>",
    "  cashout --mode fast|best --amount N --platform ID --currency CODE --payee HANDLE [--confirm]",
    "  status <depositId>",
    "  orders [--all]",
    "  withdraw <depositId> [--amount N] [--confirm]",
    "  top-up <depositId> --amount N [--confirm]",
  ].join("\n");
}

function errorPayload(error) {
  if (isCashError(error)) return error.toJSON();
  if (error && typeof error === "object" && error.name === "OfframpError") {
    return {
      error: error.message,
      code: error.code,
      step: error.step,
      depositId: error.depositId,
      txHash: error.txHash,
    };
  }
  return { error: error instanceof Error ? error.message : String(error) };
}

async function main() {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "capabilities":
      output(offramp().capabilities());
      return;
    case "estimate":
      output(
        await offramp().estimate({
          amount: usdc(required(positionals[0], "amount")),
          currency: required(positionals[1], "currency").toUpperCase(),
        }),
      );
      return;
    case "cashout":
      await runCashout(flags);
      return;
    case "status":
      await runStatus(positionals[0]);
      return;
    case "orders":
      await runOrders(flags);
      return;
    case "withdraw":
      await runWithdraw(positionals[0], flags);
      return;
    case "top-up":
      await runTopUp(positionals[0], flags);
      return;
    default:
      throw new Error(usage());
  }
}

main().catch((error) => {
  process.stderr.write(`${asJson(errorPayload(error))}\n`);
  process.exitCode = 1;
});
