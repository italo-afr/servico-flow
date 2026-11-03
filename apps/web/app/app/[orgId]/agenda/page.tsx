'use client';
import { VisitList } from '@/components/visit-list';

export default function AgendaPage() {
  return <VisitList days={7} title="Agenda da semana" />;
}
