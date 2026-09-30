import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const USAGE_WINDOW_DAYS = 30;

export type UsageStatus = 'healthy' | 'warning' | 'exceeded';

export interface UsageReport {
  company: {
    id: string;
    name: string;
    apiLimit: number;
    licenseLimit: number;
  };
  usage: {
    totalLicenses: number;
    usedLicenses: number;
    availableLicenses: number;
    usagePercentage: number;
  };
  api: {
    used: number;
    limit: number;
    usagePercentage: number;
    exceeded: boolean;
  };
  daily: { date: string; apiCalls: number }[];
  status: UsageStatus;
}

const percentage = (value: number, limit: number): number =>
  limit > 0 ? Math.round((value / limit) * 100) : 0;

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(companyId: string): Promise<UsageReport> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [usedLicenses, metrics] = await Promise.all([
      this.prisma.license.count({ where: { companyId: company.id, status: 'ACTIVE' } }),
      this.prisma.usageMetric.findMany({
        where: { companyId: company.id, date: { gte: since } },
        orderBy: { date: 'asc' },
        select: { date: true, apiCalls: true },
      }),
    ]);

    const apiUsed = metrics.reduce((total, metric) => total + metric.apiCalls, 0);
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
      daily: metrics.map((metric) => ({
        date: metric.date.toISOString().slice(0, 10),
        apiCalls: metric.apiCalls,
      })),
      status:
        apiUsed > company.apiLimit ? 'exceeded' : apiUsagePercentage >= 80 ? 'warning' : 'healthy',
    };
  }
}
