/** Log estruturado em JSON (uma linha por evento). Nunca registre tokens, senhas ou dados pessoais. */
type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.APP_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    release: process.env.RELEASE_SHA ?? 'dev',
    ...fields,
  });
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
}
