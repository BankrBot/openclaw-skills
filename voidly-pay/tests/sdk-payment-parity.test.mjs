// Compatibility proof against the exact locked public SDK, not a second copy
// of our own typed-data builder. Disposable offline-only wallet, no RPC/API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  buildReceiveAuthorizationTypedData,
  buildTransferAuthorizationTypedData,
  signReceiveAuthorization,
  signTransferAuthorization,
  buildTransferWithAuthorizationCalldata,
} from '@voidly/session';
import {
  typedAuthorizationFor,
  checkSignResponse,
  checkRequestAgainstGrant,
} from '../scripts/preview-payment.mjs';

for (const lane of ['a', 'b']) {
  for (const amount of ['50000', '5000000']) {
    test(`locked SDK and local gate agree: lane ${lane}, amount ${amount}`, async (t) => {
      const network = t.mock.method(globalThis, 'fetch', () => {
        throw new Error('Network is forbidden in SDK parity fixtures');
      });
      const wallet = Wallet.createRandom();
      const nowMs = Date.now();
      const terms = {
        payer: wallet.address.toLowerCase(),
        payee: '0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912',
        band: { min: '50000', max: '5000000' },
        grantHash: 'ab'.repeat(32),
        expiresAt: new Date(nowMs + 600_000).toISOString(),
      };
      const input = {
        chain: 'eip155:8453',
        from: `eip155:8453:${terms.payer}`,
        to: `eip155:8453:${terms.payee}`,
        value: amount,
        validAfter: 0,
        validBefore: Math.floor(Date.parse(terms.expiresAt) / 1000),
        grantHash: terms.grantHash,
      };
      const build = lane === 'a' ? buildReceiveAuthorizationTypedData : buildTransferAuthorizationTypedData;
      const sdk = await build(input);
      assert.equal(sdk.ok, true);
      const local = typedAuthorizationFor(terms, terms.expiresAt, lane, amount);
      assert.equal(local.ok, true);
      assert.deepEqual(local.domain, sdk.typedData.domain);
      assert.equal(local.primaryType, sdk.typedData.primaryType);
      assert.deepEqual(local.types[local.primaryType], sdk.typedData.types[sdk.typedData.primaryType]);
      assert.deepEqual(local.message, sdk.typedData.message);

      const sign = lane === 'a' ? signReceiveAuthorization : signTransferAuthorization;
      const signed = await sign({ ...input, nowMs }, async typed => {
        // Ethers derives EIP712Domain itself. No provider is attached, so this
        // signs only an in-memory synthetic fixture, never a wallet request.
        const { EIP712Domain: _domain, ...types } = typed.types;
        return wallet.signTypedData(typed.domain, types, typed.message);
      });
      assert.equal(signed.ok, true);
      const response = {
        success: true, signatureType: 'eth_signTypedData_v4',
        signer: wallet.address, signature: signed.signed.signature,
      };
      assert.equal(checkSignResponse({ response, terms, lane, typedAmount: amount }).ok, true);
      assert.equal(checkSignResponse({ response, terms, lane: lane === 'a' ? 'b' : 'a', typedAmount: amount }).ok, false);
      if (lane === 'b') {
        const built = buildTransferWithAuthorizationCalldata(signed.signed);
        assert.equal(built.ok, true);
        const checked = checkRequestAgainstGrant({
          request: built.request, terms, expiresAt: terms.expiresAt,
          typedAmount: amount, signResponse: response,
        });
        assert.equal(checked.ok, true);
        assert.equal(checked.decoded.value, amount);
      }
      assert.equal(network.mock.callCount(), 0);
    });
  }
}
