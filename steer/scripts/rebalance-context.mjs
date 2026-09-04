#!/usr/bin/env node

import { execFile } from "node:child_process";

const USAGE = `Usage:
  node scripts/rebalance-context.mjs \\
    --vault <vault address> --chain <chain> --protocol <market protocol>

Run this script through one Bankr execute_cli call. It performs these read-only
Steer CLI commands internally:
  steer vaults inspect <vault> --format json --full-output
  steer markets history <pool> --window 26h --interval hour --format json --full-output

It prints only a compact rebalance-context JSON object. It never runs profile,
plan, quote, preparation, or submission, and never treats incomplete history as
an execution approval.`;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--vault", "--chain", "--protocol"].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }

  if (options.help) {
    return options;
  }
  for (const required of ["vault", "chain", "protocol"]) {
    if (!options[required]) {
      throw new Error(`--${required} is required.`);
    }
  }
  return options;
}

function runSteer(args) {
  return new Promise((resolve, reject) => {
    execFile("steer", args, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const command = `steer ${args.join(" ")}`;
        const structured = cliFailureFromJson(stdout, "Steer");
        const exit = typeof error.code === "number" ? ` Exit code: ${error.code}.` : "";
        const diagnostic = structured ?? boundedDiagnostic(stdout, stderr);
        reject(new Error([
          `Steer command failed: ${command}.${exit}`,
          diagnostic ? `Diagnostic: ${diagnostic}` : "No structured CLI diagnostic was returned.",
        ].join(" ")));
        return;
      }
      resolve(stdout);
    });
  });
}

function isVolumeUsdSchemaFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /PoolHourData[^\n]*no field [`"]?volumeUsd/i.test(message);
}

function toIsoUtc(timestamp) {
  return new Date(timestamp * 1000).toISOString();
}

function normalizedHour(timestamp) {
  return Math.floor(timestamp / 3600) * 3600;
}

function fallbackBucket(snapshot) {
  if (!isObject(snapshot)) {
    return null;
  }
  const startTimestamp = numeric(snapshot.periodStartUnix);
  const fallbackPrice = text(snapshot.token0Price) ?? text(snapshot.token1Price);
  const open = text(snapshot.open) ?? fallbackPrice;
  const high = text(snapshot.high) ?? fallbackPrice;
  const low = text(snapshot.low) ?? fallbackPrice;
  const close = text(snapshot.close) ?? fallbackPrice;
  if (startTimestamp === null || !open || !high || !low || !close) {
    return null;
  }
  return {
    close,
    end: toIsoUtc(startTimestamp + 3600),
    endTimestamp: startTimestamp + 3600,
    high,
    low,
    open,
    start: toIsoUtc(startTimestamp),
    startTimestamp,
    volumeUsd: numeric(snapshot.volumeUSD ?? snapshot.volumeUsd),
  };
}

async function runVolumeUsdCompatibilityFallback(input) {
  const subgraphKey = process.env.STEER_SUBGRAPH_STUDIO_KEY;
  const rawSubgraphs = parseCliJson(await runSteer([
    "subgraphs",
    "--chain", input.chain,
    "--protocol", input.protocol,
    "--format", "json",
    "--full-output",
  ]), "subgraphs");
  const subgraphPayload = findPayload(
    requireObject(rawSubgraphs, "Subgraphs input"),
    (value) => Array.isArray(value.subgraphs),
    "subgraphs",
  );
  const subgraph = subgraphPayload.subgraphs.find((entry) => (
    isObject(entry)
    && text(entry.chain?.alias) === input.chain
    && text(entry.protocol?.alias) === input.protocol
    && text(entry.url)
  ));
  const discoveredUrl = text(subgraph?.url);
  if (!discoveredUrl) {
    throw new Error("steer subgraphs did not return a protocol GraphQL endpoint for the requested chain and protocol.");
  }
  const endpoint = discoveredUrl.replace("/api//", `/api/${subgraphKey}/`);
  const endTimestamp = normalizedHour(Math.floor(Date.now() / 1000));
  const startTimestamp = endTimestamp - (26 * 3600);
  const query = `
    query MarketPriceHistory($pool: String!, $timestampGte: Int!, $timestampLt: Int!, $limit: Int!) {
      poolHourDatas(
        first: $limit
        orderBy: periodStartUnix
        orderDirection: asc
        where: { pool: $pool, periodStartUnix_gte: $timestampGte, periodStartUnix_lt: $timestampLt }
      ) {
        periodStartUnix
        open
        high
        low
        close
        token0Price
        token1Price
        volumeUSD
        liquidity
      }
    }
  `;

  let response;
  try {
    const httpResponse = await fetch(endpoint, {
      body: JSON.stringify({
        query,
        variables: {
          limit: 27,
          pool: input.poolId.toLowerCase(),
          timestampGte: startTimestamp,
          timestampLt: endTimestamp,
        },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    response = await httpResponse.json();
    if (!httpResponse.ok) {
      throw new Error(`GraphQL endpoint returned HTTP ${httpResponse.status}.`);
    }
  } catch (error) {
    throw new Error(`The market-history compatibility fallback failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isObject(response) || !isObject(response.data)) {
    const errors = isObject(response) && Array.isArray(response.errors)
      ? response.errors.map((entry) => text(entry?.message)).filter(Boolean).join("; ")
      : null;
    throw new Error(`The market-history compatibility fallback returned no market data${errors ? `: ${errors}` : "."}`);
  }

  const buckets = (response.data.poolHourDatas ?? [])
    .map(fallbackBucket)
    .filter((bucket) => bucket !== null)
    .slice(-27);
  return {
    data: {
      buckets,
      chain: input.chain,
      history: {
        bucketCount: buckets.length,
        end: toIsoUtc(endTimestamp),
        endTimestamp,
        interval: "hour",
        latestClose: buckets.at(-1)?.close ?? null,
        start: buckets[0]?.start ?? toIsoUtc(startTimestamp),
        startTimestamp: buckets[0]?.startTimestamp ?? startTimestamp,
        window: "26h",
      },
      poolId: input.poolId,
      protocol: input.protocol,
    },
  };
}

