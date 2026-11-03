# Setup local

## Pré-requisitos

- Node.js 24 (ver `.nvmrc`) e pnpm 10.28 (`corepack enable`)
- PostgreSQL 16 com a extensão `btree_gist` — via Docker (abaixo) ou instalado localmente

## Passos

```bash
pnpm install --frozen-lockfile
```

```bash
docker compose -f infra/compose/docker-compose.dev.yml up -d
```

(Sobe PostgreSQL com os bancos `servicoflow_dev` e `servicoflow_test`, e Mailpit em http://localhost:8025. **Não verificado no ambiente onde o projeto foi construído, que não tinha Docker**; lá foi usado PostgreSQL 16 local com os mesmos bancos.)

```bash
cp .env.example .env
```

Gere os segredos e cole em `.env`:

```bash
openssl rand -hex 32
```

(`SESSION_SECRET` e `TOKEN_PAYLOAD_ENCRYPTION_KEY`, um valor diferente para cada.)

Sem Docker/Mailpit, deixe `SMTP_URL=` vazio: os e-mails vão para arquivos em `.local-mail/`.

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Cria duas empresas **fictícias** e contas com senha `demo-senha-123` (ex.: `beto@clima-norte.example.com`, atendente). Recusa `APP_ENV=production|staging`.

```bash
pnpm dev
```

Web em http://localhost:3000 (API em :3001, acessada pela web via `/api`). Em outro terminal, o worker:

```bash
pnpm --filter @servicoflow/api dev:worker
```

## Criar uma empresa real (controlado)

```bash
pnpm --filter @servicoflow/api org:create -- --name "Nome da Empresa" --admin-email pessoa@dominio.com
```

## Verificações

| Comando                 | O que faz                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | ESLint em todos os pacotes                                                                                     |
| `pnpm typecheck`        | `tsc --noEmit`                                                                                                 |
| `pnpm test:unit`        | regras puras (estados, dinheiro, política, backoff, cripto)                                                    |
| `pnpm test:integration` | API + PostgreSQL real em `TEST_DATABASE_URL` (precisa terminar em `_test`; o schema é **apagado**)             |
| `pnpm test:e2e`         | Playwright: sobe API (:3101) e web (:3100) contra `servicoflow_e2e` (recriado) e percorre a jornada no celular |
| `pnpm build`            | build de contracts, API e web                                                                                  |

Massa sintética para carga (só local/test/ci):

```bash
pnpm --filter @servicoflow/api exec tsx --env-file=../../.env src/db/synthetic-cli.ts
```
