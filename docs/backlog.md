# Backlog — ServiçoFlow

Quadro: `Backlog` → `Pronto` → `Em andamento` → `Em revisão` → `Concluído` / `Bloqueado`.
Uma tarefa principal em andamento por vez. Cada tarefa termina com comportamento demonstrável.

Legenda de risco: **A** autorização/isolamento · **C** consistência/concorrência ·
**D** dados pessoais · **I** integração externa · **O** operação.

Tarefas das fases 1–3 estão detalhadas (próximas a executar). As demais estão em nível
de épico e serão detalhadas quando entrarem em `Pronto`.

## Resumo

| ID | Título | Fase | Marco | Estado | Depende de |
|---|---|---|---|---|---|
| D-01 | Conduzir entrevistas de descoberta | 0 | A | Substituída por simulação fictícia (sem acesso a usuários reais) | — |
| F-01 | Esqueleto andante: web → `/api/v1/health/ready` → PostgreSQL | 1 | A | **Pronto** | — |
| F-02 | CI inicial (lockfile, lint, tipos, testes, build) | 1 | A | Pronto | F-01 |
| F-03 | ADRs iniciais e documentação de setup | 1 | A | Pronto | F-01 |
| ID-01 | Login/logout com sessão revogável | 2 | A | Backlog | F-01, ADR-002 |
| ID-02 | Empresa, associação e primeiro administrador (fluxo controlado) | 2 | A | Backlog | ID-01 |
| ID-03 | Convite com expiração e uso único | 2 | A | Backlog | ID-02 |
| ID-04 | Contexto de empresa + matriz de autorização no servidor | 2 | A | Backlog | ID-02 |
| ID-05 | Recuperação de acesso | 2 | A | Backlog | ID-01 |
| OS-01 | Cliente, endereço e equipamento por empresa | 3 | A | Backlog | ID-04 |
| OS-02 | Abrir ordem com número sequencial seguro | 3 | A | Backlog | OS-01 |
| OS-03 | Listar, buscar e detalhar ordens | 3 | A | Backlog | OS-02 |
| OS-04 | Comando de triagem, linha do tempo e auditoria | 3 | A | Backlog | OS-02 |
| OS-05 | Cancelar ordem com motivo | 3 | A | Backlog | OS-04 |
| QT-* | Orçamentos, versões, link e decisão | 4 | A | Backlog | OS-04 |
| SC-* | Agenda, diagnóstico, não sobreposição | 5 | A | Backlog | OS-04, QT-* |
| EX-* | Área do técnico, execução e fotos privadas | 6 | A | Backlog | SC-* |
| NT-* | Outbox, worker, e-mail e jobs | 7 | B | Backlog | QT-* |
| DB-* | Dashboard de pendências e sessão de uso | 8 | A | Backlog | EX-* |
| OP-* | Segurança, desempenho, backup, runbooks | 9 | B | Backlog | todas |
| DP-* | Staging e produção | 10 | B | Backlog (requer orçamento/contas) | OP-* |
| PL-* | Piloto acompanhado | 11 | B | Backlog (requer empresa) | DP-* |
| AI-* | Triagem assistida com avaliação | 12 | C | Backlog (opcional) | PL-* |

**Primeira fatia a executar: F-01.** Primeira fatia *comercial*: OS-01→OS-02
(depende da base de identidade da fase 2, por decisão do brief: segurança antes de dados comerciais).

---

## Fase 0

### D-01 — Conduzir entrevistas de descoberta
- **Problema:** o recorte é hipotético; sem evidência não sabemos qual dor priorizar.
- **Comportamento esperado:** 3–5 conversas registradas em `docs/discovery.md` §8.
- **Critérios de aceite:** cada conversa com data, função, processo com exemplo concreto, problemas, interpretação separada, hipóteses H1–H8 atualizadas.
- **Riscos:** D (não coletar dados de clientes finais).
- **Dependências:** ação do responsável. **Não bloqueia F-01** — o projeto avança como demonstração técnica.

## Fase 1

### F-01 — Esqueleto andante
- **Problema:** sem base reproduzível, cada fatia reinventa configuração.
- **Comportamento esperado:** uma página da web mostra o estado retornado por `GET /api/v1/health/ready`, que consulta o PostgreSQL. Requisição passa pelo prefixo `/api` usado em produção.
- **Escopo:** monorepo pnpm (`apps/web`, `apps/api`, `packages/contracts`, `packages/config`); TypeScript estrito; lint/format; Compose com PostgreSQL, storage compatível com S3 e captura de e-mail; `.env.example`; validação de configuração na inicialização; primeira migration (tabela mínima); seed que recusa `APP_ENV=production`; `/health/live` e `/health/ready`.
- **Exclusões:** autenticação, entidades de negócio, proxy de produção, deploy.
- **Critérios de aceite:**
  1. Clone limpo + passos do `docs/setup.md` sobem tudo e a web exibe "pronto".
  2. Parar o PostgreSQL faz `/ready` retornar 503 e `/live` continuar 200.
  3. Remover `DATABASE_URL` faz a API falhar na inicialização com mensagem clara e sem segredo.
  4. Seed com `APP_ENV=production` aborta.
  5. Versões fixadas e justificadas (Node, pnpm, Next.js, NestJS, PostgreSQL, Prisma, runner de testes).
