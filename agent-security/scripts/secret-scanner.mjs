#!/usr/bin/env node
/**
 * Secret Scanner — Scans workspace files for accidentally committed secrets
 * 
 * Usage:
 *   node secret-scanner.mjs --dir /path/to/scan
 *   node secret-scanner.mjs --dir . --ignore node_modules,.git
 */

import { readdir, readFile, stat } from 'fs/promises';
import { resolve, join, extname } from 'path';
// Parse args manually — no dependencies required
const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const argv = {
  dir: getArg('dir', '.'),
  ignore: getArg('ignore', 'node_modules,.git,dist,build,.next'),
  maxSize: parseInt(getArg('max-size', '1048576')),
};

// Secret patterns with descriptions
const PATTERNS = [
  { name: 'Ethereum Private Key', regex: /(?:^|[^a-fA-F0-9])0x[a-fA-F0-9]{64}(?:[^a-fA-F0-9]|$)/g, severity: 'CRITICAL' },
  { name: 'Generic Private Key', regex: /(?:private[_-]?key|PRIVATE[_-]?KEY)\s*[=:]\s*['"]?[a-zA-Z0-9+/=_-]{20,}/g, severity: 'CRITICAL' },
  { name: 'Mnemonic Phrase (12 words)', regex: /(?:[a-z]{3,10}\s){11}[a-z]{3,10}/g, severity: 'CRITICAL' },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
  { name: 'AWS Secret Key', regex: /(?:aws_secret|AWS_SECRET)[_A-Z]*\s*[=:]\s*['"]?[A-Za-z0-9+/=]{40}/g, severity: 'CRITICAL' },
  { name: 'Generic API Key', regex: /(?:api[_-]?key|API[_-]?KEY|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/g, severity: 'HIGH' },
  { name: 'Generic Secret', regex: /(?:secret|SECRET|token|TOKEN)\s*[=:]\s*['"]?[a-zA-Z0-9_+/=-]{20,}/g, severity: 'HIGH' },
  { name: 'Bearer Token', regex: /Bearer\s+[a-zA-Z0-9_.~+/=-]{20,}/g, severity: 'HIGH' },
  { name: 'JWT Token', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, severity: 'HIGH' },
  { name: 'Stripe Key', regex: /(?:sk_live|pk_live|sk_test|pk_test)_[a-zA-Z0-9]{20,}/g, severity: 'CRITICAL' },
  { name: 'Infura/Alchemy Key', regex: /(?:infura|alchemy)[._-]?(?:key|api|token|secret)\s*[=:]\s*['"]?[a-zA-Z0-9]{20,}/gi, severity: 'HIGH' },
  { name: 'GitHub Token', regex: /gh[ps]_[a-zA-Z0-9]{36,}/g, severity: 'CRITICAL' },
  { name: 'Slack Token', regex: /xox[bpas]-[a-zA-Z0-9-]{10,}/g, severity: 'HIGH' },
  { name: 'Password in URL', regex: /https?:\/\/[^:]+:[^@]+@/g, severity: 'HIGH' },
  { name: 'Hardcoded Password', regex: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}/gi, severity: 'MEDIUM' },
];

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs', '.java',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.md', '.txt', '.sh', '.bash', '.zsh',
  '.env', '.env.local', '.env.production',
  '.html', '.css', '.astro', '.vue', '.svelte',
]);

const ignoreDirs = new Set(argv.ignore.split(',').map(d => d.trim()));

async function scanFile(filePath) {
  const findings = [];
  try {
    const s = await stat(filePath);
    if (s.size > argv.maxSize) return findings;
    
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of PATTERNS) {
        const matches = line.matchAll(pattern.regex);
        for (const match of matches) {
          // Skip obvious false positives
          const val = match[0];
          if (val.includes('YOUR_') || val.includes('xxx') || val.includes('example')) continue;
          if (val.includes('0x0000000000000000000000000000000000000000')) continue;
          
          findings.push({
            file: filePath,
            line: i + 1,
            pattern: pattern.name,
            severity: pattern.severity,
            match: val.length > 60 ? val.slice(0, 30) + '...' + val.slice(-10) : val,
          });
        }
      }
    }
  } catch (err) {
    // Skip files we can't read
  }
  return findings;
}

async function scanDir(dir) {
  let findings = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) continue;
        findings = findings.concat(await scanDir(fullPath));
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const nameLC = entry.name.toLowerCase();
        // Scan known extensions + dotenv files
        if (SCAN_EXTENSIONS.has(ext) || nameLC.startsWith('.env') || nameLC === 'dockerfile') {
          findings = findings.concat(await scanFile(fullPath));
        }
      }
    }
  } catch (err) {
    // Skip dirs we can't read
  }
  return findings;
}

async function main() {
  const dir = resolve(argv.dir);
  console.log(`🔍 Scanning ${dir} for secrets...\n`);
  
  const findings = await scanDir(dir);
  
  if (findings.length === 0) {
    console.log('✅ No secrets detected!\n');
    console.log('Note: This scanner uses pattern matching and may miss some secrets.');
    console.log('Always review sensitive files manually.');
    return;
  }
  
  // Sort by severity
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  
  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;
  const medium = findings.filter(f => f.severity === 'MEDIUM').length;
  
  console.log(`⚠️  Found ${findings.length} potential secrets:\n`);
  console.log(`   🔴 CRITICAL: ${critical}`);
  console.log(`   🟠 HIGH: ${high}`);
  console.log(`   🟡 MEDIUM: ${medium}\n`);
  
  for (const f of findings) {
    const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '🟡';
    console.log(`${icon} [${f.severity}] ${f.pattern}`);
    console.log(`   ${f.file}:${f.line}`);
    console.log(`   Match: ${f.match}\n`);
  }
  
  console.log('─'.repeat(50));
  console.log('Actions:');
  if (critical > 0) console.log('  🔴 CRITICAL findings require immediate rotation of exposed credentials');
  if (high > 0) console.log('  🟠 HIGH findings should be moved to environment variables');
  if (medium > 0) console.log('  🟡 MEDIUM findings should be reviewed for false positives');
  console.log('\nNote: Some findings may be false positives. Review each match in context.');
}

main().catch(console.error);
