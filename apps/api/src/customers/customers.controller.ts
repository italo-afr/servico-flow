import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { audit } from '../audit/audit.js';
import { conflict, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { decodeCursor, pageOf } from '../common/pagination.js';
import { withTransaction, type Db, type Tx } from '../db/pool.js';
import { CurrentMember, RequestId, Requires, type Member } from '../identity/context.js';
import { DB } from '../tokens.js';

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const addressSchema = z.strictObject({
  label: opt(60),
  street: z.string().trim().min(2).max(200),
  number: opt(20),
  complement: opt(100),
  district: opt(100),
  city: z.string().trim().min(2).max(100),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'UF com 2 letras'),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, 'CEP no formato 00000-000')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  accessNotes: opt(500),
});
export const equipmentSchema = z.strictObject({
  description: z.string().trim().min(2).max(160),
  brand: opt(60),
  model: opt(80),
  capacityBtu: z.coerce.number().int().min(1000).max(1_000_000).optional(),
  serialNumber: opt(80),
});
// Dados pessoais mínimos (brief 7.6): sem CPF, documento ou data de nascimento.
const customerSchema = z.strictObject({
  name: z.string().trim().min(2).max(160),
  phone: opt(40),
  email: z
    .email()
    .max(254)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: opt(2000),
  address: addressSchema.optional(),
  equipment: equipmentSchema.optional(),
});
const updateSchema = z.strictObject({
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  phone: opt(40),
  email: z
    .email()
    .max(254)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: opt(2000),
});
const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(300).optional(),
  archived: z.enum(['true', 'false']).default('false'),
});

export async function insertAddress(
  tx: Tx,
  orgId: string,
  customerId: string,
  a: z.infer<typeof addressSchema>,
) {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO service_addresses (organization_id, customer_id, label, street, number, complement, district, city, state, postal_code, access_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      orgId,
      customerId,
      a.label,
      a.street,
      a.number,
      a.complement,
      a.district,
      a.city,
      a.state,
      a.postalCode ?? null,
      a.accessNotes,
    ],
  );
  return r.rows[0]!.id;
}
export async function insertEquipment(
  tx: Tx,
  orgId: string,
  customerId: string,
  e: z.infer<typeof equipmentSchema>,
) {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO equipment (organization_id, customer_id, description, brand, model, capacity_btu, serial_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [orgId, customerId, e.description, e.brand, e.model, e.capacityBtu ?? null, e.serialNumber],
  );
  return r.rows[0]!.id;
}

