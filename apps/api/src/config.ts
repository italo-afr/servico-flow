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
  // Porta INTERNA de métricas Prometheus (0 desliga). Nunca publicar no proxy.
  METRICS_PORT: z.coerce.number().int().min(0).max(65535).default(9464),
  WORKER_METRICS_PORT: z.coerce.number().int().min(0).max(65535).default(9465),
  // Destino dos alertas operacionais do avaliador embutido (opcional).
  OPS_ALERT_EMAIL: z
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.local-storage'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
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
  const c = parsed.data;
  if (c.APP_ENV === 'production' && c.STORAGE_DRIVER !== 's3') {
    throw new ConfigError(
      'Configuração inválida: STORAGE_DRIVER=s3 é obrigatório em produção (disco do container é efêmero).',
    );
  }
  if (
    c.STORAGE_DRIVER === 's3' &&
    (!c.STORAGE_BUCKET || !c.STORAGE_ACCESS_KEY_ID || !c.STORAGE_SECRET_ACCESS_KEY)
  ) {
    throw new ConfigError(
      'Configuração inválida: STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID e STORAGE_SECRET_ACCESS_KEY são obrigatórias com STORAGE_DRIVER=s3.',
    );
  }
  return c;
}
