import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { audit } from '../audit/audit.js';
import { AppError, conflict, invalid, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';
import { CurrentMember, Public, RequestId, Requires, type Member } from '../identity/context.js';
import { orderDetailExtras } from '../orders/detail-extras.js';
import { technicianOrderFilter } from '../orders/service.js';
import { DB, STORAGE } from '../tokens.js';
import { IMAGE_LIMITS, validateAndReencode } from './images.js';
import { LocalStorage, type ObjectStorage } from './storage.js';

const URL_TTL_SECONDS = 300;

const initiateSchema = z.strictObject({
  orderId: z.uuid(),
  appointmentId: z.uuid().optional(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().min(1).max(IMAGE_LIMITS.maxBytes, 'Máximo de 5 MB por foto'),
});

/** Garante que o membro pode ver a ordem (técnico: só se tiver visita atribuída). */
async function assertOrderAccess(db: Pick<Db, 'query'>, m: Member, orderId: string) {
  const params: unknown[] = [m.organizationId, orderId];
  let scope = '';
  if (m.role === 'TECHNICIAN') {
    params.push(m.userId);
    scope = ` AND ${technicianOrderFilter(3)}`;
  }
  const r = await db.query(
    `SELECT status FROM service_orders so WHERE so.organization_id = $1 AND so.id = $2${scope}`,
    params,
  );
  if (!r.rows[0]) throw notFound('Ordem');
  return r.rows[0].status as string;
}

orderDetailExtras.attachments = async (db, m, orderId) => {
  const r = await db.query(
    `SELECT at.id, at.width, at.height, at.size_bytes AS "sizeBytes", at.created_at AS "createdAt", u.name AS "uploadedBy",
            at.appointment_id AS "appointmentId"
       FROM attachments at JOIN "user" u ON u.id = at.uploaded_by
      WHERE at.organization_id = $1 AND at.order_id = $2 AND at.status = 'READY' ORDER BY at.created_at`,
    [m.organizationId, orderId],
  );
  return r.rows;
};

@Controller('organizations/:orgId/attachments')
export class AttachmentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /** 1) Autoriza o upload: valida permissão e quota, cria registro PENDENTE e URL curta. */
  @Post('initiate')
  @Requires('attachments.write')
  async initiate(
    @CurrentMember() m: Member,
    @Body(new ZodPipe(initiateSchema)) b: z.infer<typeof initiateSchema>,
  ) {
    const status = await assertOrderAccess(this.db, m, b.orderId);
    if (status === 'CANCELLED')
      throw conflict('INVALID_STATE', 'Ordem cancelada não recebe fotos.');
    if (b.appointmentId) {
      const a = await this.db.query(
        `SELECT 1 FROM appointments WHERE organization_id = $1 AND id = $2 AND order_id = $3`,
        [m.organizationId, b.appointmentId, b.orderId],
      );
      if (!a.rowCount) throw invalid('Visita inválida para esta ordem.');
    }
    const count = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM attachments WHERE organization_id = $1 AND order_id = $2 AND status IN ('PENDING','READY')`,
      [m.organizationId, b.orderId],
    );
    if ((count.rows[0]?.n ?? 0) >= IMAGE_LIMITS.maxPerOrder) {
      throw conflict('QUOTA_EXCEEDED', `Limite de ${IMAGE_LIMITS.maxPerOrder} fotos por ordem.`);
    }
    // Chave gerada pelo servidor; nome enviado pelo usuário não é usado.
    const rawKey = `quarantine/${m.organizationId}/${randomUUID()}`;
    const r = await this.db.query<{ id: string }>(
      `INSERT INTO attachments (organization_id, order_id, appointment_id, uploaded_by, raw_key, declared_type, declared_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        m.organizationId,
        b.orderId,
        b.appointmentId ?? null,
        m.userId,
        rawKey,
        b.contentType,
        b.sizeBytes,
      ],
    );
    const uploadUrl = await this.storage.presignPut(rawKey, b.contentType, URL_TTL_SECONDS);
    return {
      id: r.rows[0]!.id,
      uploadUrl,
      method: 'PUT',
      headers: { 'content-type': b.contentType },
      expiresInSeconds: URL_TTL_SECONDS,
    };
  }

  /** 2) Finaliza: lê o objeto bruto, valida pelo conteúdo, reprocessa e publica. */
  @Post(':id/finalize')
  @Requires('attachments.write')
  async finalize(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestId() requestId: string,
  ) {
    const r = await this.db.query(
      `SELECT id, order_id, raw_key, status, uploaded_by FROM attachments WHERE organization_id = $1 AND id = $2`,
      [m.organizationId, id],
    );
    const at = r.rows[0];
    if (!at || at.uploaded_by !== m.userId) throw notFound('Anexo');
    if (at.status === 'READY') return { id, status: 'READY' };
    if (at.status !== 'PENDING') throw conflict('INVALID_STATE', 'Anexo recusado.');
    const raw = await this.storage.get(at.raw_key, IMAGE_LIMITS.maxBytes);
    if (!raw) throw new AppError(409, 'UPLOAD_MISSING', 'Arquivo ainda não enviado.');
    const check = await validateAndReencode(raw);
    await this.storage.delete(at.raw_key); // objeto bruto nunca é servido
    if (!check.ok) {
      await this.db.query(
        `UPDATE attachments SET status = 'REJECTED', reject_reason = $2, finalized_at = now() WHERE id = $1`,
        [id, check.reason],
      );
      log('warn', 'attachment_rejected', { requestId, attachmentId: id, reason: check.reason });
      throw invalid('Arquivo não é uma imagem JPEG, PNG ou WebP válida (máx. 5 MB).');
    }
    const objectKey = `orgs/${m.organizationId}/orders/${at.order_id}/${randomUUID()}.webp`;
    await this.storage.put(objectKey, check.buffer, 'image/webp');
    await this.db.query(
      `UPDATE attachments SET status = 'READY', object_key = $2, size_bytes = $3, width = $4, height = $5, finalized_at = now() WHERE id = $1`,
      [id, objectKey, check.buffer.length, check.width, check.height],
    );
    await audit(this.db, {
      organizationId: m.organizationId,
      actorType: 'USER',
      actorUserId: m.userId,
      action: 'attachment.added',
      resourceType: 'attachment',
      resourceId: id,
      requestId,
    });
    return { id, status: 'READY', width: check.width, height: check.height };
  }

  /** 3) Download: valida empresa, ordem e papel a CADA pedido; URL expira em 5 min (T18). */
  @Get(':id/url')
  @Requires('orders.read')
  async url(@CurrentMember() m: Member, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.db.query(
      `SELECT order_id, object_key FROM attachments WHERE organization_id = $1 AND id = $2 AND status = 'READY'`,
      [m.organizationId, id],
    );
    if (!r.rows[0]) throw notFound('Anexo');
    await assertOrderAccess(this.db, m, r.rows[0].order_id);
    return {
      url: await this.storage.presignGet(r.rows[0].object_key, URL_TTL_SECONDS),
      expiresInSeconds: URL_TTL_SECONDS,
    };
  }
}

