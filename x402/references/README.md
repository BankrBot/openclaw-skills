# x402 Reference Documentation Index

Complete reference documentation for the x402 payment protocol.

## Getting Started

### 🚀 [Quick Start Guide](quick-start.md)
Get up and running with x402 in under 5 minutes.
- Prerequisites and setup
- Choose server or client path
- Test the complete flow
- Common issues and solutions

### ⚙️ [Environment Setup](environment-setup.md)
Configure your development environment.
- Environment variable templates
- Server and client configuration
- Testnet and mainnet setup
- Security best practices
- Troubleshooting setup issues

## Technical Reference

### 📖 [Protocol Specifications](protocol_specs.md)
Complete technical reference for the x402 protocol.
- Core concepts and roles
- Network identifiers (CAIP-2)
- HTTP headers and status codes
- Payment flow diagrams
- Payment schemes (exact, future schemes)
- Facilitator endpoints
- Bazaar discovery extension
- Security considerations
- Common assets and tokens

## Troubleshooting

### 🔧 [Troubleshooting Guide](troubleshooting.md)
Solutions to common problems and errors.
- Environment setup issues
- Server configuration problems
- Client payment errors
- Network connectivity issues
- Facilitator problems
- Debugging tips and tools

## Examples

### 📚 [Examples Documentation](../examples/README.md)
Comprehensive examples in multiple languages.
- Server implementations (Express, FastAPI, Gin)
- Client implementations (Fetch, HTTPX, Go HTTP)
- Advanced examples (Bazaar, Dynamic Pricing, MCP)
- Configuration files and templates
- Testing and validation

## Document Overview

### Quick Reference
| Document | Purpose | Audience |
|----------|---------|----------|
| Quick Start | Get started fast | Beginners |
| Environment Setup | Configure environment | All users |
| Protocol Specs | Technical details | Developers |
| Troubleshooting | Solve problems | All users |
| Examples | Working code | Developers |

### By User Type

**New to x402?**
1. Start with [Quick Start Guide](quick-start.md)
2. Review [Examples](../examples/README.md)
3. Configure using [Environment Setup](environment-setup.md)

**Building a Server?**
1. Read [Protocol Specs](protocol_specs.md) - Server section
2. Check [Server Examples](../examples/README.md#server-examples)
3. Review [Environment Setup](environment-setup.md) - Server config

**Building a Client?**
1. Read [Protocol Specs](protocol_specs.md) - Client section
2. Check [Client Examples](../examples/README.md#client-examples)
3. Review [Environment Setup](environment-setup.md) - Client config

**Debugging Issues?**
1. Check [Troubleshooting Guide](troubleshooting.md)
2. Enable debug logging
3. Review relevant [Protocol Specs](protocol_specs.md)

### By Topic

**Payment Flow**
- [Protocol Specs - Payment Flow](protocol_specs.md#payment-flow)
- [Quick Start - Test the Flow](quick-start.md#step-4-test-the-flow)

**Networks & Assets**
- [Protocol Specs - Network Identifiers](protocol_specs.md#network-identifiers-caip-2)
- [Protocol Specs - Common Assets](protocol_specs.md#common-assets)
- [Environment Setup - Network Selection](environment-setup.md#network-selection)

**Service Discovery**
- [Protocol Specs - Bazaar Discovery](protocol_specs.md#bazaar-discovery-extension)
- [Examples - Bazaar Discovery](../examples/README.md#bazaar-discovery)
- [Advanced Example - Bazaar](../examples/advanced/bazaar-discovery.py)

**Security**
- [Protocol Specs - Security Considerations](protocol_specs.md#security-considerations)
- [Environment Setup - Security Best Practices](environment-setup.md#security-best-practices)
- [Troubleshooting - Payment Issues](troubleshooting.md#payment-issues)

**Dynamic Pricing**
- [Examples - Dynamic Pricing](../examples/README.md#dynamic-pricing)
- [Advanced Example - Dynamic Pricing](../examples/advanced/dynamic-pricing.py)

**AI Agent Integration**
- [Examples - MCP Server](../examples/README.md#mcp-server)
- [Advanced Example - MCP](../examples/advanced/mcp-server.ts)
- [Protocol Specs - Bazaar Discovery](protocol_specs.md#bazaar-discovery-extension)

## External Resources

### Official Documentation
- [x402 GitHub Repository](https://github.com/coinbase/x402) - Official protocol repository
- [x402 Protocol Website](https://x402.org) - Protocol documentation
- [x402 Ecosystem](https://x402.org/ecosystem) - Community projects

### Blockchain Documentation
- [Base Documentation](https://docs.base.org) - Base blockchain docs
- [Solana Documentation](https://docs.solana.com) - Solana docs
- [Coinbase Developer Platform](https://docs.cdp.coinbase.com) - CDP docs

### Tools & Utilities
- [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet) - Get testnet tokens
- [Base Sepolia Explorer](https://sepolia.basescan.org) - EVM transaction explorer
- [Solana Explorer](https://explorer.solana.com) - SVM transaction explorer

### Standards
- [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md) - Chain ID specification
- [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612) - Permit (approval by signature)
- [HTTP Status 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) - Payment Required

## Community & Support

- **GitHub Issues**: [coinbase/x402/issues](https://github.com/coinbase/x402/issues)
- **Discord**: [Base Discord](https://discord.gg/base)
- **Twitter/X**: [@base](https://twitter.com/base)

## Contributing

Found an issue or want to improve the documentation?
- Report issues: [GitHub Issues](https://github.com/coinbase/x402/issues)
- Contribute: [Contributing Guide](https://github.com/coinbase/x402/blob/main/CONTRIBUTING.md)

## Changelog

### Latest Updates
- Added comprehensive examples for TypeScript, Python, and Go
- Enhanced protocol specifications with detailed flow diagrams
- Added troubleshooting guide with common solutions
- Improved environment setup documentation
- Added quick start guide for faster onboarding

## License

The x402 protocol is open source. Refer to the [official repository](https://github.com/coinbase/x402) for license information.

---

**Need Help?** Start with the [Quick Start Guide](quick-start.md) or check the [Troubleshooting Guide](troubleshooting.md).
