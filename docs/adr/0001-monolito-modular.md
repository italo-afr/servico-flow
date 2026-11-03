# ADR-0001 — Monólito modular com processos de API e worker

**Status:** aceito · 2026-11-03

**Contexto.** Uma pessoa desenvolvendo, poucas empresas no piloto, fluxo com transações que cruzam ordem, orçamento e agenda (aceite muda orçamento e ordem juntos).

**Alternativas.** (a) Microserviços por domínio; (b) monólito único sem worker; (c) monólito modular com API + worker do mesmo código.

**Decisão.** (c). `apps/api` contém módulos (`identity`, `organizations`, `customers`, `orders`, `quotes`, `scheduling`, `attachments`, `notifications`, `ops`) que compartilham o PostgreSQL. O worker (`src/worker/main.ts`) é outro entrypoint do mesmo artefato.

**Consequências.** Transações locais garantem invariantes sem sagas. Módulos se comunicam por funções explícitas e _hooks_ (`onOrderCancelled`, `onQuoteRevised`, `orderDetailExtras`) em vez de alterar tabelas alheias diretamente. Escala vertical primeiro.

**Verificação.** Testes de integração exercitam transações entre módulos (T06–T13).

**Gatilho de revisão.** Equipes diferentes precisando publicar módulos de forma independente, ou um módulo com perfil de carga muito diferente (ex.: processamento de imagens pesado).
