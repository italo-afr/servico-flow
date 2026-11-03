import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { AppConfig } from '../config.js';
import { AppError, forbidden, notFound, unauthenticated } from '../common/errors.js';
import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';
import { AUTH, CONFIG, DB } from '../tokens.js';
import type { Auth } from './auth.js';
import { PERMISSION_KEY, PUBLIC_KEY } from './context.js';
import { can, type Permission, type Role } from './policy.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard global, negação por padrão:
 * 1. CSRF: métodos de escrita exigem Origin igual à origem do app.
 * 2. Sessão obrigatória, exceto rotas @Public.
 * 3. Rotas com :orgId exigem associação ATIVA, consultada no banco a cada requisição
 *    (remoção de membro tem efeito imediato — T04).
 * 4. @Requires(permissão) aplica a matriz de papéis.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly origin: string;
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) config: AppConfig,
  ) {
    this.origin = new URL(config.PUBLIC_APP_URL).origin;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (UNSAFE.has(req.method) && req.header('origin') !== this.origin) {
      throw new AppError(403, 'CSRF_ORIGIN_MISMATCH', 'Origem da requisição não permitida.');
    }
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw unauthenticated();
    req.user = { id: session.user.id, email: session.user.email, name: session.user.name };

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      targets,
    );
    const rawOrg = req.params?.orgId;
    const orgId = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
    if (orgId === undefined) {
      if (permission) throw new Error(`@Requires(${permission}) em rota sem :orgId`);
      return true;
    }
    if (!UUID.test(orgId)) throw notFound('Empresa');
    const r = await this.db.query<{ id: string; role: Role; timezone: string }>(
      `SELECT m.id, m.role, o.timezone FROM memberships m JOIN organizations o ON o.id = m.organization_id
        WHERE m.organization_id = $1 AND m.user_id = $2 AND m.status = 'ACTIVE'`,
      [orgId, req.user.id],
    );
    const m = r.rows[0];
    // 404 (não 403): não revela se a empresa existe para quem não é membro.
    if (!m) throw notFound('Empresa');
    req.member = {
      membershipId: m.id,
      organizationId: orgId,
      role: m.role,
      timezone: m.timezone,
      userId: req.user.id,
    };
    if (!permission) throw new Error('Rota com :orgId precisa declarar @Requires');
    if (!can(m.role, permission)) {
      log('warn', 'access_denied', {
        requestId: req.requestId,
        organizationId: orgId,
        role: m.role,
        permission,
      });
      throw forbidden();
    }
    return true;
  }
}
