'use client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { OrderSections, type OrderDetail } from '@/components/order-sections';
import { ErrorAlert, Field, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, EVENT_LABEL, PRIORITY_LABEL, StatusBadge } from '@/lib/labels';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { org, path } = useOrg();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const load = useAction(
    useCallback(async () => setOrder(await api<OrderDetail>(path(`/orders/${id}`))), [path, id]),
  );
  useEffect(() => void load.run(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const command = useAction(async (cmd: string, json: object = {}) => {
    await api(path(`/orders/${id}/${cmd}`), {
      method: 'POST',
      json: { version: order?.version, ...json },
    });
    setCancelling(false);
    await load.run();
  });

  if (!order)
    return load.error ? <ErrorAlert error={load.error} /> : <p className="muted">Carregando…</p>;
  const canManage = org.role !== 'TECHNICIAN';
  const terminal = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const a = order.address;
  return (
    <>
      <div className="row spread">
        <h1>
          Ordem #{order.number} <StatusBadge status={order.status} />
        </h1>
        {canManage && !terminal && (
          <div className="row">
            {order.status === 'OPEN' && (
              <button onClick={() => void command.run('start-triage')}>Iniciar triagem</button>
            )}
            <button className="secondary" onClick={() => setCancelling((v) => !v)}>
              Cancelar ordem
            </button>
          </div>
        )}
      </div>
      <ErrorAlert error={command.error} />
      {cancelling && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void command.run('cancel', { reason });
          }}
        >
          <p>
            Cancelar encerra a ordem, cancela visitas futuras e invalida links de orçamento. O
            histórico é mantido.
          </p>
          <Field label="Motivo do cancelamento" name="reason" error={command.error}>
            <input
              id="reason"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button className="danger" disabled={command.pending}>
            Confirmar cancelamento
          </button>
        </form>
      )}
      <div className="grid2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Cliente</h2>
          <p>
            <strong>{order.customer.name}</strong>
          </p>
          {order.customer.phone && (
            <p>
              Telefone: <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>
            </p>
          )}
          <p>
            {a.street}
            {a.number ? `, ${a.number}` : ''}
            {a.complement ? ` — ${a.complement}` : ''}
            <br />
            {[a.district, a.city, a.state].filter(Boolean).join(' · ')} {a.postalCode}
          </p>
          {a.accessNotes && <p className="muted">Acesso: {a.accessNotes}</p>}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Equipamento e problema</h2>
          <p>
            <strong>{order.equipment.description}</strong>
            {order.equipment.brand && ` · ${order.equipment.brand}`}
            {order.equipment.model && ` ${order.equipment.model}`}
            {order.equipment.capacityBtu &&
              ` · ${order.equipment.capacityBtu.toLocaleString('pt-BR')} BTU`}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{order.description}</p>
          <p className="muted">
            Prioridade: {PRIORITY_LABEL[order.priority]}
            {order.assignedName && ` · Responsável: ${order.assignedName}`}
          </p>
          {order.cancelReason && (
            <p className="muted">Motivo do cancelamento: {order.cancelReason}</p>
          )}
        </div>
      </div>
      <OrderSections order={order} reload={() => void load.run()} />
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Linha do tempo</h2>
        <ul className="timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <strong>{EVENT_LABEL[e.type] ?? e.type}</strong>
              <div className="muted" style={{ fontSize: '0.875rem' }}>
                {dt(e.createdAt, org.timezone)} ·{' '}
                {e.actorType === 'CUSTOMER_LINK' ? 'Cliente (link)' : (e.actorName ?? 'Sistema')}
                {typeof e.data.reason === 'string' && ` · ${e.data.reason}`}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
