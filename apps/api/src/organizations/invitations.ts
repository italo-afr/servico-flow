import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { audit } from '../audit/audit.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { AppError, conflict, forbidden, invalid, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { withTransaction, type Db, type Tx } from '../db/pool.js';
import type { Auth } from '../identity/auth.js';
import { CurrentMember, Public, RequestId, Requires, type Member } from '../identity/context.js';
import { canInvite, ROLES, type Role } from '../identity/policy.js';
import { enqueue } from '../notifications/outbox.js';
import { AUTH, CONFIG, DB } from '../tokens.js';

const INVITE_TTL_DAYS = 7;
const emailSchema = z
  .email()
  .max(254)
  .transform((e) => e.trim().toLowerCase());

export async function createInvitation(
  tx: Tx,
  config: AppConfig,
  input: {
    organizationId: string;
    email: string;
    role: Role;
    invitedBy: string | null;
    requestId?: string;
  },
): Promise<{ id: string; link: string; expiresAt: Date }> {
  const active = await tx.query(
    `SELECT 1 FROM memberships m JOIN "user" u ON u.id = m.user_id
      WHERE m.organization_id = $1 AND u.email = $2 AND m.status = 'ACTIVE'`,
    [input.organizationId, input.email],
  );
  if (active.rowCount) throw conflict('ALREADY_MEMBER', 'Esta pessoa já faz parte da equipe.');
  // Um convite pendente por e-mail/empresa: o anterior é revogado.
  await tx.query(
    `UPDATE invitations SET revoked_at = now()
      WHERE organization_id = $1 AND email = $2 AND consumed_at IS NULL AND revoked_at IS NULL`,
    [input.organizationId, input.email],
  );
  const token = randomToken();
  const r = await tx.query<{ id: string; expires_at: Date }>(
    `INSERT INTO invitations (organization_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) RETURNING id, expires_at`,
    [
      input.organizationId,
      input.email,
      input.role,
      sha256(token),
      input.invitedBy,
      INVITE_TTL_DAYS,
    ],
  );
  const inv = r.rows[0]!;
  const link = `${config.PUBLIC_APP_URL}/convite#token=${token}`;
  await enqueue(tx, config.TOKEN_PAYLOAD_ENCRYPTION_KEY, {
    organizationId: input.organizationId,
    type: 'invitation.created',
    payload: { invitationId: inv.id, email: input.email },
    secret: { link },
  });
  await audit(tx, {
    organizationId: input.organizationId,
    actorType: input.invitedBy ? 'USER' : 'SYSTEM',
    actorUserId: input.invitedBy,
    action: 'invitation.created',
    resourceType: 'invitation',
    resourceId: inv.id,
    requestId: input.requestId,
    metadata: { role: input.role },
  });
  return { id: inv.id, link, expiresAt: inv.expires_at };
}

const createSchema = z.strictObject({ email: emailSchema, role: z.enum(ROLES) });
const tokenSchema = z.strictObject({ token: z.string().min(20).max(200) });
const acceptSchema = z.strictObject({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(10).max(128).optional(),
});

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role: Role;
  org_name: string;
  consumed_at: Date | null;
  consumed_by: string | null;
  revoked_at: Date | null;
  expired: boolean;
}

