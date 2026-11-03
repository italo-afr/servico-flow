import { conflict } from '../common/errors.js';

/** Máquina de estados da ordem (brief 5.1). Transições só por comandos de domínio. */
export const ORDER_STATUSES = [
  'OPEN',
  'TRIAGE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  OPEN: ['TRIAGE', 'CANCELLED'],
  TRIAGE: ['AWAITING_APPROVAL', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'TRIAGE', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'TRIAGE', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'APPROVED', 'TRIAGE', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw conflict(
      'INVALID_TRANSITION',
      `A ordem está em ${STATUS_LABEL[from]} e não pode ir para ${STATUS_LABEL[to]}.`,
    );
  }
}

export const isTerminal = (s: OrderStatus) => TRANSITIONS[s].length === 0;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  OPEN: 'Aberta',
  TRIAGE: 'Em triagem',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em execução',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};
