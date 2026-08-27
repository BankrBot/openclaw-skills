#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const positionalArgs = process.argv.slice(2).filter((arg) => arg !== '--live');
const [deployRepoArg, outputArg = 'references/shared/deployment-manifest.json'] = positionalArgs;
const pinLiveRuntime = process.argv.includes('--live');
if (!deployRepoArg) {
  throw new Error('usage: build-reviewed-manifest.mjs <deploy-all-v6 checkout> [output]');
}

const skillRoot = resolve(import.meta.dirname, '..');
const deployRepo = resolve(deployRepoArg);
const output = resolve(skillRoot, outputArg);
const chainConfigPath = join(skillRoot, 'references/shared/chain-config.json');
const abiDir = join(skillRoot, 'references/shared/abis');
const cast = process.env.CAST_BIN || 'cast';

const chainFolders = {
  '1': 'ethereum',
  '10': 'optimism',
  '8453': 'base',
  '42161': 'arbitrum',
  '11155111': 'sepolia',
  '11155420': 'optimism_sepolia',
  '84532': 'base_sepolia',
  '421614': 'arbitrum_sepolia'
};

const cloneImplementations = {
  JBERC20__ProjectBAN: 'JBERC20',
  JBERC20__ProjectCPN: 'JBERC20',
  JBERC20__ProjectDEFIFA: 'JBERC20',
  JBERC20__ProjectMARKEE: 'JBERC20',
  JBERC20__ProjectNANA: 'JBERC20',
  JBERC20__ProjectREV: 'JBERC20',
  JB721TiersHook__ProjectBAN: 'JB721TiersHook',
  JB721TiersHook__ProjectCPN: 'JB721TiersHook',
  JBP6FeeLPSplitHook: 'JBUniswapV4LPSplitHook'
};

const sha256 = (value) => `sha256-${createHash('sha256').update(value).digest('base64')}`;
const keccak = (hex) => execFileSync(cast, ['keccak', hex], { encoding: 'utf8' }).trim().toLowerCase();

function canonicalType(input) {
  if (!input.type.startsWith('tuple')) return input.type;
  const suffix = input.type.slice('tuple'.length);
  return `(${(input.components || []).map(canonicalType).join(',')})${suffix}`;
}

function functionSignature(entry) {
  return `${entry.name}(${(entry.inputs || []).map(canonicalType).join(',')})`;
}

function selector(signature) {
  return execFileSync(cast, ['sig', signature], { encoding: 'utf8' }).trim().toLowerCase();
}

function hexToNumber(hex) {
  return Number.parseInt(hex, 16);
}

const chainConfigRaw = await readFile(chainConfigPath);
const chainConfig = JSON.parse(chainConfigRaw);
const abiFiles = (await readdir(abiDir)).filter((name) => name.endsWith('.json')).sort();
const abiManifest = {};

for (const file of abiFiles) {
  const raw = await readFile(join(abiDir, file));
  const abi = JSON.parse(raw);
  const name = basename(file, '.json');
  const writes = abi
    .filter((entry) => entry.type === 'function' && entry.stateMutability !== 'view' && entry.stateMutability !== 'pure')
    .map((entry) => {
      const signature = functionSignature(entry);
      return { selector: selector(signature), signature };
    })
    .sort((a, b) => a.selector.localeCompare(b.selector));
  abiManifest[name] = { file: `abis/${file}`, integrity: sha256(raw), allowedWrites: writes };
}

