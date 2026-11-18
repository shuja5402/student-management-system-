import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decrypt, encrypt } from '../src/utils/crypto.js';

describe('field encryption', () => {
  it('round-trips values and uses a fresh IV each time', () => {
    const a = encrypt('+919876543210');
    const b = encrypt('+919876543210');
    assert.notEqual(a, b);
    assert.equal(decrypt(a), '+919876543210');
  });

  it('returns null for empty values', () => {
    assert.equal(encrypt(''), null);
    assert.equal(decrypt(null), null);
  });

  it('detects tampering', () => {
    const parts = encrypt('secret').split(':');
    parts[3] = Buffer.from('tampered!').toString('base64');
    assert.throws(() => decrypt(parts.join(':')));
  });
});
