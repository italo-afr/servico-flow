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

const NAV: { href: string; label: string; roles: string[]; icon: string }[] = [
  {
    href: '',
    label: 'Painel',
    roles: ['ADMIN', 'ATTENDANT'],
    icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
  },
  {
    href: '/ordens',
    label: 'Ordens',
    roles: ['ADMIN', 'ATTENDANT'],
    icon: 'M8 4h8l3 3v13H5V4zM9 11h6M9 15h6',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    roles: ['ADMIN', 'ATTENDANT'],
    icon: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  },
  {
    href: '/agenda',
    label: 'Agenda',
    roles: ['ADMIN', 'ATTENDANT'],
    icon: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  },
  {
    href: '/minhas-visitas',
    label: 'Minhas visitas',
    roles: ['TECHNICIAN', 'ADMIN'],
    icon: 'M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.500 7 11 7 11M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  },
  {
    href: '/equipe',
    label: 'Equipe',
    roles: ['ADMIN'],
    icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 19v-1a5 5 0 0 1 10 0v1M17 11a3 3 0 0 0 0-6M21 19v-1a5 5 0 0 0-3-4',
  },
  {
    href: '/operacao',
    label: 'Operação',
    roles: ['ADMIN'],
    icon: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6',
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase();
}

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
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon d="M4 12h4l3-7 4 14 3-7h2" />
            </span>
            ServiçoFlow
          </div>
          <div className="org-name">
            <small>Empresa</small>
            {org.organizationName}
          </div>
          <nav aria-label="Principal">
            {NAV.filter((n) => n.roles.includes(org.role)).map((n) => {
              const href = base + n.href;
              const active = n.href ? pathname.startsWith(href) : pathname === base;
              return (
                <Link
                  key={n.href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'active' : undefined}
                >
                  <Icon d={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <div className="user">
              <span className="avatar" aria-hidden="true">
                {initials(me.user.name)}
              </span>
              <div>
                <div className="user-name">{me.user.name}</div>
                <div className="user-role">{ROLE_LABEL[org.role]}</div>
              </div>
            </div>
            {me.memberships.length > 1 && <Link href="/app">Trocar empresa</Link>}
            <button
              className="secondary"
              onClick={() => {
                void signOut().finally(() => router.replace('/login'));
              }}
            >
              Sair
            </button>
          </div>
        </aside>
        <div className="content">
          {org.isDemo && (
            <div className="demo-banner">Ambiente de demonstração — dados fictícios</div>
          )}
          <main>{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
