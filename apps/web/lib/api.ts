import type { ApiError } from '@servicoflow/contracts';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
  }
}

/**
 * Chamada à API pela mesma origem (/api/...). Cookies de sessão vão automaticamente.
 * Nunca mostra sucesso sem resposta do servidor (brief 8.2).
 */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      credentials: 'same-origin',
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiRequestError(0, {
      code: 'NETWORK',
      message: 'Sem conexão com o servidor. A ação não foi enviada.',
      requestId: '-',
    });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as ApiError | null) ?? {
      code: 'HTTP_' + res.status,
      message: 'Erro inesperado.',
      requestId: res.headers.get('x-request-id') ?? '-',
    };
    throw new ApiRequestError(res.status, err);
  }
  return body as T;
}
