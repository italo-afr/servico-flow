import { z } from 'zod';

/** Formato padrão de erro da API (brief 5.6). */
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  fields?: Record<string, string[]>;
}

export const uuidSchema = z.uuid();

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
