# Progresso

## Marco e fase atuais

Marco A (piloto funcional) — **fase 0 concluída como hipótese documentada**; próxima: fase 1 (F-01).

## Última entrega concluída

2026-11-03 — Fase 0: repositório criado, brief salvo, materiais de descoberta, recorte de produto e backlog.

- `docs/project-brief.md` — especificação normativa.
- `docs/discovery.md` — roteiro, consentimento, modelo de registro, hipóteses H1–H8 e 2 entrevistas **fictícias** (decisão do responsável; não são evidência).
- `docs/product.md` — hipótese de valor, personas, fluxo atual (hipotético) × proposto, exemplo ponta a ponta sintético, conjunto do piloto, pendências.
- `docs/backlog.md` — tarefas verticais com aceite e riscos; F-01 pronta.

## Estado real por ambiente

- Local: apenas documentação; nenhum código.
- Staging: não existe.
- Demo: não existe.
- Produção: não existe.

## Verificações executadas

- Inspeção do ambiente de desenvolvimento (container de nuvem, 2026-11-03):
  Node v22.23.4, pnpm 10.28.0, Docker 29.9.2, cliente psql 16.15, git 2.43.0.
  Isso descreve a máquina de desenvolvimento atual, **não** uma escolha de versão para o projeto.
- Não há código, logo não há testes.

## Decisões novas e ADRs

Decisões de stack **propostas** (brief §2/§6), a confirmar com documentação oficial em F-01:

| Área                             | Proposta                                                                            | A verificar em F-01                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Runtime                          | Node.js LTS                                                                         | Linha LTS ativa em nov/2026 e compatibilidade de Next.js/NestJS/Prisma |
| Pacotes                          | pnpm workspaces                                                                     | Versão a fixar em `packageManager`                                     |
| Web                              | Next.js (App Router)                                                                | Versão estável atual; modo `standalone` para self-hosting              |
| API + worker                     | NestJS, mesmo código, dois entrypoints                                              | Versão estável atual                                                   |
| Banco                            | PostgreSQL                                                                          | Versão suportada pelo provedor gerenciado; extensão `btree_gist`       |
| ORM                              | Prisma + migrations SQL manuais para constraints de exclusão, FKs compostas e locks | Suporte a SQL bruto em migrations e `$transaction` interativa          |
| Testes                           | Runner (Vitest ou Jest), Supertest, Playwright                                      | Compatibilidade com NestJS/decorators                                  |
| Auth                             | **Em aberto** (ADR-002)                                                             | Biblioteca mantida com sessão revogável em cookie                      |
| Nenhum ADR escrito ainda (F-03). |

## Riscos e pendências

- Recorte não validado (H1–H8). Prioridade entre aprovação (H2) e agenda (H4) pode mudar.
- H6: se clientes não usam e-mail, o link privado precisaria ser copiável pelo atendente — exige ADR antes da fase 4.
- Prisma não modela constraints de exclusão nativamente — validar migration SQL manual em F-01.
- Sem dados reais: entrevistas, orçamento (R$ 150/mês) e horas (15 h/semana) são fictícios. O estudo de caso deve dizer isso.

## Bloqueios externos

- Entrevistas reais (D-01): não há acesso a empresas; substituídas por simulação fictícia.
- Remoto: `github.com/italo-afr/servi-o-flow` (configurado em 2026-11-03).

## Próxima tarefa pronta

**F-01 — Esqueleto andante** (`docs/backlog.md`): web → `/api/v1/health/ready` → PostgreSQL, com Compose, configuração validada, primeira migration e seed protegido.

## Como reproduzir a última entrega

Somente documentos: `ls docs/` e leitura dos arquivos acima.
