/**
 * Conversões com fuso IANA explícito da EMPRESA (não o do navegador) — brief 5.3.
 */
function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - utcMs;
}

/** "2026-11-05" + "14:30" no fuso da empresa → ISO UTC. Duas iterações cobrem horário de verão. */
export function zonedToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const naive = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  let utc = naive - offsetMs(naive, timeZone);
  utc = naive - offsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** Data (AAAA-MM-DD) de um instante no fuso da empresa. */
export function zonedDate(iso: string | number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
export function zonedTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}
