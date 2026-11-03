'use client';
import { QuoteSection } from './quote-section';

export interface OrderDetail {
  id: string;
  number: number;
  status: string;
  priority: string;
  description: string;
  triageNotes: string | null;
  cancelReason: string | null;
  version: number;
  assignedName: string | null;
  customer: { id: string; name: string; phone: string | null; email?: string | null };
  address: {
    street: string;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string;
    state: string;
    postalCode: string | null;
    accessNotes: string | null;
  };
  equipment: {
    description: string;
    brand: string | null;
    model: string | null;
    capacityBtu: number | null;
  };
  events: {
    id: string;
    type: string;
    data: Record<string, unknown>;
    actorType: string;
    actorName: string | null;
    createdAt: string;
  }[];
  [extra: string]: unknown;
}

/** Seções do detalhe da ordem: orçamento (quem pode ver valores), visitas e fotos. */
export function OrderSections({ order, reload }: { order: OrderDetail; reload: () => void }) {
  return <>{order.quotes !== undefined && <QuoteSection order={order} reload={reload} />}</>;
}
