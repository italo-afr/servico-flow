'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { ErrorAlert, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, PRIORITY_LABEL, STATUS_LABEL, StatusBadge } from '@/lib/labels';

interface Row {
  id: string;
  number: number;
  status: string;
  priority: string;
  createdAt: string;
  customerName: string;
  summary: string;
  city: string;
}

function Orders() {
  const { org, path } = useOrg();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get('status') ?? '');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useAction(
    useCallback(
      async (append: string | null) => {
        const params = new URLSearchParams({ limit: '20' });
        if (status) params.set('status', status);
        if (q) params.set('q', q);
        const stale = sp.get('staleDays');
        if (stale) params.set('staleDays', stale);
        if (append) params.set('cursor', append);
        const r = await api<{ items: Row[]; nextCursor: string | null }>(path(`/orders?${params}`));
        setItems((prev) => (append ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
      },
      [path, status, q, sp],
    ),
  );
  useEffect(() => void load.run(null), [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = `/app/${org.organizationId}`;
  return (
    <>
      <div className="row spread">
        <h1>Ordens de serviço</h1>
        <Link className="button" href={`${base}/ordens/nova`}>
          Nova ordem
        </Link>
      </div>
      <form
        className="filters card"
        onSubmit={(e) => {
          e.preventDefault();
          void load.run(null);
        }}
      >
        <div>
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            placeholder="Nº da ordem ou nome do cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="status">Estado</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="OPEN,TRIAGE,AWAITING_APPROVAL,APPROVED,SCHEDULED,IN_PROGRESS">
              Em andamento
            </option>
          </select>
        </div>
        <div style={{ alignSelf: 'end', flex: '0 0 auto' }}>
          <button>Filtrar</button>
        </div>
      </form>
      {sp.get('staleDays') && (
        <p className="muted">
          Mostrando ordens sem atualização há {sp.get('staleDays')} dias ou mais.
        </p>
      )}
      <ErrorAlert error={load.error} />
      {!load.pending && items.length === 0 && !load.error && (
        <div className="card muted">
          Nenhuma ordem encontrada. <Link href={`${base}/ordens/nova`}>Abrir a primeira ordem</Link>
        </div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <table className="responsive">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Resumo</th>
              <th>Estado</th>
              <th>Prioridade</th>
              <th>Aberta em</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`${base}/ordens/${o.id}`}>#{o.number}</Link>
                </td>
                <td>
                  {o.customerName} <span className="muted">· {o.city}</span>
                </td>
                <td>{o.summary}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td>{PRIORITY_LABEL[o.priority]}</td>
                <td>{dt(o.createdAt, org.timezone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {load.pending && <p className="muted">Carregando…</p>}
      {cursor && (
        <button className="secondary" onClick={() => void load.run(cursor)}>
          Carregar mais
        </button>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
