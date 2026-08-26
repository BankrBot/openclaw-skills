#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectOpen,
  inspectTask,
  loadAllowlist,
  loadPin,
  requireAllowedCall,
  snapshotIdentities,
  verifyPinFromBase,
} from "./v2-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] || "";

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  console.error("usage: v2-inspect.mjs verify <standard|micro> | open <standard|micro> [limit] | task <v2:standard:N|v2:micro:N> | scope <v2:standard:N|v2:micro:N> | manifest <standard|micro> | allow <target> <calldata> | snapshot");
  process.exit(2);
}

try {
  if (command === "verify") {
    const market = process.argv[3];
    if (market !== "standard" && market !== "micro") usage();
    const { pin } = await verifyPinFromBase(market);
    print({
      ok: true,
      market: pin.market,
      chainId: pin.chainId,
      deploymentBlock: pin.deploymentBlock,
      bundleHash: pin.bundleHash,
      finalizedTx: pin.finalizedTx,
    });
  } else if (command === "open") {
    const market = process.argv[3];
    if (market !== "standard" && market !== "micro") usage();
    print(await inspectOpen(market, process.argv[4] ?? 25));
  } else if (command === "task") {
    if (!process.argv[3]) usage();
    print(await inspectTask(process.argv[3]));
  } else if (command === "scope") {
    if (!process.argv[3]) usage();
    const task = await inspectTask(process.argv[3]);
    print({
      id: task.id,
      market: task.market,
      chainId: task.chainId,
      registryAddress: task.registryAddress,
      escrowAddress: task.escrowAddress,
      scopeRegistryAddress: task.scopeRegistryAddress,
      discovery: task.discovery,
      scope: task.scope,
      source: task.source,
      api: task.api,
    });
  } else if (command === "manifest") {
    const market = process.argv[3] || "standard";
    if (market !== "standard" && market !== "micro") usage();
    print(loadPin(market));
  } else if (command === "allow") {
    const target = process.argv[3];
    const data = process.argv[4];
    if (!target || !data) usage();
    const signature = requireAllowedCall(loadAllowlist(), target, data);
    print({ ok: true, target, selector: data.slice(0, 10).toLowerCase(), signature });
  } else if (command === "snapshot") {
    const allowlist = loadAllowlist();
    for (const market of ["standard", "micro"]) {
      const pin = loadPin(market);
      const identities = await snapshotIdentities(pin, allowlist);
      const path = join(ROOT, "references", `base-8453-${market}-v2-identities.json`);
      writeFileSync(path, `${JSON.stringify(identities, null, 2)}\n`);
      console.error(`wrote ${path}`);
    }
  } else {
    usage();
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
