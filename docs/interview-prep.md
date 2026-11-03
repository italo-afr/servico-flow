# Perguntas técnicas (brief 13.4) — respostas apontando para o projeto

> Use como roteiro de estudo: abra o arquivo citado e explique com o código na tela.

**Por que esse problema e como validou a necessidade?**
Não validei. As entrevistas foram fictícias por falta de acesso a empresas (`docs/discovery.md` §8). As
hipóteses H1–H8 continuam abertas, e o projeto se apresenta como demonstração técnica.

**Por que monólito modular, e qual sinal justificaria outra arquitetura?**
ADR-0001. As transações cruzam módulos: o aceite muda orçamento e ordem juntos. Sinais para mudar:
equipes publicando de forma independente, ou um módulo com carga muito diferente (processamento de imagens).

**Autenticação × autorização no código?**
A autenticação é do better-auth (`identity/auth.ts`). A autorização é nossa: `identity/access.guard.ts`
consulta a associação ativa a cada requisição, e `identity/policy.ts` é a matriz de papéis.

**Como impede referência cruzada entre empresas?**
Na aplicação, o `organization_id` vem do membro autenticado, nunca do corpo da requisição. No banco, FKs
compostas (`0003_customers_orders.sql`), testadas direto no banco em `test/orders.test.ts` (T02).

**Duas decisões de orçamento ao mesmo tempo?**
`quotes/public-quote.controller.ts`: `FOR UPDATE` no orçamento. A segunda requisição espera, vê a decisão
gravada e devolve o recibo (`repeated: true`) ou 409. Teste: T06 e T07.

**A agenda continua correta com dois processos da API?**
Sim: a garantia é a constraint `EXCLUDE USING gist` do banco, não a memória da aplicação (`0006`, ADR-0005).

**Repetir uma requisição × repetir uma entrega externa?**
A requisição repetida é idempotente no nosso banco (`common/idempotency.ts`, `Idempotency-Key`). A entrega
externa repetida depende do provedor: só a deduplicação dele elimina duplicatas (ADR-0006).

**Worker morre depois que o provedor aceitou o e-mail?**
O lease vence, outro worker retoma e o e-mail pode sair de novo. Está documentado como limite (T16), não
"resolvido".

**Qual índice foi necessário e como verificou?**
`service_orders_created_idx (organization_id, created_at DESC, id)` para a lista paginada. Verifiquei com
`EXPLAIN ANALYZE` em 10 mil ordens: 0,39 ms (`docs/evidence/2026-11-03-local.md`).

**Uma falha que você investigou com telemetria?**
O falso positivo de `servicoflow_db_pool_connections{state="waiting"}` = 1: o próprio scrape consumia
conexões. Corrigido coletando o pool antes das outras consultas (ADR-0009).

**Resultado real da restauração de backup?**
Local, 10 mil ordens: dump de 0,35 s e restauração de 0,91 s, com contagens e totais idênticos. Não há
RPO/RTO de produção medido (não há produção).

**Rollback após migration incompatível?**
Migrations só avançam e são aditivas em etapas. O rollback da imagem não desfaz o schema
(`docs/runbooks.md` §4–5), e a correção é feita com uma migration nova.

**Quanto custa e o que cresce com o uso?**
Hoje R$ 0: não é hospedado. Se fosse, o que cresce primeiro é o storage de fotos, depois os e-mails
(`docs/costs.md`). Há cota por ordem e por empresa.

**Qual parte a IA ajudou a construir e como revisou?**
O código foi escrito com assistência de um agente de IA, guiado por `docs/project-brief.md`. A revisão foi
feita por testes de risco (concorrência, isolamento), verificação de APIs de bibliotecas nas definições de
tipo instaladas e CI. Os bugs encontrados estão listados em `docs/case-study.md`. **Explique com suas
palavras os arquivos acima antes de uma entrevista.**

**Qual funcionalidade ficou de fora e por quê?**
A IA na triagem. O baseline ficou abaixo do gate e não havia orçamento para avaliar um modelo (ADR-0010).
