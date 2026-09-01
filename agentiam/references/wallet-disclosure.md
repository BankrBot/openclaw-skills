# Wallet Disclosure

Full disclosure of every wallet referenced by AgentIAM and its role.

## Canonical signer

```
0x069c6012E053DFBf50390B19FaE275aD96D22ed7
```

- **Role:** Signs every AgentIAM response.
- **Trust:** Consumers must reject any response not signed by this address.
- **Chain:** Base Mainnet.

## Provider (owner) wallet

```
0x24908846a4397d3549d07661e0fc02220ab14dad
```

- **Role:** Appears in the service base URL. This is the wallet that
  registered AgentIAM as an x402 service and receives net revenue.
- **Chain:** Base Mainnet.

## BANKR x402 facilitator

```
0x8AEE...  (BANKR-operated escrow)
```

- **Role:** BANKR's facilitator/escrow. Collects USDC at payment time,
  then sweeps to the provider wallet.
- **Trust:** This is BANKR infrastructure. See BANKR's docs for their
  operational model. AgentIAM does not control this address.

## Base Mainnet USDC

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

- **Role:** The USDC contract used for settlement.
- **Trust:** Circle-issued USDC on Base Mainnet. Standard.

## Decommissioned wallets

The following address was previously associated with our operations and
is **decommissioned**. Never pay to it. Never accept a response signed
by it.

```
0x16708f79D6366eE32774048ECC7878617236Ca5C   (DECOMMISSIONED)
```

If you see this address anywhere near an AgentIAM response, treat the
response as hostile.

## Why this matters

An IAM service whose signer rotates silently is not an IAM service.
Publishing the canonical signer address here, and having your client
verify every response against it, is what gives AgentIAM its integrity
guarantee. Rotation, if it ever happens, will be announced via a signed
update from the current key before the new key takes effect.
