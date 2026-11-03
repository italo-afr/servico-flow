'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { getMe, signOut, type Me, type MeMembership } from '@/lib/auth';
import { ErrorAlert, ROLE_LABEL } from './ui';

interface OrgCtx {
  me: Me;
  org: MeMembership;
  /** Monta URL da API escopada na empresa atual. */
  path: (p: string) => string;
}
const Ctx = createContext<OrgCtx | null>(null);
export function useOrg(): OrgCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useOrg fora de OrgShell');
  return c;
}

const NAV: { href: string; label: string; roles: string[] }[] = [
  { href: '', label: 'Painel', roles: ['ADMIN', 'ATTENDANT'] },
  { href: '/ordens', label: 'Ordens', roles: ['ADMIN', 'ATTENDANT'] },
  { href: '/clientes', label: 'Clientes', roles: ['ADMIN', 'ATTENDANT'] },
  { href: '/agenda', label: 'Agenda', roles: ['ADMIN', 'ATTENDANT'] },
  { href: '/minhas-visitas', label: 'Minhas visitas', roles: ['TECHNICIAN', 'ADMIN'] },
  { href: '/equipe', label: 'Equipe', roles: ['ADMIN'] },
  { href: '/operacao', label: 'Operação', roles: ['ADMIN'] },
];

export function OrgShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiRequestError && e.status === 401) router.replace('/login');
        else setError(e);
      });
  }, [router]);
  if (error)
    return (
      <main>
        <ErrorAlert error={error} />
      </main>
    );
  if (!me)
    return (
      <main>
        <p className="muted">Carregando…</p>
      </main>
    );
  const org = me.memberships.find((m) => m.organizationId === params.orgId);
  if (!org) {
    return (
      <main>
        <div className="alert error">Você não tem acesso a esta empresa.</div>
        <Link href="/app">Escolher empresa</Link>
      </main>
    );
  }
  const base = `/app/${org.organizationId}`;
  return (
    <Ctx.Provider
      value={{ me, org, path: (p) => `/api/v1/organizations/${org.organizationId}${p}` }}
    >
      {org.isDemo && <div className="demo-banner">Ambiente de demonstração — dados fictícios</div>}
      <header className="topbar">
        <nav aria-label="Principal">
          <strong>{org.organizationName}</strong>
          {NAV.filter((n) => n.roles.includes(org.role)).map((n) => {
            const href = base + n.href;
            const active = n.href ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                key={n.href}
                href={href}
                aria-current={active ? 'page' : undefined}
                style={active ? { textDecoration: 'underline' } : undefined}
              >
                {n.label}
              </Link>
            );
          })}
          <span className="muted hide-mobile" style={{ marginLeft: 'auto' }}>
            {me.user.name} · {ROLE_LABEL[org.role]}
          </span>
          {me.memberships.length > 1 && <Link href="/app">Trocar empresa</Link>}
          <button
            className="secondary"
            onClick={() => {
              void signOut().finally(() => router.replace('/login'));
            }}
          >
            Sair
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </Ctx.Provider>
  );
}
