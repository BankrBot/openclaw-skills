"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const BANKR_API_URL = process.env.BANKR_API_URL || "https://api.bankr.bot";
const PROXY_MCP_URL = "https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp";

function loadBankrApiKey(explicit) {
  if (explicit) return explicit;
  if (process.env.BANKR_API_KEY) return process.env.BANKR_API_KEY;

  const configPath = path.join(os.homedir(), ".bankr", "config.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (cfg.apiKey) return cfg.apiKey;
  } catch {
    /* not logged in via CLI */
  }
  return null;
}

async function setEnvVars(apiKey, vars) {
  const res = await fetch(`${BANKR_API_URL}/agent/env`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ vars }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to set env in Bankr (${res.status}): ${text}`);
  }
}

async function setEnvVar(apiKey, key, value) {
  return setEnvVars(apiKey, { [key]: value });
}

async function listEnvKeys(apiKey) {
  const res = await fetch(`${BANKR_API_URL}/agent/env`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data.map((x) => (typeof x === "string" ? x : x.key));
  if (data && Array.isArray(data.keys)) return data.keys;
  return [];
}

async function setupMcpViaAgent(apiKey) {
  const prompt =
    'add an MCP server named "robinhood-agentic" at https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp ' +
    "with Streamable HTTP transport and Authorization header Bearer {{AGENTIC_TOKEN}}";

  const res = await fetch(`${BANKR_API_URL}/agent/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not queue MCP setup (${res.status}): ${text}`);
  }
  return res.json();
}

async function saveToBankr({ accessToken, refreshToken, apiKey, setupMcp }) {
  const vars = { AGENTIC_TOKEN: accessToken };
  if (refreshToken) {
    vars.AGENTIC_REFRESH_TOKEN = refreshToken;
  }
  await setEnvVars(apiKey, vars);
  let mcpJob = null;
  if (setupMcp) {
    try {
      mcpJob = await setupMcpViaAgent(apiKey);
    } catch (err) {
      mcpJob = { error: err.message };
    }
  }
  return { mcpJob };
}

function copyToClipboard(text) {
  try {
    const { execSync } = require("child_process");
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
      return true;
    }
    if (process.platform === "win32") {
      execSync("clip", { input: text });
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

module.exports = {
  loadBankrApiKey,
  saveToBankr,
  listEnvKeys,
  copyToClipboard,
  PROXY_MCP_URL,
  BANKR_API_URL,
};
