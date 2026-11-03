import type { ApiError } from '@servicoflow/contracts';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
  }
}

/** Mensagens da biblioteca de autenticação (em inglês) traduzidas para a interface. */
const AUTH_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  EMAIL_NOT_VERIFIED: 'Conta ainda não ativada. Use o link do convite recebido por e-mail.',
  INVALID_TOKEN: 'Link inválido ou expirado. Solicite um novo.',
  PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 10 caracteres.',
  PASSWORD_TOO_LONG: 'Senha longa demais.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
};

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
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    if (body && typeof body === 'object') {
      const b = body as Partial<ApiError>;
      const pt =
        (b.code && AUTH_MESSAGES[b.code]) ||
        (res.status === 429 ? AUTH_MESSAGES.TOO_MANY_REQUESTS : undefined);
      if (pt)
        body = {
          ...b,
          code: b.code ?? 'TOO_MANY_REQUESTS',
          message: pt,
          requestId: b.requestId ?? res.headers.get('x-request-id') ?? '-',
        };
    }
    const err = (body as ApiError | null) ?? {
      code: 'HTTP_' + res.status,
      message: 'Erro inesperado.',
      requestId: res.headers.get('x-request-id') ?? '-',
    };
    throw new ApiRequestError(res.status, err);
  }
  return body as T;
}