/** Rotas do adaptador local (só desenvolvimento/testes): autorizadas apenas pela assinatura HMAC. */
@Public()
@Controller('storage-local')
export class LocalStorageController {
  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  private check(op: 'put' | 'get', key: string | string[], q: { exp?: string; sig?: string }) {
    const k = Array.isArray(key) ? key.join('/') : key;
    if (
      !(this.storage instanceof LocalStorage) ||
      !this.storage.verify(op, k, Number(q.exp), String(q.sig ?? ''))
    ) {
      throw new AppError(403, 'SIGNATURE_INVALID', 'Link expirado ou inválido.');
    }
    return { k, local: this.storage };
  }

  @Put('put/*key')
  async put(
    @Param('key') key: string | string[],
    @Query() q: { exp?: string; sig?: string },
    @Req() req: Request,
  ) {
    const { k, local } = this.check('put', key, q);
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body)) throw invalid('Corpo vazio.');
    await local.put(k, body);
    return { ok: true };
  }

  @Get('get/*key')
  async get(
    @Param('key') key: string | string[],
    @Query() q: { exp?: string; sig?: string },
    @Res() res: Response,
  ) {
    const { k, local } = this.check('get', key, q);
    const data = await local.get(k);
    if (!data) throw notFound('Arquivo');
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  }
}
