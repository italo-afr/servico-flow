'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorAlert, ROLE_LABEL } from '@/components/ui';
import { ApiRequestError } from '@/lib/api';
import { getMe, type Me } from '@/lib/auth';

export default function ChooseOrg() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    getMe()
      .then((m) => {
        const only = m.memberships[0];
        if (m.memberships.length === 1 && only) {
          router.replace(
            `/app/${only.organizationId}${only.role === 'TECHNICIAN' ? '/minhas-visitas' : ''}`,
          );
        } else setMe(m);
      })
      .catch((e: unknown) =>
        e instanceof ApiRequestError && e.status === 401 ? router.replace('/login') : setError(e),
      );
  }, [router]);
  return (
    <main style={{ maxWidth: 520 }}>
      <h1>Escolha a empresa</h1>
      <ErrorAlert error={error} />
      {me && me.memberships.length === 0 && (
        <p>Sua conta não está associada a nenhuma empresa ativa.</p>
      )}
      {me?.memberships.map((m) => (
        <Link
          key={m.organizationId}
          href={`/app/${m.organizationId}`}
          className="card"
          style={{ display: 'block', textDecoration: 'none' }}
        >
          <strong>{m.organizationName}</strong>{' '}
          <span className="muted">· {ROLE_LABEL[m.role]}</span>
        </Link>
      ))}
    </main>
  );
}
