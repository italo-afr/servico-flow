import { describe, expect, it } from 'vitest';
import { computeTotals, itemSchema, LIMITS } from './money.js';

describe('cálculo do orçamento (T05)', () => {
  it('exemplo do product.md: R$ 180 + R$ 350 − R$ 30 = R$ 500', () => {
    const t = computeTotals(
      [
        { description: 'Limpeza de dreno', quantity: 1, unitPriceCents: 18000 },
        { description: 'Recarga de gás', quantity: 1, unitPriceCents: 35000 },
      ],
      3000,
    );
    expect(t).toMatchObject({ subtotalCents: 53000, discountCents: 3000, totalCents: 50000 });
  });
  it('quantidade × valor unitário por linha, sem erro de ponto flutuante', () => {
    const t = computeTotals([{ description: 'Filtro', quantity: 3, unitPriceCents: 3333 }], 0);
    expect(t.items[0]!.lineTotalCents).toBe(9999);
    expect(t.totalCents).toBe(9999);
  });
  it('desconto maior que subtotal é recusado (total nunca negativo)', () => {
    expect(() =>
      computeTotals([{ description: 'Item', quantity: 1, unitPriceCents: 100 }], 101),
    ).toThrow(/desconto/i);
  });
  it('desconto negativo ou fracionário é recusado', () => {
    expect(() =>
      computeTotals([{ description: 'Item', quantity: 1, unitPriceCents: 100 }], -1),
    ).toThrow();
    expect(() =>
      computeTotals([{ description: 'Item', quantity: 1, unitPriceCents: 100 }], 1.5),
    ).toThrow();
  });
  it('sem itens é recusado', () => expect(() => computeTotals([], 0)).toThrow());
  it('quantidade fracionária e preço com casas decimais são recusados pelo schema', () => {
    expect(
      itemSchema.safeParse({ description: 'Mão de obra', quantity: 1.5, unitPriceCents: 100 })
        .success,
    ).toBe(false);
    expect(
      itemSchema.safeParse({ description: 'Peça', quantity: 1, unitPriceCents: 10.5 }).success,
    ).toBe(false);
  });
  it('maior total possível cabe em inteiro seguro', () => {
    const max = LIMITS.maxItems * LIMITS.maxQuantity * LIMITS.maxUnitPriceCents;
    expect(Number.isSafeInteger(max)).toBe(true);
  });
});
