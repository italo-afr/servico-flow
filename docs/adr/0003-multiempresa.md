# ADR-0003 — Isolamento multiempresa e integridade das referências

**Status:** aceito · 2026-11-03

**Contexto.** US-01/T01/T02: trocar IDs em URL ou corpo não pode expor nem associar dados de outra empresa.

**Decisão.** Três camadas:

1. **Contexto validado no servidor:** `:orgId` da URL é só um pedido; o `AccessGuard` exige associação `ACTIVE` e responde 404 (sem revelar existência).
2. **Consultas sempre com `organization_id`** obtido do membro autenticado, nunca do corpo.
3. **FKs compostas** `(organization_id, id)` e, para endereço/equipamento, `(organization_id, customer_id, id)` — o banco recusa ordem com endereço de outro cliente ou outra empresa mesmo se a aplicação falhar.

RLS (row-level security) **não** foi adotado nesta versão: exigiria contexto por transação compatível com o pool e testes com a role real. Fica como defesa adicional futura.

**Verificação.** `orders.test.ts` (T01, T02 pela API e direto no banco), `attachments.test.ts` (T18), `identity.test.ts`.

**Gatilho de revisão.** Antes de abrir para empresas reais em maior número, avaliar RLS como segunda barreira.
