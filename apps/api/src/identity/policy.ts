/**
 * Matriz de autorização (brief 7.2) em código. Negação por padrão:
 * uma permissão não listada para o papel é negada.
 * Regras por recurso (ex.: técnico só nas visitas atribuídas) ficam nos serviços.
 */
export const ROLES = ['ADMIN', 'ATTENDANT', 'TECHNICIAN'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  'org.manage': ['ADMIN'],
  'members.read': ['ADMIN', 'ATTENDANT'],
  'members.manage': ['ADMIN'],
  'customers.read': ['ADMIN', 'ATTENDANT'],
  'customers.write': ['ADMIN', 'ATTENDANT'],
  'orders.read': ['ADMIN', 'ATTENDANT', 'TECHNICIAN'], // técnico: filtrado por atribuição no serviço
  'orders.write': ['ADMIN', 'ATTENDANT'],
  'quotes.read': ['ADMIN', 'ATTENDANT'],
  'quotes.write': ['ADMIN', 'ATTENDANT'],
  'appointments.read': ['ADMIN', 'ATTENDANT', 'TECHNICIAN'],
  'appointments.write': ['ADMIN', 'ATTENDANT'],
  'visits.execute': ['ADMIN', 'TECHNICIAN'], // técnico: só as próprias
  'attachments.write': ['ADMIN', 'ATTENDANT', 'TECHNICIAN'],
  'audit.read': ['ADMIN'],
  'ops.manage': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Quem pode convidar qual papel: impede escalada (atendente não cria administrador). */
export function canInvite(inviter: Role, invited: Role): boolean {
  return inviter === 'ADMIN' && ROLES.includes(invited);
}
