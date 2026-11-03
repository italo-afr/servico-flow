import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { audit } from '../audit/audit.js';
import { conflict, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { withTransaction, type Db, type Tx } from '../db/pool.js';
import {
  CurrentMember,
  CurrentUser,
  RequestId,
  Requires,
  type AuthUser,
  type Member,
} from '../identity/context.js';
import { ROLES } from '../identity/policy.js';
import { CONFIG, DB } from '../tokens.js';
import type { AppConfig } from '../config.js';

const roleSchema = z.strictObject({ role: z.enum(ROLES) });

async function assertNotLastAdmin(tx: Tx, organizationId: string, membershipId: string) {
  const r = await tx.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM memberships
      WHERE organization_id = $1 AND role = 'ADMIN' AND status = 'ACTIVE' AND id <> $2`,
    [organizationId, membershipId],
  );
  if ((r.rows[0]?.n ?? 0) === 0)
    throw conflict('LAST_ADMIN', 'A empresa precisa manter pelo menos um administrador.');
}

@Controller()
export class MembersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const r = await this.db.query(
      `SELECT o.id AS "organizationId", o.name AS "organizationName", o.timezone, o.is_demo AS "isDemo", m.role
         FROM memberships m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = $1 AND m.status = 'ACTIVE' ORDER BY o.name`,
      [user.id],
    );
    return {
      user,
      memberships: r.rows,
      features: { triageSuggestions: this.config.TRIAGE_SUGGESTIONS },
    };
  }

  @Get('organizations/:orgId/members')
  @Requires('members.read')
  async list(@CurrentMember() member: Member) {
    const r = await this.db.query(
      `SELECT m.id, m.role, m.status, u.name, u.email, m.user_id AS "userId"
         FROM memberships m JOIN "user" u ON u.id = m.user_id
        WHERE m.organization_id = $1 ORDER BY m.status, u.name LIMIT 200`,
      [member.organizationId],
    );
    return { items: r.rows };
  }

  @Post('organizations/:orgId/members/:id/role')
  @Requires('members.manage')
  async changeRole(
    @CurrentMember() member: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(roleSchema)) body: z.infer<typeof roleSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const r = await tx.query<{ role: string }>(
        `SELECT role FROM memberships WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [id, member.organizationId],
      );
      const current = r.rows[0];
      if (!current) throw notFound('Membro');
      if (current.role === 'ADMIN' && body.role !== 'ADMIN')
        await assertNotLastAdmin(tx, member.organizationId, id);
      await tx.query(`UPDATE memberships SET role = $2, updated_at = now() WHERE id = $1`, [
        id,
        body.role,
      ]);
      await audit(tx, {
        organizationId: member.organizationId,
        actorType: 'USER',
        actorUserId: member.userId,
        action: 'member.role_changed',
        resourceType: 'membership',
        resourceId: id,
        requestId,
        metadata: { from: current.role, to: body.role },
      });
      return { id, role: body.role };
    });
  }

  @Post('organizations/:orgId/members/:id/remove')
  @Requires('members.manage')
  async remove(
    @CurrentMember() member: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const r = await tx.query<{ role: string }>(
        `SELECT role FROM memberships WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
        [id, member.organizationId],
      );
      if (!r.rows[0]) throw notFound('Membro');
      if (r.rows[0].role === 'ADMIN') await assertNotLastAdmin(tx, member.organizationId, id);
      await tx.query(
        `UPDATE memberships SET status = 'REMOVED', updated_at = now() WHERE id = $1`,
        [id],
      );
      await audit(tx, {
        organizationId: member.organizationId,
        actorType: 'USER',
        actorUserId: member.userId,
        action: 'member.removed',
        resourceType: 'membership',
        resourceId: id,
        requestId,
      });
      return { id, status: 'REMOVED' };
    });
  }
}
