# ADR-0010 — Triagem assistida: baseline por regras, IA não lançada

**Status:** aceito · 2026-11-03

**Contexto.** Brief 12 propõe sugerir categoria e perguntas a partir do relato do cliente.
O brief exige um baseline sem IA, um conjunto rotulado com casos reservados e um gate de lançamento
(≥ 90% de categoria correta, sem invenções, custo aprovado). O projeto não tem orçamento para APIs
pagas (decisão do responsável) nem usuários reais para medir ganho de tempo.

**Decisão.**

- Baseline determinístico em `src/triage/rules.ts`: categorias fechadas, prioridade para vários
  sintomas, texto do cliente tratado como dado (tentativas de instrução forçam revisão), perguntas de
  informação faltante, saída sem campos de preço, prazo ou serviço executado.
- Dataset sintético `1.0.0` (50 de desenvolvimento e 30 reservados), congelado antes das regras.
  Avaliação nos reservados: **23/30 (76,7%)**, com todos os erros sendo abstenção. **Não atende ao
  gate.** Ver `docs/evidence/2026-11-03-triage.md`.
- A funcionalidade fica **desligada por padrão** (`TRIAGE_SUGGESTIONS=false`, que também serve de
  desligamento imediato). Só é ligada como experimento na demo local. Nunca preenche nada sozinha.
- **IA não implementada.** O contrato (`TriageSuggestion`) e o harness (`evaluate-cli.ts`) permitem
  comparar um modelo no futuro, desde que haja orçamento aprovado e um dataset 2.0 com novos casos
  reservados e rótulos revisados por um técnico.

**Consequências.** O portfólio demonstra o ciclo de avaliação e a decisão de não lançar abaixo do
gate, em vez de uma integração com IA sem evidência de utilidade.

**Gatilho de revisão.** Orçamento para API de modelo, ou dados reais de triagem com autorização.
