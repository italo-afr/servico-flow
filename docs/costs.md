# Custos

> **Decisão do responsável (2026-11-03): o projeto não será hospedado.** Custo de infraestrutura = R$ 0.
> As imagens ficam no GitHub Container Registry. A tabela abaixo serve só para quem decidir hospedar.
>
> **Nenhum preço foi consultado e nenhum serviço foi contratado.** O teto abaixo é um valor
> **fictício** de planejamento (decisão do responsável: sem dados reais). Preencha com valores
> consultados, data, moeda e impostos antes da fase 10.

Teto fictício de planejamento: **R$ 150/mês**.

| Item                          | Estimativa mensal consultada | Limite/risco                            | Medida de controle no projeto                                                |
| ----------------------------- | ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| VPS (proxy, web, API, worker) | Preencher                    | CPU/memória/disco; ponto único de falha | limites de memória no compose; rotação de logs                               |
| PostgreSQL gerenciado         | Preencher                    | conexões, storage, retenção de backup   | `DATABASE_POOL_MAX`; índices verificados                                     |
| Storage S3-compatível         | Preencher                    | volume, requisições, egress             | 10 fotos/ordem, 5 MB, reprocessamento ≤ 2560 px WebP, limpeza de abandonados |
| E-mail transacional           | Preencher                    | volume, reputação                       | outbox com limite de tentativas; destinatários restritos fora de produção    |
| Observabilidade               | Preencher                    | ingestão                                | logs JSON; amostragem a definir                                              |
| Domínio                       | Preencher (anual)            | renovação                               | registrar responsável e vencimento                                           |
| IA (opcional)                 | não aplicável                | —                                       | fase 12 não iniciada                                                         |

O componente que mais cresce com o uso, pelo desenho atual, é o **storage de fotos** (por ordem) seguido de **e-mails** (por orçamento/convite).
