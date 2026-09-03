"use strict";

const crypto = require("crypto");
const http = require("http");
const { URL } = require("url");

const MCP_BASE = "https://agent.robinhood.com";
const REGISTER_URL = `${MCP_BASE}/oauth/trading/register`;
const METADATA_URL = `${MCP_BASE}/.well-known/oauth-authorization-server`;
const DEFAULT_PORT = 9876;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function openBrowser(url) {
  const { exec } = require("child_process");
  const platform = process.platform;
  if (platform === "darwin") exec(`open "${url}"`);
  else if (platform === "win32") exec(`start "" "${url}"`);
  else exec(`xdg-open "${url}"`);
}

function listenForCallback(port, expectedState, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorization failed. Close this tab.</h2>");
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || state !== expectedState) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Invalid callback. Close this tab.</h2>");
        server.close();
        reject(new Error("Missing code or state mismatch"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body style='font-family:system-ui;padding:40px'>" +
          "<h2>Connected!</h2><p>Return to your terminal. You can close this tab.</p>" +
          "</body></html>"
      );
      server.close();
      resolve(code);
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {});
    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for OAuth callback (5 min)"));
    }, timeoutMs);
  });
}

async function findFreePort(start = DEFAULT_PORT) {
  for (let port = start; port < start + 20; port++) {
    try {
      await new Promise((resolve, reject) => {
        const s = http.createServer();
        s.once("error", reject);
        s.listen(port, "127.0.0.1", () => s.close(resolve));
      });
      return port;
    } catch {
      continue;
    }
  }
  throw new Error("No free port for OAuth callback");
}

async function runOAuth({ onStatus }) {
  const log = (msg) => onStatus && onStatus(msg);

  const port = await findFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  log("Fetching Robinhood OAuth metadata...");
  const meta = await fetchJson(METADATA_URL);

  log("Registering local OAuth client...");
  const reg = await fetchJson(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "RH Wallet Connect",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  const { verifier, challenge } = pkcePair();
  const state = crypto.randomBytes(16).toString("base64url");

  const authParams = new URLSearchParams({
    client_id: reg.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "internal",
  });

  const authUrl = `${meta.authorization_endpoint}?${authParams}`;

  log("Opening Robinhood login in your browser...");
  log("Sign in, select your Agentic account, then tap Allow.");
  openBrowser(authUrl);

  const code = await listenForCallback(port, state);

  log("Exchanging authorization code for token...");
  const tokenRes = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: reg.client_id,
      code_verifier: verifier,
    }),
  });

  const tokenText = await tokenRes.text();
  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    throw new Error(`Token exchange failed: ${tokenText}`);
  }

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Token exchange failed: ${tokenText}`);
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresIn: tokenData.expires_in,
  };
}

module.exports = { runOAuth, MCP_BASE };
