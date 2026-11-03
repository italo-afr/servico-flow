import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthResponse } from '@servicoflow/contracts';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/pool.js';
import { Public } from '../identity/context.js';
import { CONFIG, DB } from '../tokens.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Liveness: o processo responde. Não depende do banco. */
  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', checks: {}, release: this.config.RELEASE_SHA };
  }

  /** Readiness: banco acessível e migrations aplicadas. E-mail não entra (brief 11.4). */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = { database: 'fail', migrations: 'fail' };
    try {
      await this.db.query('SELECT 1');
      checks.database = 'ok';
      const r = await this.db.query(
        "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS ok",
      );
      if (r.rows[0]?.ok) {
        const c = await this.db.query('SELECT count(*)::int AS n FROM schema_migrations');
        checks.migrations = (c.rows[0]?.n ?? 0) > 0 ? 'ok' : 'fail';
      }
    } catch {
      // detalhes ficam no log do pool; resposta não expõe erro de banco
    }
    const ok = Object.values(checks).every((v) => v === 'ok');
    if (!ok) res.status(503);
    return { status: ok ? 'ok' : 'unavailable', checks, release: this.config.RELEASE_SHA };
  }
}
