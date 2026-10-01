import type { Role } from '../../shared/domain/role.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  companyId: string;
}

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  activeLicenseId: string | null;
  licenseAssignedAt: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findCompanyUsers(companyId: string): Promise<CompanyUser[]>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