function boundedDiagnostic(stdout, stderr) {
  const value = [stdout, stderr]
    .filter((item) => typeof item === "string" && item.trim())
    .join("\n")
    .trim();
  if (!value) {
    return null;
  }
  const redacted = value
    .replace(/(STEER_RPC_URL|STEER_SUBGRAPH_STUDIO_KEY|API[_-]?KEY|AUTHORIZATION|TOKEN|SECRET|PASSWORD)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/https?:\/\/[^\s/:@]+:[^\s/@]+@/gi, "https://[REDACTED]@")
    .replace(/([?&](?:api[_-]?key|key|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
  return redacted.length > 1200 ? `${redacted.slice(0, 1200)} [truncated]` : redacted;
}

function cliFailureFromJson(stdout, label) {
  try {
    const document = JSON.parse(stdout);
    return failedCliMessage(document, label);
  } catch {
    return null;
  }
}

function parseCliJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function parseVersion(stdout) {
  const match = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error("Unable to determine the installed Steer CLI version.");
  }
  return match.slice(1).map(Number);
}

function failedCliMessage(document, label) {
  if (document.ok !== false) {
    return null;
  }
  const error = isObject(document.error) ? document.error : {};
  const code = typeof error.code === "string" ? ` (${error.code})` : "";
  const message = typeof error.message === "string" ? error.message : "unknown CLI error";
  const retryable = error.retryable === true ? " Retryable." : error.retryable === false ? " Not retryable." : "";
  return `${label} CLI result reported failure${code}: ${message}${retryable}`;
}

function findPayload(document, predicate, label) {
  const failure = failedCliMessage(document, label);
  if (failure) {
    throw new Error(failure);
  }

  const candidates = [document, document.data, document.result, document.output]
    .filter(isObject);
  const payload = candidates.find(predicate);
  if (!payload) {
    throw new Error(`${label} does not contain the expected CLI payload.`);
  }
  return payload;
}

function text(value) {
  return typeof value === "string" ? value : null;
}

function numeric(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value) {
  const parsed = numeric(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function compactNumber(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(8));
}

function sameAddress(left, right) {
  return typeof left === "string" && typeof right === "string"
    ? left.toLowerCase() === right.toLowerCase()
    : null;
}

function normalizeBuckets(buckets) {
  const byTimestamp = new Map();
  for (const bucket of buckets) {
    if (!isObject(bucket)) {
      continue;
    }
    const endTimestamp = numeric(bucket.endTimestamp);
    const close = positive(bucket.close);
    if (endTimestamp === null || close === null) {
      continue;
    }
    byTimestamp.set(endTimestamp, {
      close,
      end: text(bucket.end),
      endTimestamp,
      high: positive(bucket.high),
      low: positive(bucket.low),
    });
  }
  return [...byTimestamp.values()].sort((left, right) => left.endTimestamp - right.endTimestamp);
}

function moveForWindow(series, seconds) {
  const latest = series.at(-1);
  if (!latest) {
    return { available: false, reason: "no valid close buckets" };
  }
  const referenceTimestamp = latest.endTimestamp - seconds;
  const reference = series.find((bucket) => bucket.endTimestamp === referenceTimestamp);
  if (!reference) {
    return {
      available: false,
      expectedReferenceEndTimestamp: referenceTimestamp,
      reason: "no exact reference close for the requested window",
    };
  }
  return {
    available: true,
    close: compactNumber(latest.close),
    changePct: compactNumber(((latest.close / reference.close) - 1) * 100),
    referenceClose: compactNumber(reference.close),
    referenceEnd: reference.end,
    referenceEndTimestamp: reference.endTimestamp,
    windowSeconds: seconds,
  };
}

function dispersion(series) {
  const hourlyLogReturns = [];
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    if (current.endTimestamp - previous.endTimestamp !== 3600) {
      continue;
    }
    hourlyLogReturns.push(Math.log(current.close / previous.close));
  }

  const mean = hourlyLogReturns.length
    ? hourlyLogReturns.reduce((sum, value) => sum + value, 0) / hourlyLogReturns.length
    : null;
  const hourlyLogReturnStdDevPct = hourlyLogReturns.length >= 2
    ? Math.sqrt(hourlyLogReturns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / hourlyLogReturns.length) * 100
    : null;

  const highs = series.map((bucket) => bucket.high).filter((value) => value !== null);
  const lows = series.map((bucket) => bucket.low).filter((value) => value !== null);
  const highLowRangePct = highs.length && lows.length
    ? ((Math.max(...highs) / Math.min(...lows)) - 1) * 100
    : null;

  return {
    highLowRangePct: compactNumber(highLowRangePct),
    hourlyLogReturnCount: hourlyLogReturns.length,
    hourlyLogReturnStdDevPct: compactNumber(hourlyLogReturnStdDevPct),
  };
}

function direction(oneHour, twentyFourHour) {
  const changes = [oneHour, twentyFourHour]
    .filter((move) => move.available)
    .map((move) => move.changePct);
  if (!changes.length) {
    return "unavailable";
  }
  const signs = new Set(changes.map((change) => (change > 0 ? "up" : change < 0 ? "down" : "flat")));
  return signs.size === 1 ? [...signs][0] : "mixed";
}

function reducePosition(position) {
  return {
    id: text(position.id),
    inRange: typeof position.inRange === "boolean" ? position.inRange : null,
    lowerTick: numeric(position.lowerTick),
    relativeWeight: position.relativeWeight ?? null,
    upperTick: numeric(position.upperTick),
  };
}

function reduceToken(token) {
  if (!isObject(token)) {
    return null;
  }
  return {
    address: text(token.address),
    decimals: numeric(token.decimals),
    symbol: text(token.symbol),
  };
}

function buildContext(rawVault, rawHistory) {
  const vault = findPayload(
    requireObject(rawVault, "Vault input"),
    (value) => isObject(value.pool) && typeof value.vaultAddress === "string",
    "Vault",
  );
  const history = findPayload(
    requireObject(rawHistory, "History input"),
    (value) => Array.isArray(value.buckets) && isObject(value.history),
    "Market history",
  );

  const pool = requireObject(vault.pool, "Vault pool");
  const vaultPoolAddress = text(pool.poolAddress);
  const historyPoolId = text(history.poolId);
  const poolMatches = sameAddress(vaultPoolAddress, historyPoolId);
  if (poolMatches === false) {
    throw new Error(`Pool identity mismatch: vault reports ${vaultPoolAddress}, history reports ${historyPoolId}.`);
  }
  if (text(vault.chain) && text(history.chain) && text(vault.chain) !== text(history.chain)) {
    throw new Error(`Chain mismatch: vault reports ${vault.chain}, history reports ${history.chain}.`);
  }

  const series = normalizeBuckets(history.buckets);
  const interval = text(history.history.interval);
  const oneHour = interval === "hour"
    ? moveForWindow(series, 3600)
    : { available: false, reason: `hourly buckets required; received ${interval ?? "unknown"}` };
  const twentyFourHour = interval === "hour"
    ? moveForWindow(series, 86400)
    : { available: false, reason: `hourly buckets required; received ${interval ?? "unknown"}` };
  const elevated = [oneHour, twentyFourHour]
    .some((move) => move.available && Math.abs(move.changePct) >= 5);

  const incompleteReasons = [];
  if (poolMatches === null) {
    incompleteReasons.push("pool address missing from one or both source responses");
  }
  if (interval !== "hour") {
    incompleteReasons.push("market history is not hourly");
  }
  if (!oneHour.available) {
    incompleteReasons.push(`1h move unavailable: ${oneHour.reason}`);
  }
  if (!twentyFourHour.available) {
    incompleteReasons.push(`24h move unavailable: ${twentyFourHour.reason}`);
  }

  return {
    schemaVersion: "steer.rebalance-context.v1",
    status: incompleteReasons.length ? "incomplete" : "complete",
    executionBoundary: {
      contextOnly: true,
      doesNotAuthorizeTend: true,
      doesNotReadRpc: true,
      doesNotRunProfile: true,
    },
    sources: {
      marketHistory: {
        interval,
        poolId: historyPoolId,
        protocol: text(history.protocol),
        window: text(history.history.window),
      },
      vaultInspect: {
        chain: text(vault.chain),
        protocol: text(vault.protocol),
        vaultAddress: text(vault.vaultAddress),
      },
    },
    vault: {
      active: typeof vault.active === "boolean" ? vault.active : null,
      apr: {
        fee: numeric(vault.feeApr),
        merkl: numeric(vault.merklApr),
        staking: numeric(vault.stakingApr),
      },
      fees: isObject(vault.fees) ? vault.fees : null,
      gas: isObject(vault.gas) ? vault.gas : null,
      holdings: isObject(vault.holdings) ? vault.holdings : null,
      pool: {
        feeTierBps: numeric(pool.feeTierBps),
        liquidity: text(pool.liquidity),
        poolAddress: vaultPoolAddress,
        poolId: text(pool.poolId),
        reportedTick: numeric(pool.tick),
        totalValueLockedUsd: numeric(pool.totalValueLockedUsd),
        volumeUsd: numeric(pool.volumeUsd),
      },
      positions: Array.isArray(vault.positions) ? vault.positions.filter(isObject).map(reducePosition) : [],
      tickRange: isObject(vault.tickRange) ? vault.tickRange : null,
      token0: reduceToken(vault.token0),
      token1: reduceToken(vault.token1),
      valuation: isObject(vault.valuation) ? vault.valuation : null,
    },
    market: {
      classification: {
        direction: direction(oneHour, twentyFourHour),
        elevatedVolatilityByMove: elevated,
        elevatedVolatilityThresholdPct: 5,
      },
      dispersion: dispersion(series),
      latestClose: series.length ? compactNumber(series.at(-1).close) : null,
      latestEnd: series.at(-1)?.end ?? null,
      latestEndTimestamp: series.at(-1)?.endTimestamp ?? null,
      moves: {
        oneHour,
        twentyFourHour,
      },
      validCloseBucketCount: series.length,
    },
    warnings: [
      "vault.pool.reportedTick is indexed vault-inspection data, not a block-pinned pool-state proof.",
      "No depth or liquidity-profile request was run by this helper.",
      ...incompleteReasons,
    ],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const versionOutput = await runSteer(["--version"]);
  const version = parseVersion(versionOutput);
  if (!process.env.STEER_SUBGRAPH_STUDIO_KEY) {
    throw new Error("markets history requires STEER_SUBGRAPH_STUDIO_KEY. Add it as a secure execute_cli environment variable; its value is never printed.");
  }

  const vaultArgs = [
    "vaults", "inspect", options.vault,
    "--chain", options.chain,
    "--protocol", options.protocol,
    "--format", "json",
    "--full-output",
  ];
  const rawVault = parseCliJson(await runSteer(vaultArgs), "vaults inspect");
  const vault = findPayload(
    requireObject(rawVault, "Vault input"),
    (value) => isObject(value.pool) && typeof value.vaultAddress === "string",
    "Vault",
  );
  const poolAddress = text(vault.pool?.poolAddress);
  if (!poolAddress) {
    throw new Error("vaults inspect did not return a pool address.");
  }

  const historyArgs = [
    "markets", "history", poolAddress,
    "--chain", options.chain,
    "--protocol", options.protocol,
    "--window", "26h",
    "--interval", "hour",
    "--limit", "27",
    "--format", "json",
    "--full-output",
  ];
  let rawHistory;
  let historySource = "markets history";
  try {
    rawHistory = parseCliJson(await runSteer(historyArgs), "markets history");
  } catch (error) {
    if (!isVolumeUsdSchemaFailure(error)) {
      throw error;
    }
    rawHistory = await runVolumeUsdCompatibilityFallback({
      chain: options.chain,
      poolId: poolAddress,
      protocol: options.protocol,
    });
    historySource = "markets history compatibility fallback";
  }
  const context = buildContext(rawVault, rawHistory);
  context.sources.execution = {
    cliVersion: version.join("."),
    commands: ["vaults inspect", ...(historySource === "markets history" ? [] : ["subgraphs"]), historySource],
  };
  process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`rebalance-context: ${error.message}\n`);
  process.exitCode = 2;
});
