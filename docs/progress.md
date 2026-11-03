# Progresso

## Marco e fase atuais

**Atualização 2026-11-03 (fim do dia):** todas as fases executáveis sem hospedagem nem usuários reais estão concluídas. Marco C avaliado: IA não lançada (ADR-0010). Material de portfólio pronto (brief 13).

Marco A (piloto funcional) **implementado e verificado localmente, com dados fictícios**.
Fases 1–9 entregues localmente, incluindo monitoramento e alertas. **Fase 10 cancelada por decisão do responsável:** projeto de portfólio, sem hospedagem. Imagens publicadas no GHCR pelo CI. Fase 11 sem empresa parceira.
Fase 12 (IA) não iniciada.

## Última entrega concluída

2026-11-03 — jornada completa: convite → cliente/local/equipamento → ordem → triagem → orçamento versionado →
link do cliente → aceite → agenda (diagnóstico/execução) → execução no celular com fotos → conclusão;
painel, operação da fila, carga e ensaio de backup. Ver `docs/evidence/2026-11-03-local.md`.

## Estado real por ambiente

- Local: tudo funcionando (PostgreSQL 16 local, e-mails em `.local-mail/`, storage em disco local).
- Staging: não existe.
- Demo: não existe.
- Produção: não existe. Nada publicado.

## Verificações executadas

lint, typecheck, 21 unitários, 72 de integração, 1 E2E, build, `pnpm audit`, carga de 120 s, backup/restore.
CI no GitHub (`.github/workflows/ci.yml`): jobs `verify` e `e2e` **passando** no commit 66e3b43 (run 41679128671). Uma execução anterior (fase 3) falhou só em `format:check`, corrigida no commit seguinte.

## Decisões novas e ADRs

`docs/adr/0001`–`0008`. Desvios do brief: sem Prisma (pg + SQL; ver `architecture.md`); RLS não adotado;
entrevistas e orçamento fictícios por decisão do responsável.

## Riscos e pendências

- Compose de produção, Dockerfiles e Caddyfile nunca executados (sem Docker no ambiente de construção).
- Sem métricas/traces/alertas exportados (só logs estruturados e painel da fila).
- T16 (duplicação de e-mail após aceite do provedor) só documentado; T26 não executado.
- Limite de taxa das rotas públicas em memória (válido para uma instância de API).
- Quota de storage por empresa não implementada.
- H6 (clientes sem e-mail) sem alternativa na v1.

## Bloqueios externos (precisam do responsável)

- Provedores e orçamento real (VPS, PostgreSQL gerenciado, storage S3, e-mail transacional), domínio e DNS.
- Autorização para criar contas/gastar e para publicar imagens no GHCR.
- Empresa parceira para piloto (hoje não há; uso real seria a fase 11).

## Próxima tarefa pronta

Nenhuma tarefa técnica pronta sem dependência externa. Pendências que dependem do responsável:
gravar o vídeo (`docs/demo-script.md`), tornar públicos os pacotes do GHCR e, se surgir uma empresa,
a fase 11 (uso acompanhado).

## Como reproduzir a última entrega

`docs/setup.md` → `pnpm db:migrate && pnpm db:seed && pnpm dev` → entrar como `beto@clima-norte.example.com` / `demo-senha-123`.

## Entregas finais (2026-11-03)

- OP-02: detalhe da ordem com consultas em paralelo (ganho pequeno e medido).
- OP-03: cota de fotos por empresa e limite por ordem válidos sob concorrência.
- Demo de um comando (`infra/demo`), verificada no CI com as imagens publicadas.
- Fase 12: baseline por regras e dataset congelado; 76,7% nos reservados → desligado por padrão.
- Brief 13: capturas (`docs/screenshots/`), estudo de caso, roteiro do vídeo, preparação para entrevista.

## Itens do brief que NÃO puderam ser cumpridos (e por quê)

| Item                                                         | Motivo                                               |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| Entrevistas e linha de base reais (fase 0)                   | sem acesso a empresas; simulação fictícia            |
| Sessão de uso acompanhado por outra pessoa (fase 8)          | não há outra pessoa disponível nesta sessão          |
| Staging, produção, HTTPS, DNS, backups no provedor (fase 10) | decisão: não hospedar                                |
| Piloto acompanhado (fase 11)                                 | sem empresa parceira                                 |
| IA avaliada contra baseline (fase 12)                        | sem orçamento de API                                 |
| Vídeo (brief 13.3)                                           | precisa ser gravado pelo responsável; roteiro pronto |
| T26 (reinício + release anterior)                            | sem ambiente hospedado                               |
