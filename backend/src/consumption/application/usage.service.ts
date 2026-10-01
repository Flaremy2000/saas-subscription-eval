import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USAGE_REPOSITORY, type UsageRepository } from '../domain/usage.repository.js';
import type { UsageReport } from '../domain/usage.types.js';

const USAGE_WINDOW_DAYS = 30;

const percentage = (value: number, limit: number): number =>
  limit > 0 ? Math.round((value / limit) * 100) : 0;

@Injectable()
export class UsageService {
  constructor(@Inject(USAGE_REPOSITORY) private readonly usage: UsageRepository) {}

  async getUsage(companyId: string): Promise<UsageReport> {
    const company = await this.usage.getCompany(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [usedLicenses, daily] = await Promise.all([
      this.usage.countActiveLicenses(company.id),
      this.usage.getDailyMetrics(company.id, since),
    ]);

    const apiUsed = daily.reduce((total, metric) => total + metric.apiCalls, 0);
    const apiUsagePercentage = percentage(apiUsed, company.apiLimit);
    const totalLicenses = company.licenseLimit;

    return {
      company: {
        id: company.id,
        name: company.name,
        apiLimit: company.apiLimit,
        licenseLimit: company.licenseLimit,
      },
      usage: {
        totalLicenses,
        usedLicenses,
        availableLicenses: Math.max(0, totalLicenses - usedLicenses),
        usagePercentage: percentage(usedLicenses, totalLicenses),
      },
      api: {
        used: apiUsed,
        limit: company.apiLimit,
        usagePercentage: apiUsagePercentage,
        exceeded: apiUsed > company.apiLimit,
      },
      daily,
      status:
        apiUsed > company.apiLimit ? 'exceeded' : apiUsagePercentage >= 80 ? 'warning' : 'healthy',
    };
  }
}
