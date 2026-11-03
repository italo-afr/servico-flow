# Roteiro do vídeo (5–8 min)

**Preparação:**

```bash
docker compose -f infra/demo/docker-compose.yml up -d
```

Duas janelas: desktop (http://localhost:8080) e uma em modo celular (DevTools, 390 px). Mailpit aberto em
http://localhost:8025. Contas: `beto@`, `ana@`, `caio@clima-norte.example.com`, senha `demo-senha-123`.
**Diga logo no início que é uma demonstração técnica com dados fictícios.**

| Tempo     | O que mostrar                                                                                                                                                                                                                      | O que dizer                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:40 | README e `docs/screenshots/01-painel.png`                                                                                                                                                                                          | Público, problema (hipótese não validada), recorte da v1. "Demonstração técnica, sem empresa real."                                                                            |
| 0:40–2:00 | Beto: Nova ordem → cliente → **Sugerir triagem** → abrir → Iniciar triagem → orçamento R$ 180 + R$ 350 − R$ 30 → Enviar. No Mailpit, o e-mail com o link. Celular: abrir o link, mostrar a URL **sem token**, aceitar e confirmar. | Total calculado no servidor; versão enviada imutável; token no fragmento; GET não decide. A triagem é experimental e ficou abaixo do gate.                                     |
| 2:00–3:00 | Beto agenda a execução com Caio. Celular como Caio: Minhas visitas → Iniciar → foto → resumo → Concluir.                                                                                                                           | O técnico não vê valores; a foto é revalidada e perde os metadados de localização.                                                                                             |
| 3:00–4:00 | Terminal: `pnpm --filter @servicoflow/api exec vitest run test/scheduling.test.ts -t T10`. Abrir `database/migrations/0006_appointments.sql` na constraint `EXCLUDE`.                                                              | 6 reservas simultâneas, só 1 grava; o banco garante, não um "checar e inserir".                                                                                                |
| 4:00–5:00 | `docker compose -f infra/demo/docker-compose.yml stop worker` → criar um convite (Equipe) → em Operação, o pendente aparece → `start worker` → o e-mail chega no Mailpit.                                                          | Outbox na mesma transação; nada se perde com o worker parado. Mostrar `:9464/metrics` com `servicoflow_outbox_oldest_eligible_seconds`.                                        |
| 5:00–6:00 | `docs/evidence/2026-11-03-local.md` (matriz T01–T26, backup e restauração) e ADR-0003.                                                                                                                                             | Isolamento entre empresas (API + FK composta), idempotência, restauração conferida.                                                                                            |
| 6:00–7:30 | `docs/evidence/2026-11-03-triage.md` e `infra/observability/alerts.test.yml`.                                                                                                                                                      | O ciclo de avaliação: dados congelados antes das regras, 76,7% nos reservados, não lançado. Alertas com testes unitários. Limite aceito: e-mail duplicado possível (ADR-0006). |

**Não faça** experimento de falha em ambiente de outra pessoa. Tudo acima é local.
