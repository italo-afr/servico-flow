# ServiçoFlow — prompt mestre e roteiro completo de construção

**Produto:** sistema web para pequenas empresas de manutenção de ar-condicionado.

**Objetivo profissional:** demonstrar capacidade de descobrir um problema, modelar regras, construir um sistema completo, publicá-lo, observar seu funcionamento e melhorar o produto a partir do uso.

**Idioma:** interface e documentação principal em português do Brasil; nomes de código consistentes em inglês.

**Data de preparação:** 3 de novembro de 2026.

**Natureza deste arquivo:** especificação proposta e prompt de execução. O produto, a validação com clientes, os testes e o deploy ainda precisam ser realizados. Nenhuma meta aqui deve ser apresentada como resultado já alcançado.

**Mapa de leitura:** as seções 1 e 2 explicam como iniciar; 3 a 8 especificam o produto; 9 organiza as fases; 10 e 11 definem verificação e operação; 12 trata a IA opcional; 13 prepara o portfólio; 14 reúne prompts reutilizáveis; 15 contém os critérios finais; 16 lista as referências.

---

## 1. Como usar este documento

Este arquivo serve como contrato de trabalho entre você e um agente de desenvolvimento. Ele também funciona como roteiro para você conduzir o projeto por conta própria.

O projeto tem três marcos:

1. **Piloto funcional:** uma empresa consegue percorrer o fluxo central com dados de teste ou dados reais autorizados.
2. **Versão 1 em produção:** o fluxo tem isolamento, testes críticos, notificações recuperáveis, monitoramento, backup restaurável e procedimentos de operação.
3. **Evolução com IA:** uma funcionalidade opcional é avaliada em relação a uma solução sem IA e só entra no produto se demonstrar utilidade.

O marco 2 já constitui um projeto completo para portfólio. O marco 3 é uma evolução; sua ausência não invalida a primeira versão.

### 1.1 O primeiro passo prático

Crie uma pasta e um repositório próprios para o sistema. Salve este arquivo em `docs/project-brief.md`. Abra o repositório no agente de desenvolvimento e envie:

```text
Leia docs/project-brief.md por completo. Esse arquivo contém o prompt mestre,
as regras do produto, o plano de execução e os critérios de aceite.
Comece pela fase 0, respeitando as decisões de escopo e registrando as hipóteses.
Execute o que puder verificar localmente. Não invente entrevistas, credenciais,
testes aprovados, métricas, usuários ou deploys.
```

Execute uma fase por vez, ou uma fatia pequena dentro da fase. Ao mudar de conversa, peça ao agente que leia o arquivo de progresso e confira o estado real do repositório antes de continuar.

### 1.2 Premissas que você pode ajustar

Como sua stack, orçamento e disponibilidade ainda não foram informados, este plano assume:

- Uma pessoa desenvolvendo, com assistência de IA.
- Experiência suficiente para revisar TypeScript, HTTP, SQL e Git; lacunas viram estudos orientados pelas tarefas.
- Uma empresa com poucos atendentes e técnicos, e serviços realizados presencialmente.
- Uma ordem de serviço com um equipamento e um técnico responsável por visita, na primeira versão.
- Aprovação de orçamento por link; o cliente não precisa criar conta.
- Sem pagamentos integrados na primeira versão.
- Sem cadastro público irrestrito de empresas: entrada por convite no piloto.
- Infraestrutura pequena; nenhum valor de mensalidade ou serviço gratuito está garantido neste documento.

Se você já domina Java, C#, Python, PHP ou outra stack, preserve o produto, os invariantes, as evidências e as fases; adapte os componentes técnicos. Registre a mudança antes de implementar para evitar manter dois caminhos concorrentes.

### 1.3 Como estudar enquanto constrói

Para cada decisão importante, responda por escrito:

1. Qual problema concreto estamos resolvendo?
2. Qual implementação mais simples também resolveria?
3. Que falha essa escolha impede e que nova complexidade introduz?
4. Qual teste ou observação permite verificar a decisão?
5. Como você investigaria o problema se acontecesse em produção?

Não avance apenas porque a tela apareceu. Você deve conseguir explicar o caminho de uma requisição, a consulta executada, a autorização aplicada e os efeitos de uma repetição ou falha.

## 2. Prompt mestre para o agente de desenvolvimento

**Use esta seção junto com o restante do arquivo. As seções 3 a 16 são a especificação normativa do prompt. Envie o arquivo inteiro; copiar apenas o bloco abaixo perde os detalhes.**

```text
Você é meu parceiro de engenharia na construção do ServiçoFlow, um sistema
para pequenas empresas de manutenção de ar-condicionado.

MISSÃO
Construir comigo o produto descrito neste documento, do entendimento do
problema à operação em produção. O objetivo é entregar software utilizável
e produzir evidências verificáveis das decisões de engenharia.

ESPECIFICAÇÃO
Leia todo este arquivo antes de implementar. As seções seguintes definem
escopo, regras, arquitetura, segurança, testes, fases e critérios de conclusão.
Não substitua essas regras por um template genérico de SaaS.

MODO DE TRABALHO
1. Inspecione o repositório, instruções locais, ferramentas e dependências.
2. Descubra o que já existe antes de criar ou reescrever arquivos.
3. Registre hipóteses e faça apenas perguntas que bloqueiem trabalho relevante.
4. Escolha versões suportadas e compatíveis, consultando documentação oficial.
5. Fixe as versões e registre comandos realmente executados.
6. Divida o trabalho em fatias verticais pequenas e verificáveis.
7. Implemente banco, regra, API, interface e testes da fatia quando aplicáveis.
8. Execute as verificações pertinentes; informe resultados e limitações reais.
9. Atualize a documentação e o progresso a cada entrega significativa.
10. Explique decisões de segurança, consistência, custo e operação em português.

ARQUITETURA INICIAL
TypeScript, Next.js para web, NestJS para API, PostgreSQL para persistência,
Prisma como camada de acesso e migrations se a compatibilidade for confirmada,
worker do mesmo backend para tarefas pendentes, armazenamento privado de fotos
e provedor transacional de e-mail. Monorepo com pnpm workspaces.
Use uma outbox no PostgreSQL antes de introduzir um broker adicional.

PRINCÍPIOS
- Autorização no servidor e isolamento entre empresas em todas as operações.
- Regras críticas protegidas por transações, constraints e testes concorrentes.
- Valores monetários exatos; datas com fuso explícito.
- Dados de demonstração sintéticos e claramente identificados.
- Sem microserviços, Kubernetes ou abstrações genéricas sem necessidade provada.
- Sem IA no caminho obrigatório do fluxo comercial.
- Nunca considerar mocks de integrações como evidência de entrega real.
- Nunca declarar produção pronta apenas porque o build passou.

AUTONOMIA E LIMITES
Pode criar e alterar o código necessário, rodar verificações locais e corrigir
problemas no escopo. Preserve trabalho existente e não faça reset destrutivo.
Não exponha segredos. Não envie mensagens reais a terceiros durante testes.
Não contrate serviços, gere cobranças, publique dados ou altere produção sem
a autorização correspondente. Prepare tudo que for verificável antes de
pedir o que faltar. Uma tarefa bloqueada por credencial não bloqueia outras.

ENTREGAS DE CADA FATIA
- Comportamento entregue e critério de aceite atendido.
- Arquivos e decisões principais, com explicação breve.
- Comandos de verificação e resultado real.
- Limitações e riscos ainda abertos.
- Próximo passo recomendado e atualização de docs/progress.md.
- Uma pergunta de compreensão técnica para eu responder ao revisar a entrega.

CRITÉRIO DE CONCLUSÃO
Use os checklists deste documento. Diferencie implementado, verificado
localmente, verificado em staging e verificado em produção. Não invente
entrevistas, métricas de negócio, testes aprovados nem disponibilidade.

COMEÇO
Inspecione o ambiente e execute a fase 0. Se eu ainda não tiver entrevistado
usuários, prepare os materiais de validação e avance no protótipo com hipóteses
marcadas. Não afirme que o problema está validado. Mostre o backlog inicial,
as decisões da stack e a primeira fatia vertical a implementar.
```

## 3. Produto, público e validação

### 3.1 A hipótese de problema

Pequenas empresas de manutenção podem perder solicitações, aprovações e histórico ao coordenar serviços por mensagens e planilhas. O ServiçoFlow reúne o acompanhamento operacional em um lugar.

Isso é uma hipótese. Não alegue que toda empresa trabalha assim, nem que o produto tem demanda antes de conversar com possíveis usuários.

**Proposta de valor inicial:** o atendente sabe quais serviços estão aguardando ação; o cliente consegue consultar e decidir sobre o orçamento; o técnico sabe o que fazer e registra o trabalho pelo celular.

### 3.2 Público inicial

Procure uma empresa pequena de manutenção de ar-condicionado que você consiga acompanhar. Evite atender vários segmentos na primeira versão. Um negócio acessível a você vale mais para a descoberta do que um mercado hipotético enorme.

Papéis:

- **Administrador:** configura a empresa, gerencia a equipe e acompanha a operação.
- **Atendente:** cadastra solicitações, prepara orçamentos e organiza visitas.
- **Técnico:** consulta visitas atribuídas, registra diagnóstico, fotos e execução.
- **Cliente externo:** vê um orçamento específico e pode aceitá-lo ou recusá-lo por link limitado.

### 3.3 Pesquisa antes de fechar o escopo

Meta de descoberta: conversar com três a cinco pessoas, buscando pelo menos um responsável pela operação e um técnico. Se só conseguir uma empresa, registre essa limitação.

Peça exemplos de trabalhos recentes, sem coletar dados pessoais desnecessários:

1. Como o pedido entrou e quem o registrou?
2. Onde ficam endereço, equipamento, descrição e fotos?
3. Como o cliente recebe e aprova o orçamento?
4. O que acontece quando o preço muda?
5. Como escolhem o técnico e evitam sobreposição de agenda?
6. Qual informação costuma faltar para executar a visita?
7. Que erro recente gerou retrabalho, atraso ou perda de atendimento?
8. O técnico tem internet no local?
9. Que parte da ferramenta atual funciona bem?
10. O que faria a equipe experimentar uma alternativa?

Peça autorização para acompanhar um fluxo real ou usar exemplos anonimizados. Não envie comunicações aos clientes da empresa sem autorização.

Produza `docs/discovery.md` com data, função da pessoa, processo observado, problemas relatados, evidências, limitações e decisões. Separe claramente observação, interpretação e hipótese.

### 3.4 Critério para seguir ou ajustar

O melhor sinal inicial é uma empresa aceitar testar um fluxo concreto e oferecer retorno. Se não houver acesso a usuários, continue como demonstração técnica com dados sintéticos, identificando isso no estudo de caso.

Se o problema principal for outro, ajuste o recorte antes de aprofundar a implementação. Exemplo: se o gargalo for aprovação de orçamento e a agenda já funcionar bem, priorize a aprovação e mantenha a agenda simples.

### 3.5 Métricas de produto

Defina o significado antes de instrumentar:

| Métrica | Como medir | Cuidado de interpretação |
|---|---|---|
| Tempo até enviar orçamento | Envio menos abertura da solicitação | Separe tempo da equipe de espera por informação |
| Tempo até decisão | Decisão menos envio da versão | Não atribua toda a demora ao sistema |
| Ordens sem atualização | Ordens abertas sem evento operacional há um limite definido | O limite depende do processo da empresa |
| Conclusão do fluxo | Ordens que chegam a conclusão dentro da janela observada | Exclua amostras ainda sem tempo de maturação |
| Esforço de cadastro | Tempo e erros em tarefa observada | Compare tarefas equivalentes |

Antes do piloto, registre uma linha de base quando possível. Depois, compare a mesma definição. Metas propostas não são resultados.

## 4. Escopo e jornadas

### 4.1 O que entra na versão 1

- Login, logout, recuperação de acesso e convite para equipe.
- Empresa com nome, fuso, dados de contato e configurações operacionais mínimas.
- Associação de usuário a empresa e papel por associação.
- Clientes, endereços de atendimento e equipamentos.
- Ordem de serviço com descrição, prioridade operacional manual e histórico.
- Orçamento com itens, valores, versões, validade e decisão do cliente.
- Link privado para consultar e decidir sobre uma versão enviada.
- Visita com técnico, início, fim, reagendamento e prevenção de conflitos.
- Execução com observações e fotos privadas.
- Notificações por e-mail com acompanhamento de tentativas.
- Painel de pendências com filtros e paginação.
- Auditoria das ações relevantes.
- Infraestrutura, verificações e documentação necessárias para operação.

### 4.2 O que fica para depois

