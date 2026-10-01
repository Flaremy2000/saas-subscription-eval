import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import type { CompanyRecord, DailyMetric, UsageRepository } from '../domain/usage.repository.js';

@Injectable()
export class PrismaUsageRepository implements UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  getCompany(companyId: string): Promise<CompanyRecord | null> {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, apiLimit: true, licenseLimit: true },
    });
  }

  countActiveLicenses(companyId: string): Promise<number> {
    return this.prisma.license.count({ where: { companyId, status: 'ACTIVE' } });
  }

  async getDailyMetrics(companyId: string, since: Date): Promise<DailyMetric[]> {
    const metrics = await this.prisma.usageMetric.findMany({
      where: { companyId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, apiCalls: true },
    });

    return metrics.map((metric) => ({
      date: metric.date.toISOString().slice(0, 10),
      apiCalls: metric.apiCalls,
    }));
  }
}