@Controller()
export class InvitationsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Post('organizations/:orgId/invitations')
  @Requires('members.manage')
  async create(
    @CurrentMember() member: Member,
    @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>,
    @RequestId() requestId: string,
  ) {
    if (!canInvite(member.role, body.role))
      throw forbidden('Seu papel não pode convidar para este papel.');
    const inv = await withTransaction(this.db, (tx) =>
      createInvitation(tx, this.config, {
        organizationId: member.organizationId,
        email: body.email,
        role: body.role,
        invitedBy: member.userId,
        requestId,
      }),
    );
    // O token NÃO é devolvido: só segue por e-mail (brief fase 4, item 8).
    return { id: inv.id, email: body.email, role: body.role, expiresAt: inv.expiresAt };
  }

  @Get('organizations/:orgId/invitations')
  @Requires('members.manage')
  async list(@CurrentMember() member: Member) {
    const r = await this.db.query(
      `SELECT id, email, role, expires_at AS "expiresAt", created_at AS "createdAt"
         FROM invitations WHERE organization_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 100`,
      [member.organizationId],
    );
    return { items: r.rows };
  }

  @Post('organizations/:orgId/invitations/:id/revoke')
  @Requires('members.manage')
  async revoke(
    @CurrentMember() member: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestId() requestId: string,
  ) {
    await withTransaction(this.db, async (tx) => {
      const r = await tx.query(
        `UPDATE invitations SET revoked_at = now() WHERE id = $1 AND organization_id = $2 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [id, member.organizationId],
      );
      if (!r.rowCount) throw notFound('Convite');
      await audit(tx, {
        organizationId: member.organizationId,
        actorType: 'USER',
        actorUserId: member.userId,
        action: 'invitation.revoked',
        resourceType: 'invitation',
        resourceId: id,
        requestId,
      });
    });
    return { ok: true };
  }

  private async findByToken(
    token: string,
    tx: Pick<Tx, 'query'> = this.db,
    lock = false,
  ): Promise<InvitationRow | undefined> {
    const r = await tx.query<InvitationRow>(
      `SELECT i.id, i.organization_id, i.email, i.role, o.name AS org_name, i.consumed_at, i.consumed_by,
              i.revoked_at, i.expires_at <= now() AS expired
         FROM invitations i JOIN organizations o ON o.id = i.organization_id
        WHERE i.token_hash = $1 ${lock ? 'FOR UPDATE OF i' : ''}`,
      [sha256(token)],
    );
    return r.rows[0];
  }

  @Post('invitations/preview')
  @Public()
  async preview(@Body(new ZodPipe(tokenSchema)) body: z.infer<typeof tokenSchema>) {
    const inv = await this.findByToken(body.token);
    if (!inv || inv.consumed_at || inv.revoked_at || inv.expired) {
      throw new AppError(410, 'INVITATION_INVALID', 'Convite inválido, expirado ou já utilizado.');
    }
    const u = await this.db.query('SELECT 1 FROM "user" WHERE email = $1', [inv.email]);
    return {
      organizationName: inv.org_name,
      email: inv.email,
      role: inv.role,
      accountExists: !!u.rowCount,
    };
  }

  @Post('invitations/accept')
  @Public()
  async accept(
    @Req() req: Request,
    @Body(new ZodPipe(acceptSchema)) body: z.infer<typeof acceptSchema>,
    @RequestId() requestId: string,
  ) {
    const inv = await this.findByToken(body.token);
    if (!inv || inv.revoked_at || inv.expired || (inv.consumed_at && !inv.consumed_by)) {
      throw new AppError(410, 'INVITATION_INVALID', 'Convite inválido, expirado ou já utilizado.');
    }
    let userId: string;
    const existing = await this.db.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
      inv.email,
    ]);
    if (existing.rows[0]) {
      // Conta existente: precisa estar logada como o destinatário do convite.
      const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session || session.user.id !== existing.rows[0].id) {
        throw new AppError(
          401,
          'LOGIN_REQUIRED',
          `Entre com a conta ${inv.email} para aceitar o convite.`,
        );
      }
      userId = existing.rows[0].id;
    } else {
      if (!body.name || !body.password) {
        throw invalid('Informe nome e senha para criar sua conta.', {
          ...(body.name ? {} : { name: ['Obrigatório'] }),
          ...(body.password ? {} : { password: ['Obrigatório (mínimo 10 caracteres)'] }),
        });
      }
      try {
        const created = await this.auth.api.signUpEmail({
          body: { email: inv.email, password: body.password, name: body.name },
        });
        userId = created.user.id;
      } catch (err) {
        // Corrida: outra requisição criou a conta antes. Pede login.
        const again = await this.db.query('SELECT id FROM "user" WHERE email = $1', [inv.email]);
        if (again.rowCount)
          throw new AppError(
            401,
            'LOGIN_REQUIRED',
            `Entre com a conta ${inv.email} para aceitar o convite.`,
          );
        throw err;
      }
    }

    return withTransaction(this.db, async (tx) => {
      const locked = await this.findByToken(body.token, tx, true);
      if (!locked || locked.revoked_at || locked.expired) {
        throw new AppError(
          410,
          'INVITATION_INVALID',
          'Convite inválido, expirado ou já utilizado.',
        );
      }
      if (locked.consumed_at) {
        if (locked.consumed_by === userId)
          return { organizationId: locked.organization_id, role: locked.role };
        throw new AppError(
          410,
          'INVITATION_INVALID',
          'Convite inválido, expirado ou já utilizado.',
        );
      }
      await tx.query(
        `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = now()`,
        [locked.organization_id, userId, locked.role],
      );
      // O token chegou pelo e-mail do destinatário: comprova posse do endereço.
      await tx.query(
        `UPDATE "user" SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1`,
        [userId],
      );
      await tx.query(`UPDATE invitations SET consumed_at = now(), consumed_by = $2 WHERE id = $1`, [
        locked.id,
        userId,
      ]);
      await audit(tx, {
        organizationId: locked.organization_id,
        actorType: 'USER',
        actorUserId: userId,
        action: 'invitation.accepted',
        resourceType: 'invitation',
        resourceId: locked.id,
        requestId,
        metadata: { role: locked.role },
      });
      return { organizationId: locked.organization_id, role: locked.role };
    });
  }
}
