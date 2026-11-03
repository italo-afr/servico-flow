/** Erro de domínio com código estável e status HTTP. Mensagem segura para o usuário. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') =>
  new AppError(404, 'NOT_FOUND', `${what} não encontrado.`);
export const forbidden = (msg = 'Você não tem permissão para esta ação.') =>
  new AppError(403, 'FORBIDDEN', msg);
export const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.');
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const invalid = (msg: string, fields?: Record<string, string[]>) =>
  new AppError(422, 'VALIDATION_FAILED', msg, fields);
