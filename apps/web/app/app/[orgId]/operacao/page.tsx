'use client';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { ErrorAlert, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/labels';

interface Ops {
  counts: Record<string, number>;
  oldestPendingSeconds: number | null;
  workerLastSeenAt: string | null;
  failed: {
    id: string;
    type: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
    recipient: string | null;
  }[];
}

export default function OpsPage() {
  const { org, path } = useOrg();
  const [d, setD] = useState<Ops | null>(null);
  const load = useAction(
    useCallback(async () => setD(await api<Ops>(path('/ops/outbox'))), [path]),
  );
  useEffect(() => void load.run(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = useAction(async (id: string) => {
    await api(path(`/ops/outbox/${id}/retry`), { method: 'POST', json: {} });
    await load.run();
  });
  const workerAge = d?.workerLastSeenAt
    ? (Date.now() - new Date(d.workerLastSeenAt).getTime()) / 1000
    : null;
  return (
    <>
      <h1>Operação — notificações</h1>
      <ErrorAlert error={load.error || retry.error} />
      {d && (
        <>
          <div className="grid2">
            <div className="card">
              <div className="muted">Worker</div>
              <strong>
                {workerAge === null
                  ? 'nunca visto'
                  : workerAge < 60
                    ? 'ativo'
                    : `sem sinal há ${Math.round(workerAge / 60)} min`}
              </strong>
            </div>
            <div className="card">
              <div className="muted">Pendente mais antigo</div>
              <strong>
                {d.oldestPendingSeconds === null
                  ? 'nenhum'
                  : `${Math.round(d.oldestPendingSeconds / 60)} min`}
              </strong>
            </div>
            {['PENDING', 'DONE', 'SUPPRESSED', 'FAILED'].map((s) => (
              <div className="card" key={s}>
                <div className="muted">
                  {
                    {
                      PENDING: 'Pendentes',
                      DONE: 'Aceitos pelo provedor',
                      SUPPRESSED: 'Suprimidos/bloqueados',
                      FAILED: 'Falha definitiva',
                    }[s]
                  }
                </div>
                <strong>{d.counts[s] ?? 0}</strong>
              </div>
            ))}
          </div>
          <p className="muted">
            “Aceito pelo provedor” não comprova entrega na caixa do destinatário (sem callbacks de
            entrega nesta versão).
          </p>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Falhas definitivas</h2>
            {d.failed.length === 0 && <p className="muted">Nenhuma.</p>}
            {d.failed.map((e) => (
              <div key={e.id} className="row spread" style={{ padding: '6px 0' }}>
                <span>
                  #{e.id} · {e.type} · {e.recipient} · {e.attempts} tentativas · {e.lastError} ·{' '}
                  {dt(e.createdAt, org.timezone)}
                </span>
                <button
                  className="secondary"
                  onClick={() =>
                    confirm('Reprocessar esta notificação? A ação será auditada.') &&
                    void retry.run(e.id)
                  }
                >
                  Reprocessar
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
