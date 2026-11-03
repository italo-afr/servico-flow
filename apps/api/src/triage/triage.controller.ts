import { Body, Controller, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { AppError } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { Requires } from '../identity/context.js';
import { CONFIG } from '../tokens.js';
import { suggestTriage } from './rules.js';

const schema = z.strictObject({ description: z.string().trim().min(3).max(4000) });

/**
 * Sugestão de triagem por regras (experimental, ADR-0010). Desligada por padrão;
 * TRIAGE_SUGGESTIONS=false funciona como desligamento imediato. Não grava nada.
 */
@Controller('organizations/:orgId/triage')
export class TriageController {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  @Post('suggest')
  @Requires('orders.write')
  suggest(@Body(new ZodPipe(schema)) b: z.infer<typeof schema>) {
    if (!this.config.TRIAGE_SUGGESTIONS)
      throw new AppError(404, 'FEATURE_DISABLED', 'Sugestão de triagem desativada.');
    return suggestTriage(b.description);
  }
}