Pagamentos, cobrança de assinatura do SaaS, emissão fiscal, estoque, roteirização geográfica, aplicativo nativo, sincronização offline, chat, WhatsApp, marketplace, múltiplos técnicos na mesma visita e múltiplos equipamentos na mesma ordem.

O sistema pode guardar um telefone para contato sem integrar mensagens. Orçamento aprovado não significa valor recebido; não apresente a soma de orçamentos como receita financeira realizada.

### 4.3 Jornada principal

1. Administrador cria a empresa por fluxo controlado e convida a equipe.
2. Atendente cadastra cliente, local e equipamento.
3. Atendente abre uma ordem a partir de contato recebido fora do sistema.
4. Equipe registra informações de triagem.
5. Atendente prepara e envia uma versão do orçamento.
6. Cliente consulta o link e aceita ou recusa explicitamente.
7. Se aceito, atendente agenda a execução com um técnico disponível.
8. Técnico vê o serviço atribuído no celular e inicia a execução.
9. Técnico registra o que fez e conclui com os dados obrigatórios.
10. Equipe acompanha o histórico e o estado final.

Para evitar ampliar o primeiro escopo, a abertura pública de solicitações fica como evolução. No MVP, quem registra o contato é o atendente.

### 4.4 Diagnóstico presencial antes do orçamento

Manutenção pode exigir visita antes de definir preço. O modelo deve suportar visitas de dois tipos: `DIAGNOSTIC` e `EXECUTION`.

- Visita de diagnóstico pode ser agendada durante a triagem, antes da aprovação.
- Visita de execução exige orçamento aprovado e atual.
- A conclusão de uma visita de diagnóstico registra achados; não conclui automaticamente a ordem.
- A primeira versão trata a cobrança de diagnóstico fora do sistema, com essa limitação explícita.

### 4.5 Histórias de usuário prioritárias

**US-01 — Isolamento:** como administrador, quero que os dados da minha empresa sejam acessíveis apenas à equipe autorizada. Aceite: trocar identificadores em URLs ou payloads não permite consultar nem alterar dados de outra empresa.

**US-02 — Abertura:** como atendente, quero registrar uma ordem com cliente, endereço e equipamento, para não perder o contexto. Aceite: a ordem recebe número interno, estado inicial e evento de criação; referências estrangeiras são rejeitadas.

**US-03 — Aprovação:** como cliente, quero ver o valor e decidir sobre o orçamento recebido. Aceite: o conteúdo é uma versão imutável; decisão repetida não duplica efeitos; link vencido ou revogado não autoriza ações.

**US-04 — Agenda:** como atendente, quero marcar uma visita sem conflito do técnico. Aceite: dois pedidos concorrentes incompatíveis não conseguem gravar duas reservas ativas sobrepostas.

**US-05 — Execução:** como técnico, quero consultar minhas visitas e registrar o atendimento pelo celular. Aceite: só consigo operar visitas atribuídas a mim, salvo permissões administrativas explícitas.

**US-06 — Recuperação:** como responsável pela operação, quero que notificações pendentes sejam retomadas após uma falha. Aceite: parar o worker não perde eventos; retomar o worker permite processá-los de acordo com a política de entrega.

## 5. Regras de negócio, dados e contratos

### 5.1 Máquina de estados da ordem

Use comandos de domínio para transições. Não aceite um `PATCH` genérico que permita escolher qualquer estado.

| Estado | Próximos estados possíveis | Condição principal |
|---|---|---|
| `OPEN` | `TRIAGE`, `CANCELLED` | Usuário autorizado assume o atendimento |
| `TRIAGE` | `AWAITING_APPROVAL`, `CANCELLED` | Uma versão de orçamento foi enviada |
| `AWAITING_APPROVAL` | `APPROVED`, `TRIAGE`, `CANCELLED` | Aceite, recusa, expiração, revisão ou cancelamento |
| `APPROVED` | `SCHEDULED`, `TRIAGE`, `CANCELLED` | Reserva válida ou necessidade de novo orçamento |
| `SCHEDULED` | `IN_PROGRESS`, `APPROVED`, `TRIAGE`, `CANCELLED` | Início, desagendamento, revisão ou cancelamento |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` | Registro de execução ou cancelamento justificado |
| `COMPLETED` | Nenhum na versão 1 | Correção por registro adicional; não apagar histórico |
| `CANCELLED` | Nenhum na versão 1 | Novo atendimento gera outra ordem vinculável |

Regras adicionais:

- Recusa ou expiração do orçamento registra o resultado na versão e devolve a ordem à triagem. Não cancela a ordem silenciosamente.
- Expiração deve ser verificada no momento da decisão, mesmo se o job de expiração estiver atrasado.
- Revisão antes de iniciar execução invalida o orçamento anterior, revoga links e cancela a reserva de execução vigente na mesma operação de negócio.
- Alterar o escopo financeiro durante `IN_PROGRESS` fica fora da versão 1. Registre a limitação e exija nova ordem para serviço adicional; não reescreva o acordo aceito.
- Cancelar ordem cancela visitas futuras ativas e revoga tokens de decisão. Preserve histórico e motivo.
- Uma visita de diagnóstico não muda a ordem para `SCHEDULED`; esse estado representa a execução aprovada.

### 5.2 Orçamentos e precisão monetária

- Moeda inicial: BRL.
- Valores monetários persistidos em centavos inteiros, com limites explícitos que evitem overflow.
- Quantidades inteiras positivas no MVP; mão de obra fracionária deve ser representada como item de preço fechado, com descrição clara.
- Subtotal = soma de quantidade × valor unitário. Total = subtotal menos desconto fixo permitido.
- Total não pode ser negativo; desconto não pode exceder subtotal.
- Cálculo final acontece no servidor; o cliente não define o total autorizado.
- Rascunho é editável. Versão enviada se torna imutável quanto a itens, valores, condições, endereço e identificação relevantes à proposta.
- Alteração após envio gera nova versão, com número sequencial por ordem.
- Só uma versão pode estar vigente para decisão. A operação de revisão é transacional.
- Versão aceita conserva um snapshot do acordo; alterações futuras no cadastro não mudam o documento aprovado.
- Guarde `sent_at`, `expires_at`, `decided_at`, versão, resultado e identificador de correlação.
- Validade inicial proposta de 7 dias por orçamento, configurável antes do envio. Depois de enviada, uma alteração de validade também exige nova versão ou procedimento explícito de substituição.
- Aceite não é pagamento nem assinatura eletrônica certificada. O produto registra uma decisão operacional; não prometa validade jurídica específica.

### 5.3 Agenda e concorrência

- Instantes persistidos em UTC com tipo adequado; entrada e exibição respeitam o fuso IANA da empresa.
- Considere intervalos semiabertos `[início, fim)`: uma visita pode começar exatamente quando outra termina.
- Fim deve ser posterior ao início. Data passada exige regra e permissão explícitas; por padrão, rejeite novo agendamento no passado.
- Reagendamento altera a reserva de forma atômica e preserva evento com valores anterior e novo.
- Visitas canceladas não bloqueiam a agenda.
- No primeiro escopo, técnico representa capacidade exclusiva por usuário em todas as empresas a que ele pertence. Um conflito externo não deve revelar dados da outra empresa.
- Checar disponibilidade e depois inserir sem proteção no banco não é suficiente.

Estratégia de referência: constraint de exclusão no PostgreSQL sobre técnico e intervalo das reservas ativas, incluindo diagnóstico e execução. Verifique suporte à extensão necessária no provedor; caso indisponível, use bloqueio transacional e estratégia equivalente documentada, com todos os caminhos de escrita protegidos. PostgreSQL documenta constraints para impedir sobreposição de intervalos. [Referência técnica](https://www.postgresql.org/docs/15/rangetypes.html).

### 5.4 Entidades mínimas

| Entidade | Campos e responsabilidades principais |
|---|---|
| `User` | Identidade global, e-mail normalizado, estado da conta; credenciais geridas pelo mecanismo de autenticação |
| `Organization` | Nome, fuso, contato e configurações mínimas |
| `Membership` | `organization_id`, `user_id`, papel, situação; combinação única |
| `Invitation` | Empresa, destinatário, papel permitido, token protegido, validade e consumo |
| `Session` | Sessão revogável ou referência ao provedor, expiração e usuário |
| `Customer` | Empresa, nome e contatos estritamente necessários |
| `ServiceAddress` | Empresa, cliente, endereço e instruções de acesso necessárias |
| `Equipment` | Empresa, cliente, descrição, marca/modelo e identificação opcional |
| `ServiceOrder` | Empresa, número interno, cliente, endereço, equipamento, estado, descrição, versão de concorrência |
| `Quote` | Empresa, ordem, versão, estado, totais e snapshot imutável após envio |
| `QuoteItem` | Empresa, orçamento, descrição, quantidade e preço unitário |
| `DecisionToken` | Empresa, orçamento específico, hash, expiração, revogação e consumo |
| `Appointment` | Empresa, ordem, técnico, tipo, intervalo e situação |
| `ExecutionReport` | Empresa, visita, autor, descrição e data de conclusão |
| `Attachment` | Empresa, recurso, chave privada do objeto, estado de validação e metadados limitados |
| `OrderEvent` | Linha do tempo operacional que pode ter visão filtrada para cliente |
| `AuditEvent` | Ator, empresa, ação, recurso, resultado e correlação; acesso restrito |
| `OutboxEvent` | Evento pendente, payload mínimo, disponibilidade, tentativas, lease e versão do esquema |
| `NotificationDelivery` | Evento, destinatário, canal, estado, chave de deduplicação e referência do provedor |
| `IdempotencyRecord` | Empresa, ator/escopo, chave, hash da entrada, resposta e validade |

Nem toda entidade precisa existir na primeira fatia. O modelo final precisa cobrir essas responsabilidades sem tabelas redundantes.

### 5.5 Integridade e índices

- Toda tabela de negócio tem `organization_id` obrigatório.
- Referências entre entidades da empresa precisam impedir associação cruzada. Prefira chaves estrangeiras compostas com `(organization_id, id)` quando apropriado, além da autorização da aplicação.
- Número de ordem único por empresa. Evite gerar com `count + 1`; use contador transacional ou outra estratégia segura.
- Versão de orçamento única por ordem; associação de usuário única por empresa.
- Índices iniciais acompanham consultas: ordens por empresa/estado/data, visitas por técnico/intervalo, outbox por estado/disponibilidade e vínculos usados na autorização.
- Valide índices com plano de execução e dados sintéticos representativos. Não adicione índice em todo campo sem observar consultas.
- Cadastros referenciados devem ser arquivados quando necessário, sem apagar o histórico da ordem por cascata acidental.
- Use controle otimista com `version` para evitar sobrescrever alterações simultâneas. Retorne conflito e permita recarregar.

### 5.6 API HTTP de referência

Prefixo `/api/v1`. Exemplos abaixo orientam o contrato; a biblioteca de autenticação pode definir rotas próprias, documentadas sem duplicação.

| Método e rota | Finalidade |
|---|---|
| `GET /me` | Identidade e associações permitidas |
| `POST /organizations/:orgId/invitations` | Convite de membro por administrador |
| `GET/POST /organizations/:orgId/customers` | Listagem paginada e cadastro |
| `GET/POST /organizations/:orgId/orders` | Listagem filtrada e abertura |
| `GET /organizations/:orgId/orders/:id` | Detalhe autorizado |
| `POST /organizations/:orgId/orders/:id/start-triage` | Comando de início de triagem |
| `POST /organizations/:orgId/orders/:id/quotes` | Criar rascunho ou nova versão conforme regra |
| `POST /organizations/:orgId/quotes/:id/send` | Congelar versão e gerar evento de envio |
| `POST /organizations/:orgId/quotes/:id/revise` | Invalidar versão e iniciar revisão |
| `POST /organizations/:orgId/orders/:id/appointments` | Reservar visita |
| `POST /organizations/:orgId/appointments/:id/reschedule` | Reagendamento atômico |
| `POST /organizations/:orgId/appointments/:id/start` | Iniciar visita autorizada |
| `POST /organizations/:orgId/appointments/:id/complete` | Concluir diagnóstico ou execução |
| `POST /organizations/:orgId/orders/:id/cancel` | Cancelamento com motivo |
| `POST /public/quote-access/exchange` | Trocar token limitado por contexto temporário |
| `GET /public/quote-access/current` | Consultar somente a proposta autorizada |
| `POST /public/quote-access/decision` | Decisão explícita e idempotente |
| `POST /organizations/:orgId/attachments/initiate` | Autorizar upload limitado |
| `POST /organizations/:orgId/attachments/:id/finalize` | Verificar objeto e finalizar registro |
| `GET /health/live` e `GET /health/ready` | Verificação de processo e prontidão |

`orgId` na URL é uma solicitação de contexto, nunca prova de autorização. Valide a associação ativa a cada operação.

Defina também rotas de endereços, equipamentos e leitura de agenda quando implementar as respectivas fatias. Não esconda ações de domínio em atualizações genéricas de ORM.

Contrato transversal:

- Validação de entrada, limite de tamanho, rejeição de campos não permitidos e parâmetros de paginação limitados.
- Ordenação estável; cursor ou página com limites documentados.
- Erros com `code`, `message`, `requestId` e campos inválidos quando aplicável.
- `401` para ausência de autenticação; `403` para ação proibida; `404` para recurso indisponível no escopo; `409` para conflitos de estado/versão/agenda; `422` para regras de entrada conforme convenção escolhida; `429` para limite excedido.
- Nenhuma stack trace, SQL, segredo ou detalhe de outra empresa na resposta.
- OpenAPI gerada e versionada; documentação pública deve conter apenas exemplos sintéticos.

### 5.7 Idempotência e transação de aprovação

Na decisão do orçamento, a mesma requisição repetida deve devolver o resultado já registrado, sem criar outro evento de aprovação.

Dentro de uma transação curta:

1. Resolva e valide o acesso limitado sem consumir a decisão em uma consulta GET.
2. Bloqueie a versão ou aplique comparação atômica de estado.
3. Verifique validade, revogação, vigência, estado da ordem e decisão anterior.
4. Se a decisão idêntica já existe, devolva o resultado anterior autorizado.
5. Se a decisão for incompatível com o estado atual, retorne conflito.
6. Persista decisão, mudança da ordem, auditoria, evento e outbox.
7. Marque o token de decisão como consumido para novas decisões e mantenha uma forma limitada de consultar o recibo durante sua validade.
8. Faça commit; envio de e-mail acontece fora da transação.

Em criação de recursos e agendamento, adote `Idempotency-Key` para comandos que exigem proteção a repetição. Escopo mínimo: empresa, ator, operação e chave; grave hash da entrada e resultado atomicamente. Mesma chave com conteúdo diferente retorna conflito. Defina retenção inicial de 24 horas para esses registros, ajustável à operação. Proteção de estado do orçamento continua válida após esse prazo.

## 6. Arquitetura e stack de referência

### 6.1 Decisão inicial

Monólito modular no backend. API e worker são processos do mesmo produto e compartilham os módulos de domínio e o banco; não são microserviços independentes.

```text
Navegador de atendente, técnico ou cliente
                  |
             HTTPS / mesmo domínio
                  |
          Proxy e limites de entrada
             /               \
      Next.js web         /api -> NestJS
                                |
                           PostgreSQL
                         /            \
                Dados do produto    Outbox
                                      |
                               Worker do backend
                                /            \
                       Provedor de e-mail   Limpeza/expiração

