export const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberta',
  TRIAGE: 'Em triagem',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em execução',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};
export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
export const EVENT_LABEL: Record<string, string> = {
  'order.created': 'Ordem aberta',
  'order.triage_started': 'Triagem iniciada',
  'order.updated': 'Dados atualizados',
  'order.cancelled': 'Ordem cancelada',
  'quote.sent': 'Orçamento enviado',
  'quote.revised': 'Orçamento revisado',
  'quote.accepted': 'Cliente aceitou o orçamento',
  'quote.rejected': 'Cliente recusou o orçamento',
  'quote.expired': 'Orçamento expirou',
  'appointment.scheduled': 'Visita agendada',
  'appointment.rescheduled': 'Visita reagendada',
  'appointment.cancelled': 'Visita cancelada',
  'appointment.started': 'Visita iniciada',
  'appointment.completed': 'Visita concluída',
  'order.completed': 'Ordem concluída',
};
export const brl = (cents: number | string) =>
  (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dt = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' });

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge status-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}
