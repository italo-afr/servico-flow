# ADR-0002 — Autenticação com better-auth e sessões no PostgreSQL

**Status:** aceito · 2026-11-03

**Contexto.** Brief 6.3: biblioteca mantida, sessão revogável em cookie no mesmo domínio, recuperação de acesso, convites, sem implementar criptografia própria.

**Alternativas.** (a) Provedor OIDC externo (custo, dependência, mais um serviço no piloto); (b) Passport + sessões próprias (mais código de segurança nosso); (c) better-auth 1.7.15 com adaptador PostgreSQL.

**Decisão.** (c), montado em `/api/auth/*` antes do body parser (`app.ts`). Configuração conferida nas definições de tipo da versão instalada (não de memória). Schema SQL gerado por `getMigrations()` da própria biblioteca e versionado em `0002_identity.sql`.

- Sessões no banco, `cookieCache` desativado → revogação e logout têm efeito imediato.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` quando a URL pública é HTTPS, prefixo `sf`.
- **Cadastro público bloqueado na borda HTTP** (`/api/auth/sign-up/*` → 404). Contas são criadas pelo servidor ao aceitar convite (`auth.api.signUpEmail`), e o e-mail é marcado como verificado porque o token chegou na caixa do destinatário.
- `requireEmailVerification: true`; senha mínima de 10; `revokeSessionsOnPasswordReset`.
- Limites: 5 logins/min, 3 pedidos de recuperação/5 min, por IP (armazenados no banco).
- Autorização é nossa: `AccessGuard` consulta a associação ativa a CADA requisição.
- CSRF: métodos de escrita exigem `Origin` igual à origem pública (além do `SameSite`).

**Consequências.** Mensagens de erro da biblioteca vêm em inglês (traduzidas no cliente). Rate limit por IP depende de `trust proxy` correto atrás do Caddy.

**Verificação.** `test/identity.test.ts`: sem sessão, cadastro bloqueado, convite único/expirado/revogado, T01, T04, CSRF, logout revoga. Limite de login observado manualmente (HTTP 429 após 5 tentativas).

**Gatilho de revisão.** Necessidade de SSO, 2FA ou mudança de licença/manutenção da biblioteca.
