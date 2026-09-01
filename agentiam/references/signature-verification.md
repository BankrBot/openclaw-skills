# Signature Verification

Every AgentIAM response is signed by the canonical signer wallet. A
consuming agent must verify the signature before acting on the result.
If the signer does not match the canonical wallet, the response is
rejected regardless of `result.decision`.

## Canonical signer

```
0x069c6012E053DFBf50390B19FaE275aD96D22ed7
```

Full wallet policy and the rationale for rejecting any other signer live
in `references/wallet-disclosure.md`.

## How signatures are produced

The signer takes the `result` object, produces a canonical JSON string
(sorted keys, no whitespace), and signs it with EIP-191 `personal_sign`.

Pseudocode:

```
message = canonicalize(result)             // deterministic JSON
digest  = keccak256("\x19Ethereum Signed Message:\n" + len(message) + message)
sig     = sign(digest, canonical_private_key)
```

## How to verify (Node / ethers v6)

See `scripts/verify-signature.js` for a runnable reference. The core
three lines:

```javascript
const message   = canonicalize(resp.result);
const digest    = ethers.hashMessage(message);
const recovered = ethers.recoverAddress(digest, resp.proof.signature);
```

Then compare `recovered` to BOTH `resp.proof.signer` AND the canonical
signer. Both must match.

## How to verify (Python / eth_account)

```python
from eth_account.messages import encode_defunct
from eth_account import Account
import json

def canonicalize(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))

message = canonicalize(resp["result"])
msg     = encode_defunct(text=message)
recovered = Account.recover_message(msg, signature=resp["proof"]["signature"])

assert recovered.lower() == resp["proof"]["signer"].lower()
assert recovered.lower() == "0x069c6012e053dfbf50390b19fae275ad96d22ed7"
```

## Canonicalization rules

- JSON keys are sorted lexicographically at every object level.
- No whitespace between tokens.
- Numbers are emitted exactly as the signer encoded them — do not
  reformat.
- Arrays keep their original order.

The `scripts/verify-signature.js` implementation is the authoritative
reference. If in doubt, diff against that.

## Failure modes

| Condition | What it means | Action |
| --- | --- | --- |
| `recovered != claimed` | Body was modified in transit. | Reject. |
| `recovered != canonical` | Response came from a wallet we do not trust. | Reject. |
| Missing `proof.signature` | Malformed response. | Reject. |
| Timestamp skew > 5 min | Possible replay. | Reject or refetch. |

Never fall back to "trust the HTTP status" on signature failure.
