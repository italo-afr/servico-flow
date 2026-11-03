import { z } from 'zod';

/**
 * Configuração validada na inicialização (brief 11.4).
 * Falha com mensagem que lista apenas NOMES de variáveis, nunca valores.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'test', 'ci', 'staging', 'demo', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  PUBLIC_APP_URL: z.url(),
  SESSION_SECRET: z.string().min(32, 'deve ter pelo menos 32 caracteres'),
  TOKEN_PAYLOAD_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'deve ser 32 bytes em hexadecimal (64 caracteres)'),
  EMAIL_FROM: z.string().min(3).default('ServiçoFlow <nao-responda@servicoflow.local>'),
  SMTP_URL: z.string().optional(),
  EMAIL_ALLOWED_RECIPIENTS: z.string().optional(),
  RELEASE_SHA: z.string().default('dev'),
  AUTH_RATE_LIMIT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type AppConfig = z.infer<typeof schema>;

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(
      `Configuração inválida ou ausente:\n${lines.join('\n')}\nVeja .env.example e docs/setup.md.`,
    );
  }
  return parsed.data;
}
