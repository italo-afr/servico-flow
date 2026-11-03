'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorAlert, Field, useAction } from '@/components/ui';
import { signIn } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction(async () => {
    await signIn(email, password);
    router.push('/app');
  });
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Entrar</h1>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run();
        }}
      >
        <ErrorAlert error={action.error} />
        <Field label="E-mail" name="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Senha" name="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" disabled={action.pending}>
          {action.pending ? 'Entrando…' : 'Entrar'}
        </button>
        <Link href="/esqueci-senha">Esqueci minha senha</Link>
      </form>
      <p className="muted">Acesso somente por convite da sua empresa.</p>
    </main>
  );
}