const deployCommit = execFileSync('git', ['-C', deployRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const deployCommitTime = execFileSync('git', ['-C', deployRepo, 'show', '-s', '--format=%cI', deployCommit], { encoding: 'utf8' }).trim();
const upstreamCommit = '783b11ab163fdc60fd68db8b690ee1ebc26dc2fa';
const chains = {};

for (const [chainId, folder] of Object.entries(chainFolders)) {
  const configured = chainConfig.chains[chainId];
  if (!configured) throw new Error(`chain-config missing chain ${chainId}`);
  const contracts = {};

  for (const [name, configuredAddress] of Object.entries(configured.contracts).sort(([a], [b]) => a.localeCompare(b))) {
    const artifactPath = join(deployRepo, 'deployments', folder, `${name}.json`);
    let raw;
    try { raw = await readFile(artifactPath); } catch { continue; }
    const artifact = JSON.parse(raw);
    if (artifact.address.toLowerCase() !== configuredAddress.toLowerCase()) {
      throw new Error(`${chainId}/${name}: chain config ${configuredAddress} != artifact ${artifact.address}`);
    }
    if (!artifact.deployedBytecode || artifact.deployedBytecode === '0x') continue;

    const abiName = abiManifest[name] ? name : cloneImplementations[name];
    const implementationName = cloneImplementations[name] || null;
    const implementationAddress = implementationName
      ? configured.contracts[implementationName]?.toLowerCase() || null
      : null;
    const txHash = artifact.receipt?.transactionHash || null;
    const blockHex = artifact.receipt?.blockNumber || null;

    contracts[name] = {
      address: configuredAddress.toLowerCase(),
      runtimeCodeHash: keccak(artifact.deployedBytecode),
      artifactRuntimeCodeHash: keccak(artifact.deployedBytecode),
      deploymentBlock: blockHex ? hexToNumber(blockHex) : null,
      deploymentTransaction: txHash,
      artifactIntegrity: sha256(raw),
      artifactGitCommit: artifact.gitCommit || null,
      solcInputHash: artifact.solcInputHash || null,
      abi: abiName || null,
      // Alias/project clones remain descriptive only. A live project clone must be resolved from
      // the project graph and separately pinned before a write; never inherit authority from an ABI.
      writeEnabled: Boolean(abiManifest[name]),
      proxy: implementationName
        ? { kind: 'minimal-clone', implementationName, implementationAddress, admin: null }
        : { kind: 'none', implementationName: null, implementationAddress: null, admin: null }
    };
  }

  chains[chainId] = {
    name: configured.name,
    rpc: configured.rpc,
    contracts
  };
}

const manifest = {
  schemaVersion: 1,
  protocol: 'juicebox-v6',
  generatedAt: deployCommitTime,
  provenance: {
    juiceboxSkillsRepository: 'https://github.com/mejango/juicebox-skills',
    juiceboxSkillsCommit: upstreamCommit,
    deploymentRepository: 'https://github.com/Bananapus/deploy-all-v6',
    deploymentCommit: deployCommit,
    chainConfigIntegrity: sha256(chainConfigRaw),
    viem: {
      version: '2.55.19',
      npmTarball: 'https://registry.npmjs.org/viem/-/viem-2.55.19.tgz',
      integrity: 'sha512-4QPIX0eYPLsOBk53NKswVMkQoxuP7GlOBnB4wM6dkDokREO4QENNc3bmyPKK1PBTViXh0TPJCHLjIuU20Qi3fg=='
    },
    ethers: {
      version: '6.15.0',
      npmTarball: 'https://registry.npmjs.org/ethers/-/ethers-6.15.0.tgz',
      integrity: 'sha512-Kf/3ZW54L4UT0pZtsY/rf+EkBU7Qi5nnhonjUb8yTXcxH3cdcWrV2cRyk0Xk/4jK6OoHhxxZHriyhje20If2hQ=='
    }
  },
  externalServices: {
    relayr: {
      origin: 'https://api.relayr.ba5ed.com',
      paymentContract: '0x1c05f7841379d4393574c0ffa17908ec40ffd97d',
      paymentFunction: 'prepayment(bytes16,uint40)',
      paymentSelector: '0x103903a7',
      runtimeCodeHash: '0x6006b5acadb4cd60aa5c00cb844c34563e182dff83d4f4ff4fde226f7df16fa6',
      nativePaymentTokens: [
        '0x0000000000000000000000000000000000000000',
        '0x000000000000000000000000000000000000eeee'
      ],
      paymentChainIds: [1, 10, 8453, 42161],
      maxAuthorizationSeconds: 1200,
      maxPaymentWei: '50000000000000000'
    }
  },
  policy: {
    supportedChainIds: Object.keys(chainFolders).map(Number),
    allowedForwarders: ['ERC2771Forwarder'],
    allowedSpenders: ['JBMultiTerminal', 'JBRouterTerminalRegistry', 'Permit2', 'JBSuckerRegistry'],
    allowedDeployers: [
      'JB721TiersHookDeployer', 'JB721TiersHookProjectDeployer', 'JBOmnichainDeployer',
      'JBProjectPayerDeployer', 'JBUniswapV4LPSplitHookDeployer', 'REVDeployer', 'CTDeployer'
    ],
    unknownTargetBehavior: 'reject',
    missingManifestBehavior: 'reject',
    codeHashMismatchBehavior: 'reject',
    proxyMismatchBehavior: 'reject'
  },
  abis: abiManifest,
  chains
};

if (pinLiveRuntime) {
  const checks = [];
  for (const [chainId, chain] of Object.entries(manifest.chains)) {
    for (const [name, pin] of Object.entries(chain.contracts)) {
      if (!pin.writeEnabled) continue;
      checks.push(async () => {
        const latest = await rpcCall(chain.rpc, 'eth_getCode', [pin.address, 'latest']);
        if (!latest || latest === '0x') throw new Error(`${chainId}/${name}: code absent at latest`);
        const latestHash = keccak(latest);
        pin.runtimeCodeHash = latestHash;
      });
    }
  }
  const relayr = manifest.externalServices.relayr;
  for (const chainId of relayr.paymentChainIds) {
    const code = await rpcCall(manifest.chains[String(chainId)].rpc, 'eth_getCode', [relayr.paymentContract, 'latest']);
    if (!code || code === '0x' || keccak(code) !== relayr.runtimeCodeHash) {
      throw new Error(`${chainId}/Relayr payment contract: live code hash mismatch`);
    }
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, checks.length) }, async () => {
    while (cursor < checks.length) await checks[cursor++]();
  }));
}

await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${output}`);

async function rpcCall(url, method, params) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'juicebox-v6-manifest-review/1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    if (response.ok) {
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${body.error.message}`);
      return body.result;
    }
    if (![403, 429, 503].includes(response.status) || attempt === 5) {
      throw new Error(`${method}: HTTP ${response.status} from ${url}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
  }
}
