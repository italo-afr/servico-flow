import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { audit } from '../audit/audit.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { AppError, conflict } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { withTransaction, type Db } from '../db/pool.js';
import { Public, RequestId } from '../identity/context.js';
import { enqueue } from '../notifications/outbox.js';
import { lockOrder, transitionOrder } from '../orders/service.js';
import { CONFIG, DB } from '../tokens.js';
import { expireQuote, lockQuote } from './quotes.service.js';

const COOKIE = 'sf_quote';
const COOKIE_PATH = '/api/v1/public/quote-access';
const SESSION_MINUTES = 30;

/** Limite simples por IP para rotas públicas (processo único; ver ADR-0004). */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  enabled = true;
  check(key: string) {
    if (!this.enabled) return;
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.clear();
    if (list.length > this.max)
      throw new AppError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto.');
  }
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.header('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const unauthorized = () =>
  new AppError(401, 'QUOTE_ACCESS_REQUIRED', 'Abra novamente o link recebido por e-mail.');

const exchangeSchema = z.strictObject({ token: z.string().min(20).max(200) });
const decisionSchema = z.strictObject({
  decision: z.enum(['ACCEPT', 'REJECT']),
  confirm: z.literal(true, 'Confirme a decisão'),
});

/**
 * Acesso do cliente sem conta (brief 7.4): o token do link é trocado por um cookie
 * curto limitado a UM orçamento. GET nunca decide. Decisão é POST explícito e idempotente.
 */
@Public()
@Controller('public/quote-access')
export class PublicQuoteController {
  private readonly exchangeLimit = new RateLimiter(20, 60_000);
  private readonly decisionLimit = new RateLimiter(10, 60_000);
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {
    this.exchangeLimit.enabled = this.decisionLimit.enabled = config.AUTH_RATE_LIMIT;
  }

  @Post('exchange')
  async exchange(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(exchangeSchema)) b: z.infer<typeof exchangeSchema>,
  ) {
    this.exchangeLimit.check(req.ip ?? 'unknown');
    const r = await this.db.query<{ id: string; quote_id: string; organization_id: string }>(
      `SELECT id, quote_id, organization_id FROM decision_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() - interval '30 days'`,
      [sha256(b.token)],
    );
    const t = r.rows[0];
    if (!t)
      throw new AppError(
        410,
        'LINK_INVALID',
        'Este link não é mais válido. Peça um novo orçamento à empresa.',
      );
    const session = randomToken();
    await this.db.query(
      `INSERT INTO quote_access_sessions (organization_id, quote_id, token_id, session_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
      [t.organization_id, t.quote_id, t.id, sha256(session), SESSION_MINUTES],
    );
    res.cookie(COOKIE, session, {
      httpOnly: true,
      secure: this.config.PUBLIC_APP_URL.startsWith('https://'),
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: SESSION_MINUTES * 60_000,
    });
    return { ok: true };
  }

  private async session(req: Request) {
    const raw = readCookie(req, COOKIE);
    if (!raw) throw unauthorized();
    const r = await this.db.query<{ quote_id: string; organization_id: string; token_id: string }>(
      `SELECT quote_id, organization_id, token_id FROM quote_access_sessions WHERE session_hash = $1 AND expires_at > now()`,
      [sha256(raw)],
    );
    if (!r.rows[0]) throw unauthorized();
    return r.rows[0];
  }

  /** Somente leitura: abrir o link (inclusive por robôs de e-mail) não altera nada. */
  @Get('current')
  async current(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const s = await this.session(req);
    const r = await this.db.query(
      `SELECT q.status, q.version, q.snapshot, q.expires_at AS "expiresAt", q.decided_at AS "decidedAt",
              (q.expires_at <= now()) AS expired, t.revoked_at IS NOT NULL AS revoked
         FROM quotes q JOIN decision_tokens t ON t.id = $3
        WHERE q.organization_id = $1 AND q.id = $2`,
      [s.organization_id, s.quote_id, s.token_id],
    );
    const q = r.rows[0];
    return {
      status: q.status,
      version: q.version,
      proposal: q.snapshot, // só o conteúdo destinado ao cliente; sem observações internas
      expiresAt: q.expiresAt,
      decidedAt: q.decidedAt,
      canDecide: q.status === 'SENT' && !q.expired && !q.revoked,
    };
  }

  @Post('decision')
  async decision(
    @Req() req: Request,
    @Body(new ZodPipe(decisionSchema)) b: z.infer<typeof decisionSchema>,
    @RequestId() requestId: string,
  ) {
    this.decisionLimit.check(req.ip ?? 'unknown');
    const s = await this.session(req);
    const target = b.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const result = await withTransaction(this.db, async (tx) => {
      const q = await lockQuote(tx, s.organization_id, s.quote_id);
      const token = await tx.query<{ revoked_at: Date | null }>(
        `SELECT revoked_at FROM decision_tokens WHERE id = $1 FOR UPDATE`,
        [s.token_id],
      );
      if (q.status === 'ACCEPTED' || q.status === 'REJECTED') {
        // Repetição da mesma decisão devolve o recibo já registrado, sem novos efeitos.
        if (q.status === target) return { kind: 'receipt' as const, status: q.status };
        throw conflict('ALREADY_DECIDED', 'Este orçamento já foi decidido.');
      }
      if (q.status !== 'SENT' || token.rows[0]?.revoked_at) {
        throw conflict(
          'QUOTE_NOT_CURRENT',
          'Esta versão do orçamento foi substituída ou cancelada.',
        );
      }
      // Validade verificada AQUI, mesmo que o job de expiração esteja atrasado.
      if (await expireQuote(tx, s.organization_id, s.quote_id)) return { kind: 'expired' as const };

      const order = await lockOrder(tx, s.organization_id, q.order_id);
      await tx.query(
        `UPDATE quotes SET status = $2, decided_at = now(), updated_at = now() WHERE id = $1`,
        [q.id, target],
      );
      await tx.query(`UPDATE decision_tokens SET consumed_at = now() WHERE id = $1`, [s.token_id]);
      await transitionOrder(
        tx,
        order,
        target === 'ACCEPTED' ? 'APPROVED' : 'TRIAGE',
        { type: 'CUSTOMER_LINK', userId: null },
        {
          type: target === 'ACCEPTED' ? 'quote.accepted' : 'quote.rejected',
          data: { quoteId: q.id, version: q.version },
          visibleToCustomer: true,
        },
      );
      await audit(tx, {
        organizationId: s.organization_id,
        actorType: 'CUSTOMER_LINK',
        action: target === 'ACCEPTED' ? 'quote.accepted' : 'quote.rejected',
        resourceType: 'quote',
        resourceId: q.id,
        requestId,
        metadata: { version: q.version, totalCents: Number(q.total_cents) },
      });
      // Avisa quem cuida da ordem (fora da transação, pelo worker).
      const notify = await tx.query<{ email: string }>(
        `SELECT u.email FROM service_orders so JOIN "user" u ON u.id = coalesce(so.assigned_user_id, so.created_by)
          WHERE so.organization_id = $1 AND so.id = $2`,
        [s.organization_id, q.order_id],
      );
      if (notify.rows[0]) {
        await enqueue(tx, this.config.TOKEN_PAYLOAD_ENCRYPTION_KEY, {
          organizationId: s.organization_id,
          type: 'quote.decided',
          payload: {
            quoteId: q.id,
            email: notify.rows[0].email,
            decision: target,
            version: q.version,
            orderNumber: order.number,
          },
        });
      }
      return { kind: 'decided' as const, status: target };
    });
    if (result.kind === 'expired')
      throw conflict(
        'QUOTE_EXPIRED',
        'O prazo deste orçamento terminou. Peça uma nova proposta à empresa.',
      );
    return { status: result.status, repeated: result.kind === 'receipt' };
  }
}
