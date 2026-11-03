# Descoberta — ServiçoFlow

> **Estado em 2026-11-03: nenhuma entrevista realizada.** Este arquivo contém o
> roteiro, o modelo de registro e as hipóteses a validar. Nada aqui é
> observação de campo até que uma seção "Registro de conversa" seja preenchida
> com data e origem reais.

## 1. Objetivo da descoberta

Responder, com evidência de pelo menos uma empresa real:

1. Onde o processo atual perde informação ou tempo (pedido, orçamento, agenda, execução)?
2. Qual desses pontos dói mais — e, portanto, qual fatia deve vir primeiro?
3. Diagnóstico presencial antes do orçamento é frequente?
4. O técnico tem internet no local (condição para operar pelo celular sem offline)?
5. A empresa aceitaria testar um fluxo concreto e dar retorno?

Meta: 3 a 5 conversas, incluindo ao menos um responsável pela operação e um técnico.
Se houver acesso a apenas uma empresa, registrar essa limitação no estudo de caso.

## 2. Como recrutar

- Começar por contatos diretos (rede pessoal, indicação, empresas que já atenderam você).
- Pedido curto: 30 minutos de conversa sobre como organizam os serviços; sem venda.
- Oferecer em troca: um resumo do que foi observado e acesso ao piloto, se fizer sentido.
- Não contatar clientes da empresa. Não pedir planilhas com dados pessoais.

## 3. Consentimento (ler no início)

> Estou estudando como pequenas empresas de manutenção organizam pedidos,
> orçamentos e visitas, para construir um sistema de portfólio e, se fizer
> sentido, um piloto. Vou anotar o processo, sem nomes de clientes, telefones
> ou endereços. Posso citar trechos de forma anônima? Posso gravar o áudio
> apenas para minhas anotações? Você pode parar a qualquer momento.

Registre a resposta (sim/não) para citação e gravação.

## 4. Roteiro de entrevista

Peça sempre **um exemplo recente e concreto** ("o último serviço que vocês fizeram")
em vez de opinião genérica ("como costuma ser").

### 4.1 Responsável pela operação / atendente (≈30 min)

**Contexto (3 min)**
- Quantas pessoas atendem? Quantos técnicos? Quantos serviços por semana, aproximadamente?
- Que ferramentas usam hoje (WhatsApp, planilha, caderno, sistema)?

**Pedido (5 min)** — perguntas 1 e 2 do brief
- Conte o último pedido que entrou. Por onde chegou? Quem registrou? Onde?
- Onde ficam endereço, equipamento, descrição e fotos desse pedido agora?

**Orçamento (7 min)** — perguntas 3 e 4
- Como esse cliente recebeu o orçamento? Em que formato?
- Como ele aprovou? Ficou registrado onde?
- Já houve mudança de preço depois do envio? O que aconteceu?
- Precisaram ir ao local antes de dar o preço? Com que frequência isso acontece?
- O diagnóstico é cobrado? Como?

**Agenda (5 min)** — pergunta 5
- Como escolheram o técnico e o horário?
- Já aconteceu de marcar dois serviços no mesmo horário para o mesmo técnico?

**Execução (3 min)** — pergunta 6
- Que informação costuma faltar quando o técnico chega?

**Problemas (5 min)** — perguntas 7, 9 e 10
- Conte um erro recente que gerou retrabalho, atraso ou perda de cliente.
- O que funciona bem no jeito atual e não pode piorar?
- O que faria vocês experimentarem outra ferramenta? O que faria desistir?

**Fechamento (2 min)**
- Posso acompanhar um atendimento real (sem dados pessoais) ou usar exemplos anonimizados?
- Topariam testar um fluxo simples daqui a algumas semanas?

### 4.2 Técnico (≈15 min)

- Como você fica sabendo do serviço do dia? Onde consulta endereço e problema?
- Tem internet no local? Usa o celular durante o serviço? (pergunta 8)
- O que você registra depois do serviço? Tira fotos? Para quê?
- O que mais atrapalha: informação faltando, horário errado, cliente ausente?
- Conte o último serviço em que você chegou e não conseguiu resolver. Por quê?

### 4.3 Sinais a observar (não perguntar diretamente)

