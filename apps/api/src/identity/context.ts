import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission, Role } from './policy.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
export interface Member {
  membershipId: string;
  organizationId: string;
  role: Role;
  timezone: string;
  userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    member?: Member;
  }
}

export const PUBLIC_KEY = 'sf:public';
export const PERMISSION_KEY = 'sf:permission';

/** Rota sem sessão (health, link do cliente, aceite de convite). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Exige associação ativa à empresa :orgId e a permissão indicada. */
export const Requires = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new Error('CurrentUser usado em rota sem sessão');
  return user;
});
export const CurrentMember = createParamDecorator((_: unknown, ctx: ExecutionContext): Member => {
  const member = ctx.switchToHttp().getRequest<Request>().member;
  if (!member) throw new Error('CurrentMember usado em rota sem @Requires');
  return member;
});
export const RequestId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest<Request>().requestId,
);