API autoriza acesso ao armazenamento privado de fotos.
Web, API e worker enviam telemetria sem dados sensíveis.
```

### 6.2 Stack proposta

| Área | Escolha inicial | Justificativa e limite |
|---|---|---|
| Linguagem | TypeScript com modo estrito | Uma linguagem no produto; validação em runtime continua necessária |
| Runtime | Node.js em linha LTS suportada | Fixar versão compatível com as dependências |
| Web | Next.js e React | Interface responsiva e rotas do produto; domínio comercial fica na API |
| API | NestJS | Módulos e integração HTTP explícitos; evitar camadas cerimoniais |
| Banco | PostgreSQL | Transações, integridade e consultas operacionais |
| Acesso a dados | Prisma, após confirmar compatibilidade | SQL explícito para constraints, bloqueios e consultas que exigirem |
| Jobs | Outbox e worker com PostgreSQL | Evita adicionar infraestrutura de fila no primeiro estágio |
| Fotos | Storage privado compatível com S3 | Arquivos fora do filesystem efêmero do container |
| E-mail | Provedor transacional com sandbox e documentação de deduplicação | Escolher após avaliar preço, limites e comportamento real |
| Testes | Runner compatível, Supertest e Playwright | Regras, integração HTTP/banco e jornadas de navegador |
| Organização | pnpm workspaces | Monorepo pequeno sem orquestrador adicional obrigatório |
| Containers | Docker e Compose no desenvolvimento | Ambiente reproduzível; produção conforme provedor escolhido |
| CI/CD | GitHub Actions | Verificação e build rastreáveis; deploy depende da hospedagem |
| Observabilidade | Logs estruturados, métricas e traces com OpenTelemetry quando compatível | Investigar operações e medir o serviço |

Produção deve usar uma linha Node.js com suporte adequado; confirme a compatibilidade real antes de escolher o número da versão. [Política oficial de releases](https://nodejs.org/en/about/previous-releases).

### 6.3 Autenticação: decidir na fase 1

Use uma biblioteca mantida ou provedor que ofereça integração documentada com a stack escolhida. Verifique manutenção, revogação, recuperação, convites, modo local/testes e compatibilidade com execução em container. Registre a escolha em ADR; não invente API de biblioteca com base em memória.

Preferência de arquitetura: sessão revogável com cookie seguro no mesmo domínio. Se usar provedor OIDC, valide o callback no servidor e crie o contexto local de sessão e associação. Autenticação identifica o usuário; permissões de empresa continuam responsabilidade da aplicação.

Não implemente algoritmo de hash, geração criptográfica ou protocolo de autenticação do zero. O mecanismo escolhido deve cobrir armazenamento seguro de credenciais ou delegá-lo ao provedor. Caso não permita todos os fluxos descritos, registre e resolva a lacuna antes de abrir o piloto.

### 6.4 Estrutura sugerida do repositório

```text
apps/
  web/
  api/
    src/
      modules/
        identity/
        organizations/
        customers/
        orders/
        quotes/
        scheduling/
        execution/
        attachments/
        notifications/
        audit/
      worker/
packages/
  contracts/
  config/
database/
  migrations/
  seeds/
infra/
  compose/
  containers/
  deploy/
scripts/
tests/
  integration/
  e2e/
  load/
docs/
  adr/
  runbooks/
  evidence/
