'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { KIND_LABEL } from '@/components/appointments-section';
import { useOrg } from '@/components/org';
import { ErrorAlert, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { StatusBadge } from '@/lib/labels';
import { addDays, zonedDate, zonedTime, zonedToIso } from '@/lib/time';

interface Dash {
  metrics: Record<'open' | 'awaitingApproval' | 'visitsToday' | 'completed30d' | 'stale3d', number>;
  definitions: Record<string, string>;
}
interface Visit {
  id: string;
  orderId: string;
  orderNumber: number;
  kind: 'DIAGNOSTIC' | 'EXECUTION';
  startsAt: string;
  endsAt: string;
  technicianName: string;
  customerName: string;
}
interface OrderRow {
  id: string;
  number: number;
  status: string;
  customerName: string;
  summary: string;
}

const TONE: Record<keyof Dash['metrics'], string> = {
  open: '',
  awaitingApproval: 'tile-warn',
  visitsToday: '',
  stale3d: 'tile-warn',
  completed30d: 'tile-ok',
};
const ICON: Record<keyof Dash['metrics'], string> = {
  open: 'M8 4h8l3 3v13H5V4zM9 11h6M9 15h6',
  awaitingApproval: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18',
  visitsToday: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  stale3d: 'M12 9v4M12 16.5v.5M4 19 12 4l8 15z',
  completed30d: 'M5 12.5 10 17.5 19 7',
};

/** Cada indicador abre a lista que o compõe (brief fase 8). */
export default function Dashboard() {
  const { org, path } = useOrg();
  const tz = org.timezone;
  const [d, setD] = useState<Dash | null>(null);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [recent, setRecent] = useState<OrderRow[] | null>(null);
  const load = useAction(
    useCallback(async () => {
      const today = zonedDate(Date.now(), tz);
      const from = encodeURIComponent(zonedToIso(today, '00:00', tz));
      const to = encodeURIComponent(zonedToIso(addDays(today, 1), '00:00', tz));
      const [dash, appts, orders] = await Promise.all([
        api<Dash>(path('/dashboard')),
        api<{ items: Visit[] }>(path(`/appointments?from=${from}&to=${to}`)),
        api<{ items: OrderRow[] }>(path('/orders?limit=6')),
      ]);
      setD(dash);
      setVisits(appts.items);
      setRecent(orders.items);
    }, [path, tz]),
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
      <div className="grid2 tiles">
        {tiles.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`card tile ${TONE[t.key]}`}
            title={d?.definitions[t.key]}
          >
            <div className="tile-top">
              {t.label}
              <span className="tile-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={ICON[t.key]} />
                </svg>
              </span>
            </div>
            <div className="tile-num">{d ? d.metrics[t.key] : '—'}</div>
            <div className="tile-def">{d?.definitions[t.key]}</div>
          </Link>
        ))}
      </div>
      <div className="panels">
        <section className="card">
          <div className="row spread">
            <h2>Visitas de hoje</h2>
            <Link href={`${base}/agenda`}>Ver agenda</Link>
          </div>
          {visits?.length === 0 && <p className="muted">Nenhuma visita marcada para hoje.</p>}
          <ul className="list">
            {visits?.map((v) => (
              <li key={v.id}>
                <Link href={`${base}/ordens/${v.orderId}`}>
                  <span className="list-time">
                    {zonedTime(v.startsAt, tz)}
                    <small>{zonedTime(v.endsAt, tz)}</small>
                  </span>
                  <span className="list-main">
                    <strong>{v.customerName}</strong>
                    <span className="muted">
                      Ordem #{v.orderNumber} · {KIND_LABEL[v.kind]} · {v.technicianName}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="row spread">
            <h2>Ordens recentes</h2>
            <Link href={`${base}/ordens`}>Ver todas</Link>
          </div>
          {recent?.length === 0 && <p className="muted">Nenhuma ordem ainda.</p>}
          <ul className="list">
            {recent?.map((o) => (
              <li key={o.id}>
                <Link href={`${base}/ordens/${o.id}`}>
                  <span className="list-main">
                    <strong>
                      #{o.number} · {o.customerName}
                    </strong>
                    <span className="muted">{o.summary}</span>
                  </span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