- **Riscos:** O (compatibilidade de versões), I (Prisma + constraints de exclusão exigem SQL manual — validar nesta fase com uma migration SQL de teste usando `btree_gist`).
- **Verificação:** comandos acima executados e registrados em `docs/progress.md`.
- **Documentação:** `docs/setup.md`, `docs/architecture.md`, README.

### F-02 — CI inicial
- **Comportamento esperado:** PR roda install por lockfile, lint, typecheck, testes unitários, testes de integração contra PostgreSQL de serviço, build.
- **Critérios de aceite:** workflow com `permissions` mínimas; actions fixadas por SHA; falha visível ao quebrar um teste.
- **Riscos:** O. **Dependência externa:** repositório no GitHub (ainda não existe).

### F-03 — ADRs iniciais
- ADR-001 monólito modular (API + worker); ADR-002 autenticação e sessões; ADR-003 modelo multiempresa e FKs compostas. Diagrama simples em `docs/architecture.md`.
- **Critério de aceite:** cada ADR com contexto, alternativas, decisão, consequências, verificação e gatilho de revisão.

## Fase 2

### ID-01 — Login/logout com sessão revogável
- **Aceite:** cookie `HttpOnly`/`Secure`/`SameSite`; logout invalida sessão no servidor; rotação após login; limite de tentativas; teste T19 (sessão expirada).
- **Riscos:** A. **Decisão prévia:** biblioteca/provedor em ADR-002 consultando documentação atual.

### ID-02 — Empresa, associação e primeiro administrador
- **Aceite:** criação de empresa só por comando controlado (script/CLI restrito); `Membership` única por (org, user); fuso IANA validado.
- **Riscos:** A.

### ID-03 — Convite
- **Aceite:** token com hash armazenado, expiração, uso único; convite repetido/expirado falha; atendente não convida administrador (sem escalada).
- **Riscos:** A, I (e-mail — até a fase 7, link exibido apenas na caixa de captura local).

### ID-04 — Contexto de empresa e matriz de autorização
- **Aceite:** `orgId` da URL validado contra associação ativa a cada requisição; política central nega por padrão; testes T01 e T04 com duas empresas sintéticas e quatro papéis.
- **Riscos:** A.

### ID-05 — Recuperação de acesso
- **Aceite:** resposta idêntica para e-mail existente ou não; token curto e uso único; sessões anteriores revogadas após troca.

## Fase 3

### OS-01 — Cliente, endereço e equipamento
- **Problema:** atendente precisa registrar o contexto uma vez e reutilizar.
- **Aceite:** CRUD com arquivamento (sem delete em cascata); FKs compostas `(organization_id, id)` impedem endereço de outra empresa; equipamento ligado ao cliente; teste T02 no banco e na API; campos pessoais mínimos.
- **Riscos:** A, D.

### OS-02 — Abrir ordem
- **Aceite:** número sequencial por empresa via contador transacional (não `count+1`); evento `ORDER_CREATED` na linha do tempo; referências estrangeiras ou de outro cliente rejeitadas; teste de concorrência com conexões independentes: N aberturas simultâneas → N números distintos.
- **Riscos:** A, C.

### OS-03 — Listar, buscar, detalhar
- **Aceite:** paginação com limite máximo e ordenação estável; filtros por estado; busca limitada; detalhe 404 para recurso fora do escopo; técnico não lista ordens não atribuídas.
- **Riscos:** A, O (índice por empresa/estado/data verificado com `EXPLAIN`).

### OS-04 — Triagem, linha do tempo e auditoria
- **Aceite:** comando `start-triage` só de `OPEN`; segunda chamada concorrente → 409 ou resultado idempotente documentado; `version` para controle otimista; `OrderEvent` e `AuditEvent` gravados na mesma transação.
- **Riscos:** C.

### OS-05 — Cancelar ordem
- **Aceite:** motivo obrigatório; estados terminais não cancelam; (fases seguintes estendem para revogar tokens e visitas).

## Fases 4–12 (épicos)

- **QT (fase 4):** cálculo em centavos no servidor; rascunho → envio imutável com snapshot; revisão transacional; token ≥256 bits com hash; troca por contexto limitado; decisão idempotente; testes T05–T09. *Pendente da descoberta: H6 (e-mail vs. link copiado).*
- **SC (fase 5):** `Appointment` com `tstzrange` semiaberto e constraint de exclusão (`btree_gist`) para reservas ativas por técnico; diagnóstico antes do orçamento, execução só com aprovação; testes T10–T12.
- **EX (fase 6):** visitas do técnico; início/conclusão por tipo; upload privado com validação/reprocessamento; testes T03, T13, T17, T18.
- **NT (fase 7):** outbox na mesma transação; worker com `FOR UPDATE SKIP LOCKED` e lease; backoff com jitter; reprocessamento auditado; testes T14–T16, T25.
- **DB (fase 8):** indicadores com definição e drill-down; sessão de uso acompanhado; teste T23–T24.
- **OP (fase 9):** varredura de autorização, carga moderada, migrations, restauração, runbooks; T20–T22, T26.
- **DP (fase 10):** imagens por commit, staging, produção — **requer orçamento, contas e domínio autorizados**.
- **PL (fase 11):** onboarding e observação — **requer empresa parceira**.
- **AI (fase 12):** baseline por regras primeiro; dataset 50/30; gate do brief 12.5.
