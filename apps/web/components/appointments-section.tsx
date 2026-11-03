'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useOrg } from './org';
import type { OrderDetail } from './order-sections';
import { ErrorAlert, Field, useAction } from './ui';
import { api } from '@/lib/api';
import { addDays, zonedDate, zonedTime, zonedToIso } from '@/lib/time';

export interface Appointment {
  id: string;
  kind: 'DIAGNOSTIC' | 'EXECUTION';
  status: string;
  startsAt: string;
  endsAt: string;
  version: number;
  technicianUserId: string;
  technicianName: string;
  reportSummary?: string | null;
}
export const KIND_LABEL = { DIAGNOSTIC: 'Diagnóstico', EXECUTION: 'Execução' } as const;
export const APPT_STATUS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

interface Tech {
  membershipId: string;
  userId: string;
  name: string;
  role: string;
}

function SlotFields({
  tz,
  value,
  onChange,
}: {
  tz: string;
  value: { date: string; time: string; minutes: string };
  onChange: (v: typeof value) => void;
}) {
  return (
    <div className="grid2">
      <div>
        <label htmlFor="date">Data</label>
        <input
          id="date"
          type="date"
          required
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="time">Início ({tz})</label>
        <input
          id="time"
          type="time"
          required
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="minutes">Duração</label>
        <select
          id="minutes"
          value={value.minutes}
          onChange={(e) => onChange({ ...value, minutes: e.target.value })}
        >
          {[30, 60, 90, 120, 180, 240, 360, 480].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const toRange = (v: { date: string; time: string; minutes: string }, tz: string) => {
  const startsAt = zonedToIso(v.date, v.time, tz);
  return {
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + Number(v.minutes) * 60_000).toISOString(),
  };
};

export function AppointmentsSection({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { org, path, me } = useOrg();
  const tz = org.timezone;
  const list = (order.appointments as Appointment[] | undefined) ?? [];
  const isManager = org.role !== 'TECHNICIAN';
  const [techs, setTechs] = useState<Tech[]>([]);
  const [booking, setBooking] = useState<'DIAGNOSTIC' | 'EXECUTION' | null>(null);
  const [techId, setTechId] = useState('');
  const [slot, setSlot] = useState({
    date: addDays(zonedDate(Date.now(), tz), 1),
    time: '09:00',
    minutes: '60',
  });
  const [resched, setResched] = useState<Appointment | null>(null);
  const [summary, setSummary] = useState('');
  useEffect(() => {
    if (isManager)
      void api<{ items: Tech[] }>(path('/technicians')).then((r) => {
        setTechs(r.items);
        setTechId(r.items[0]?.membershipId ?? '');
      });
  }, [isManager, path]);
  const act = useAction(async (url: string, json: object = {}) => {
    await api(path(url), { method: 'POST', json });
    setBooking(null);
    setResched(null);
    setSummary('');
    reload();
  });
  const canDiagnose = ['OPEN', 'TRIAGE'].includes(order.status);
  const canExecute = order.status === 'APPROVED';
  return (
    <div className="card stack">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Visitas</h2>
        {isManager && (
          <div className="row">
            {canDiagnose && (
              <button className="secondary" onClick={() => setBooking('DIAGNOSTIC')}>
                Agendar diagnóstico
              </button>
            )}
            {canExecute && (
              <button onClick={() => setBooking('EXECUTION')}>Agendar execução</button>
            )}
          </div>
        )}
      </div>
      {/* Conflito de agenda: formulário é preservado e a mensagem não revela outra visita. */}
      <ErrorAlert error={act.error} />
      {booking && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act.run(`/orders/${order.id}/appointments`, {
              technicianMembershipId: techId,
              kind: booking,
              ...toRange(slot, tz),
            });
          }}
        >
          <strong>{KIND_LABEL[booking]}</strong>
          <Field label="Técnico" name="technicianMembershipId" error={act.error}>
            <select
              id="technicianMembershipId"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
            >
              {techs.map((t) => (
                <option key={t.membershipId} value={t.membershipId}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <SlotFields tz={tz} value={slot} onChange={setSlot} />
          <div className="row">
            <button disabled={act.pending}>Confirmar</button>
            <button type="button" className="secondary" onClick={() => setBooking(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {list.length === 0 && <p className="muted">Nenhuma visita agendada.</p>}
      {list.map((a) => {
        const mine = a.technicianUserId === me.user.id;
        return (
          <div key={a.id} className="card" style={{ marginBottom: 0 }}>
            <div className="row spread">
              <strong>
                {KIND_LABEL[a.kind]} ·{' '}
                {new Date(a.startsAt).toLocaleDateString('pt-BR', { timeZone: tz })}{' '}
                {zonedTime(a.startsAt, tz)}–{zonedTime(a.endsAt, tz)}
              </strong>
              <span className="badge">{APPT_STATUS[a.status]}</span>
            </div>
            <p className="muted">Técnico: {a.technicianName}</p>
            {a.reportSummary && <p>Relatório: {a.reportSummary}</p>}
            {isManager && a.status === 'SCHEDULED' && resched?.id !== a.id && (
              <div className="row">
                <button
                  className="secondary"
                  onClick={() => {
                    setResched(a);
                    setSlot({
                      date: zonedDate(a.startsAt, tz),
                      time: zonedTime(a.startsAt, tz),
                      minutes: String(
                        (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000,
                      ),
                    });
                  }}
                >
                  Reagendar
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    const reason = prompt('Motivo do cancelamento da visita:');
                    if (reason) void act.run(`/appointments/${a.id}/cancel`, { reason });
                  }}
                >
                  Cancelar visita
                </button>
              </div>
            )}
            {resched?.id === a.id && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act.run(`/appointments/${a.id}/reschedule`, {
                    version: a.version,
                    ...toRange(slot, tz),
                  });
                }}
              >
                <SlotFields tz={tz} value={slot} onChange={setSlot} />
                <div className="row">
                  <button disabled={act.pending}>Salvar novo horário</button>
                  <button type="button" className="secondary" onClick={() => setResched(null)}>
                    Voltar
                  </button>
                </div>
              </form>
            )}
            {mine && a.status === 'SCHEDULED' && (
              <button onClick={() => void act.run(`/appointments/${a.id}/start`)}>
                Iniciar visita
              </button>
            )}
            {mine && a.status === 'IN_PROGRESS' && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act.run(`/appointments/${a.id}/complete`, { summary });
                }}
              >
                <Field
                  label={a.kind === 'DIAGNOSTIC' ? 'Achados do diagnóstico' : 'O que foi feito'}
                  name="summary"
                  error={act.error}
                >
                  <textarea
                    id="summary"
                    required
                    minLength={5}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </Field>
                <button disabled={act.pending}>
                  {a.kind === 'DIAGNOSTIC' ? 'Concluir diagnóstico' : 'Concluir serviço'}
                </button>
              </form>
            )}
          </div>
        );
      })}
      {isManager && <Link href={`/app/${org.organizationId}/agenda`}>Ver agenda completa</Link>}
    </div>
  );
}
