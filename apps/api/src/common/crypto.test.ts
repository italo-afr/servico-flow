import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, randomToken, sha256 } from './crypto.js';

const key = 'b'.repeat(64);
describe('crypto', () => {
  it('token tem 256 bits e é único', () => {
    const t = randomToken();
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(randomToken()).not.toBe(t);
  });
  it('cifra e decifra; adulteração é detectada', () => {
    const c = encrypt('link-secreto', key);
    expect(c).not.toContain('link-secreto');
    expect(decrypt(c, key)).toBe('link-secreto');
    const parts = c.split('.');
    parts[3] = Buffer.from('outro').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });
  it('sha256 é determinístico', () => expect(sha256('a')).toBe(sha256('a')));
});
