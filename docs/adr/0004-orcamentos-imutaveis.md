# ADR-0004 — Orçamentos imutáveis e decisão idempotente

**Status:** aceito · 2026-11-03

**Decisão.**

- Valores em centavos (`bigint`), cálculo só no servidor (`quotes/money.ts`); limites garantem inteiro seguro em JS.
- Ao enviar, a versão ganha `snapshot` (cliente, endereço, equipamento, itens, totais) e fica imutável — reforçado por **triggers** que recusam alterar itens/valores de orçamento não-rascunho.
- Índice único parcial: no máximo uma versão `DRAFT`/`SENT` por ordem.
- Link: token de 256 bits no **fragmento** da URL (`#token=`), só o SHA-256 no banco; o bruto vai cifrado (AES-256-GCM) na outbox e é apagado após o envio. A página troca o token por cookie `HttpOnly` de 30 min, limitado ao orçamento, e remove o fragmento do histórico. `Referrer-Policy: no-referrer`; sem scripts de terceiros.
- `GET` nunca decide. Decisão: `POST` com `confirm: true`, `SELECT … FOR UPDATE` no orçamento, validade conferida no momento da decisão, repetição da mesma decisão devolve o recibo (sem novos efeitos), decisão diferente → 409.
- Revisão: na mesma transação, versão anterior `SUPERSEDED`, tokens revogados, sessões de acesso apagadas, reserva de execução cancelada, ordem volta à triagem e nasce rascunho N+1.
- Limite de taxa das rotas públicas é **em memória por processo** (adequado a uma instância de API).

**Consequências e limites.** Se o cliente não usa e-mail (hipótese H6), não há canal alternativo nesta versão. O aceite é registro operacional, não assinatura com validade jurídica.

**Verificação.** `quotes.test.ts`: T05–T09, snapshot, imutabilidade na API e no banco. O T08 revelou um CHECK incorreto (orçamento aceito não podia ser substituído), corrigido na migration 0005.

**Gatilho de revisão.** Mais de uma instância de API (limite de taxa precisa ir para o banco/Redis); necessidade de envio por outros canais.
