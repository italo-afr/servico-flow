'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { useOrg } from '@/components/org';
import { ErrorAlert, useAction } from '@/components/ui';
import { api } from '@/lib/api';

interface Row {
  id: string;
  name: string;
  phone: string | null;
  orderCount: number;
}

export default function CustomersPage() {
  const { org, path } = useOrg();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useAction(
    useCallback(
      async (after: string | null) => {
        const p = new URLSearchParams({ limit: '20' });
        if (q) p.set('q', q);
        if (after) p.set('cursor', after);
        const r = await api<{ items: Row[]; nextCursor: string | null }>(path(`/customers?${p}`));
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
      },
      [path, q],
    ),
  );
  useEffect(() => void load.run(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const base = `/app/${org.organizationId}`;
  return (
    <>
      <div className="row spread">
        <h1>Clientes</h1>
        <button onClick={() => setCreating((v) => !v)}>
          {creating ? 'Fechar' : 'Novo cliente'}
        </button>
      </div>
      {creating && (
        <div className="card">
          <CustomerForm
            apiPath={path('/customers')}
            onCreated={() => {
              setCreating(false);
              void load.run(null);
            }}
          />
        </div>
      )}
      <form
        className="row card"
        onSubmit={(e) => {
          e.preventDefault();
          void load.run(null);
        }}
      >
        <input
          aria-label="Buscar"
          placeholder="Nome ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <button>Buscar</button>
      </form>
      <ErrorAlert error={load.error} />
      {!load.pending && !items.length && (
        <div className="card muted">Nenhum cliente cadastrado.</div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <table className="responsive">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Ordens</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`${base}/clientes/${c.id}`}>{c.name}</Link>
                </td>
                <td>{c.phone ?? '—'}</td>
                <td>{c.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor && (
        <button className="secondary" onClick={() => void load.run(cursor)}>
          Carregar mais
        </button>
      )}
    </>
  );
}
