export interface CompanyRecord {
  id: string;
  name: string;
  apiLimit: number;
  licenseLimit: number;
}

export interface DailyMetric {
  date: string;
  apiCalls: number;
}

export type PersonalLicenseStatus = 'NONE' | 'ACTIVE' | 'REVOKED';

export interface PersonalLicense {
  status: PersonalLicenseStatus;
  assignedAt: string | null;
  revokedAt: string | null;
}

export interface PersonalUsage {
  license: PersonalLicense;
  daily: DailyMetric[];
}

export interface UsageRepository {
  getCompany(companyId: string): Promise<CompanyRecord | null>;
  countActiveLicenses(companyId: string): Promise<number>;
  getDailyMetrics(companyId: string, since: Date): Promise<DailyMetric[]>;
  getPersonalUsage(params: {
    companyId: string;
    userId: string;
    since: Date;
  }): Promise<PersonalUsage>;
}

export const USAGE_REPOSITORY = Symbol('UsageRepository');