.github/workflows/
```

Ajuste a localização das migrations ao padrão do ORM escolhido. Não duplique um diretório apenas para seguir o desenho acima. `contracts` contém contratos públicos, não entidades internas do ORM nem segredos.

### 6.5 Fronteiras dos módulos

Controller recebe HTTP e valida contrato; serviço de aplicação coordena a ação; domínio concentra invariantes; acesso a dados executa persistência. Aplique essa separação onde ajuda a clareza, sem criar uma interface e cinco arquivos vazios para cada chamada.

Um módulo não altera tabelas de outro por conveniência. Defina operações internas claras e fronteiras transacionais; a aprovação pode coordenar orçamento e ordem na mesma transação do monólito.

### 6.6 Decisões arquiteturais que merecem ADR

Um ADR contém contexto, alternativas, decisão, consequências, forma de verificação e gatilho de revisão.

1. Monólito modular e processos de API/worker.
2. Autenticação e sessões.
3. Modelo multiempresa e integridade das referências.
4. Orçamentos imutáveis e decisões idempotentes.
5. Proteção de concorrência da agenda.
6. Outbox, recuperação e limites da entrega de e-mail.
7. Armazenamento privado e validação de imagens.
8. Hospedagem, backups e restauração.

RLS no PostgreSQL pode entrar como defesa adicional após o isolamento da aplicação estar bem testado. Se adotada, teste com a role real da aplicação, sem privilégios de bypass, e estabeleça contexto por transação de forma compatível com pool de conexões. Não alegue proteção só porque `ENABLE ROW LEVEL SECURITY` aparece em uma migration. [Documentação de políticas](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## 7. Segurança e privacidade

### 7.1 Modelo de ameaças prático

Liste ativo, ameaça, impacto, proteção e teste. Cubra pelo menos:

- Usuário da empresa A tentando ler, alterar ou anexar arquivo na empresa B.
- Técnico tentando ver custos, equipe ou ordens que não lhe foram atribuídas.
- Cliente alterando identificador para aprovar outro orçamento.
- Link privado vazando em logs, analytics ou cabeçalho de referência.
- Requisições concorrentes causando decisões ou reservas incompatíveis.
- Arquivo disfarçado de imagem e abuso de armazenamento.
- Segredo em bundle frontend, repositório ou mensagem de erro.
- Conta de demonstração enviando e-mails a terceiros.

### 7.2 Matriz de autorização

| Ação | Administrador | Atendente | Técnico | Cliente por link |
|---|---|---|---|---|
| Configurar empresa/equipe | Sim | Não | Não | Não |
| Clientes e ordens | Sim | Sim | Só dados necessários das visitas atribuídas | Não |
| Elaborar/enviar orçamento | Sim | Sim | Não | Não |
| Consultar valores de orçamento | Sim | Sim | Não por padrão | Só proposta autorizada |
| Agendar/reagendar | Sim | Sim | Não | Não |
| Iniciar/concluir visita | Sim, com justificativa se atuar por outro | Não por padrão | Só as próprias | Não |
| Ver auditoria e reprocessar notificações | Sim | Não por padrão | Não | Não |
| Aceitar/recusar orçamento externo | Não pelo endpoint de cliente | Não | Não | Só versão autorizada |

Se a empresa precisar registrar uma decisão recebida por telefone, trate como funcionalidade futura com origem e ator explícitos. Não simule ação do cliente.

Autorização deve ser verificada no servidor e em cada acesso ao recurso, com negação como padrão. Os cenários de abuso acima são requisitos do projeto. [Referência OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### 7.3 Sessões e proteção HTTP

Use cookies `HttpOnly`, `Secure` em HTTPS e política `SameSite` adequada ao fluxo. Configure expiração, revogação, rotação após autenticação e comportamento ao remover associação da empresa. Proteja operações de escrita contra CSRF conforme a solução adotada; `SameSite` sozinho não substitui análise do fluxo.

Limite tentativas de login, recuperação e endpoints de token. Não revele existência de conta na recuperação. Use TLS e configuração explícita de origens; evite CORS amplo com credenciais. [Referência de sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### 7.4 Link privado do cliente

Proposta inicial: token aleatório criptograficamente forte, com pelo menos 256 bits de entropia, associado a uma versão e expiração. Guarde apenas hash na tabela de autorização. O token bruto que precisa ser enviado por e-mail exige tratamento transitório seguro: payload criptografado ou mecanismo equivalente, acesso mínimo e remoção após entrega/expiração. Não registre esse conteúdo em logs.

Uma implementação possível usa o token no fragmento da URL, lido pelo navegador e trocado via POST por sessão curta limitada à proposta; depois remove o fragmento do histórico. Isso reduz exposição ao servidor de páginas e a cabeçalhos de referência. Não adicione scripts de terceiros nessa página. Se escolher query/path, documente as medidas equivalentes de proteção e sanitização.

O GET da proposta nunca aprova nem consome a decisão: ferramentas de segurança de e-mail podem abrir links automaticamente. A decisão exige botão explícito, confirmação e POST protegido. Link expirado, substituído ou revogado não pode decidir. Limite a consulta ao conteúdo destinado ao cliente, sem observações internas.

### 7.5 Fotos e anexos

Escopo inicial proposto: JPEG, PNG e WebP, até 5 MB por arquivo e até 10 imagens por ordem, com limites de dimensões e processamento. Esses valores são escolhas do produto, ajustáveis após o piloto.

Requisitos de implementação:

- Autorizar antes do upload; gerar chave interna sem nome enviado pelo usuário.
- Bucket privado; URL assinada curta não concede acesso permanente.
- Validar formato pelo conteúdo e tentar decodificação em biblioteca mantida; limitar pixels e recursos utilizados.
- Reprocessar a imagem para formato permitido, removendo metadados como localização quando aplicável.
- Manter estado pendente/quarentena até validar; não servir objeto bruto não validado ao cliente.
- Validar empresa, recurso e permissão também no download.
- Aplicar quota por empresa e limpeza de uploads abandonados.
- Não aceitar SVG, HTML, documentos ou executáveis na primeira versão.

O desenho acima segue a orientação de restringir tipos, validar conteúdo e controlar acesso ao upload; os limites numéricos são decisões deste projeto. [Referência OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### 7.6 Dados pessoais e operação responsável

Colete apenas nome, contato e endereço necessários ao serviço. CPF, documentos pessoais, data de nascimento e dados financeiros não entram por padrão. Evite fotos de documentos ou pessoas.

Documente os dados armazenados, quem acessa, provedores envolvidos, retenção proposta e procedimento de exportação/exclusão. Políticas de retenção comercial e obrigações jurídicas devem ser definidas com o responsável antes de uso real; este roteiro não determina prazos legais nem certifica conformidade com a LGPD.

Em logs técnicos, use identificadores internos e mensagens sanitizadas. Auditoria comercial não deve armazenar cópias completas de cadastros ou tokens. Restrinja edição e exclusão de auditoria pela role da aplicação, sem prometer inviolabilidade contra administradores do banco.

### 7.7 Demonstração pública

Use dados sintéticos, ambiente separado do piloto e aviso visível de demonstração. E-mails são interceptados ou enviados apenas para destinatários controlados. Desabilite cobranças e integrações reais, limite escrita/uploads e restaure o dataset periodicamente com job restrito ao ambiente demo.

Nunca publique credenciais de uma empresa real. Uma conta demo não pode acessar endpoints administrativos de operação nem modificar outra demonstração isolada.

## 8. Experiência de uso

### 8.1 Telas da versão 1

1. Login e recuperação de acesso.
2. Aceite de convite.
3. Seleção de empresa quando o usuário tiver mais de uma associação.
4. Dashboard com pendências e atalhos para as respectivas listas filtradas.
5. Lista de ordens com busca e filtros por estado, técnico e período.
6. Cadastro de cliente/local/equipamento, com fluxo rápido durante a abertura.
7. Detalhe da ordem com resumo, orçamento, visitas, fotos e linha do tempo.
8. Editor e revisão de orçamento antes do envio.
9. Página privada do cliente com itens, total, validade e decisão.
10. Agenda simples diária/semanal; lista cronológica é suficiente para começar.
11. Área do técnico priorizando as visitas do dia e ações de execução.
12. Equipe/configurações para administrador.
13. Área operacional restrita com notificações falhas e reprocessamento auditado.

### 8.2 Padrões de interface

Adote componentes semânticos, contraste legível, foco visível, navegação por teclado e rótulos de formulário. Teste largura de celular e desktop. Botões de toque precisam ser confortáveis no uso em campo.

Para cada tela, defina estados de carregamento, vazio, erro, sucesso, acesso negado e sessão expirada. Campos inválidos devem indicar como corrigir, sem apagar o que a pessoa já preencheu.

Na aprovação, destaque versão, valor, condições e prazo. No conflito de agenda, preserve o formulário e informe indisponibilidade sem revelar outro cliente ou outra empresa. Em ações destrutivas, solicite confirmação contextual e motivo quando necessário.

Sem internet, informe que a ação não foi enviada. Não mostre sucesso baseado apenas em estado local. Sincronização offline fica fora do escopo.

### 8.3 Definição de tela concluída

A tela usa a API real, respeita permissões, funciona em celular, possui estados alternativos e participa de uma jornada verificável. Uma tela com números fixos ou botão sem efeito não está concluída, mesmo que pareça visualmente pronta.

## 9. Plano de implementação por fases

### 9.1 Organização do trabalho

Use um quadro com `Backlog`, `Pronto para executar`, `Em andamento`, `Em revisão`, `Concluído` e `Bloqueado`. Mantenha uma tarefa principal em andamento. Cada tarefa deve terminar com comportamento demonstrável, e não apenas com uma camada de código criada.

Modelo de tarefa:

```markdown
## Título
Problema e usuário afetado:
Comportamento esperado:
Escopo e exclusões:
Critérios de aceite:
Riscos: autorização, consistência, dados e integrações
Verificação necessária:
Documentação afetada:
Dependências:
```

Use branches curtas e commits coerentes. Uma PR deve explicar problema, comportamento resultante, decisões relevantes e verificação. Abra uma PR mesmo trabalhando sozinho quando ela ajudar a revisar uma fatia significativa; não crie cerimônia para cada ajuste cosmético.

### Fase 0 — Descoberta e recorte

**Objetivo:** definir para quem o sistema existe e qual fluxo será entregue primeiro.

**Faça:**

1. Inspecione o ambiente e o repositório, sem sobrescrever trabalho existente.
2. Leia este documento e registre dúvidas realmente bloqueantes.
3. Prepare o roteiro de entrevistas e execute as conversas possíveis.
4. Desenhe o fluxo atual e o proposto em uma página.
5. Registre hipótese de valor, persona, dor principal e restrições.
6. Confirme se há necessidade de diagnóstico antes do orçamento.
7. Defina o conjunto mínimo do piloto e crie backlog por jornadas.
8. Registre orçamento mensal pretendido e horas disponíveis, se informados; caso contrário, deixe pendentes explícitos.

**Entregáveis:** `docs/discovery.md`, `docs/product.md`, `docs/backlog.md`, `docs/progress.md`.

**Verificação:** consiga descrever uma ordem realista de ponta a ponta e indicar quem executa cada passo. Toda afirmação de descoberta deve ter origem ou ser marcada como hipótese.

**Resultado esperado:** escopo compreensível, problemas priorizados e um fluxo principal fechado. Sem entrevistas, o resultado é uma hipótese documentada e um protótipo a validar.

### Fase 1 — Projeto técnico e ambiente reproduzível

**Objetivo:** preparar a base mínima de desenvolvimento e decisões irreversíveis de curto prazo.

**Faça:**

1. Verifique ferramentas instaladas, versões e compatibilidade oficial.
2. Escolha e registre versões de Node, pnpm, Next.js, NestJS, PostgreSQL, ORM, autenticação e testes.
3. Crie o monorepo com configuração estrita, lint e formatação.
4. Prepare Compose local para PostgreSQL, storage compatível e captura de e-mail; use mocks de provedor apenas onde declarados.
5. Configure `.env.example` sem segredos, validação de configuração e mensagens claras para variáveis ausentes.
6. Prepare a primeira migration e seed exclusivamente de desenvolvimento/teste.
7. Faça web chamar um endpoint real da API, passando pelo prefixo que será usado em produção.
8. Configure CI com instalação por lockfile, tipos, lint, testes iniciais e build.
9. Defina a estratégia de hospedagem e registre uma estimativa de custo com valores consultados na ocasião.
10. Crie os primeiros ADRs e um diagrama simples.

**Entregáveis:** repositório executável, lockfile, configuração local, CI inicial, `.env.example`, `docs/setup.md`, `docs/architecture.md`, `docs/adr/`.

**Verificação:** um clone limpo consegue instalar, subir dependências, aplicar migrations e abrir a web seguindo o README. O processo falha claramente se faltar configuração obrigatória.

**Resultado esperado:** esqueleto integrado e reproduzível. Nenhuma funcionalidade comercial é declarada pronta nesta fase.

### Fase 2 — Identidade, empresas e permissões

**Objetivo:** construir o contexto de segurança antes de cadastrar dados comerciais.

**Faça:**

1. Integre a solução de autenticação escolhida com sessão revogável.
2. Implemente empresa, associações e criação controlada do primeiro administrador.
3. Implemente convites com expiração e uso único, e impeça escalada de papel.
4. Implemente contexto de empresa validado no servidor.
5. Crie a matriz de autorização em código, sem confiar na navegação da interface.
6. Faça remoção de associação e alteração de papel terem efeito sem depender de expirar um token longo.
7. Configure login, logout, recuperação e verificação de e-mail conforme a biblioteca/provedor.
8. Crie duas empresas sintéticas e usuários de cada papel para testes.

**Verificação:** teste um usuário sem sessão, associação removida, convite repetido/expirado, técnico em ação administrativa e troca de empresa. Um membro de A não obtém dados de B, inclusive por referências no corpo da requisição.

**Resultado esperado:** usuários reais ou de teste controlado conseguem entrar e operar apenas no escopo permitido. Essa fase estabelece as proteções reaproveitadas nas demais.

### Fase 3 — Primeira fatia comercial: abrir e consultar uma ordem

**Objetivo:** entregar o primeiro fluxo útil com persistência real.

**Faça:**

1. Modele cliente, endereço e equipamento com referências coerentes por empresa.
2. Implemente cadastro e edição com validação e arquivamento quando necessário.
3. Implemente abertura de ordem e geração segura do número interno.
4. Implemente listagem paginada, busca limitada e detalhe da ordem.
5. Registre criação e início de triagem na linha do tempo e auditoria.
6. Implemente o comando de triagem com proteção de transição.
7. Entregue a interface completa dessa jornada, incluindo celular e erros.

**Verificação:** criar cliente/local/equipamento, abrir ordem, recarregar a página e localizar o mesmo registro. Tentar criar ordem com equipamento de outra empresa ou de outro cliente deve falhar. Dois cadastros simultâneos não recebem o mesmo número de ordem dentro da empresa.

**Resultado esperado:** a equipe já consegue registrar um atendimento e encontrar seu contexto sem planilha paralela para essa tarefa.

### Fase 4 — Orçamentos, versões e decisão do cliente

**Objetivo:** fechar o acordo comercial com integridade e rastreabilidade.

**Faça:**

1. Implemente itens, cálculo de valores e validação de descontos no servidor.
2. Crie rascunho, visualização de revisão e comando de envio.
3. Torne a versão enviada imutável; gere snapshot dos termos e contexto necessário.
4. Implemente revisão e invalidação de versão anterior na mesma transação.
5. Implemente token privado, troca por contexto limitado e página de proposta.
6. Implemente aceite/recusa com concorrência e repetição protegidas.
7. Registre mudanças de estado, decisão, auditoria e evento pendente.
8. No desenvolvimento, exiba o link apenas em ferramenta local restrita ou caixa de e-mail de teste; nunca crie endpoint público de listagem de tokens.
9. Trate expiração no comando de decisão e posteriormente em job de normalização.

**Verificação:** duas aprovações simultâneas produzem uma decisão e um evento comercial; aceite seguido de recusa não altera a decisão. Link antigo não aprova versão nova. GET da proposta não altera seu estado. Alterar o cadastro do cliente não muda o snapshot já enviado.

**Resultado esperado:** um cliente de teste consegue decidir sobre uma proposta específica e a equipe vê o resultado correto, inclusive após repetição ou revisão.

### Fase 5 — Agenda, diagnóstico e concorrência

**Objetivo:** reservar capacidade sem inconsistência entre atendimentos.

**Faça:**

1. Implemente tipos de visita e regras de elegibilidade da ordem.
2. Defina tratamento de fuso e formato de entrada da API.
3. Adicione constraint ou mecanismo transacional que impeça sobreposição real.
4. Implemente agenda por técnico, dia e semana, começando por lista se necessário.
5. Implemente reagendamento e cancelamento atômicos com histórico.
6. Trate revisão de orçamento como cancelamento da reserva de execução anterior.
7. Garanta que técnico esteja com associação ativa e papel elegível.

**Verificação:** use duas conexões/requisições concorrentes. Para intervalos incompatíveis, uma vence e a outra recebe conflito. Intervalos adjacentes são aceitos. Visitas canceladas liberam capacidade. Diagnóstico pode ocorrer antes do orçamento; execução não.

**Resultado esperado:** o atendente organiza visitas com confiança e sabe quando precisa escolher outro horário.

### Fase 6 — Execução em campo e imagens privadas

**Objetivo:** concluir o serviço pelo celular e preservar o histórico.

**Faça:**

1. Entregue a área de visitas do técnico com ordenação por horário.
2. Mostre apenas dados operacionais necessários ao trabalho atribuído.
3. Implemente início e conclusão de diagnóstico e execução com regras distintas.
4. Exija resumo de execução; fotos podem ser opcionais conforme validação com a empresa.
5. Implemente iniciação, validação e finalização de anexos privados.
6. Implemente download autorizado e limpeza de uploads abandonados.
7. Faça conclusão de execução atualizar ordem e eventos na mesma transação.
8. Trate perda de conexão e repetição sem mostrar sucesso falso.

**Verificação:** técnico não atribuído não acessa nem conclui visita, mesmo manipulando a URL. Arquivo inválido não é publicado. URL expirada deixa de servir o objeto. Concluir diagnóstico mantém a ordem aberta para orçamento; concluir execução encerra o fluxo previsto.

**Resultado esperado:** um técnico consegue consultar, executar e registrar a visita no celular com dados persistidos e imagens protegidas.

### Fase 7 — Notificações confiáveis e tarefas de manutenção

**Objetivo:** enviar comunicações fora da requisição e recuperar trabalho após falhas.

**Faça:**

1. Grave eventos relevantes na outbox junto com a alteração comercial.
2. Implemente worker com aquisição concorrente segura, lease e recuperação.
3. Crie entregas por evento/destinatário/canal com unicidade adequada.
4. Implemente integração de e-mail com timeout e política de tentativas.
5. Classifique erros permanentes e transitórios; não repetir endereço definitivamente rejeitado sem ação.
6. Adote backoff com jitter, limite de tentativas e estado de falha definitiva.
7. Implemente reprocessamento administrativo auditado com semântica clara.
8. Suprima eventos que ficaram obsoletos antes do envio, como link de proposta já revogada.
9. Adicione jobs de expiração e limpeza com liderança/locking para não executar de forma conflitante.
10. Entregue painel restrito de fila, idade do pendente mais antigo e falhas.

**Política inicial proposta:** timeout de envio de 15 segundos, lease de 2 minutos, até 8 tentativas com espera exponencial limitada a 1 hora e jitter. São parâmetros iniciais; ajuste após medir o provedor. O timeout deve ser menor que o lease e o worker deve renovar o lease se o processamento puder ultrapassá-lo.

**Verificação:** parar o worker, aprovar orçamento, confirmar pendência e reiniciar; evento é processado. Derrubar processo após aquisição permite recuperação depois do lease. Simular falha após o provedor aceitar expõe e verifica o comportamento de deduplicação realmente disponível.

**Resultado esperado:** comunicação rastreável, recuperável e com limites conhecidos; o sucesso comercial não depende da disponibilidade imediata do e-mail.

### Fase 8 — Dashboard e acabamento do piloto

**Objetivo:** tornar o fluxo utilizável no trabalho diário.

**Faça:**

1. Construa indicadores a partir dos dados reais: abertas, aguardando decisão, visitas do dia e serviços concluídos no período.
2. Defina cada indicador e permita abrir a lista que o compõe.
3. Adicione busca e filtros sem consultas ilimitadas.
4. Revise mensagens, estados vazios, carregamento, acessibilidade e celular.
5. Faça uma sessão de uso acompanhado com tarefas concretas.
6. Registre dificuldades observadas e corrija os obstáculos do fluxo principal.

**Verificação:** outra pessoa percorre abertura, orçamento, decisão, agenda e execução. Compare os contadores com registros conhecidos. Uma falha de API é exibida com orientação e `requestId` útil para suporte.

**Resultado esperado:** marco de piloto funcional atingido. O piloto ainda precisa passar pela preparação operacional antes de receber dependência real do negócio.

### Fase 9 — Segurança, desempenho e preparação operacional

**Objetivo:** fechar riscos que uma demonstração visual não revela.

**Faça:**

1. Execute a matriz de autorização em todas as entidades e endpoints relevantes.
2. Revise queries, paginação, payloads e limites de upload.
3. Rode cenários concorrentes de decisão, revisão, cancelamento e agenda.
4. Instrumente operações críticas com logs correlacionados, métricas e traces.
5. Faça teste de carga moderado com massa sintética e ambiente descrito.
6. Teste migrations em banco vazio e em snapshot sintético da versão anterior.
7. Faça restauração de backup e confira integridade do fluxo restaurado.
8. Revise dependências, segredos, configuração HTTP e modelo de ameaças.
9. Documente limitações, procedimentos de incidente e políticas de dados.

**Verificação:** evidências ficam em `docs/evidence/` sem dados pessoais. Bloqueadores de acesso cruzado, corrupção de valores, reserva conflitante e perda de backup impedem marcar a versão como pronta.

**Resultado esperado:** candidato a release com riscos conhecidos e verificações repetíveis.

### Fase 10 — Staging e produção

**Objetivo:** publicar o mesmo artefato que foi verificado, com procedimento de reversão.

**Faça:**

1. Escolha provedores e confirme custo, região, limites e autorização para despesas.
2. Configure staging isolado; use apenas dados sintéticos e destinatários controlados.
3. Construa imagens identificadas por commit e publique no registry autorizado.
4. Faça deploy em staging com banco, storage e e-mail de teste configurados.
5. Aplique migrations compatíveis e rode smoke tests.
6. Ensaie reversão de aplicação e restauração de banco em ambiente seguro.
7. Configure produção, DNS, HTTPS, banco e storage privados, alertas e backups.
8. Aplique migrations uma única vez por release, antes de escalar processos dependentes.
9. Publique o artefato verificado e execute smoke tests de produção com conta controlada.
10. Registre release, commit, resultado, custo previsto e pendências.

**Verificação:** fluxo completo pelo domínio HTTPS, reinício de containers sem perda de dados, banco inacessível publicamente quando a arquitetura permitir, arquivos privados e alerta de erro recebendo eventos de teste.

**Resultado esperado:** marco de versão 1 em produção, com operação controlada. Se faltarem conta, domínio ou credenciais, a fase fica parcialmente bloqueada; entregue configuração e instruções concretas sem declarar publicação concluída.

### Fase 11 — Piloto acompanhado e estabilização

**Objetivo:** observar se o produto funciona no contexto escolhido.

**Faça:**

1. Faça onboarding do responsável e da equipe que vai testar.
2. Explique o recorte do piloto, limites e forma de suporte.
3. Acompanhe primeiros serviços sem exigir migração total do negócio.
4. Registre fricções, dúvidas, falhas e tarefas realizadas fora do sistema.
5. Corrija primeiro erros e obstáculos de uso; adie funcionalidades fora do objetivo.
6. Observe métricas por duas a quatro semanas quando houver volume e disponibilidade.
7. Compare com a linha de base e relate tamanho da amostra e limitações.

**Verificação:** feedback e uso reais, com permissão para mencionar os resultados. Se não houver empresa piloto, faça teste de usabilidade com pessoas convidadas e descreva exatamente esse tipo de evidência.

**Resultado esperado:** versão estabilizada e um estudo de caso honesto sobre o que funcionou e o que precisa mudar.

### Fase 12 — IA opcional e apresentação final

**Objetivo:** adicionar uma melhoria mensurável e apresentar o projeto com clareza.

Siga a seção 12 para decidir se a IA merece entrar. Prepare os materiais da seção 13 mesmo se a conclusão for manter a solução sem IA.

**Resultado esperado:** projeto demonstrável, documentação consistente e uma evolução técnica sustentada por avaliação, caso implementada.

### 9.2 Estimativa de planejamento

Como referência inicial de organização, reserve de 180 a 300 horas para uma versão com esse escopo, sem contar espera por usuários e eventuais estudos extensos. É uma estimativa proposta, não uma garantia: experiência, integração de autenticação, refinamento visual e operação podem ampliar bastante esse esforço.

Com 15 horas semanais, essa referência corresponde aproximadamente a 12 a 20 semanas. Planeje cerca de 20 a 40 horas adicionais para a evolução com IA e sua avaliação, se ela fizer sentido. Reestime após as duas primeiras fatias usando tempo efetivamente gasto.

Se tiver menos tempo, reduza acabamento do dashboard e mantenha agenda em lista. Preserve isolamento, integridade, privacidade, testes críticos e recuperação de dados. Não esconda segurança como tarefa opcional de última hora.

## 10. Testes e evidências de qualidade

### 10.1 Estratégia

Teste os riscos e os comportamentos relevantes. Não busque uma porcentagem de cobertura como substituto da análise de risco.

- **Unitários:** cálculo de orçamento, transições de estado, política de autorização e classificação de tentativas quando a lógica for isolável.
- **Integração:** banco PostgreSQL real em ambiente descartável, constraints, transações, consultas por empresa, idempotência e endpoints.
- **Ponta a ponta:** jornadas principais pelo navegador e integração entre web/API/banco.
- **Contratos de provedores:** formato de requisições/respostas e falhas simuladas, complementados por verificação em sandbox real.
- **Operacionais:** parar worker, reiniciar processo, falhar migration em staging, restaurar backup e reverter release.

Não substitua PostgreSQL por SQLite para provar comportamento de constraints, intervalos e bloqueios. Nos testes concorrentes, use conexões independentes e sincronização que force sobreposição real; duas chamadas executadas uma depois da outra não comprovam concorrência.

### 10.2 Matriz mínima de cenários

| ID | Cenário | Evidência de aceite |
|---|---|---|
| T01 | Usuário A tenta acessar ordem de B | Nenhum dado ou alteração; resposta conforme política |
| T02 | Referência a cliente/endereço/equipamento de outra empresa | Rejeição na API e integridade protegida no banco |
| T03 | Técnico tenta acessar visita não atribuída | Acesso negado também no backend |
| T04 | Associação removida enquanto sessão permanece aberta | Operação seguinte perde acesso à empresa |
| T05 | Orçamento com desconto inválido e total manipulado | Servidor rejeita ou recalcula de acordo com contrato |
| T06 | Duas decisões iguais simultâneas | Uma decisão e um evento comercial |
| T07 | Aceite e recusa simultâneos | Um resultado válido; outro retorna resultado/conflito previsto |
| T08 | Revisão concorrente com aceite | Apenas uma transição compatível; nenhuma aprovação da versão revogada |
| T09 | Link expirado, revogado e aberto por GET | Sem decisão indevida; estado comercial preservado |
| T10 | Duas reservas sobrepostas concorrentes | Uma reserva ativa; outra recebe conflito |
| T11 | Reservas adjacentes e visita cancelada | Capacidade liberada conforme intervalo definido |
| T12 | Reagendamento concorrente com outra reserva | Constraint/invariante continua válida |
| T13 | Conclusão duplicada de execução | Uma conclusão e efeitos únicos no domínio |
| T14 | Worker parado durante evento comercial | Evento permanece pendente e é retomado |
| T15 | Worker morre depois de adquirir evento | Outro processamento recupera após lease |
| T16 | Provedor aceita e processo morre antes de confirmar | Comportamento de deduplicação ou duplicação residual documentado |
| T17 | Upload com extensão correta e conteúdo inválido | Não publicado; rejeição e limpeza |
| T18 | URL/identificador de anexo de outra empresa | Sem acesso ao conteúdo |
| T19 | Sessão expirada e tentativa CSRF | Escrita não autorizada impedida |
| T20 | Clone e banco vazios | Setup documentado funciona |
| T21 | Atualização da versão anterior | Migration preserva dados e compatibilidade esperada |
| T22 | Backup restaurado | Dados e referências amostradas íntegros; app inicia |
| T23 | Jornada completa no celular | Tarefa concluída sem bloqueador de interface |
| T24 | Dashboard com massa conhecida | Indicadores batem com as definições |
| T25 | Conta demo tenta enviar para terceiro | Envio real bloqueado/interceptado |
| T26 | Reinício e release anterior | Sistema recupera operação conforme procedimento |

Para cada cenário, registre em que nível foi verificado. Teste automatizado local não comprova automaticamente a configuração da produção.

### 10.3 Verificação de desempenho

Crie uma massa sintética pequena, mas suficiente para observar paginação e índices: por exemplo, 10 empresas, 10 mil ordens no total e visitas distribuídas. Identifique claramente a origem sintética e restrinja geração a ambientes de teste.

Teste listagem paginada, detalhe de ordem, agenda e decisão de orçamento com mistura realista. Comece com 20 usuários virtuais por 10 minutos, antes de aumentar. Nunca faça teste de carga contra serviço de terceiros sem permissão; substitua e-mail e IA por adaptadores controlados.

Metas iniciais de engenharia, a validar no hardware escolhido:

- p95 de endpoints comuns abaixo de 500 ms, excluindo upload e chamadas externas.
- Falhas inesperadas abaixo de 1% no cenário definido; conflitos de negócio esperados não contam como erro inesperado.
- Nenhuma quebra de integridade após o teste.
- Documentação de CPU, memória, versão, dataset, tráfego e gargalo observado.

Se a meta não for atingida, investigue consulta, índice, N+1, pool e volume antes de acrescentar cache ou distribuir serviços. Não extrapole esse ensaio para uma alegação de milhões de usuários.

### 10.4 Comandos de verificação

O agente deve criar scripts de projeto equivalentes aos abaixo e documentar o que cada um executa. Estes são contratos desejados para o repositório, não comandos já existentes ou já verificados:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm smoke -- --base-url=https://SEU_DOMINIO
```

