#!/usr/bin/env node

/**
 * Agent Security Audit Script
 * 
 * Self-audit tool for AI agents to check their own security posture.
 * Run: node security-audit.mjs [--fix]
 * 
 * Checks:
 * - File permissions on credential files (.env, wallet.env, config)
 * - .gitignore coverage for secret file patterns
 * - Secrets accidentally committed to git history
 * - Credential directory permissions
 * - World-readable sensitive files
 * - SSH key permissions
 * - Git remote configuration (public vs private)
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readFileSync, chmodSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const FIX_MODE = process.argv.includes('--fix');
const VERBOSE = process.argv.includes('--verbose');

// ── Results tracking ──────────────────────────────────────────────────

const results = { pass: 0, warn: 0, fail: 0, fixed: 0, checks: [] };

function pass(msg) {
  results.pass++;
  results.checks.push({ status: 'PASS', msg });
  console.log(`  ✅ ${msg}`);
}

function warn(msg, fix) {
  results.warn++;
  results.checks.push({ status: 'WARN', msg });
  console.log(`  ⚠️  ${msg}`);
  if (fix) console.log(`      Fix: ${fix}`);
}

function fail(msg, fix) {
  results.fail++;
  results.checks.push({ status: 'FAIL', msg });
  console.log(`  ❌ ${msg}`);
  if (fix) console.log(`      Fix: ${fix}`);
}

function fixed(msg) {
  results.fixed++;
  results.checks.push({ status: 'FIXED', msg });
  console.log(`  🔧 FIXED: ${msg}`);
}

function section(title) {
  console.log(`\n━━ ${title} ${'━'.repeat(Math.max(0, 60 - title.length))}`);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// ── Checks ────────────────────────────────────────────────────────────

function checkFilePermission(filePath, expectedMode, label) {
  const resolved = filePath.startsWith('~') ? filePath.replace('~', HOME) : filePath;
  if (!existsSync(resolved)) {
    if (VERBOSE) console.log(`  ⏭️  ${label}: not found (${resolved})`);
    return;
  }
  
  const stat = statSync(resolved);
  const mode = (stat.mode & 0o777).toString(8);
  const expected = expectedMode.toString(8);
  
  if (parseInt(mode, 8) <= parseInt(expected, 8)) {
    pass(`${label} permissions: ${mode} (good)`);
  } else {
    if (FIX_MODE) {
      try {
        chmodSync(resolved, expectedMode);
        fixed(`${label}: ${mode} → ${expected}`);
      } catch (e) {
        fail(`${label} permissions: ${mode} (should be ${expected} or stricter)`, `chmod ${expected} "${resolved}"`);
      }
    } else {
      fail(`${label} permissions: ${mode} (should be ${expected} or stricter)`, `chmod ${expected} "${resolved}"`);
    }
  }
}

function checkCredentialFiles() {
  section('CREDENTIAL FILE PERMISSIONS');
  
  const files = [
    ['~/.env', 0o600, '.env (home)'],
    ['.env', 0o600, '.env (workspace)'],
    ['~/.axiom/wallet.env', 0o600, 'wallet.env'],
    ['~/.clawdbot/clawdbot.json', 0o600, 'clawdbot.json'],
    ['~/.openclaw/openclaw.json', 0o600, 'openclaw.json'],
    ['~/.clawdbot/identity/device-auth.json', 0o600, 'device-auth.json'],
    ['~/.ssh/id_rsa', 0o600, 'SSH private key (RSA)'],
    ['~/.ssh/id_ed25519', 0o600, 'SSH private key (Ed25519)'],
    ['~/.ssh/config', 0o600, 'SSH config'],
    ['~/.npmrc', 0o600, '.npmrc (may contain tokens)'],
    ['~/.docker/config.json', 0o600, 'Docker config'],
  ];
  
  for (const [path, mode, label] of files) {
    checkFilePermission(path, mode, label);
  }
  
  // Check credential directories
  const dirs = [
    ['~/.clawdbot/credentials', 0o700, 'clawdbot credentials dir'],
    ['~/.openclaw/credentials', 0o700, 'openclaw credentials dir'],
    ['~/.ssh', 0o700, '.ssh directory'],
    ['~/.axiom', 0o700, '.axiom directory'],
    ['~/.gnupg', 0o700, '.gnupg directory'],
  ];
  
  for (const [path, mode, label] of dirs) {
    checkFilePermission(path, mode, label);
  }
}

function checkWorldReadableSecrets() {
  section('WORLD-READABLE SECRET FILES');
  
  const output = run(`find "${HOME}" -maxdepth 4 \\( -name "*.env" -o -name "*secret*" -o -name "*private*key*" -o -name "*.pem" -o -name "*wallet*" -o -name "*credential*" \\) -perm -004 2>/dev/null`);
  
  if (!output) {
    pass('No world-readable secret files found');
  } else {
    const files = output.split('\n').filter(Boolean);
    for (const f of files) {
      if (FIX_MODE) {
        try {
          chmodSync(f, 0o600);
          fixed(`Removed world-readable permission: ${f}`);
        } catch {
          fail(`World-readable secret file: ${f}`, `chmod 600 "${f}"`);
        }
      } else {
        fail(`World-readable secret file: ${f}`, `chmod 600 "${f}"`);
      }
    }
  }
}

function checkGitignore() {
  section('.GITIGNORE COVERAGE');
  
  // Check if we're in a git repo
  if (!run('git rev-parse --is-inside-work-tree')) {
    if (VERBOSE) console.log('  ⏭️  Not in a git repo, skipping .gitignore checks');
    return;
  }
  
  const gitRoot = run('git rev-parse --show-toplevel');
  if (!gitRoot) return;
  
  const gitignorePath = join(gitRoot, '.gitignore');
  
  if (!existsSync(gitignorePath)) {
    fail('No .gitignore file found!', 'Create .gitignore with secret file patterns');
    return;
  }
  
  const content = readFileSync(gitignorePath, 'utf-8');
  
  const requiredPatterns = [
    ['.env', 'Excludes .env files'],
    ['*.pem', 'Excludes PEM key files'],
    ['*.key', 'Excludes key files'],
  ];
  
  for (const [pattern, desc] of requiredPatterns) {
    // Check if pattern is covered (exact or wildcard match)
    const lines = content.split('\n').map(l => l.trim());
    const covered = lines.some(line => {
      if (line.startsWith('#') || !line) return false;
      return line === pattern || line === `*${pattern}` || line === `**/${pattern}` || 
             (pattern.startsWith('*.') && line === pattern);
    });
    
    if (covered) {
      pass(`${pattern} pattern in .gitignore`);
    } else {
      warn(`${pattern} pattern NOT in .gitignore (${desc})`, `echo "${pattern}" >> .gitignore`);
    }
  }
  
  // Check if .env files are actually tracked
  const trackedEnv = run('git ls-files -- "*.env" ".env" ".env.*"');
  if (trackedEnv) {
    for (const f of trackedEnv.split('\n').filter(Boolean)) {
      fail(`Secret file is tracked by git: ${f}`, `git rm --cached "${f}" && echo "${f}" >> .gitignore`);
    }
  } else {
    pass('No .env files tracked by git');
  }
}

function checkGitHistory() {
  section('SECRETS IN GIT HISTORY');
  
  if (!run('git rev-parse --is-inside-work-tree')) {
    if (VERBOSE) console.log('  ⏭️  Not in a git repo, skipping git history checks');
    return;
  }
  
  // Check for .env files ever added to git
  const envHistory = run('git log --all --diff-filter=A --name-only --pretty=format: -- "*.env" ".env" ".env.*" "*.pem" "*.key" "*wallet*env*" "*secret*" 2>/dev/null');
  
  if (envHistory && envHistory.trim()) {
    const files = [...new Set(envHistory.split('\n').filter(Boolean))];
    for (const f of files) {
      fail(`Secret file was committed to git history: ${f}`, 
        `Use git-filter-repo or BFG to remove: git filter-repo --path "${f}" --invert-paths`);
    }
  } else {
    pass('No secret files found in git history');
  }
  
  // Quick pattern scan on recent commits (last 50)
  const patterns = [
    'sk-[a-zA-Z0-9]{20,}',           // OpenAI
    'sk-ant-[a-zA-Z0-9-]{20,}',      // Anthropic
    'AKIA[0-9A-Z]{16}',              // AWS
    'ghp_[a-zA-Z0-9]{36}',           // GitHub PAT
  ];
  
  let foundSecrets = false;
  for (const pattern of patterns) {
    const match = run(`git log -50 --all -p | grep -cE '${pattern}' 2>/dev/null`);
    if (match && parseInt(match) > 0) {
      fail(`Potential secret pattern found in recent git history (${parseInt(match)} matches for pattern: ${pattern.substring(0, 20)}...)`);
      foundSecrets = true;
    }
  }
  
  if (!foundSecrets) {
    pass('No obvious secret patterns in recent git history');
  }
}

function checkGitRemote() {
  section('GIT REMOTE CONFIGURATION');
  
  if (!run('git rev-parse --is-inside-work-tree')) return;
  
  const remotes = run('git remote -v');
  if (!remotes) {
    pass('No git remotes configured (local only)');
    return;
  }
  
  for (const line of remotes.split('\n').filter(Boolean)) {
    // Check for github.com public repo indicators
    if (line.includes('github.com') && !line.includes('.git (fetch)')) continue;
    
    const match = line.match(/github\.com[:/]([^/]+)\/([^.\s]+)/);
    if (match) {
      const [, owner, repo] = match;
      // We can't easily check public/private without API, but warn about workspace repos
      const repoName = repo.replace('.git', '');
      if (['clawd', 'clawdbot', 'moltbot', 'openclaw'].some(w => repoName.toLowerCase().includes(w))) {
        warn(`Agent workspace appears to have a git remote: ${owner}/${repoName}. Ensure this repo is PRIVATE.`,
          'Go to GitHub repo settings and verify visibility is "Private"');
      }
    }
  }
}

function checkGlobalGitignore() {
  section('GLOBAL GIT CONFIGURATION');
  
  const globalIgnore = run('git config --global core.excludesfile');
  if (globalIgnore && existsSync(globalIgnore.replace('~', HOME))) {
    pass(`Global gitignore configured: ${globalIgnore}`);
  } else {
    warn('No global gitignore configured',
      'git config --global core.excludesfile ~/.gitignore_global && echo ".env\n*.pem\n*.key" >> ~/.gitignore_global');
  }
}

function checkPrecommitHooks() {
  section('PRE-COMMIT HOOKS');
  
  if (!run('git rev-parse --is-inside-work-tree')) return;
  
  const gitRoot = run('git rev-parse --show-toplevel');
  if (!gitRoot) return;
  
  const hookPath = join(gitRoot, '.git', 'hooks', 'pre-commit');
  
  if (existsSync(hookPath)) {
    const stat = statSync(hookPath);
    if (stat.mode & 0o111) {
      pass('Pre-commit hook installed and executable');
      const content = readFileSync(hookPath, 'utf-8');
      if (content.includes('ggshield') || content.includes('detect-secrets') || content.includes('trufflehog')) {
        pass('Pre-commit hook includes secret scanning');
      } else {
        warn('Pre-commit hook exists but may not scan for secrets',
          'Consider adding ggshield, detect-secrets, or trufflehog to the hook');
      }
    } else {
      warn('Pre-commit hook exists but is not executable', `chmod +x "${hookPath}"`);
    }
  } else {
    warn('No pre-commit hook installed',
      'Install ggshield: pip install ggshield && ggshield install -m local');
  }
}

function checkDiskEncryption() {
  section('DISK ENCRYPTION');
  
  const platform = process.platform;
  
  if (platform === 'darwin') {
    const fv = run('fdesetup status');
    if (fv && fv.includes('On')) {
      pass('FileVault is enabled');
    } else {
      fail('FileVault is NOT enabled — disk is unencrypted!', 'System Settings → Privacy & Security → FileVault → Turn On');
    }
  } else if (platform === 'linux') {
    const luks = run('lsblk -o NAME,TYPE,FSTYPE | grep -i crypt');
    if (luks) {
      pass('LUKS encrypted partition detected');
    } else {
      warn('Could not detect disk encryption (may be false negative on some setups)',
        'Ensure full disk encryption is enabled (LUKS/dm-crypt)');
    }
  }
}

function checkRunningServices() {
  section('EXPOSED SERVICES');
  
  // Check if any gateway/agent services are bound to 0.0.0.0
  const listening = run("lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E '(0\\.0\\.0\\.0|\\*):' | head -10");
  if (listening) {
    const lines = listening.split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const proc = parts[0];
      const port = parts[8];
      if (proc === 'node' || proc === 'moltbot' || proc === 'openclaw') {
        warn(`Agent-related process listening on all interfaces: ${proc} ${port}`,
          'Bind to 127.0.0.1 instead of 0.0.0.0, or use Tailscale/VPN for remote access');
      }
    }
  } else {
    pass('No agent processes bound to all interfaces (0.0.0.0)');
  }
}

// ── Main ──────────────────────────────────────────────────────────────

console.log('\n🛡️  Agent Security Audit');
console.log(`   Mode: ${FIX_MODE ? 'AUDIT + FIX' : 'AUDIT ONLY (use --fix to auto-remediate)'}`);
console.log(`   Time: ${new Date().toISOString()}`);

checkCredentialFiles();
checkWorldReadableSecrets();
checkGitignore();
checkGitHistory();
checkGitRemote();
checkGlobalGitignore();
checkPrecommitHooks();
checkDiskEncryption();
checkRunningServices();

// ── Summary ───────────────────────────────────────────────────────────

section('SUMMARY');
console.log(`  ✅ Passed: ${results.pass}`);
console.log(`  ⚠️  Warnings: ${results.warn}`);
console.log(`  ❌ Failed: ${results.fail}`);
if (FIX_MODE) console.log(`  🔧 Fixed: ${results.fixed}`);

if (results.fail === 0 && results.warn === 0) {
  console.log('\n  🎉 All checks passed! Your security posture looks good.\n');
} else if (results.fail === 0) {
  console.log('\n  👍 No critical issues. Review warnings when you can.\n');
} else {
  console.log(`\n  🚨 ${results.fail} critical issue(s) found. Fix them now.\n`);
  if (!FIX_MODE) {
    console.log('  Run with --fix to auto-remediate what we can.\n');
  }
}

process.exit(results.fail > 0 ? 1 : 0);
