---
name: security-framework-integration
description: |
  Integrate ConsenSys/Trail of Bits smart contract security best practices into a Foundry project.
  Use when: (1) setting up security documentation for a new smart contract project, 
  (2) adding security tooling to CI, (3) creating reusable security contract patterns,
  (4) user asks to "add security best practices" or "integrate ConsenSys guidelines".
  Covers documentation structure, security contracts, CI integration, and audit workflows.
author: Ember 🐉
version: 1.0.0
date: 2026-01-29
---

# Security Framework Integration

## Problem
Smart contract projects need comprehensive security documentation, reusable security patterns,
and automated security tooling - but setting this up from scratch is time-consuming and easy
to miss important elements.

## Context / Trigger Conditions
- New Foundry/Hardhat project needs security documentation
- User wants to "add security best practices"
- Preparing project for external audit
- Setting up CI with security analysis
- Need reusable security contract patterns

## Solution

### Step 1: Create Documentation Structure

```bash
mkdir -p docs contracts/security test/security scripts
```

Create these docs based on ConsenSys best practices:

| File | Purpose |
|------|---------|
| `docs/KNOWN-ATTACKS.md` | Attack vectors with code examples (reentrancy, oracle, frontrunning, DoS) |
| `docs/SECURITY-PHILOSOPHY.md` | Core security principles (prepare for failure, rollout carefully, stay simple) |
| `docs/PATTERNS.md` | Secure code patterns (CEI, pull payments, safe calls, commit-reveal) |
| `docs/SECURITY-TOOLS.md` | Tool guide (Slither, Echidna, Mythril, Foundry fuzz) |
| `docs/DEPLOYMENT-CHECKLIST.md` | Pre-deployment checklist |
| `AUDIT_CHECKLIST.md` | Growing checklist from audits |

### Step 2: Create Security Contracts

Essential reusable patterns in `contracts/security/`:

**CommitReveal.sol** - Frontrunning protection:
```solidity
abstract contract CommitReveal {
    mapping(address => bytes32) public commits;
    mapping(address => uint256) public commitTimestamps;
    uint256 public constant MIN_REVEAL_DELAY = 1 minutes;
    
    function commit(bytes32 hash) external { ... }
    modifier onlyRevealed(bytes32 secret) { ... }
}
```

**OracleConsumer.sol** - Secure oracle consumption:
```solidity
abstract contract OracleConsumer {
    uint256 public constant STALENESS_THRESHOLD = 1 hours;
    
    function _validatePrice(uint256 price, uint256 updatedAt) internal view {
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) revert StalePrice();
        if (price == 0) revert InvalidPrice();
    }
}
```

**PullPayment.sol** - DoS-resistant payments:
```solidity
abstract contract PullPayment is ReentrancyGuard {
    mapping(address => uint256) public pendingWithdrawals;
    
    function _allocatePayment(address payee, uint256 amount) internal { ... }
    function withdrawPayments() external nonReentrant { ... }
}
```

### Step 3: Add Slither to CI

```yaml
# .github/workflows/ci.yml
slither:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        submodules: recursive
    - name: Run Slither
      uses: crytic/slither-action@v0.4.0
      with:
        target: 'contracts/'
        slither-args: '--exclude naming-convention,solc-version'
        fail-on: 'high'
```

### Step 4: Create Local Security Scan Script

```bash
#!/bin/bash
# scripts/security-scan.sh
forge fmt --check
forge build
forge test -vvv
slither . --filter-paths "lib|test"
forge coverage
forge test --gas-report > gas-report.txt
```

### Step 5: Update README

Add Security Documentation section linking to all docs and listing security contracts.

### Step 6: Configure External Auditors

Document audit workflow with AI auditors:
- @clawditor - General security, gas optimization
- @dragon_bot_z - DoS vectors, edge cases

## Verification
- [ ] All docs created and linked in README
- [ ] Security contracts compile (`forge build`)
- [ ] Tests pass (`forge test`)
- [ ] Slither runs without critical issues
- [ ] CI pipeline includes security analysis

## Example

See: https://github.com/emberdragonc/smart-contract-framework

## Notes
- Reference source: https://consensysdiligence.github.io/smart-contract-best-practices/
- Also useful: https://github.com/crytic/building-secure-contracts (Trail of Bits)
- Update AUDIT_CHECKLIST.md as you learn from audits
- Security contracts should use Solidity 0.8.20+ and custom errors

## References
- [ConsenSys Best Practices](https://consensysdiligence.github.io/smart-contract-best-practices/)
- [Smart Contract Security Field Guide](https://scsfg.io/)
- [SWC Registry](https://swcregistry.io/)
- [Trail of Bits Building Secure Contracts](https://github.com/crytic/building-secure-contracts)