`test:integration` e `test:e2e` devem apontar somente para bancos/contas de teste com proteções contra uso acidental de produção. O script de smoke precisa ser não destrutivo ou usar recursos controlados com identificação e limpeza segura. Não execute o placeholder acima sem substituir e autorizar o destino.

### 10.5 Registro de evidências

Modelo para `docs/evidence/YYYY-MM-DD-release.md`:

```markdown
Commit e versão:
Ambiente e recursos:
Data/hora e fuso:
Cenários executados:
Comandos e saída resumida:
Resultados medidos:
Falhas e correções:
Limitações:
Evidências sanitizadas:
Responsável pela execução:
```

## 11. Deploy, custos e operação

### 11.1 Caminho de referência para hospedagem

Para tornar a implantação concreta, use inicialmente este desenho: uma VPS Linux com Docker Compose para proxy, web, API e worker; PostgreSQL gerenciado; storage privado compatível com S3; e provedor transacional de e-mail.

Esse desenho ajuda a demonstrar operação de containers e mantém dados fora do disco efêmero da aplicação. A VPS única é ponto de falha da aplicação; não alegue alta disponibilidade. Se preferir uma plataforma gerenciada de containers, substitua a camada de execução e preserve os contratos operacionais abaixo.

A escolha da marca/provedor depende de orçamento, região, formas de pagamento e limites consultados na fase 1. O plano não exige contratar serviço agora. Antes da contratação, monte uma comparação curta com custo mensal total, backups, rede privada, saída de dados e operação exigida.

