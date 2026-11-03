# ADR-0008 — Hospedagem, backups e restauração (proposta, não executada)

**Status:** proposto · 2026-11-03 — **nenhum serviço contratado; nada publicado.**

**Proposta.** VPS Linux com Docker Compose (`infra/deploy/docker-compose.prod.yml`): Caddy (TLS automático) → web e API; worker; migration como tarefa única por release. PostgreSQL **gerenciado** com backup automático (retenção proposta 14 dias) e storage S3-compatível privado com versionamento. RPO proposto ≤ 24 h, RTO ≤ 4 h (objetivos, não garantias).

**Ensaio local realizado.** `pg_dump -Fc` (≈1,9 MB, 0,35 s) → `pg_restore` em banco isolado (0,91 s) com 10 mil ordens sintéticas: contagens e totais idênticos, zero referências órfãs, API sobe e login funciona. Ver `docs/evidence/2026-11-03-local.md`.

**Pendente.** Escolha de provedores com preços consultados (`docs/costs.md`), domínio, conta de e-mail transacional, ensaio de restauração no provedor real e de objetos do storage.

**Gatilho de revisão.** Orçamento definido pelo responsável ou exigência de RPO menor (PITR).
