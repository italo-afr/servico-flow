'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorAlert, Field, takeHashToken, useAction } from '@/components/ui';
import { resetPassword } from '@/lib/auth';

export default function ResetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => setToken(takeHashToken()), []);
  const action = useAction(async () => {
    if (!token) return;
    await resetPassword(token, password);
    setDone(true);
  });
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Nova senha</h1>
      {done ? (
        <div className="alert success">
          Senha alterada. Sessões anteriores foram encerradas. <Link href="/login">Entrar</Link>
        </div>
      ) : !token ? (
        <div className="alert error">Link inválido. Solicite um novo em “Esqueci minha senha”.</div>
      ) : (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run();
          }}
        >
          <ErrorAlert error={action.error} />
          <Field label="Nova senha" name="newPassword" hint="Mínimo de 10 caracteres.">
            <input
              id="newPassword"
              type="password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button disabled={action.pending}>Salvar senha</button>
        </form>
      )}
    </main>
  );
}
