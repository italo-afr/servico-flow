'use client';
import { useOrg } from '@/components/org';

export default function Dashboard() {
  const { org } = useOrg();
  return <h1>Painel — {org.organizationName}</h1>;
}