Se usar PostgreSQL no mesmo servidor por limitação de orçamento, declare o ponto único de falha e implemente backup externo automático, teste de restauração, monitoramento de disco e procedimento de recuperação. Volume Docker persistente sozinho não é backup.

### 11.2 Ambientes

| Ambiente | Dados | Integrações | Finalidade |
|---|---|---|---|
| Local | Sintéticos | Captura local/sandbox | Desenvolvimento |
| CI | Descartáveis | Fakes e testes controlados | Verificação automatizada |
| Staging | Sintéticos | Sandbox/destinatários permitidos | Validar release e operação |
| Demo pública | Sintéticos e limitados | Envio externo desabilitado | Portfólio |
| Produção piloto | Reais autorizados | Provedores reais autorizados | Uso pela empresa |

Use bancos, buckets, credenciais e limites separados. Staging e demo podem ter capacidade menor; nunca compartilhem dados reais ou segredos com produção. Se compartilhar um host por custo, documente o isolamento e a disputa de recursos.

### 11.3 Configuração de domínio e proxy

Use um domínio por ambiente. Sirva web e API pela mesma origem para simplificar cookies e política de acesso. O proxy encaminha `/api/*` para a API e as demais rotas para a web, sem remover o prefixo esperado pelo backend.

Exemplo ilustrativo de Caddy, a validar no ambiente real:

```caddyfile
{$APP_DOMAIN} {
    handle /api/* {
        reverse_proxy api:3001
    }
    handle {
        reverse_proxy web:3000
    }
}
```

Esse fragmento não é a configuração completa de produção. Acrescente limites de payload, timeouts, política de headers, proteção dos caminhos internos, armazenamento persistente dos certificados e logs sanitizados. Configure a aplicação para confiar apenas no proxy esperado ao interpretar origem/IP. O domínio deve ter DNS apontado corretamente e os pré-requisitos de emissão de TLS precisam ser atendidos.

