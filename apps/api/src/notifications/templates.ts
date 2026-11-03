import type { Db } from '../db/pool.js';

export interface OutboxRow {
  id: string;
  organization_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  payload_encrypted: string | null;
  attempts: number;
  max_attempts: number;
}

export type Rendered =
  | { kind: 'send'; to: string; subject: string; text: string }
  | { kind: 'suppress'; reason: string };

/**
 * Monta o e-mail a partir do evento. Também decide supressão: evento que ficou
 * obsoleto antes do envio (ex.: convite revogado, orçamento substituído) não é enviado.
 */
export async function render(
  db: Db,
  ev: OutboxRow,
  secret: Record<string, string> | null,
): Promise<Rendered> {
  const p = ev.payload as Record<string, string>;
  switch (ev.type) {
    case 'invitation.created': {
      const r = await db.query(
        `SELECT i.consumed_at, i.revoked_at, i.expires_at < now() AS expired, o.name AS org_name
           FROM invitations i JOIN organizations o ON o.id = i.organization_id WHERE i.id = $1`,
        [p.invitationId],
      );
      const inv = r.rows[0];
      if (!inv || inv.consumed_at || inv.revoked_at || inv.expired)
        return { kind: 'suppress', reason: 'invitation_inactive' };
      if (!secret?.link) return { kind: 'suppress', reason: 'secret_missing' };
      return {
        kind: 'send',
        to: p.email!,
        subject: `Convite para ${inv.org_name} no ServiçoFlow`,
        text: `Você foi convidado(a) para a equipe de ${inv.org_name}.\n\nAceite o convite em:\n${secret.link}\n\nO link expira em 7 dias. Se você não esperava este convite, ignore este e-mail.`,
      };
    }
    case 'auth.password_reset': {
      if (!secret?.link) return { kind: 'suppress', reason: 'secret_missing' };
      return {
        kind: 'send',
        to: p.email!,
        subject: 'Redefinição de senha — ServiçoFlow',
        text: `Recebemos um pedido para redefinir sua senha.\n\n${secret.link}\n\nO link expira em 1 hora. Se não foi você, ignore este e-mail.`,
      };
    }
    case 'quote.sent': {
      const r = await db.query(
        `SELECT q.status, q.version, q.total_cents, q.expires_at, o.name AS org_name, so.number
           FROM quotes q JOIN organizations o ON o.id = q.organization_id
           JOIN service_orders so ON so.id = q.order_id WHERE q.id = $1`,
        [p.quoteId],
      );
      const q = r.rows[0];
      if (!q || q.status !== 'SENT') return { kind: 'suppress', reason: 'quote_not_current' };
      if (!secret?.link) return { kind: 'suppress', reason: 'secret_missing' };
      const total = (Number(q.total_cents) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      return {
        kind: 'send',
        to: p.email!,
        subject: `Orçamento da ordem #${q.number} — ${q.org_name}`,
        text: `${q.org_name} enviou o orçamento versão ${q.version} da ordem #${q.number}, no valor de ${total}.\n\nConsulte e decida em:\n${secret.link}\n\nVálido até ${new Date(q.expires_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      };
    }
    case 'quote.decided': {
      return {
        kind: 'send',
        to: p.email!,
        subject: `Orçamento da ordem #${p.orderNumber} ${p.decision === 'ACCEPTED' ? 'aceito' : 'recusado'}`,
        text: `O cliente ${p.decision === 'ACCEPTED' ? 'aceitou' : 'recusou'} a versão ${p.version} do orçamento da ordem #${p.orderNumber}.`,
      };
    }
    case 'appointment.scheduled': {
      return {
        kind: 'send',
        to: p.email!,
        subject: `Nova visita atribuída — ordem #${p.orderNumber}`,
        text: `Uma visita (${p.kind === 'DIAGNOSTIC' ? 'diagnóstico' : 'execução'}) foi atribuída a você em ${p.startsAtLocal}. Consulte "Minhas visitas" no ServiçoFlow.`,
      };
    }
    default:
      return { kind: 'suppress', reason: 'unknown_type' };
  }
}
