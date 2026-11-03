'use client';
import { useState } from 'react';
import { useOrg } from './org';
import { ErrorAlert, useAction } from './ui';
import { api } from '@/lib/api';

interface Suggestion {
  category: string;
  questions: string[];
  needsHumanReview: boolean;
  reasonForReview: string | null;
}
const CATEGORY: Record<string, string> = {
  INSUFFICIENT_COOLING: 'Refrigeração insuficiente',
  WATER_LEAK: 'Vazamento de água',
  NOISE: 'Ruído',
  NOT_TURNING_ON: 'Não liga',
  BAD_SMELL: 'Cheiro',
  ERROR_CODE: 'Código de erro',
  PREVENTIVE_MAINTENANCE: 'Manutenção preventiva',
  INSTALLATION: 'Instalação',
  UNKNOWN: 'Não identificado',
};

/** Experimental (ADR-0010): sugestão por regras; nunca preenche nada sozinha. */
export function TriageHint({ description }: { description: string }) {
  const { me, path } = useOrg();
  const [s, setS] = useState<Suggestion | null>(null);
  const run = useAction(async () =>
    setS(await api<Suggestion>(path('/triage/suggest'), { method: 'POST', json: { description } })),
  );
  if (!me.features?.triageSuggestions) return null;
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <button
        type="button"
        className="secondary"
        disabled={description.trim().length < 3 || run.pending}
        onClick={() => void run.run()}
      >
        Sugerir triagem
      </button>
      <ErrorAlert error={run.error} />
      {s && (
        <div style={{ marginTop: 8 }}>
          <p>
            <strong>{CATEGORY[s.category] ?? s.category}</strong>{' '}
            <span className="badge">sugestão por regras · revise</span>
          </p>
          {s.reasonForReview && <p className="muted">{s.reasonForReview}</p>}
          {s.questions.length > 0 && (
            <>
              <p className="muted" style={{ marginBottom: 4 }}>
                Pergunte ao cliente:
              </p>
              <ul>
                {s.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          )}
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Classificação de atendimento; não é diagnóstico técnico.
          </p>
        </div>
      )}
    </div>
  );
}
