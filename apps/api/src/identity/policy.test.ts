import { describe, expect, it } from 'vitest';
import { can, canInvite, PERMISSIONS, ROLES } from './policy.js';

describe('matriz de autorização', () => {
  it('nega por padrão: técnico não gerencia equipe nem vê orçamentos', () => {
    expect(can('TECHNICIAN', 'members.manage')).toBe(false);
    expect(can('TECHNICIAN', 'quotes.read')).toBe(false);
    expect(can('TECHNICIAN', 'visits.execute')).toBe(true);
  });
  it('atendente opera clientes, ordens e orçamentos, mas não auditoria', () => {
    for (const p of [
      'customers.write',
      'orders.write',
      'quotes.write',
      'appointments.write',
    ] as const) {
      expect(can('ATTENDANT', p)).toBe(true);
    }
    expect(can('ATTENDANT', 'audit.read')).toBe(false);
  });
  it('somente administrador convida (sem escalada de papel)', () => {
    expect(canInvite('ATTENDANT', 'ADMIN')).toBe(false);
    expect(canInvite('ATTENDANT', 'TECHNICIAN')).toBe(false);
    expect(canInvite('ADMIN', 'ADMIN')).toBe(true);
  });
  it('toda permissão lista apenas papéis válidos', () => {
    for (const roles of Object.values(PERMISSIONS))
      for (const r of roles) expect(ROLES).toContain(r);
  });
});
