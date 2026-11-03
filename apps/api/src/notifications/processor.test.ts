import { describe, expect, it } from 'vitest';
import { backoffSeconds, OUTBOX_POLICY } from './processor.js';

describe('backoff', () => {
  it('cresce exponencialmente e é limitado a 1 hora', () => {
    expect(backoffSeconds(1, () => 0.999)).toBeLessThan(31);
    expect(backoffSeconds(3, () => 0.999)).toBeLessThanOrEqual(120);
    expect(backoffSeconds(20, () => 0.999)).toBeLessThanOrEqual(OUTBOX_POLICY.maxBackoffSeconds);
  });
  it('nunca é menor que 5 s', () => expect(backoffSeconds(1, () => 0)).toBe(5));
  it('timeout de envio é menor que o lease', () =>
    expect(OUTBOX_POLICY.sendTimeoutMs / 1000).toBeLessThan(OUTBOX_POLICY.leaseSeconds));
});
