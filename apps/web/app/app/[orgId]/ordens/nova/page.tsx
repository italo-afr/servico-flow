'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { useOrg } from '@/components/org';
import { ErrorAlert, Field, useAction } from '@/components/ui';
import { api } from '@/lib/api';

interface CustomerHit {
  id: string;
  name: string;
  phone: string | null;
}
interface CustomerDetail {
  id: string;
  name: string;
  addresses: {
    id: string;
    street: string;
    number: string | null;
    city: string;
    archivedAt: string | null;
  }[];
  equipment: { id: string; description: string; brand: string | null; archivedAt: string | null }[];
}

export default function NewOrderPage() {
  const { org, path } = useOrg();
  const router = useRouter();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [addressId, setAddressId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  // Uma chave por formulário: duplo clique ou nova tentativa não abre ordem duplicada.
  const [idemKey] = useState(() => crypto.randomUUID());

  const search = useAction(async () => {
    const r = await api<{ items: CustomerHit[] }>(
      path(`/customers?limit=10&q=${encodeURIComponent(q)}`),
    );
    setHits(r.items);
  });
  const pick = useAction(async (id: string) => {
    const c = await api<CustomerDetail>(path(`/customers/${id}`));
    setCustomer(c);
    setAddressId(c.addresses.find((a) => !a.archivedAt)?.id ?? '');
    setEquipmentId(c.equipment.find((e) => !e.archivedAt)?.id ?? '');
  });
  useEffect(() => {
    if (mode === 'search') void search.run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useAction(async () => {
    if (!customer) return;
    const r = await api<{ id: string }>(path('/orders'), {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKey },
      json: { customerId: customer.id, addressId, equipmentId, description, priority },
    });
    router.push(`/app/${org.organizationId}/ordens/${r.id}`);
  });

  return (
    <>
      <h1>Nova ordem de serviço</h1>
      {!customer && (
        <div className="card stack">
          <div className="row">
            <button
              className={mode === 'search' ? '' : 'secondary'}
              onClick={() => setMode('search')}
            >
              Cliente existente
            </button>
            <button className={mode === 'new' ? '' : 'secondary'} onClick={() => setMode('new')}>
              Novo cliente
            </button>
          </div>
          {mode === 'search' ? (
            <>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void search.run();
                }}
              >
                <input
                  aria-label="Buscar cliente"
                  placeholder="Nome ou telefone"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button>Buscar</button>
              </form>
              <ErrorAlert error={search.error || pick.error} />
              {hits.length === 0 && !search.pending && (
                <p className="muted">Nenhum cliente encontrado.</p>
              )}
              {hits.map((h) => (
                <button
                  key={h.id}
                  className="secondary"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => void pick.run(h.id)}
                >
                  {h.name} {h.phone && <span className="muted">&nbsp;· {h.phone}</span>}
                </button>
              ))}
            </>
          ) : (
            <CustomerForm apiPath={path('/customers')} onCreated={(r) => void pick.run(r.id)} />
          )}
        </div>
      )}
      {customer && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit.run();
          }}
        >
          <div className="row spread">
            <strong>{customer.name}</strong>
            <button type="button" className="secondary" onClick={() => setCustomer(null)}>
              Trocar cliente
            </button>
          </div>
          <ErrorAlert error={submit.error} />
          <Field label="Local de atendimento" name="addressId" error={submit.error}>
            <select
              id="addressId"
              required
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
            >
              {customer.addresses
                .filter((a) => !a.archivedAt)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.street}
                    {a.number ? `, ${a.number}` : ''} — {a.city}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Equipamento" name="equipmentId" error={submit.error}>
            <select
              id="equipmentId"
              required
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              {customer.equipment
                .filter((x) => !x.archivedAt)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.description}
                    {x.brand ? ` (${x.brand})` : ''}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Descrição do problema relatado" name="description" error={submit.error}>
            <textarea
              id="description"
              required
              minLength={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Prioridade" name="priority" error={submit.error}>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </Field>
          <button disabled={submit.pending || !addressId || !equipmentId}>
            {submit.pending ? 'Abrindo…' : 'Abrir ordem'}
          </button>
        </form>
      )}
    </>
  );
}
