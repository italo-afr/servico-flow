# ADR-0009 — Métricas Prometheus e alertas em duas camadas

**Status:** aceito · 2026-11-03

**Contexto.** Brief 11.8: medir erro, latência, fila, banco e processo; alertar sem ruído. O projeto é de
portfólio e **não será hospedado** (decisão do responsável), então os alertas precisam funcionar também sem
infraestrutura externa.

**Alternativas.** (a) Só logs; (b) OpenTelemetry completo (métricas + traces) com coletor; (c) métricas
Prometheus com `prom-client` + regras + avaliador embutido.

**Decisão.** (c).

- **Métricas** (`src/observability/metrics.ts`): API em `:9464/metrics` e worker em `:9465/metrics`, portas
  **internas** que o proxy não publica. Requisições por rota normalizada e classe de status, histograma de
  latência, pool, fração de conexões do PostgreSQL, fila por estado, idade do evento elegível mais antigo,
  heartbeat do worker, processados por resultado, erros do laço e métricas padrão do processo. Sem rótulos
  de empresa, e-mail ou IDs (cardinalidade e privacidade).
- **Camada 1, Prometheus/Alertmanager** (`infra/observability/`): 9 regras (API/worker fora, 5xx > 5%
  com volume mínimo, p95 > 500 ms, fila parada, falhas, pool esperando, conexões > 80%, memória). As
  regras têm **testes unitários** (`alerts.test.yml`) validados pelo `promtool` no CI.
- **Camada 2, avaliador embutido no worker** (`src/observability/alerts.ts`): a cada minuto, sob advisory
  lock, avalia condições visíveis no banco, grava estado em `ops_alerts` e notifica **só nas transições**
  (disparou/resolveu). Suporta janela "for". O e-mail sai **direto pelo mailer, sem passar pela outbox**:
  o alerta "fila parada" não pode depender da fila.

**Consequências e limites.**

- O avaliador embutido não detecta a morte do próprio worker nem da API/host; isso só a camada 1 detecta.
- Traces OpenTelemetry **não** foram implementados; a correlação é feita pelo `requestId` nos logs e
  respostas de erro.
- Não há dashboard Grafana; o Prometheus e o painel Operação cobrem a consulta.
- Limiares são propostas sem dados reais de uso.

**Verificação.**

- `test/observability.test.ts` (9 testes): rótulos normalizados sem organizationId, gauges, transições
  únicas, janela "for", envio direto e política de destinatário, métrica de estado.
- Demonstração local com API e worker compilados: alerta `outbox_failed_recent` disparou, o e-mail chegou à
  caixa local e `servicoflow_ops_alert_firing` foi para 1.
- Durante essa verificação apareceu um falso positivo (`waiting=1` causado pelo próprio scrape), corrigido
  coletando o pool antes das consultas.
- O job `observability` do CI roda `promtool check rules`, `promtool test rules`, `promtool check config`
  e `amtool check-config`.

**Gatilho de revisão.** Hospedagem real: adicionar node_exporter (disco), Grafana e traces.
