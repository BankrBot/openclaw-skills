# Frontend security boundary

Apply this boundary to every generated Juicebox wallet UI.

## Dependency

Ask for approval before adding or running a dependency. Install only the dependency needed by the generated UI, at the exact reviewed version:

```bash
npm install --save-exact viem@2.55.19
# Only the contract-explorer template uses ethers:
npm install --save-exact ethers@6.15.0
```

The approved npm artifact is:

```text
https://registry.npmjs.org/viem/-/viem-2.55.19.tgz
sha512-4QPIX0eYPLsOBk53NKswVMkQoxuP7GlOBnB4wM6dkDokREO4QENNc3bmyPKK1PBTViXh0TPJCHLjIuU20Qi3fg==

https://registry.npmjs.org/ethers/-/ethers-6.15.0.tgz
sha512-Kf/3ZW54L4UT0pZtsY/rf+EkBU7Qi5nnhonjUb8yTXcxH3cdcWrV2cRyk0Xk/4jK6OoHhxxZHriyhje20If2hQ==
```

Require the package lock to contain each installed package's exact version and integrity before building. Reject a changed version, tarball, or integrity. Import `viem`, `viem/chains`, or `ethers` from the locally installed package. Do not add import maps or dynamic imports that resolve to a CDN.

## Content Security Policy

Move inline JavaScript and CSS into same-origin files. Start with this response header and narrow `connect-src` to the RPC/API origins the selected workflow actually uses:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://ethereum-rpc.publicnode.com https://optimism-rpc.publicnode.com https://base-rpc.publicnode.com https://arbitrum-one-rpc.publicnode.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
```

Add testnet RPCs, Bendystraw, or Relayr only when the chosen feature needs them. Never use `unsafe-inline`, `unsafe-eval`, wildcard script origins, or third-party script origins. Keep API keys server-side behind a same-origin route.

## Wallet boundary

- Construct, decode, review, and simulate the exact transaction locally.
- Re-check the connected account and chain immediately before the wallet prompt.
- Use the reviewed manifest and `verifyWriteTarget`; never trust an address from URL state, API output, or inline fallback data.
- Preserve pending and uncertain states with the transaction hash. Never enable a retry until the original transaction is reconciled.
