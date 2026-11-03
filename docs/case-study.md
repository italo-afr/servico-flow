# Estudo de caso — ServiçoFlow

> **Tipo de evidência:** demonstração técnica com dados **fictícios e sintéticos**. Não houve empresa
> parceira, entrevistas reais nem uso em produção. Os números abaixo são de testes e ensaios locais/CI.

## Problema e recorte

Hipótese: pequenas empresas de manutenção de ar-condicionado perdem pedidos, aprovações e histórico ao
coordenar serviços por mensagens e planilhas (`docs/discovery.md`, H1–H8, **não validadas**). O recorte
da versão 1 é um fluxo único: **pedido → triagem → orçamento → decisão do cliente → visita → execução**,
para uma empresa com poucos atendentes e técnicos.

Fica fora, de propósito: pagamentos, nota fiscal, WhatsApp, modo offline e app nativo (brief 4.2). Uma
ordem tem um equipamento, e uma visita tem um técnico.

## O que foi construído

| Papel         | Pode fazer                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Atendente     | cadastro rápido (cliente, local e equipamento), ordem numerada, orçamento versionado, agenda sem conflito |
| Cliente       | link privado sem conta; vê a proposta e aceita ou recusa                                                  |
| Técnico       | no celular: visitas do dia, início, fotos privadas, conclusão; não vê valores                             |
| Administrador | equipe por convite, painel com indicadores definidos, painel da fila de notificações                      |

Telas: [`docs/screenshots/`](screenshots/). Para rodar localmente com um comando:
`docker compose -f infra/demo/docker-compose.yml up -d`.

## Três decisões difíceis

### 1. O banco como última linha de defesa das regras críticas

**Trade-off:** escolhi SQL nativo (`pg` + migrations próprias) em vez do ORM sugerido no brief. As regras
que mais importam são construções do PostgreSQL, e um ORM não as substituiria:

- constraint de exclusão para a agenda;
- FKs compostas por empresa;
- índices únicos parciais;
- triggers de imutabilidade;
- `SKIP LOCKED`.

O custo é tipagem manual das linhas e um executor de migrations próprio
(`apps/api/src/db/migrate.ts`, com checksum, advisory lock e transação por arquivo).

**Verificação:** testes de concorrência com requisições realmente simultâneas.

- **T10:** 6 reservas sobrepostas em paralelo → 1 vence, 5 recebem 409.
- **T06:** duas aprovações simultâneas → um único evento comercial.

**O que aprendi:** o teste **T08** (revisão de orçamento concorrente com aceite) encontrou um bug que
nenhuma revisão de código tinha pegado. Um `CHECK` impedia substituir um orçamento já aceito. Corrigi com
uma migration nova (`0005`), sem editar a antiga, porque o checksum do executor não permite.

### 2. O link do cliente: conveniência contra vazamento

O cliente decide sem conta, então o link é a credencial. Proteções:

- o token tem 256 bits e vai no **fragmento** (`#token=`), que não chega ao servidor de páginas nem ao `Referer`;
- só o SHA-256 dele fica no banco;
- o valor bruto viaja cifrado (AES-256-GCM) na outbox e é apagado depois do envio;
- a página troca o token por um cookie `HttpOnly` de 30 minutos, válido para um único orçamento;
- `GET` nunca decide, porque robôs de segurança de e-mail abrem links sozinhos.

**Trade-off aceito:** o cliente sem e-mail não tem canal nesta versão (hipótese H6). Copiar o link para o
WhatsApp exporia o token ao atendente, e isso pediria outro desenho.

### 3. Notificação confiável sem prometer o impossível

A aprovação não pode falhar porque o e-mail está fora do ar. Por isso, o evento vai para uma outbox na
**mesma transação** do negócio, e o worker o processa com:

- `FOR UPDATE SKIP LOCKED`;
- lease;
- backoff com jitter;
- supressão de eventos que ficaram obsoletos.

**Limite documentado (T16):** se o processo cair depois de o provedor aceitar e antes do registro, o e-mail
pode sair duplicado. Escrevi isso no ADR-0006 em vez de prometer entrega exatamente uma vez.

Aplicando a mesma ideia ao monitoramento: o alerta "fila parada" é enviado **direto pelo mailer**, porque
não pode depender da própria fila (ADR-0009).

## Resultados medidos

| O quê                                | Resultado                                                                                      | Onde                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------- |
| Testes                               | 28 unitários, 85 de integração (PostgreSQL real), 1 E2E da jornada no celular                  | `docs/evidence/`           |
| CI no GitHub                         | lint, tipos, testes, E2E, `promtool test rules`, build e smoke test das imagens, demo completa | workflows `CI` e `Imagens` |
| Carga (20 VUs, 120 s, 10 mil ordens) | p95 57,6 ms, 0 erros, ~587 req/s                                                               | `2026-11-03-local.md`      |
| Backup e restauração                 | contagens e totais idênticos; API sobe no banco restaurado                                     | idem                       |
| Triagem por regras (sem IA)          | 23/30 nos casos reservados (76,7%), **abaixo do gate de 90%** → desligada por padrão           | `2026-11-03-triage.md`     |

Os números de carga valem para um contêiner de 4 vCPU e esse cenário. Não servem para falar de escala.

## Bugs que os testes e o CI encontraram

1. Um `CHECK` de orçamento impedia a revisão após o aceite. Pego pelo T08 e corrigido na migration 0005.
2. O glob `./apps/**` sem aspas nos scripts era expandido pelo shell, e o build da raiz não compilava as
   apps. Pego pela medição de carga.
3. O `.dockerignore` estava faltando: o build levaria `.env` e dados locais para a imagem. Pego na revisão
   antes do primeiro build.
4. Falso positivo de "pool esperando", causado pelo próprio scrape de métricas. Pego no teste ao vivo.
5. O YAML lia a chave de criptografia só com dígitos como **número**. Pego pelo job `demo-smoke` do CI.

## O que ficou de fora e por quê

- **Hospedagem:** decisão do responsável (projeto de portfólio). As imagens ficam no GHCR, e a demo é local.
- **Uso real e entrevistas:** não houve acesso a empresas. As hipóteses continuam não validadas.
- **IA na triagem:** sem orçamento para API. O baseline foi avaliado e não passou no gate, então fica
  desligado (ADR-0010).
- **Traces e dashboards:** métricas e alertas cobrem as perguntas operacionais desta escala.
- **RLS:** o isolamento é garantido pela aplicação e por FKs compostas, ambos testados. RLS seria uma
  segunda barreira futura.

## Próximos passos coerentes com os sinais

Os passos 1 e 2 só fazem sentido se houver uma empresa disponível.

1. Validar H1, H2 e H6 com uma empresa real antes de qualquer funcionalidade nova.
2. Se clientes não usarem e-mail, desenhar um canal alternativo para o link (H6).
3. Montar o dataset 2.0 de triagem com rótulos revisados por um técnico, antes de comparar com um modelo.
