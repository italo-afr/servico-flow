# Segurança e privacidade

## Modelo de ameaças

| Ativo                      | Ameaça                                             | Impacto                  | Proteção                                                                                                                                  | Teste                                 |
| -------------------------- | -------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Dados da empresa           | Membro de A lê/altera B trocando IDs               | Vazamento entre clientes | `AccessGuard` (associação ativa, 404), `organization_id` do membro em toda query, FKs compostas                                           | T01, T02 (API e banco)                |
| Ordens/valores             | Técnico vê custos, equipe ou ordens não atribuídas | Exposição interna        | Matriz de papéis; filtro por visita atribuída; seção de orçamento omitida; e-mail do cliente removido                                     | T03, `quotes.test` (403), jornada E2E |
| Orçamento                  | Cliente troca identificador para aprovar outro     | Acordo indevido          | Sessão de acesso amarrada a UM orçamento; sem ID na decisão                                                                               | `quotes.test`                         |
| Link privado               | Vaza em log, analytics, Referer                    | Terceiro decide          | Token no fragmento (não chega ao servidor de páginas), só hash no banco, `no-referrer`, sem scripts de terceiros, cookie curto `HttpOnly` | T09; URL sem token no E2E             |
| Robô de e-mail abre o link | Decisão involuntária                               | —                        | GET nunca decide; POST com `confirm: true`                                                                                                | T09                                   |
| Consistência               | Requisições concorrentes                           | Decisão/reserva dupla    | `FOR UPDATE`, constraint de exclusão, índices únicos parciais, idempotência                                                               | T06–T08, T10–T13                      |
| Storage                    | Arquivo disfarçado, abuso                          | XSS, custo               | Validação pelo conteúdo, reprocessamento WebP, quarentena, quota, limpeza                                                                 | T17, T18                              |
| Sessão                     | CSRF, sessão roubada, membro removido              | Ação indevida            | `SameSite=Lax` + checagem de `Origin`; sessão no banco; associação checada a cada requisição                                              | T04, T19                              |
| Credenciais                | Força bruta                                        | Invasão                  | 5 logins/min/IP; recuperação não revela conta                                                                                             | observado (429)                       |
| Segredos                   | Em bundle, repo ou erro                            | Comprometimento          | `.env` fora do git, nada secreto com prefixo público, erros sem stack/SQL                                                                 | busca de segredos; filtro de erros    |
| Demo                       | Envia e-mail a terceiros                           | Spam, reputação          | Lista de destinatários permitidos fora de produção e sempre com `DEMO_MODE`                                                               | T25                                   |

## Matriz de autorização

Implementada em `apps/api/src/identity/policy.ts` (negação por padrão) e testada em `policy.test.ts` e nos testes de integração.

| Ação                             | Admin                           | Atendente | Técnico                                  | Cliente (link)        |
| -------------------------------- | ------------------------------- | --------- | ---------------------------------------- | --------------------- |
| Equipe e convites                | ✔                               | ✘         | ✘                                        | ✘                     |
| Clientes e ordens                | ✔                               | ✔         | só ordens com visita atribuída (leitura) | ✘                     |
| Orçamentos (ver/editar/enviar)   | ✔                               | ✔         | ✘                                        | só a proposta do link |
| Agendar/reagendar                | ✔                               | ✔         | ✘                                        | ✘                     |
| Iniciar/concluir visita          | ✔ com justificativa se de outro | ✘         | só as próprias                           | ✘                     |
| Fotos                            | ✔                               | ✔         | só ordens atribuídas                     | ✘                     |
| Painel da fila e reprocessamento | ✔                               | ✘         | ✘                                        | ✘                     |
| Aceitar/recusar                  | ✘                               | ✘         | ✘                                        | só a versão vigente   |

## Dados pessoais

| Dado                              | Onde                | Quem acessa                                                       | Observação                               |
| --------------------------------- | ------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| Nome, e-mail da equipe            | `user`              | membros da mesma empresa                                          |                                          |
| Nome, telefone, e-mail do cliente | `customers`         | admin/atendente; técnico vê nome e telefone das ordens atribuídas | sem CPF, documento ou data de nascimento |
| Endereço e instruções de acesso   | `service_addresses` | idem                                                              |                                          |
| Fotos                             | storage privado     | membros autorizados da ordem                                      | EXIF/GPS removidos                       |
| Snapshot do orçamento             | `quotes.snapshot`   | equipe e cliente do link                                          | cópia intencional do acordo              |
| IP e user-agent de sessão         | `session`           | ninguém pela interface                                            | mantido pela biblioteca de autenticação  |

Logs técnicos usam IDs internos; auditoria guarda só identificadores e metadados não sensíveis. A role da aplicação não tem rota que altere `audit_events` — isso não protege contra administradores do banco.

**Retenção e LGPD:** prazos de retenção, exportação e exclusão precisam ser definidos com o responsável antes de uso real. Este projeto não certifica conformidade. Procedimento proposto em `runbooks.md` (item 10).

## Limites conhecidos

- RLS não adotado (ADR-0003). Limite de taxa das rotas públicas é por processo.
- Sem métricas/alertas/traces exportados ainda. Sem callbacks de bounce de e-mail.
- Quota de armazenamento por empresa (bytes) não implementada; existe quota por ordem.
- Auditoria de dependências: `pnpm audit --prod` sem vulnerabilidades conhecidas em 2026-11-03.