O uso de `handle` preserva o prefixo da rota; não troque por `handle_path` sem ajustar o backend, pois essa diretiva remove o prefixo correspondente. [Referência do Caddy](https://caddyserver.com/docs/caddyfile/directives/handle).

Em self-hosting, o Next.js recomenda colocar um reverse proxy na frente do servidor. Confira também o comportamento de cache e variáveis da versão adotada. [Guia oficial](https://nextjs.org/docs/app/guides/self-hosting).

### 11.4 Containers e configuração

- Use builds em múltiplos estágios e usuário sem privilégios no runtime.
- Imagens por commit e digest; mantenha a release anterior acessível.
- Não inclua `.env`, credenciais, dados locais ou ferramentas desnecessárias na imagem.
- Processe configuração obrigatória na inicialização e falhe com mensagem sanitizada.
- Configure limite de recursos, restart policy, healthchecks e encerramento gracioso.
- API e worker não expõem portas públicas diretamente; somente o proxy deve recebê-las.
- Banco gerenciado exige TLS validado e acesso restrito por rede/credencial conforme o provedor.
- Limite pools de conexão por processo; a soma de web/API/worker/jobs precisa caber no banco.
- Configure rotação de logs e alertas de disco, sem deixar o host encher silenciosamente.

Os healthchecks da API, neste contrato com prefixo global, ficam em `/api/v1/health/live` e `/api/v1/health/ready`. Liveness confirma que o processo responde; readiness confirma configuração e acesso ao banco necessários para atender. Indisponibilidade do provedor de e-mail não deve derrubar a prontidão da API se a outbox continua aceitando eventos. Worker tem heartbeat próprio e alerta por atraso; uma rota HTTP saudável da API não comprova que o worker está executando.

Na VPS, mantenha atualização de segurança do sistema, acesso SSH por chave e firewall expondo apenas o necessário, sem publicar o socket Docker. Persistência de certificados e configurações do proxy deve sobreviver à recriação dos containers. Registre quem tem acesso administrativo e como esse acesso é revogado.

Variáveis de referência, adaptadas ao mecanismo de autenticação e provedores escolhidos:

```dotenv
NODE_ENV=development
APP_ENV=local
APP_DOMAIN=localhost
PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=<definida-no-ambiente>
SESSION_SECRET=<segredo-aleatorio-fora-do-repositorio>
TOKEN_PAYLOAD_ENCRYPTION_KEY=<chave-fora-do-repositorio>
STORAGE_ENDPOINT=<endpoint>
STORAGE_REGION=<regiao>
STORAGE_BUCKET=<bucket-privado>
STORAGE_ACCESS_KEY_ID=<credencial>
STORAGE_SECRET_ACCESS_KEY=<credencial>
EMAIL_PROVIDER=<adaptador>
EMAIL_API_KEY=<credencial>
EMAIL_FROM=<remetente-verificado>
EMAIL_ALLOWED_RECIPIENTS=<restricao-para-demo-staging>
OTEL_EXPORTER_OTLP_ENDPOINT=<coletor-se-utilizado>
RELEASE_SHA=<commit>
DEMO_MODE=true
```

Essas são chaves propostas, não uma configuração pronta para copiar com segurança em produção. `.env.example` contém placeholders. Segredos ficam no mecanismo de secrets do host/provedor. Nada secreto recebe prefixo de variável pública do frontend. Garanta que valores públicos de build sejam consistentes com a estratégia de promoção da imagem entre ambientes.

### 11.5 Pipeline de entrega

**Em PR:**

1. Checkout de código e instalação pelo lockfile.
2. Lint, tipos e testes unitários.
3. PostgreSQL de teste, migrations e testes de integração.
4. Build de web/API/worker.
5. Jornadas E2E com dependências controladas.
6. Verificação de segredos e dependências; falhas relevantes são triadas.

**Após merge/release autorizada:**

1. Construir e publicar imagens uma vez, identificadas pelo commit.
2. Fazer deploy em staging e executar migration compatível por tarefa única.
3. Rodar smoke tests e registrar a release.
4. Promover os mesmos artefatos para produção após cumprir os gates definidos.
5. Conferir backup recente e plano de reversão antes de migration relevante.
6. Executar migration de produção uma vez; não em cada réplica ao iniciar.
7. Atualizar os serviços, aguardar prontidão e verificar fluxo de teste controlado.
8. Observar erros/latência/fila e registrar resultado.

Use permissões mínimas no workflow, secrets por ambiente e identidade temporária quando o provedor suportar. Fixe actions externas por commit completo e mantenha rotina de atualização. [Referência GitHub](https://docs.github.com/en/actions/reference/security/secure-use).

### 11.6 Migrations e reversão

Mantenha migrations versionadas, revisadas e testadas em banco vazio e na versão anterior. A sintaxe exata do ORM deve ser obtida da documentação da versão fixada. Prisma tem fluxos e comandos dependentes da versão; não misture instruções de releases diferentes. [Documentação de migrations](https://docs.prisma.io/docs/orm/migrations/how-migrations-work).

Use mudança compatível em etapas: adicionar estrutura nova, publicar código capaz de conviver com a antiga, migrar dados de forma limitada e observável e só depois remover o que ficou obsoleto. Não faça remoção de coluna e reversão de aplicação incompatível na mesma operação sem plano específico.

Rollback da imagem não desfaz migration. Restaurar banco pode perder alterações posteriores ao ponto restaurado e exige decisão operacional. Prefira correção progressiva para mudanças de dados quando seguro; reserve restauração para o cenário apropriado e ensaie antes.

Nunca rode reset de banco, seed destrutivo ou sincronização automática de schema em produção. Scripts de seed precisam recusar `APP_ENV=production` por padrão.

### 11.7 Worker e entrega de notificações

O evento da outbox é persistido na mesma transação da mudança de negócio; isso elimina a lacuna entre gravar o estado e registrar a intenção de envio. A entrega posterior pode repetir, então deduplicação continua necessária. [Referência do padrão](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

Implementação de referência:

1. Em transação curta, selecionar eventos elegíveis com mecanismo como `FOR UPDATE SKIP LOCKED`.
2. Marcar dono do lease, validade e tentativa; confirmar a transação.
3. Fazer chamada externa fora do bloqueio de banco.
4. Registrar resultado apenas se ainda possuir o lease esperado.
5. Se falhar, reagendar com backoff ou marcar falha definitiva.
6. Recuperar leases expirados; usar relógio do banco para consistência de disponibilidade.

`SKIP LOCKED` pode ajudar consumidores concorrentes de uma tabela semelhante a fila, mas não substitui transações e não serve para qualquer consulta de negócio. [Referência PostgreSQL](https://www.postgresql.org/docs/current/sql-select.html).

**Limite essencial:** pode ocorrer falha após o provedor aceitar o e-mail e antes de o worker gravar sucesso. Se o provedor oferece chave idempotente, use uma chave estável por entrega e verifique a janela de retenção. Se não oferece, uma duplicação residual de e-mail pode ocorrer. Documente esse limite; não prometa entrega exatamente uma vez.

Uma unique constraint em `NotificationDelivery` evita dois registros locais da mesma entrega, mas não resolve sozinha a duplicação externa nessa janela. Preserve idempotência do estado comercial independentemente disso. Reenvio intencional deve ser ação distinta, autorizada e auditada.

Antes de enviar e-mails reais, verifique domínio/remetente e configure os registros de autenticação pedidos pelo provedor, como SPF, DKIM e DMARC, seguindo a documentação do serviço escolhido. Envie testes apenas a caixas controladas e registre o resultado. Aceitação da API do provedor deve ser estado `ACCEPTED_BY_PROVIDER`, não prova de entrega na caixa do cliente. Se implementar callbacks de entrega/bounce, valide assinatura, deduplique eventos e registre rejeições; se não implementar, exponha a limitação no painel operacional.

### 11.8 Observabilidade e metas operacionais

Comece pelos sinais que respondem a perguntas reais:

- Taxa de erro e latência por rota normalizada.
- Disponibilidade observada externamente.
- Conexões e latência de banco.
- Eventos pendentes, idade do mais antigo, tentativas e falhas definitivas.
- Memória, CPU e disco do host.
- Data do último backup verificado e último ensaio de restauração.

Inclua `requestId`, `traceId`, `release`, `organizationId` e identificadores internos onde forem úteis e seguros. Não use e-mails, tokens, descrições completas ou IDs únicos como labels de métricas, evitando exposição e cardinalidade excessiva. Logs, métricas e traces cumprem papéis complementares. [Referência OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/).

Metas propostas para o piloto, sujeitas a validação:

- Disponibilidade mensal da aplicação de 99,5%, calculada por monitor externo com metodologia registrada.
- Nenhum evento elegível pendente por mais de 5 minutos em operação normal sem gerar alerta.
- Alerta de erro acima de limiar definido por uma janela, com volume mínimo para evitar ruído.
- Alerta de disco antes de esgotar capacidade.

Não chame essas metas de SLA contratado nem diga que foram cumpridas antes de medir o período. Provedor de e-mail e aplicação podem ter indicadores separados.

### 11.9 Backups e recuperação

Proposta inicial de objetivo: **RPO de até 24 horas** e **RTO de até 4 horas** para o piloto. RPO é quanto de dado recente se admite perder; RTO é quanto tempo se busca levar para recuperar. São objetivos de desenho, não garantias. Se a empresa precisar de menos perda, escolha PITR e infraestrutura compatíveis e faça o ensaio correspondente.

Plano:

1. Habilitar backup automático do banco com retenção proposta de 14 dias, ajustada ao custo e à política definida.
2. Proteger backups com criptografia e acesso separado da aplicação quando possível.
3. Proteger também objetos de fotos com versionamento/backup e política de retenção coerente.
4. Guardar configuração de infraestrutura, versões e procedimento de reconstrução; proteger chaves necessárias à recuperação.
5. Monitorar falhas dos backups e não apenas a criação do agendamento.
6. Restaurar em ambiente isolado antes do piloto e mensalmente durante a operação inicial.
7. Após restaurar, impedir envio automático de notificações antigas até reconciliar o estado e liberar o worker conscientemente.

Verifique clientes/ordens amostrados, relações, totais, fotos e aplicação inicializando. Registre horário do ponto recuperado, duração real, lacunas e passos manuais. Um backup só do banco não restaura fotos externas; disponibilidade de objetos precisa ser verificada separadamente.

### 11.10 Runbooks obrigatórios

Crie instruções executáveis, com acesso necessário, diagnóstico, ação, verificação e comunicação ao responsável:

1. Aplicação indisponível.
2. Erros de banco ou pool esgotado.
3. Fila acumulada/provedor de e-mail fora do ar.
4. Migration falhou.
5. Reverter versão da aplicação.
6. Restaurar banco e objetos.
7. Rotacionar segredo e invalidar sessões.
8. Suspeita de acesso indevido entre empresas.
9. Disco cheio ou aumento inesperado de custo.
10. Pedido de exportação/exclusão de dados.

Exemplo de investigação de fila: verificar último heartbeat do worker, estado dos eventos, idade do pendente mais antigo, erro sanitizado do provedor e leases expirados. Corrigir a causa antes de reprocessar. Não reenviar todos os eventos por tentativa sem analisar o efeito.

### 11.11 Controle de custos

Crie `docs/costs.md` com data da consulta, moeda, impostos/câmbio quando aplicáveis, limites e custos de excedente. Não presuma que plano gratuito inclui backup, worker persistente ou uso comercial.

| Item | Estimativa mensal consultada | Limite/risco | Medida de controle |
|---|---|---|---|
| VPS/containers | Preencher | CPU, memória e disco | Limites e monitoramento |
| PostgreSQL | Preencher | Storage, conexões, backup e recuperação | Pool e retenção |
| Storage | Preencher | Volume, requisições e egress | Quotas e limpeza |
| E-mail | Preencher | Mensagens, reputação e excedentes | Quotas e destinatários de teste |
| Observabilidade | Preencher | Ingestão e retenção | Amostragem e sanitização |
| Domínio | Preencher/anualizar | Renovação | Registrar responsável e vencimento |
| IA, se usada | Preencher | Tokens e repetição | Limite por empresa e kill switch |

Configure aviso a 80% do orçamento definido, quando a plataforma permitir, e alertas de consumo anormal. Defina limites que a aplicação consegue impor; um alerta de cobrança não impede a despesa sozinho.

### 11.12 Checklist de release

- [ ] Commit identificado e verificações relevantes aprovadas.
- [ ] Nenhum bloqueador de autorização, integridade ou recuperação aberto.
- [ ] Configuração e segredos por ambiente revisados.
- [ ] Backup recente e recuperação ensaiada.
- [ ] Migration compatível e forma de recuperação documentadas.
- [ ] Artefato verificado em staging.
- [ ] Plano de reversão e release anterior disponíveis.
- [ ] Monitoramento e alertas ativos.
- [ ] Smoke tests em produção executados com recursos controlados.
- [ ] Janela inicial de observação concluída e resultado registrado.

## 12. IA como evolução mensurável

### 12.1 Funcionalidade candidata

A IA transforma a descrição livre de uma solicitação em uma **sugestão de triagem**, que um atendente revisa. Ela pode propor categoria, resumir fatos e indicar informações que faltam.

Exemplo:

```text
Entrada:
"O ar do escritório liga, mas não gela. Começou ontem. A unidade faz barulho."

Sugestão:
Categoria: refrigeração insuficiente.
Resumo: equipamento liga sem resfriar; relato iniciado ontem; há ruído.
Perguntas: marca/modelo? há código de erro? qual a capacidade do equipamento?
Aviso: classificação de atendimento; não é diagnóstico técnico confirmado.
```

A funcionalidade não define preço, não promete diagnóstico, não agenda nem envia comunicações sozinha. Questões de segurança no atendimento são encaminhadas à equipe; não transforme o projeto em um sistema de instrução autônoma de reparo.

### 12.2 Antes de implementar

Pergunte se a triagem manual realmente consome tempo ou gera erro. Construa uma alternativa simples sem IA, como formulário com categoria e perguntas sugeridas por regra. Compare com ela; não compare apenas com ausência de ferramenta.

Escolha provedor/modelo depois de verificar documentação atual, custo, limites, política de dados e disponibilidade. Nenhum modelo específico é obrigatório. Não mande nome, telefone, endereço ou fotos por padrão; use apenas a descrição necessária, preferencialmente sanitizada.

### 12.3 Contrato de saída

Exemplo de estrutura, com enumerações definidas pelo produto:

```json
{
  "category": "INSUFFICIENT_COOLING",
  "summary": "Equipamento liga, não resfria e apresenta ruído segundo o relato.",
  "reportedFacts": ["Liga", "Não resfria", "Ruído relatado"],
  "missingInformation": ["Marca e modelo", "Código de erro"],
  "needsHumanReview": true,
  "reasonForReview": "Relato insuficiente para confirmar diagnóstico técnico."
}
```

Valide schema, tamanho de campos e categorias no servidor. Texto do usuário é dado não confiável; instruções contidas nele não alteram as regras do sistema. A integração não recebe ferramentas para modificar registros comerciais nem credenciais de outros serviços.

### 12.4 Conjunto de avaliação

Prepare inicialmente 80 exemplos rotulados, como referência de esforço: 50 para desenvolver e ajustar a solução e 30 reservados para uma avaliação final sem ajustes sobre esses mesmos casos. Esse tamanho permite um experimento inicial; não prova generalização ampla.

Inclua relatos claros, curtos, ambíguos, contraditórios, com erros de escrita, com múltiplos problemas e tentativas de instruir a IA a ignorar as regras. Use dados sintéticos ou anonimizados com autorização; identifique a origem.

Um profissional do domínio deve revisar os rótulos quando possível. Sem essa revisão, informe que a avaliação é técnica e possui limitação de validade no negócio.

Cada exemplo contém:

- Entrada e categoria esperada, inclusive `UNKNOWN` quando adequado.
- Fatos explícitos que podem ser resumidos.
- Informações ausentes relevantes.
- Afirmações que seriam invenções.
- Resultado esperado de revisão/abstenção.
- Justificativa do rótulo e versão do dataset.

### 12.5 Medidas e gate de lançamento

Meça categoria correta, estrutura válida, fatos inventados, revisão humana necessária, latência p50/p95 e custo por solicitação. Registre também se o atendente aceita a sugestão e quanto precisa editar.

Critérios propostos para o experimento:

- Pelo menos 90% de categoria correta no conjunto reservado, informando número absoluto de acertos e total.
- Nenhuma afirmação comercial inventada sobre preço, prazo ou serviço já executado nos exemplos avaliados.
- Resposta inválida ou timeout nunca impede cadastro/triagem manual.
- Evidência de ganho de tempo ou redução de esforço em tarefa equivalente.
- Custo por solicitação dentro do orçamento explicitamente aprovado para a funcionalidade.

Se não cumprir os critérios, mantenha desabilitada ou restrita a experimento. Zero erros observados em uma amostra pequena não significa impossibilidade de erro. Não use a nota de um segundo modelo como única evidência; combine checks determinísticos e revisão humana.

### 12.6 Integração de produção

- Feature flag por empresa e desligamento global imediato.
- Timeout, limite de tokens, limite de requisições e de custo por empresa/dia.
- Retentativas limitadas; sem loop ilimitado tentando melhorar uma resposta.
- Versionamento de prompt, modelo, schema e conjunto de avaliação.
- Log de custo e resultado de validação sem descrição pessoal completa.
- Persistência da sugestão e da edição humana conforme política de dados.
- Caminho manual disponível em caso de falha, bloqueio ou desativação.
- Aviso claro de que é uma sugestão a revisar.

**Resultado esperado:** uma melhoria que você consegue avaliar e operar, ou uma conclusão documentada de que regras/formulário são mais adequados no momento. Ambas demonstram julgamento de engenharia.

## 13. Portfólio e demonstração

### 13.1 Conjunto de entrega profissional

Ao final, prepare:

1. URL de demonstração com dados sintéticos e integrações limitadas.
2. Repositório público ou recorte publicável, sem segredos nem dados de clientes.
3. README que permita compreender e executar o projeto.
4. Diagrama da arquitetura e diagrama de dados legíveis.
5. ADRs principais e matriz de autorização.
6. Evidências dos testes críticos e ensaios operacionais.
7. Relatório de desempenho com ambiente e limitações.
8. Planilha/tabela de custos consultados e consumo real quando disponível.
9. Vídeo de demonstração de cinco a oito minutos.
10. Estudo de caso com problema, recorte, decisões, resultados e próximos passos.

### 13.2 Estrutura do README

```text
Nome e descrição do produto
Problema e público escolhido
Estado atual: demo, piloto ou produção
Links úteis e vídeo
Principais jornadas
Arquitetura e decisões
Stack e versões fixadas
Pré-requisitos e setup reproduzível
Configuração e variáveis, sem segredos
Migrations e dados de demonstração
Como rodar verificações
Segurança e isolamento entre empresas
Deploy e operação
Evidências e limites conhecidos
Roadmap curto e licença
```

O bloco inicial deve explicar o problema e o comportamento do produto antes de listar tecnologias. Capturas de tela devem mostrar dados fictícios e contexto suficiente para entender a jornada.

### 13.3 Roteiro do vídeo

**0:00–0:40:** explique público, problema e recorte. Diga se é demonstração ou piloto real.

**0:40–2:00:** abra uma solicitação, prepare orçamento e mostre a decisão na visão do cliente.

**2:00–3:00:** agende visita, entre como técnico e conclua o atendimento pelo layout mobile.

**3:00–4:00:** mostre dois pedidos concorrentes de agenda e o conflito sendo impedido. Explique o mecanismo e a evidência do teste.

**4:00–5:00:** pare o worker em demo/staging, gere evento, mostre a pendência e retome o processamento. Não faça experimento de falha em produção sem autorização e plano.

**5:00–6:00:** explique isolamento, orçamento imutável, idempotência e backup restaurado, mostrando evidências sanitizadas.

**6:00–8:00, se necessário:** apresente resultado do piloto ou avaliação de IA, custo e uma limitação que você decidiu aceitar.

### 13.4 Perguntas para se preparar

- Por que escolheu esse problema e como validou a necessidade?
- Por que um monólito modular e qual sinal justificaria outra arquitetura?
- Como autenticação difere de autorização no seu código?
- Como você impede referência cruzada entre empresas no banco e na aplicação?
- O que acontece se duas decisões de orçamento chegam ao mesmo tempo?
- Como a agenda permanece correta com dois processos da API?
- Qual é a diferença entre repetir uma requisição e repetir uma entrega externa?
- O que ocorre se o worker morre após o provedor aceitar o e-mail?
- Qual índice foi necessário e como você verificou?
- Qual falha você observou e como investigou com telemetria?
- Qual o resultado real da restauração de backup?
- Como você faria rollback após uma migration incompatível?
- Quanto custa manter o projeto e qual componente aumenta com o uso?
- Qual parte a IA ajudou a construir e como você revisou sua contribuição?
- Qual funcionalidade ficou de fora e por quê?

Respostas precisam apontar para código, teste, ADR ou medição. Evite decorar explicações que você não consegue reproduzir.

### 13.5 Como descrever o projeto sem exagerar

Exemplo de apresentação, preenchendo apenas o que foi realmente realizado:

> Desenvolvi o ServiçoFlow para organizar solicitações, propostas e visitas de manutenção. Modelei o fluxo comercial, implementei isolamento entre empresas, aprovação idempotente e prevenção de conflitos de agenda. Publiquei a aplicação em [ambiente real], automatizei a verificação e documentei recuperação de notificações e restauração de backup. O piloto/demonstração mostrou [resultado medido], com a limitação [limitação relevante].

Se o uso foi apenas sintético, substitua “piloto” por “demonstração técnica”. Não diga que você provou senioridade ou escala empresarial; exponha os problemas resolvidos e deixe as evidências sustentar a avaliação.

## 14. Prompts de execução por etapa

Os prompts abaixo pressupõem que o agente leu o arquivo inteiro. Eles permitem iniciar, retomar e revisar o projeto sem solicitar que uma única resposta gere todo o sistema.

### 14.1 Descoberta e backlog

```text
Leia docs/project-brief.md e inspecione o repositório.
Execute a fase 0: prepare a descoberta e transforme o fluxo em backlog.
Separe observações reais de hipóteses ainda não validadas.
Não invente entrevistas. Se não houver acesso a usuários, prepare o roteiro
e avance no protótipo explicitando as premissas.
Entregue product.md, discovery.md, backlog.md e progress.md.
Priorize tarefas verticais com critérios de aceite e risco identificado.
Indique a primeira fatia a executar e o resultado esperado de cada marco.
```

### 14.2 Arquitetura e fundação

```text
Execute a fase 1 do project-brief.
Verifique versões suportadas e compatíveis na documentação oficial.
Prepare o monorepo, dependências locais, configuração, primeira migration,
web integrada à API e CI inicial. Registre os ADRs pertinentes.
Não adicione serviços que o fluxo atual não exige.
Valide a instalação em ambiente limpo e documente comandos executados.
Explique o caminho navegador -> proxy -> web/API -> banco.
Informe o que foi verificado e quais decisões dependem de conta ou orçamento.
```

### 14.3 Implementar uma fatia vertical

```text
Leia project-brief.md, progress.md e o estado atual do repositório.
Implemente a próxima tarefa pronta do backlog: [ID E TÍTULO].
Primeiro confirme critérios de aceite, regras e permissões relevantes.
Entregue a fatia de ponta a ponta: migration/modelo se necessário, regra,
API, interface, testes dos riscos e documentação afetada.
Use persistência real e não declare mocks como integração concluída.
Execute verificações pertinentes, corrija falhas e registre evidências.
Ao terminar, explique comportamento, decisões, limitações e próximo passo.
Não amplie o escopo para funcionalidades não relacionadas.
```

### 14.4 Revisar isolamento e autorização

```text
Faça uma revisão de segurança focada em autorização e multiempresa.
Leia a matriz de papéis e inventarie endpoints, jobs, queries e anexos.
Tente acesso cruzado por URL, body, relacionamentos, filtros e download.
Verifique revogação de associação, papéis e contexto no pool de conexões.
Use pelo menos duas empresas e usuários de papéis diferentes.
Corrija falhas encontradas e crie testes que reproduzam o risco real.
Não avalie segurança apenas pela interface. Não use dados de terceiros.
Entregue achados, correções, comandos executados e limites da revisão.
```

### 14.5 Revisar concorrência e idempotência

```text
Revise aprovação, revisão de orçamento, cancelamento e agenda sob concorrência.
Escreva os invariantes e identifique suas proteções no banco/aplicação.
Crie cenários com conexões independentes e sobreposição real de transações.
Teste repetição, disputa entre comandos incompatíveis e rollback parcial.
Verifique se domínio, auditoria e outbox ficam consistentes juntos.
Não prometa exatamente uma vez para entrega externa sem suporte comprovado.
Corrija os problemas e mostre a evidência de cada invariante.
```

### 14.6 Preparar e executar deploy

```text
Prepare a fase 10 com base na configuração de hospedagem já decidida.
Inspecione o que existe e não exponha segredos em código ou saída de comandos.
Produza imagens por commit, configuração do proxy, healthchecks, migrations
de release, pipeline, smoke tests e runbook de rollback.
Valide em staging antes de alterar produção.
Para etapas que exijam domínio, conta, credencial, custo ou autorização,
prepare o restante e liste exatamente a dependência que falta.
Não contrate serviços nem altere produção sem a autorização correspondente.
Depois de executar o deploy autorizado, verifique o domínio e registre
o resultado real. Configuração pronta não equivale a produção publicada.
```

### 14.7 Ensaio de falha e recuperação

```text
Em ambiente isolado, execute os ensaios operacionais do project-brief.
Pare o worker, gere eventos e demonstre a retomada.
Simule crash depois de adquirir lease e depois da aceitação do provedor.
Documente os limites de deduplicação do e-mail e a integridade do domínio.
Restaure backup em banco separado e verifique dados e anexos.
Impeça envios antigos durante a restauração até reconciliar o estado.
Meça tempo de recuperação e ponto do backup; não invente RPO/RTO cumpridos.
Registre evidências sanitizadas e atualize os runbooks.
```

### 14.8 Avaliar a funcionalidade de IA

```text
Implemente a fase opcional de IA apenas se a utilidade da triagem estiver clara.
Primeiro construa a alternativa sem IA e o conjunto de avaliação rotulado.
Reserve casos que não serão usados para ajustar o prompt.
Defina schema, métricas, custo máximo, fallback e revisão humana.
Consulte documentação atual do provedor escolhido; não envie dados pessoais
desnecessários nem conceda ferramentas de escrita ao modelo.
Compare baseline e IA em qualidade, tempo, custo e falhas.
Entregue relatório reprodutível. Se o ganho não for suficiente, mantenha
a funcionalidade desabilitada e explique a decisão.
```

### 14.9 Preparar apresentação e estudo de caso

```text
Audite a documentação contra o código e as evidências reais.
Prepare README, arquitetura, principais ADRs, roteiro de demonstração,
relatório de testes, custo e estudo de caso.
Remova dados pessoais e segredos de capturas, logs e arquivos publicáveis.
Separe hipótese, teste sintético, uso de piloto e resultado em produção.
Não invente usuários, ganhos percentuais, disponibilidade ou escala.
Explique três decisões difíceis, seus trade-offs e as verificações realizadas.
Liste limitações conhecidas e próximos passos coerentes com os sinais de uso.
```

### 14.10 Retomar o projeto em outra conversa

```text
Leia docs/project-brief.md, docs/progress.md, backlog e ADRs relevantes.
Confira git status e o estado real antes de alterar arquivos.
Resuma o marco atual, a última entrega verificada, os bloqueios e a próxima
tarefa pronta. Preserve alterações existentes e não refaça trabalho concluído.
Continue a próxima fatia autorizada com base nos critérios de aceite.
```

### 14.11 Aprender a partir do código gerado

```text
Explique a fatia que acabamos de entregar usando o código real.
Mostre a entrada HTTP, autenticação, autorização, regra, transação e resposta.
Descreva o comportamento em repetição, concorrência e falha intermediária.
Escolha um teste relevante e explique por que ele detecta o problema.
Depois faça três perguntas para verificar minha compreensão e proponha
uma pequena alteração que eu possa implementar para demonstrá-la.
Não substitua a explicação por uma lista de tecnologias.
```

### 14.12 Modelo de progresso persistente

Mantenha `docs/progress.md` curto, atualizado e com caminhos para evidências:

```markdown
# Progresso
## Marco e fase atuais
## Última entrega concluída
## Estado real por ambiente
- Local:
- Staging:
- Demo:
- Produção:
## Verificações executadas
## Decisões novas e ADRs
## Riscos e pendências
## Bloqueios externos
## Próxima tarefa pronta
## Como reproduzir a última entrega
```

## 15. Checklist final e resultado esperado

### 15.1 Marco A — Piloto funcional

- [ ] Público, problema e premissas documentados.
- [ ] Empresa e equipe com papéis definidos.
- [ ] Cadastro de cliente, endereço e equipamento.
- [ ] Ordem e triagem com histórico.
- [ ] Orçamento versionado e cálculo confiável.
- [ ] Cliente consulta e decide sobre a proposta específica.
- [ ] Agenda distingue diagnóstico e execução.
- [ ] Técnico registra atendimento pelo celular.
- [ ] Arquivos privados e permissões do fluxo principal funcionando.
- [ ] Jornada integral demonstrada com persistência real.
- [ ] Uso observado por outra pessoa e dificuldades registradas.

**Resultado esperado:** um sistema integrado que permite executar o processo escolhido. Ainda não implica operação segura com dependência real do negócio.

### 15.2 Marco B — Versão 1 em produção

- [ ] Tudo do marco A.
- [ ] Isolamento entre empresas verificado na API, referências e arquivos.
- [ ] Concorrência de aprovação e agenda testada com banco real.
- [ ] Outbox, retry, lease, falhas definitivas e reprocessamento auditado.
- [ ] Limites de entrega de notificações documentados.
- [ ] CI, imagens, migrations e artefato rastreável.
- [ ] Staging validado e produção publicada em HTTPS.
- [ ] Segredos separados, limites de entrada e integrações autorizadas.
- [ ] Logs, métricas, traces pertinentes e alertas úteis.
- [ ] Backup e restauração de banco/objetos ensaiados.
- [ ] Plano de rollback compatível com migrations.
- [ ] Custos, quotas, retenção e responsabilidades documentados.
- [ ] Dados reais usados apenas com autorização e recorte do piloto definido.
- [ ] Nenhum bloqueador crítico de acesso, integridade ou recuperação aberto.

**Resultado esperado:** uma aplicação operacional de escopo controlado, que você sabe publicar, observar, investigar e recuperar. Alta disponibilidade, conformidade certificada e escala ilimitada não são consequências automáticas desse marco.

### 15.3 Marco C — IA avaliada, se aplicável

- [ ] Necessidade da funcionalidade identificada.
- [ ] Baseline sem IA implementado.
- [ ] Dataset e rótulos com origem e limitações documentadas.
- [ ] Conjunto reservado para avaliação final.
- [ ] Qualidade, falhas, custo e latência medidos.
- [ ] Revisão humana, fallback e limites de consumo.
- [ ] Prompt/modelo/schema versionados.
- [ ] Decisão de lançar ou não sustentada pelas evidências.

**Resultado esperado:** domínio de um ciclo de avaliação e operação de IA, inclusive a capacidade de decidir que uma solução mais simples é preferível.

### 15.4 Portfólio concluído

- [ ] README reproduzível e coerente com a implementação.
- [ ] Demo pública separada com dados sintéticos.
- [ ] Vídeo com fluxo e pelo menos uma recuperação de falha.
- [ ] Diagramas, ADRs e resultados verificáveis.
- [ ] Estudo de caso com observação real ou limitação explícita de uso sintético.
- [ ] Explicação dos custos e limites da arquitetura.
- [ ] Você consegue responder às perguntas técnicas apontando para o projeto.

### 15.5 O que esse projeto deve demonstrar sobre você

| Competência | Evidência esperada |
|---|---|
| Entendimento de produto | Descoberta, recorte e decisões a partir de problemas observados |
| Modelagem | Estados, orçamento imutável, integridade e referências por empresa |
| Backend | Transações, contratos, autorização, idempotência e concorrência |
| Frontend | Jornada responsiva completa e tratamento dos estados reais |
| Segurança | Isolamento testado, sessões, links limitados e arquivos privados |
| Qualidade | Testes de risco, verificações reproduzíveis e evidências |
| Entrega | Ambiente reproduzível, CI/CD, migrations e release rastreável |
| Operação | Telemetria, alertas, recuperação, backup restaurado e custos |
| IA aplicada, se houver | Comparação com baseline, avaliação, limites e decisão de produto |
| Comunicação | README, ADRs, vídeo e estudo de caso sem alegações infladas |

Esse conjunto permite demonstrar conhecimento por decisões e comportamento observável. A quantidade de ferramentas usadas ou a quantidade de código gerado não substituem essas evidências.

### 15.6 Sua primeira sessão de trabalho

Ao começar, faça apenas o necessário para estabelecer direção e a primeira entrega:

1. Crie o repositório e coloque este documento em `docs/project-brief.md`.
2. Envie o prompt de descoberta da seção 14.1.
3. Revise o fluxo, as premissas e o recorte do piloto.
4. Agende ou realize as conversas de descoberta por conta própria.
5. Execute a fundação técnica com o prompt 14.2.
6. Continue pela identidade e depois pela primeira ordem completa.

O ritmo correto é terminar uma fatia, verificar, compreender e avançar. Não é necessário ter a interface inteira desenhada nem todas as tabelas prontas para entregar a primeira jornada.

## 16. Referências oficiais

Documentação consultada na preparação deste roteiro. Reconsulte a documentação da versão efetivamente fixada durante a implementação; APIs, versões e serviços podem mudar. Os limites numéricos, metas, escopo e escolhas de arquitetura deste arquivo são propostas de projeto, não exigências universais das fontes.

- [Node.js — política de releases](https://nodejs.org/en/about/previous-releases): escolher uma linha suportada para produção.
- [Next.js — self-hosting](https://nextjs.org/docs/app/guides/self-hosting): execução própria, reverse proxy e configuração.
- [Caddy — handle](https://caddyserver.com/docs/caddyfile/directives/handle): roteamento e preservação do prefixo da API.
- [NestJS — autenticação](https://docs.nestjs.com/security/authentication): integração de autenticação; conferir a versão adotada.
- [NestJS — autorização](https://docs.nestjs.com/security/authorization): organização dos controles de acesso.
- [Prisma — migrations](https://docs.prisma.io/docs/orm/migrations/how-migrations-work): fluxo dependente da versão do ORM.
- [PostgreSQL — intervalos e constraints de exclusão](https://www.postgresql.org/docs/15/rangetypes.html): fundamentos da prevenção de sobreposição.
- [PostgreSQL — SELECT e locking](https://www.postgresql.org/docs/current/sql-select.html): bloqueios e uso de `SKIP LOCKED`.
- [PostgreSQL — políticas de segurança por linha](https://www.postgresql.org/docs/17/ddl-rowsecurity.html): defesa adicional quando adotada corretamente.
- [AWS — transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): intenção de evento na mesma transação e tratamento de repetição.
- [OWASP — autorização](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): controle de acesso no servidor.
- [OWASP — sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): cookies, ciclo de sessão e proteção.
- [OWASP — upload de arquivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): validação e armazenamento de anexos.
- [OpenTelemetry — sinais](https://opentelemetry.io/docs/concepts/signals/): logs, métricas e traces.
- [GitHub Actions — uso seguro](https://docs.github.com/en/actions/reference/security/secure-use): permissões, secrets e referências imutáveis de actions.
