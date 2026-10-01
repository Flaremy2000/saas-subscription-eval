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

export interface UsageRepository {
  getCompany(companyId: string): Promise<CompanyRecord | null>;
  countActiveLicenses(companyId: string): Promise<number>;
  getDailyMetrics(companyId: string, since: Date): Promise<DailyMetric[]>;
}

export const USAGE_REPOSITORY = Symbol('UsageRepository');
