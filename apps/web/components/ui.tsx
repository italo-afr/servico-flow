'use client';
import { useState } from 'react';
import { ApiRequestError } from '@/lib/api';

/** Mostra a mensagem do servidor e o código de suporte (requestId). */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : 'Erro inesperado.';
  const requestId = error instanceof ApiRequestError ? error.body.requestId : undefined;
  return (
    <div className="alert error" role="alert">
      {msg}
      {requestId && requestId !== '-' && (
        <div className="muted" style={{ fontSize: '0.8rem' }}>
          Código para suporte: {requestId}
        </div>
      )}
    </div>
  );
}

export function fieldErrors(error: unknown, name: string): string[] | undefined {
  return error instanceof ApiRequestError ? error.body.fields?.[name] : undefined;
}

export function Field(props: {
  label: string;
  name: string;
  error?: unknown;
  children: React.ReactElement;
  hint?: string;
}) {
  const errs = fieldErrors(props.error, props.name);
  return (
    <div>
      <label htmlFor={props.name}>{props.label}</label>
      {props.children}
      {props.hint && (
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {props.hint}
        </div>
      )}
      {errs?.map((e) => (
        <div key={e} className="field-error">
          {e}
        </div>
      ))}
    </div>
  );
}

/** Executa uma ação assíncrona com estado de envio e erro; nunca indica sucesso sem resposta. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function run(...args: A): Promise<R | undefined> {
    setPending(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, setError };
}

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ATTENDANT: 'Atendente',
  TECHNICIAN: 'Técnico',
};

/** Lê `token` do fragmento da URL e o remove do histórico (brief 7.4). */
export function takeHashToken(): string | null {
  if (typeof window === 'undefined') return null;
  const m = /token=([^&]+)/.exec(window.location.hash);
  if (!m?.[1]) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return decodeURIComponent(m[1]);
}