- Quantas ferramentas diferentes aparecem ao descrever um único serviço.
- Momentos em que a pessoa precisa "procurar na conversa".
- Quem é o gargalo (normalmente uma pessoa só concentra tudo?).

## 5. Modelo de registro de conversa

Copie uma seção por conversa. Não registre nomes de clientes finais, telefones ou endereços.

```markdown
### Conversa N — AAAA-MM-DD
- Empresa: (identificador anônimo, ex.: "Empresa A — 2 técnicos, região X")
- Função da pessoa:
- Formato: presencial / vídeo / telefone; duração:
- Consentimento para citar: sim/não; gravação: sim/não

**Processo observado (fatos relatados com exemplo concreto)**
- ...

**Problemas relatados (com exemplo)**
| Problema | Exemplo concreto | Frequência relatada | Impacto relatado |
|---|---|---|---|

**Interpretação (minha leitura, não fato)**
- ...

**Hipóteses afetadas** (ver seção 6): H1 confirmada / enfraquecida / sem evidência ...

**Limitações desta conversa**
- ...

**Decisões ou mudanças de recorte resultantes**
- ...
```

## 6. Hipóteses a validar

Todas as linhas abaixo são **hipóteses**, derivadas do brief, sem evidência de campo ainda.

| ID | Hipótese | Como validar | Sinal que muda o recorte | Estado |
|---|---|---|---|---|
| H1 | Pedidos chegam por WhatsApp/telefone e o contexto (endereço, equipamento, fotos) fica espalhado em conversas | Perguntas 1–2 com exemplo recente | Se já existe um registro central que funciona, reduzir ênfase no cadastro | Não validada |
| H2 | A aprovação de orçamento é informal e às vezes se perde ou gera disputa de valor | Perguntas 3–4 | Se aprovação é rara como problema, simplificar a fase 4 (sem link público, só registro interno) | Não validada |
| H3 | Diagnóstico presencial antes do orçamento é comum | Pergunta sobre ida prévia ao local | Se raro, manter visita `DIAGNOSTIC` no modelo mas sem UI dedicada no piloto | Não validada |
| H4 | Conflitos de agenda de técnicos acontecem | Pergunta 5 | Se nunca acontecem, agenda em lista simples e prioridade menor | Não validada |
| H5 | Técnicos têm internet suficiente no local para usar web mobile | Pergunta 8 ao técnico | Se não têm, registrar risco; offline continua fora da v1, mas a tela precisa tolerar envio posterior | Não validada |
| H6 | Clientes finais abririam um link de orçamento por e-mail | Perguntar como o cliente prefere receber | Se clientes só usam WhatsApp, o link precisa ser copiável para envio manual (sem integrar WhatsApp) | Não validada |
| H7 | A equipe tem 1–3 atendentes e 1–5 técnicos | Pergunta de contexto | Volumes muito maiores mudam prioridades de agenda/dashboard | Não validada |
| H8 | A empresa aceitaria testar um fluxo concreto | Pergunta de fechamento | Sem aceite, o projeto segue como demonstração técnica com dados sintéticos | Não validada |

**Observação sobre H6:** o brief exclui integração com WhatsApp (seção 4.2). Se a
descoberta mostrar que o e-mail não é usado pelos clientes, a alternativa compatível
com o escopo é permitir que o atendente copie o link privado e o envie manualmente.
Isso exige revisar a seção 7.4 (o token bruto ficaria visível ao atendente) — decisão
a registrar em ADR antes da fase 4.

## 7. Linha de base (preencher se houver acesso a uma empresa)

| Métrica (brief 3.5) | Valor atual estimado | Origem | Data |
|---|---|---|---|
| Tempo até enviar orçamento | — | — | — |
| Tempo até decisão do cliente | — | — | — |
| Ordens sem atualização há X dias | — | — | — |
| Esforço de cadastro de um pedido | — | — | — |

Estimativas relatadas são "relato", não medição; marque-as assim.

## 8. Registros de conversa

_Nenhuma conversa registrada até o momento._

## 9. Limitações atuais

- Zero entrevistas: todo o recorte de produto em `docs/product.md` é hipotético.
- Sem empresa parceira identificada: o projeto segue, por ora, como **demonstração técnica com dados sintéticos**.
