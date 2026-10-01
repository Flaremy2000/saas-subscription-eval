import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import type {
  CompanyRecord,
  DailyMetric,
  PersonalUsage,
  UsageRepository,
} from '../domain/usage.repository.js';

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

  async getPersonalUsage(params: {
    companyId: string;
    userId: string;
    since: Date;
  }): Promise<PersonalUsage> {
    const [license, metrics] = await Promise.all([
      this.prisma.license.findFirst({
        where: { userId: params.userId, companyId: params.companyId },
        orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }],
        select: { status: true, assignedAt: true, revokedAt: true },
      }),
      this.prisma.userUsageMetric.findMany({
        where: { companyId: params.companyId, userId: params.userId, date: { gte: params.since } },
        orderBy: { date: 'asc' },
        select: { date: true, apiCalls: true },
      }),
    ]);

    return {
      license: license
        ? {
            status: license.status,
            assignedAt: license.assignedAt.toISOString(),
            revokedAt: license.revokedAt ? license.revokedAt.toISOString() : null,
          }
        : { status: 'NONE', assignedAt: null, revokedAt: null },
      daily: metrics.map((metric) => ({
        date: metric.date.toISOString().slice(0, 10),
        apiCalls: metric.apiCalls,
      })),
    };
  }
}
