'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { APPT_STATUS, KIND_LABEL } from './appointments-section';
import { useOrg } from './org';
import { ErrorAlert, useAction } from './ui';
import { api } from '@/lib/api';
import { addDays, weekdayLabel, zonedDate, zonedTime, zonedToIso } from '@/lib/time';

interface Visit {
  id: string;
  orderId: string;
  orderNumber: number;
  kind: 'DIAGNOSTIC' | 'EXECUTION';
  status: string;
  startsAt: string;
  endsAt: string;
  technicianName: string;
  customerName: string;
  street: string;
  streetNumber: string | null;
  district: string | null;
  city: string;
}

/** Lista cronológica agrupada por dia, no fuso da empresa (brief 8.1, telas 10 e 11). */
export function VisitList({ days, title }: { days: number; title: string }) {
  const { org, path } = useOrg();
  const tz = org.timezone;
  const [start, setStart] = useState(() => zonedDate(Date.now(), tz));
  const [items, setItems] = useState<Visit[]>([]);
  const load = useAction(
    useCallback(async () => {
      const from = zonedToIso(start, '00:00', tz);
      const to = zonedToIso(addDays(start, days), '00:00', tz);
      const r = await api<{ items: Visit[] }>(
        path(`/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      );
      setItems(r.items);
    }, [path, start, days, tz]),
  );
  useEffect(() => void load.run(), [start]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = new Map<string, Visit[]>();
  for (let i = 0; i < days; i++) byDay.set(addDays(start, i), []);
  for (const v of items) byDay.get(zonedDate(v.startsAt, tz))?.push(v);
  return (
    <>
      <div className="row spread">
        <h1>{title}</h1>
        <div className="row">
          <button
            className="secondary"
            aria-label="Período anterior"
            onClick={() => setStart(addDays(start, -days))}
          >
            ‹
          </button>
          <button className="secondary" onClick={() => setStart(zonedDate(Date.now(), tz))}>
            Hoje
          </button>
          <button
            className="secondary"
            aria-label="Próximo período"
            onClick={() => setStart(addDays(start, days))}
          >
            ›
          </button>
        </div>
      </div>
      <ErrorAlert error={load.error} />
      {[...byDay.entries()].map(([day, visits]) => (
        <section key={day}>
          <h2 style={{ textTransform: 'capitalize' }}>{weekdayLabel(day)}</h2>
          {visits.length === 0 && <p className="muted">Sem visitas.</p>}
          {visits.map((v) => (
            <Link
              key={v.id}
              href={`/app/${org.organizationId}/ordens/${v.orderId}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div className="row spread">
                <strong>
                  {zonedTime(v.startsAt, tz)}–{zonedTime(v.endsAt, tz)} · {KIND_LABEL[v.kind]}
                </strong>
                <span className="badge">{APPT_STATUS[v.status]}</span>
              </div>
              <div>
                Ordem #{v.orderNumber} · {v.customerName}
              </div>
              <div className="muted">
                {v.street}
                {v.streetNumber ? `, ${v.streetNumber}` : ''} ·{' '}
                {[v.district, v.city].filter(Boolean).join(' · ')}
              </div>
              {org.role !== 'TECHNICIAN' && (
                <div className="muted">Técnico: {v.technicianName}</div>
              )}
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
