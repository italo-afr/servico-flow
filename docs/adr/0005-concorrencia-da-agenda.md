# ADR-0005 — Constraint de exclusão para a agenda

**Status:** aceito · 2026-11-03

**Contexto.** "Checar e depois inserir" não impede duas reservas concorrentes (brief 5.3).

**Decisão.** `appointments.period` é coluna gerada `tstzrange(starts_at, ends_at, '[)')` e
`EXCLUDE USING gist (technician_user_id WITH =, period WITH &&) WHERE status IN ('SCHEDULED','IN_PROGRESS')`
(extensão `btree_gist`). A constraint **não inclui `organization_id`**: o técnico é capacidade exclusiva em todas as empresas. Violação (`23P01`) vira 409 com mensagem genérica, sem dados da outra reserva. Índice único parcial garante uma execução ativa por ordem. Reagendar é um `UPDATE` único — o banco valida o novo intervalo atomicamente.

**Verificação.** `scheduling.test.ts`: T10 (6 reservas concorrentes → 1 vence), T11 (adjacência e cancelamento), T12 (reagendamentos concorrentes; consulta confirma zero sobreposições), conflito entre empresas.

**Gatilho de revisão.** Provedor gerenciado sem `btree_gist` (alternativa: `pg_advisory_xact_lock` por técnico em todos os caminhos de escrita).