@Controller('organizations/:orgId/customers')
export class CustomersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Requires('customers.read')
  async list(
    @CurrentMember() m: Member,
    @Query(new ZodPipe(listSchema)) q: z.infer<typeof listSchema>,
  ) {
    const cursor = decodeCursor(q.cursor);
    const params: unknown[] = [m.organizationId, q.limit + 1];
    let where = `organization_id = $1 AND archived_at IS ${q.archived === 'true' ? 'NOT ' : ''}NULL`;
    if (q.q) {
      params.push(`%${q.q.replace(/[%_\\]/g, '\\$&')}%`);
      where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (cursor) {
      params.push(cursor.t, cursor.id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    const r = await this.db.query(
      `SELECT id, name, phone, email, created_at AS "createdAt", archived_at AS "archivedAt",
              (SELECT count(*)::int FROM service_orders so WHERE so.organization_id = c.organization_id AND so.customer_id = c.id) AS "orderCount"
         FROM customers c WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $2`,
      params,
    );
    return pageOf(r.rows, q.limit);
  }

  @Post()
  @Requires('customers.write')
  async create(
    @CurrentMember() m: Member,
    @Body(new ZodPipe(customerSchema)) b: z.infer<typeof customerSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (organization_id, name, phone, email, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [m.organizationId, b.name, b.phone, b.email ?? null, b.notes],
      );
      const id = c.rows[0]!.id;
      const addressId = b.address ? await insertAddress(tx, m.organizationId, id, b.address) : null;
      const equipmentId = b.equipment
        ? await insertEquipment(tx, m.organizationId, id, b.equipment)
        : null;
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'customer.created',
        resourceType: 'customer',
        resourceId: id,
        requestId,
      });
      return { id, addressId, equipmentId };
    });
  }

  @Get(':id')
  @Requires('customers.read')
  async detail(@CurrentMember() m: Member, @Param('id', ParseUUIDPipe) id: string) {
    const c = await this.db.query(
      `SELECT id, name, phone, email, notes, version, archived_at AS "archivedAt", created_at AS "createdAt"
         FROM customers WHERE organization_id = $1 AND id = $2`,
      [m.organizationId, id],
    );
    if (!c.rows[0]) throw notFound('Cliente');
    const [addresses, equipment, orders] = await Promise.all([
      this.db.query(
        `SELECT id, label, street, number, complement, district, city, state, postal_code AS "postalCode",
                access_notes AS "accessNotes", archived_at AS "archivedAt"
           FROM service_addresses WHERE organization_id = $1 AND customer_id = $2 ORDER BY created_at`,
        [m.organizationId, id],
      ),
      this.db.query(
        `SELECT id, description, brand, model, capacity_btu AS "capacityBtu", serial_number AS "serialNumber", archived_at AS "archivedAt"
           FROM equipment WHERE organization_id = $1 AND customer_id = $2 ORDER BY created_at`,
        [m.organizationId, id],
      ),
      this.db.query(
        `SELECT id, number, status, created_at AS "createdAt" FROM service_orders
          WHERE organization_id = $1 AND customer_id = $2 ORDER BY created_at DESC LIMIT 50`,
        [m.organizationId, id],
      ),
    ]);
    return {
      ...c.rows[0],
      addresses: addresses.rows,
      equipment: equipment.rows,
      orders: orders.rows,
    };
  }

  @Post(':id/update')
  @Requires('customers.write')
  async update(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateSchema)) b: z.infer<typeof updateSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      // Controle otimista: só atualiza se ninguém alterou desde a leitura (brief 5.5).
      const r = await tx.query<{ version: number }>(
        `UPDATE customers SET name = $4, phone = $5, email = $6, notes = $7, version = version + 1, updated_at = now()
          WHERE organization_id = $1 AND id = $2 AND version = $3 RETURNING version`,
        [m.organizationId, id, b.version, b.name, b.phone, b.email ?? null, b.notes],
      );
      if (!r.rows[0]) {
        const exists = await tx.query(
          'SELECT 1 FROM customers WHERE organization_id = $1 AND id = $2',
          [m.organizationId, id],
        );
        if (!exists.rowCount) throw notFound('Cliente');
        throw conflict(
          'VERSION_CONFLICT',
          'O cadastro foi alterado por outra pessoa. Recarregue e tente novamente.',
        );
      }
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'customer.updated',
        resourceType: 'customer',
        resourceId: id,
        requestId,
      });
      return { id, version: r.rows[0].version };
    });
  }

  @Post(':id/archive')
  @Requires('customers.write')
  async archive(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      // Arquivar, nunca apagar: ordens antigas continuam com seu histórico.
      const r = await tx.query(
        `UPDATE customers SET archived_at = coalesce(archived_at, now()), version = version + 1 WHERE organization_id = $1 AND id = $2`,
        [m.organizationId, id],
      );
      if (!r.rowCount) throw notFound('Cliente');
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'customer.archived',
        resourceType: 'customer',
        resourceId: id,
        requestId,
      });
      return { id, archived: true };
    });
  }

  @Post(':id/addresses')
  @Requires('customers.write')
  async addAddress(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(addressSchema)) b: z.infer<typeof addressSchema>,
  ) {
    return withTransaction(this.db, async (tx) => {
      await this.assertActive(tx, m.organizationId, id);
      return { id: await insertAddress(tx, m.organizationId, id, b) };
    });
  }

  @Post(':id/equipment')
  @Requires('customers.write')
  async addEquipment(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(equipmentSchema)) b: z.infer<typeof equipmentSchema>,
  ) {
    return withTransaction(this.db, async (tx) => {
      await this.assertActive(tx, m.organizationId, id);
      return { id: await insertEquipment(tx, m.organizationId, id, b) };
    });
  }

  @Post(':id/addresses/:addressId/archive')
  @Requires('customers.write')
  async archiveAddress(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    const r = await this.db.query(
      `UPDATE service_addresses SET archived_at = coalesce(archived_at, now()) WHERE organization_id = $1 AND customer_id = $2 AND id = $3`,
      [m.organizationId, id, addressId],
    );
    if (!r.rowCount) throw notFound('Endereço');
    return { id: addressId, archived: true };
  }

  @Post(':id/equipment/:equipmentId/archive')
  @Requires('customers.write')
  async archiveEquipment(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
  ) {
    const r = await this.db.query(
      `UPDATE equipment SET archived_at = coalesce(archived_at, now()) WHERE organization_id = $1 AND customer_id = $2 AND id = $3`,
      [m.organizationId, id, equipmentId],
    );
    if (!r.rowCount) throw notFound('Equipamento');
    return { id: equipmentId, archived: true };
  }

  private async assertActive(tx: Tx, orgId: string, id: string) {
    const r = await tx.query(
      `SELECT archived_at FROM customers WHERE organization_id = $1 AND id = $2 FOR SHARE`,
      [orgId, id],
    );
    if (!r.rows[0]) throw notFound('Cliente');
    if (r.rows[0].archived_at) throw conflict('CUSTOMER_ARCHIVED', 'Cliente arquivado.');
  }
}
