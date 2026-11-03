'use client';
import { useEffect, useState } from 'react';
import type { HealthResponse } from '@servicoflow/contracts';
import { api, ApiRequestError } from '@/lib/api';

/** Página técnica: prova o caminho navegador → /api → NestJS → PostgreSQL. */
export default function StatusPage() {
  const [state, setState] = useState<{ data?: HealthResponse; error?: string }>({});
  useEffect(() => {
    api<HealthResponse>('/api/v1/health/ready')
      .then((data) => setState({ data }))
      .catch((e: unknown) => {
        const body =
          e instanceof ApiRequestError ? (e.body as unknown as HealthResponse) : undefined;
        setState({
          data: body?.checks ? body : undefined,
          error: e instanceof Error ? e.message : 'erro',
        });
      });
  }, []);
  return (
    <main>
      <h1>Estado do sistema</h1>
      {!state.data && !state.error && <p className="muted">Verificando…</p>}
      {state.data && (
        <div className="card" data-testid="health">
          <p>
            <strong>{state.data.status === 'ok' ? 'Pronto' : 'Indisponível'}</strong> — versão{' '}
            {state.data.release}
          </p>
          <ul>
            {Object.entries(state.data.checks).map(([k, v]) => (
              <li key={k}>
                {k}: {v === 'ok' ? 'ok' : 'falha'}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.error && !state.data && <div className="alert error">{state.error}</div>}
    </main>
  );
}
