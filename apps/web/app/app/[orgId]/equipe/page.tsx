'use client';
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/org';
import { ErrorAlert, Field, ROLE_LABEL, useAction } from '@/components/ui';
import { api } from '@/lib/api';

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}
interface InviteRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function TeamPage() {
  const { path, me } = useOrg();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('TECHNICIAN');
  const [notice, setNotice] = useState('');
  const load = useAction(
    useCallback(async () => {
      const [m, i] = await Promise.all([
        api<{ items: MemberRow[] }>(path('/members')),
        api<{ items: InviteRow[] }>(path('/invitations')),
      ]);
      setMembers(m.items);
      setInvites(i.items);
    }, [path]),
  );
  useEffect(() => void load.run(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const invite = useAction(async () => {
    await api(path('/invitations'), { method: 'POST', json: { email, role } });
    setNotice(`Convite enviado para ${email}.`);
    setEmail('');
    await load.run();
  });
  const act = useAction(async (url: string, json?: unknown) => {
    await api(path(url), { method: 'POST', json: json ?? {} });
    await load.run();
  });
  return (
    <>
      <h1>Equipe</h1>
      <ErrorAlert error={load.error || act.error} />
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setNotice('');
          void invite.run();
        }}
      >
        <h2 style={{ marginTop: 0 }}>Convidar pessoa</h2>
        <ErrorAlert error={invite.error} />
        {notice && <div className="alert success">{notice}</div>}
        <div className="grid2">
          <Field label="E-mail" name="email" error={invite.error}>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Papel" name="role" error={invite.error}>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="TECHNICIAN">Técnico</option>
              <option value="ATTENDANT">Atendente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </Field>
        </div>
        <button disabled={invite.pending}>Enviar convite</button>
      </form>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Membros</h2>
        <table className="responsive">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.name} {m.status === 'REMOVED' && <span className="badge">removido</span>}
                </td>
                <td>{m.email}</td>
                <td>{ROLE_LABEL[m.role]}</td>
                <td>
                  {m.status === 'ACTIVE' && m.email !== me.user.email && (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (confirm(`Remover ${m.name} da equipe? O acesso termina imediatamente.`))
                          void act.run(`/members/${m.id}/remove`);
                      }}
                    >
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invites.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Convites pendentes</h2>
          {invites.map((i) => (
            <div key={i.id} className="row spread" style={{ padding: '6px 0' }}>
              <span>
                {i.email} · {ROLE_LABEL[i.role]} · expira{' '}
                {new Date(i.expiresAt).toLocaleDateString('pt-BR')}
              </span>
              <button
                className="secondary"
                onClick={() => void act.run(`/invitations/${i.id}/revoke`)}
              >
                Revogar
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
