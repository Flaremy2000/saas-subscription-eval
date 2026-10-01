import type { AssignedLicense } from './license.types.js';

export interface LicenseRepository {
  countActive(companyId: string): Promise<number>;
  assign(params: { userId: string; companyId: string }): Promise<AssignedLicense>;
}

export const LICENSE_REPOSITORY = Symbol('LicenseRepository');

export class DuplicateLicenseError extends Error {
  constructor() {
    super('User already has an active license');
    this.name = 'DuplicateLicenseError';
  }
}

export class SeatLimitReachedError extends Error {
  constructor() {
    super('License limit reached');
    this.name = 'SeatLimitReachedError';
  }
}

export class CompanyNotFoundError extends Error {
  constructor() {
    super('Company not found');
    this.name = 'CompanyNotFoundError';
  }
}
