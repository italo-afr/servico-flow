import { z } from 'zod';
import { invalid } from '../common/errors.js';

/**
 * Cálculo monetário em centavos inteiros (brief 5.2). Limites garantem que o maior
 * total possível (50 itens × 10.000 un × R$ 100 mi) cabe em Number.MAX_SAFE_INTEGER.
 */
export const LIMITS = {
  maxItems: 50,
  maxQuantity: 10_000,
  maxUnitPriceCents: 10_000_000_000, // R$ 100 milhões
  maxSubtotalCents: 100_000_000_000, // R$ 1 bilhão
};

export const itemSchema = z.strictObject({
  description: z.string().trim().min(2).max(300),
  quantity: z.number().int('Quantidade inteira').min(1).max(LIMITS.maxQuantity),
  unitPriceCents: z.number().int('Valor em centavos inteiros').min(0).max(LIMITS.maxUnitPriceCents),
});
export type QuoteItemInput = z.infer<typeof itemSchema>;

export interface Totals {
  items: (QuoteItemInput & { position: number; lineTotalCents: number })[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/** O total é sempre calculado aqui; o cliente nunca define o valor autorizado. */
export function computeTotals(items: QuoteItemInput[], discountCents: number): Totals {
  if (items.length === 0) throw invalid('Inclua pelo menos um item.', { items: ['Obrigatório'] });
  if (items.length > LIMITS.maxItems) throw invalid(`No máximo ${LIMITS.maxItems} itens.`);
  if (!Number.isSafeInteger(discountCents) || discountCents < 0) {
    throw invalid('Desconto inválido.', {
      discountCents: ['Use centavos inteiros, não negativos.'],
    });
  }
  const lines = items.map((it, i) => ({
    ...it,
    position: i + 1,
    lineTotalCents: it.quantity * it.unitPriceCents,
  }));
  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (subtotalCents > LIMITS.maxSubtotalCents)
    throw invalid('Valor total acima do limite permitido.');
  if (discountCents > subtotalCents) {
    throw invalid('O desconto não pode ser maior que o subtotal.', {
      discountCents: ['Maior que o subtotal'],
    });
  }
  return { items: lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}
