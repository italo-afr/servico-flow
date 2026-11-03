import { invalid } from './errors.js';

/** Cursor opaco para paginação estável por (created_at DESC, id DESC). */
export interface Cursor {
  t: string;
  id: string;
}
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}
export function decodeCursor(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;
    if (typeof c.t !== 'string' || typeof c.id !== 'string' || Number.isNaN(Date.parse(c.t)))
      throw new Error();
    return c;
  } catch {
    throw invalid('Cursor de paginação inválido.');
  }
}
export function pageOf<T extends { createdAt: Date | string; id: string }>(
  rows: T[],
  limit: number,
) {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: new Date(last.createdAt).toISOString(), id: last.id })
        : null,
  };
}
