'use client';
import { useState } from 'react';
import { ErrorAlert, Field, useAction } from '@/components/ui';
import { requestReset } from '@/lib/auth';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const action = useAction(async () => {
    await requestReset(email);
    setDone(true);
  });
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Recuperar acesso</h1>
      {done ? (
        // Mesma mensagem exista ou não a conta (não revela cadastro).
        <div className="alert success">
          Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.
        </div>
      ) : (
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
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <button disabled={action.pending}>Enviar link</button>
        </form>
      )}
    </main>
  );
}
