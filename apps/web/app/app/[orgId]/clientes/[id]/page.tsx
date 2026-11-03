'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { ErrorAlert, Field, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dt, StatusBadge } from '@/lib/labels';

interface Detail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  version: number;
  archivedAt: string | null;
  addresses: {
    id: string;
    street: string;
    number: string | null;
    city: string;
    state: string;
    archivedAt: string | null;
  }[];
  equipment: {
    id: string;
    description: string;
    brand: string | null;
    model: string | null;
    archivedAt: string | null;
  }[];
  orders: { id: string; number: number; status: string; createdAt: string }[];
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { org, path } = useOrg();
  const [c, setC] = useState<Detail | null>(null);
  const [edit, setEdit] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [newEq, setNewEq] = useState('');
  const load = useAction(
    useCallback(async () => setC(await api<Detail>(path(`/customers/${id}`))), [path, id]),
  );
  useEffect(() => void load.run(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(async () => {
    if (!c || !edit) return;
    await api(path(`/customers/${id}/update`), {
      method: 'POST',
      json: {
        version: c.version,
        name: edit.name,
        phone: edit.phone || undefined,
        email: edit.email || undefined,
      },
    });
    setEdit(null);
    await load.run();
  });
  const act = useAction(async (url: string, json: object = {}) => {
    await api(path(url), { method: 'POST', json });
    await load.run();
  });
  if (!c)
    return load.error ? <ErrorAlert error={load.error} /> : <p className="muted">Carregando…</p>;
  const base = `/app/${org.organizationId}`;
  return (
    <>
      <div className="row spread">
        <h1>
          {c.name} {c.archivedAt && <span className="badge">arquivado</span>}
        </h1>
        {!c.archivedAt && (
          <div className="row">
            <button
              className="secondary"
              onClick={() => setEdit({ name: c.name, phone: c.phone ?? '', email: c.email ?? '' })}
            >
              Editar
            </button>
            <button
              className="secondary"
              onClick={() =>
                confirm('Arquivar cliente? Ordens antigas continuam acessíveis.') &&
                void act.run(`/customers/${id}/archive`)
              }
            >
              Arquivar
            </button>
          </div>
        )}
      </div>
      <ErrorAlert error={act.error} />
      {edit ? (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run();
          }}
        >
          <ErrorAlert error={save.error} />
          <Field label="Nome" name="name" error={save.error}>
            <input
              id="name"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label="Telefone" name="phone" error={save.error}>
            <input
              id="phone"
              value={edit.phone}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
            />
          </Field>
          <Field label="E-mail" name="email" error={save.error}>
            <input
              id="email"
              type="email"
              value={edit.email}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
          </Field>
          <div className="row">
            <button disabled={save.pending}>Salvar</button>
            <button type="button" className="secondary" onClick={() => setEdit(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="card">
          <p>
            Telefone: {c.phone ?? '—'} · E-mail: {c.email ?? '—'}
          </p>
        </div>
      )}
      <div className="grid2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Locais</h2>
          {c.addresses.map((a) => (
            <p key={a.id} className={a.archivedAt ? 'muted' : ''}>
              {a.street}
              {a.number ? `, ${a.number}` : ''} — {a.city}/{a.state} {a.archivedAt && '(arquivado)'}
            </p>
          ))}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Equipamentos</h2>
          {c.equipment.map((x) => (
            <div key={x.id} className="row spread">
              <span className={x.archivedAt ? 'muted' : ''}>
                {x.description} {x.brand} {x.model} {x.archivedAt && '(arquivado)'}
              </span>
              {!x.archivedAt && (
                <button
                  className="secondary"
                  onClick={() => void act.run(`/customers/${id}/equipment/${x.id}/archive`)}
                >
                  Arquivar
                </button>
              )}
            </div>
          ))}
          {!c.archivedAt && (
            <form
              className="row"
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                void act
                  .run(`/customers/${id}/equipment`, { description: newEq })
                  .then(() => setNewEq(''));
              }}
            >
              <input
                aria-label="Novo equipamento"
                placeholder="Novo equipamento"
                value={newEq}
                onChange={(e) => setNewEq(e.target.value)}
                style={{ flex: 1 }}
              />
              <button disabled={newEq.length < 2}>Adicionar</button>
            </form>
          )}
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ordens</h2>
        {c.orders.length === 0 && <p className="muted">Nenhuma ordem.</p>}
        {c.orders.map((o) => (
          <p key={o.id}>
            <Link href={`${base}/ordens/${o.id}`}>#{o.number}</Link>{' '}
            <StatusBadge status={o.status} />{' '}
            <span className="muted">{dt(o.createdAt, org.timezone)}</span>
          </p>
        ))}
      </div>
    </>
  );
}
