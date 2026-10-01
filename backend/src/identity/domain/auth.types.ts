import type { Role } from '../../shared/domain/role.js';

declare global {
  namespace Express {
    interface User {
      sub: string;
      email: string;
      name: string;
      role: Role;
      companyId: string;
    }
  }
}

export type AuthenticatedUser = Express.User;

export type JwtPayload = AuthenticatedUser;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
}
