'use client';
import { useEffect, useState } from 'react';
import { ErrorAlert, takeHashToken, useAction } from '@/components/ui';
import { api, ApiRequestError } from '@/lib/api';
import { brl } from '@/lib/labels';

interface Proposal {
  organization: { name: string; phone: string | null };
  order: { number: number; description: string };
  customer: { name: string };
  address: { street: string; number: string | null; city: string; state: string };
  equipment: { description: string; brand: string | null; model: string | null };
  items: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  version: number;
  timezone: string;
}
interface Current {
  status: string;
  version: number;
  proposal: Proposal;
  expiresAt: string;
  decidedAt: string | null;
  canDecide: boolean;
}

const BASE = '/api/v1/public/quote-access';

/**
 * Página pública do cliente. Sem scripts de terceiros (brief 7.4).
 * O token vem no fragmento (#), é trocado por um cookie curto e removido do histórico.
 */
export default function PublicQuotePage() {
  const [data, setData] = useState<Current | null>(null);
  const [pick, setPick] = useState<'ACCEPT' | 'REJECT' | null>(null);
  const load = useAction(async () => setData(await api<Current>(`${BASE}/current`)));
  useEffect(() => {
    const token = takeHashToken();
    const run = async () => {
      if (token) await api(`${BASE}/exchange`, { method: 'POST', json: { token } });
      await load.run();
    };
    run().catch((e: unknown) => load.setError(e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const decide = useAction(async () => {
    if (!pick) return;
    await api(`${BASE}/decision`, { method: 'POST', json: { decision: pick, confirm: true } });
    setPick(null);
    await load.run();
  });

  const expiredLink =
    load.error instanceof ApiRequestError && [401, 410].includes(load.error.status);
  if (!data) {
    return (
      <main style={{ maxWidth: 640 }}>
        <h1>Orçamento</h1>
        {expiredLink ? (
          <div className="alert error">
            Este link não é mais válido ou a sessão expirou. Abra novamente o link do e-mail ou peça
            um novo à empresa.
          </div>
        ) : (
          <ErrorAlert error={load.error} />
        )}
        {!load.error && <p className="muted">Carregando…</p>}
      </main>
    );
  }
  const p = data.proposal;
  const tz = p.timezone;
  return (
    <main style={{ maxWidth: 640 }}>
      <p className="muted">{p.organization.name}</p>
      <h1>
        Orçamento da ordem #{p.order.number} <span className="badge">versão {data.version}</span>
      </h1>
      <div className="card">
        <p>
          <strong>{p.customer.name}</strong>
        </p>
        <p>
          {p.address.street}
          {p.address.number ? `, ${p.address.number}` : ''} — {p.address.city}/{p.address.state}
        </p>
        <p>
          Equipamento: {p.equipment.description} {p.equipment.brand ?? ''} {p.equipment.model ?? ''}
        </p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Serviço/peça</th>
              <th>Qtd.</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i, k) => (
              <tr key={k}>
                <td>{i.description}</td>
                <td>{i.quantity}</td>
                <td>{brl(i.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.discountCents > 0 && (
          <p>
            Subtotal {brl(p.subtotalCents)} · Desconto {brl(p.discountCents)}
          </p>
        )}
        <p style={{ fontSize: '1.4rem' }}>
          Total: <strong>{brl(p.totalCents)}</strong>
        </p>
        {p.notes && <p>Condições: {p.notes}</p>}
        <p className="muted">
          Válido até{' '}
          {new Date(data.expiresAt).toLocaleString('pt-BR', {
            timeZone: tz,
            dateStyle: 'long',
            timeStyle: 'short',
          })}
          .
        </p>
      </div>
      {data.status === 'ACCEPTED' && (
        <div className="alert success">
          Você aceitou este orçamento
          {data.decidedAt &&
            ` em ${new Date(data.decidedAt).toLocaleString('pt-BR', { timeZone: tz })}`}
          . A empresa entrará em contato para agendar.
        </div>
      )}
      {data.status === 'REJECTED' && (
        <div className="alert">
          Você recusou este orçamento. A empresa poderá enviar uma nova proposta.
        </div>
      )}
      {['EXPIRED', 'SUPERSEDED', 'CANCELLED'].includes(data.status) && (
        <div className="alert error">
          Este orçamento não está mais disponível para decisão (
          {data.status === 'EXPIRED' ? 'prazo encerrado' : 'substituído ou cancelado'}).
        </div>
      )}
      <ErrorAlert error={decide.error} />
      {data.canDecide && !pick && (
        <div className="row">
          <button onClick={() => setPick('ACCEPT')}>Aceitar orçamento</button>
          <button className="secondary" onClick={() => setPick('REJECT')}>
            Recusar
          </button>
        </div>
      )}
      {data.canDecide && pick && (
        <div className="card stack" role="dialog" aria-labelledby="confirm-title">
          <h2 id="confirm-title" style={{ marginTop: 0 }}>
            {pick === 'ACCEPT' ? `Confirmar aceite de ${brl(p.totalCents)}?` : 'Confirmar recusa?'}
          </h2>
          <p className="muted">
            Esta decisão é registrada para a versão {data.version} e não pode ser desfeita por aqui.
            Não é um pagamento.
          </p>
          <div className="row">
            <button
              disabled={decide.pending}
              className={pick === 'REJECT' ? 'danger' : ''}
              onClick={() => void decide.run()}
            >
              {decide.pending ? 'Enviando…' : pick === 'ACCEPT' ? 'Sim, aceito' : 'Sim, recuso'}
            </button>
            <button className="secondary" onClick={() => setPick(null)}>
              Voltar
            </button>
          </div>
        </div>
      )}
      {p.organization.phone && <p className="muted">Dúvidas: {p.organization.phone}</p>}
    </main>
  );
}
