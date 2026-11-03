'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorAlert, Field, ROLE_LABEL, takeHashToken, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { signIn } from '@/lib/auth';

interface Preview {
  organizationName: string;
  email: string;
  role: string;
  accountExists: boolean;
}

export default function InvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const load = useAction(async (t: string) =>
    setPreview(
      await api<Preview>('/api/v1/invitations/preview', { method: 'POST', json: { token: t } }),
    ),
  );
  useEffect(() => {
    const t = takeHashToken();
    setToken(t);
    if (t) void load.run(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const accept = useAction(async () => {
    if (!token || !preview) return;
    if (preview.accountExists) await signIn(preview.email, password);
    await api('/api/v1/invitations/accept', {
      method: 'POST',
      json: preview.accountExists ? { token } : { token, name, password },
    });
    if (!preview.accountExists) await signIn(preview.email, password);
    router.push('/app');
  });

  if (!token)
    return (
      <main>
        <div className="alert error">Link de convite inválido.</div>
      </main>
    );
  return (
    <main style={{ maxWidth: 460 }}>
      <h1>Convite</h1>
      <ErrorAlert error={load.error} />
      {preview && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void accept.run();
          }}
        >
          <p>
            Você foi convidado(a) para <strong>{preview.organizationName}</strong> como{' '}
            <strong>{ROLE_LABEL[preview.role] ?? preview.role}</strong>.
          </p>
          <p className="muted">Conta: {preview.email}</p>
          <ErrorAlert error={accept.error} />
          {!preview.accountExists && (
            <Field label="Seu nome" name="name" error={accept.error}>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
          )}
          <Field
            label={preview.accountExists ? 'Sua senha' : 'Crie uma senha'}
            name="password"
            error={accept.error}
            hint={preview.accountExists ? undefined : 'Mínimo de 10 caracteres.'}
          >
            <input
              id="password"
              type="password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={preview.accountExists ? 'current-password' : 'new-password'}
            />
          </Field>
          <button disabled={accept.pending}>
            {accept.pending ? 'Enviando…' : 'Aceitar convite'}
          </button>
          {preview.accountExists && <Link href="/esqueci-senha">Esqueci minha senha</Link>}
        </form>
      )}
    </main>
  );
}
