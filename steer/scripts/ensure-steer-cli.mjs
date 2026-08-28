#!/usr/bin/env node

import { execFile } from "node:child_process";

const PACKAGE_NAME = "@steerprotocol/cli";
const PACKAGE_REGISTRY_URL = "https://registry.npmjs.org/%40steerprotocol%2Fcli";
const TIMEOUT_MS = 120_000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const USAGE = `Usage: node scripts/ensure-steer-cli.mjs

Resolve the npm registry's current ${PACKAGE_NAME} latest dist-tag, install that exact
version when needed, and verify that the steer binary on PATH matches it.
The script prints one JSON result and never prints npm or CLI command output.`;

class PreflightError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024, timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function latestVersion() {
  let response;
  try {
    response = await fetch(PACKAGE_REGISTRY_URL, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PreflightError(
      "NPM_LATEST_UNAVAILABLE",
      `Unable to resolve npm latest for ${PACKAGE_NAME}.`,
    );
  }
  try {
    if (!response.ok) {
      throw new Error(`Registry returned HTTP ${response.status}.`);
    }
    const metadata = await response.json();
    const version = metadata?.["dist-tags"]?.latest;
    if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
      throw new Error("Registry latest dist-tag was not a valid version.");
    }
    return version;
  } catch {
    throw new PreflightError(
      "NPM_LATEST_INVALID",
      `The npm registry latest dist-tag for ${PACKAGE_NAME} was not a valid version.`,
    );
  }
}

async function installedVersion() {
  let stdout;
  try {
    stdout = await run("steer", ["--version"]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw new PreflightError("CLI_VERSION_UNAVAILABLE", "Unable to run steer --version.");
  }

  const match = stdout.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/);
  if (!match) {
    throw new PreflightError("CLI_VERSION_INVALID", "steer --version did not report a valid version.");
  }
  return match[0];
}

async function install(version) {
  try {
    await run("npm", ["install", "--global", `${PACKAGE_NAME}@${version}`]);
  } catch {
    throw new PreflightError(
      "CLI_INSTALL_FAILED",
      `Unable to install ${PACKAGE_NAME}@${version}.`,
    );
  }
}

async function main() {
  if (process.argv.slice(2).includes("--help") || process.argv.slice(2).includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (process.argv.length !== 2) {
    throw new PreflightError("USAGE", "This script does not accept arguments.");
  }

  const expectedVersion = await latestVersion();
  const beforeVersion = await installedVersion();
  let updated = false;

  if (beforeVersion !== expectedVersion) {
    await install(expectedVersion);
    updated = true;
  }

  const installed = await installedVersion();
  const finalExpectedVersion = await latestVersion();
  if (finalExpectedVersion !== expectedVersion) {
    throw new PreflightError(
      "VERSION_CHANGED_DURING_RUN",
      `npm latest changed from ${expectedVersion} to ${finalExpectedVersion} during preflight.`,
    );
  }
  if (installed !== expectedVersion) {
    throw new PreflightError(
      "CLI_VERSION_MISMATCH",
      `The steer binary reports ${installed ?? "no version"}, expected ${expectedVersion}.`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    expectedVersion,
    installedVersion: installed,
    ok: true,
    package: PACKAGE_NAME,
    updated,
  })}\n`);
}

main().catch((error) => {
  const code = error instanceof PreflightError ? error.code : "PREFLIGHT_FAILED";
  const message = error instanceof Error ? error.message : "Steer CLI preflight failed.";
  process.stdout.write(`${JSON.stringify({ error: { code, message }, ok: false })}\n`);
  process.exitCode = 1;
});
