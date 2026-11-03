import { betterAuth } from 'better-auth';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/pool.js';
import { enqueue } from '../notifications/outbox.js';

/**
 * Autenticação com better-auth (ADR-0002): sessões no PostgreSQL, revogáveis,
 * cookie HttpOnly. Cadastro público é bloqueado na borda HTTP (ver app.ts):
 * contas só nascem ao aceitar convite, criadas pelo servidor.
 */
export function createAuth(config: AppConfig, db: Db) {
  const secure = config.PUBLIC_APP_URL.startsWith('https://');
  return betterAuth({
    appName: 'ServiçoFlow',
    database: db,
    secret: config.SESSION_SECRET,
    baseURL: config.PUBLIC_APP_URL,
    basePath: '/api/auth',
    trustedOrigins: [new URL(config.PUBLIC_APP_URL).origin],
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: secure,
      cookiePrefix: 'sf',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 dias
      updateAge: 60 * 60 * 24, // renova no máximo 1x/dia
      // cookieCache desativado: toda requisição consulta o banco, revogação é imediata.
    },
    rateLimit: {
      enabled: config.AUTH_RATE_LIMIT,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 300, max: 3 },
        '/reset-password': { window: 300, max: 5 },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Resposta da API é a mesma exista ou não a conta; o e-mail sai pela outbox.
      sendResetPassword: async ({ user, token }) => {
        await enqueue(db, config.TOKEN_PAYLOAD_ENCRYPTION_KEY, {
          organizationId: null,
          type: 'auth.password_reset',
          payload: { userId: user.id, email: user.email },
          secret: {
            link: `${config.PUBLIC_APP_URL}/redefinir-senha#token=${encodeURIComponent(token)}`,
          },
        });
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
