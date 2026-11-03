# ADR-0006 — Outbox transacional e limites da entrega de e-mail

**Status:** aceito · 2026-11-03

**Decisão.** Eventos (`outbox_events`) são gravados na mesma transação da mudança de negócio. O worker adquire lotes com `FOR UPDATE SKIP LOCKED`, marca _lease_ de 120 s, envia **fora** da transação com timeout de 15 s, e só atualiza o evento se ainda for o dono do lease. Falha transitória: backoff exponencial limitado a 1 h com jitter, até 8 tentativas; falha permanente (SMTP 5xx) ou esgotamento → `FAILED`, visível no painel e reprocessável (auditado). Eventos obsoletos (convite revogado, orçamento substituído) são suprimidos. Fora de produção (e sempre em demo), só destinatários de `EMAIL_ALLOWED_RECIPIENTS` recebem.

**Limite essencial (T16).** Se o processo morrer depois de o provedor aceitar o e-mail e antes do registro em `notification_deliveries`, o evento será reenviado quando o lease vencer → **e-mail duplicado possível**. O worker envia `X-Idempotency-Key` estável por evento; só elimina a duplicação se o provedor escolhido honrar esse cabeçalho (a confirmar na escolha do provedor). O estado comercial não é afetado (é idempotente por si). "Aceito pelo provedor" não prova entrega na caixa; não há callbacks de bounce nesta versão.

**Verificação.** `outbox.test.ts`: T14, T15, SKIP LOCKED concorrente, retry, supressão, T25. T16 documentado, não simulado contra provedor real.
