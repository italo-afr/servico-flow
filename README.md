# ServiçoFlow

Sistema web para pequenas empresas de manutenção de ar-condicionado acompanharem
**pedido → orçamento → visita → execução** em um só lugar.

- O **atendente** registra o pedido e sabe o que está aguardando ação.
- O **cliente** abre um link privado, vê uma versão específica do orçamento e aceita ou recusa.
- O **técnico** vê as visitas do dia no celular e registra o que fez, com fotos.

> **Estado atual (2026-11-03): fase 0 concluída — ainda não há código.**
> Projeto de **demonstração técnica**. Não há empresa parceira: entrevistas, empresa,
> clientes, orçamento e horas de planejamento são **fictícios** e identificados como tal.
> Nenhum resultado de uso, desempenho ou disponibilidade foi medido.

## Problema (hipótese)

Pequenas empresas de manutenção podem perder pedidos, aprovações e histórico ao coordenar
serviços por WhatsApp, telefone e planilhas. Isso **não foi validado** com usuários reais —
ver [`docs/discovery.md`](docs/discovery.md).

## Jornada principal

```text
Atendente cadastra cliente/local/equipamento
  → abre ordem (OPEN) → triagem (TRIAGE)
      ↳ visita de diagnóstico opcional
  → envia versão do orçamento (AWAITING_APPROVAL)
  → cliente aceita pelo link (APPROVED)  |  recusa/expira → volta à triagem
  → agenda execução sem conflito de técnico (SCHEDULED)
  → técnico inicia (IN_PROGRESS) e conclui com resumo e fotos (COMPLETED)
```

Exemplo completo com dados fictícios: [`docs/product.md` §5](docs/product.md).

## Decisões de engenharia que o projeto pretende demonstrar

| Problema | Abordagem planejada |
|---|---|
| Dados de uma empresa vazando para outra | Autorização no servidor a cada requisição + chaves estrangeiras compostas `(organization_id, id)` |
| Orçamento alterado depois de aceito | Versão enviada é imutável (snapshot); mudança gera nova versão e revoga o link anterior |
| Clique duplo / duas abas aprovando | Decisão idempotente em transação; repetição devolve o resultado já registrado |
| Dois agendamentos sobrepostos para o mesmo técnico | Constraint de exclusão do PostgreSQL sobre intervalos `[início, fim)` |
| E-mail fora do ar no momento da aprovação | Outbox na mesma transação + worker com lease e retentativas |
| Link de orçamento vazando | Token ≥256 bits, só o hash no banco, GET nunca decide |

Nada da tabela acima está implementado ainda.

## Stack proposta

TypeScript · Next.js (web) · NestJS (API e worker) · PostgreSQL · Prisma · pnpm workspaces ·
Docker Compose · GitHub Actions. Versões serão fixadas na fase 1 após consulta à documentação oficial.

## Roadmap

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Descoberta, recorte e backlog | ✅ Concluída (com dados fictícios) |
| 1 | Esqueleto: web → API → PostgreSQL, Compose, CI | ⏭️ Próxima |
| 2 | Login, empresas, convites, permissões | — |
| 3 | Clientes, equipamentos e ordens | — |
| 4 | Orçamentos versionados e decisão do cliente | — |
| 5 | Agenda com prevenção de conflitos | — |
| 6 | Área do técnico e fotos privadas | — |
| 7 | Notificações confiáveis (outbox) | — |
| 8–9 | Dashboard, segurança, desempenho, backup | — |
| 10 | Staging e produção | — |
| 11–12 | Uso acompanhado e IA opcional avaliada | — |

## Documentação

- [`docs/project-brief.md`](docs/project-brief.md) — especificação completa (regras, arquitetura, fases, critérios)
- [`docs/product.md`](docs/product.md) — hipótese de valor, personas, fluxos e recorte do piloto
- [`docs/discovery.md`](docs/discovery.md) — roteiro de entrevistas e simulações fictícias
- [`docs/backlog.md`](docs/backlog.md) — tarefas com critérios de aceite e riscos
- [`docs/progress.md`](docs/progress.md) — estado real e próximos passos

## Como executar

Ainda não há código. As instruções de setup serão adicionadas na fase 1 (`docs/setup.md`).
