'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { ErrorAlert, useAction } from '@/components/ui';
import { api } from '@/lib/api';

interface Dash {
  metrics: Record<'open' | 'awaitingApproval' | 'visitsToday' | 'completed30d' | 'stale3d', number>;
  definitions: Record<string, string>;
}

/** Cada indicador abre a lista que o compõe (brief fase 8). */
export default function Dashboard() {
  const { org, path } = useOrg();
  const [d, setD] = useState<Dash | null>(null);
  const load = useAction(
    useCallback(async () => setD(await api<Dash>(path('/dashboard'))), [path]),
  );
  useEffect(() => void load.run(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const base = `/app/${org.organizationId}`;
  const tiles: { key: keyof Dash['metrics']; label: string; href: string }[] = [
    {
      key: 'open',
      label: 'Ordens em andamento',
      href: `${base}/ordens?status=OPEN,TRIAGE,AWAITING_APPROVAL,APPROVED,SCHEDULED,IN_PROGRESS`,
    },
    {
      key: 'awaitingApproval',
      label: 'Aguardando decisão do cliente',
      href: `${base}/ordens?status=AWAITING_APPROVAL`,
    },
    { key: 'visitsToday', label: 'Visitas hoje', href: `${base}/agenda` },
    { key: 'stale3d', label: 'Sem atualização há 3+ dias', href: `${base}/ordens?staleDays=3` },
    { key: 'completed30d', label: 'Concluídas (30 dias)', href: `${base}/ordens?status=COMPLETED` },
  ];
  return (
    <>
      <div className="row spread">
        <h1>Painel</h1>
        <Link className="button" href={`${base}/ordens/nova`}>
          Nova ordem
        </Link>
      </div>
      <ErrorAlert error={load.error} />
      <div className="grid2">
        {tiles.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit' }}
            title={d?.definitions[t.key]}
          >
            <div className="muted">{t.label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{d ? d.metrics[t.key] : '—'}</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              {d?.definitions[t.key]}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
