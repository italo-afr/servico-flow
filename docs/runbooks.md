# Runbooks

Cada item: **acesso necessário → diagnóstico → ação → verificação → comunicação**. Comandos assumem a VPS do ADR-0008 (ainda não provisionada); ajuste ao provedor real.

### 1. Aplicação indisponível

Acesso: SSH na VPS. Diagnóstico: `docker compose ps`; `curl -s https://$APP_DOMAIN/api/v1/health/live` e `/ready`; `docker compose logs --since 15m api proxy`. Ação: `ready` 503 com `database: fail` → item 2; container parado → `docker compose up -d api`; certificado → logs do Caddy (DNS, portas 80/443). Verificação: `ready` 200 e login de conta controlada. Comunicar o responsável com horário de início/fim.

### 2. Erros de banco ou pool esgotado

Diagnóstico: logs `db_pool_error`/`unhandled_error`; no banco, `SELECT state, count(*) FROM pg_stat_activity GROUP BY 1`. Ação: identificar consultas longas (`pg_stat_activity` por `query_start`), encerrar a ofensora (`pg_cancel_backend`), reduzir `DATABASE_POOL_MAX` se a soma dos pools passar do limite do plano. Verificação: latência normal e `ready` 200.

### 3. Fila acumulada / provedor de e-mail fora

Diagnóstico: página **Operação** (heartbeat, pendente mais antigo, falhas) ou `SELECT status, count(*), min(created_at) FROM outbox_events GROUP BY 1`; `last_error` dos eventos. Ação: worker sem heartbeat → `docker compose restart worker`; provedor fora → aguardar (o backoff segura as tentativas; nada se perde); credencial inválida → corrigir segredo e reiniciar. **Não reprocessar em massa sem analisar**: reenviar pode duplicar e-mails (ADR-0006). Reprocessar falhas uma a uma pelo painel (auditado).

### 4. Migration falhou

A migration roda em transação: falha não deixa estado parcial nem registro em `schema_migrations`. Ação: ler o erro (`docker compose run --rm migrate`), corrigir com **nova** migration (arquivos aplicados nunca são editados — o checksum impede). Não publicar a nova imagem da API até a migration passar.

### 5. Reverter versão da aplicação

`export IMAGE_TAG=<sha anterior>` e `docker compose up -d api worker web`. Rollback de imagem **não desfaz migrations**: só reverter se o código anterior é compatível com o schema atual (migrations são aditivas em etapas, brief 11.6). Verificação: smoke de login, abrir ordem de teste.

### 6. Restaurar banco e objetos

Decisão do responsável (perde dados posteriores ao ponto restaurado). Restaurar primeiro em banco **isolado** com `scripts/restore-check.sh` (suprime notificações pendentes antigas), conferir contagens/totais/órfãs, só então apontar a aplicação. Objetos: restaurar versões do bucket; conferir que `attachments.object_key` READY existem. Liberar o worker conscientemente após reconciliar.

### 7. Rotacionar segredo e invalidar sessões

`SESSION_SECRET`: trocar no arquivo de segredos e reiniciar; para encerrar todas as sessões, `DELETE FROM "session";`. `TOKEN_PAYLOAD_ENCRYPTION_KEY`: payloads pendentes cifrados com a chave antiga falham (`decrypt_failed`); reenvie convites/orçamentos afetados. Credenciais de storage/e-mail: gerar nova no provedor, trocar, revogar a antiga.

### 8. Suspeita de acesso indevido entre empresas

Preservar evidências (logs, `audit_events` por `organization_id` e período, `access_denied`/`db_constraint` nos logs). Conter: remover a associação suspeita (efeito imediato) e encerrar sessões do usuário (`DELETE FROM "session" WHERE "userId" = …`). Reproduzir com teste automatizado antes de corrigir. Comunicar o responsável; avaliar obrigação de comunicar titulares (decisão jurídica, fora deste documento).

### 9. Disco cheio ou custo inesperado

`df -h`; `docker system df`; logs têm rotação (10 MB × 5 por serviço). Limpar imagens antigas mantendo a anterior. Custo: comparar com `docs/costs.md`; olhar volume do storage (uploads abandonados são limpos a cada minuto pelo worker) e de e-mails.

### 10. Exportação/exclusão de dados

Exportação de um cliente final: consultar `customers`, `service_addresses`, `equipment`, `service_orders`, `quotes.snapshot`, fotos. Exclusão: arquivar cadastro e, se exigido, anonimizar campos pessoais (`name`, `phone`, `email`, endereço) mantendo IDs e valores; snapshots de orçamento e fotos precisam de decisão explícita do responsável. Registrar a ação em auditoria.
