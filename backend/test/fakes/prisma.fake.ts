import { randomUUID } from 'node:crypto';
import type {
  Company,
  License,
  LicenseStatus,
  UsageMetric,
  User,
} from '../../src/generated/prisma/client.js';

interface UniqueWhere {
  id?: string;
  email?: string;
}

interface LicenseWhere {
  companyId?: string;
  userId?: string;
  status?: LicenseStatus;
}

interface FindManyArgs {
  where: { companyId: string; date: { gte: Date } };
  orderBy?: { date: 'asc' | 'desc' };
  select?: { date?: boolean; apiCalls?: boolean };
}

/**
 * In-memory Prisma double covering the query shapes used by the application.
 * Lets the e2e suites exercise the real service layer without a database.
 */
export class FakePrisma {
  companies: Company[] = [];
  users: User[] = [];
  licenses: License[] = [];
  usageMetrics: UsageMetric[] = [];

  user = {
    findUnique: async ({ where }: { where: UniqueWhere }): Promise<User | null> => {
      if (where.email !== undefined) {
        return this.users.find((user) => user.email === where.email) ?? null;
      }
      return this.users.find((user) => user.id === where.id) ?? null;
    },
  };

  company = {
    findUnique: async ({ where }: { where: { id: string } }): Promise<Company | null> =>
      this.companies.find((company) => company.id === where.id) ?? null,
  };

  license = {
    findFirst: async ({ where }: { where: LicenseWhere }): Promise<License | null> =>
      this.licenses.find(
        (license) =>
          license.userId === where.userId &&
          (where.status === undefined || license.status === where.status),
      ) ?? null,
    count: async ({ where }: { where: LicenseWhere }): Promise<number> =>
      this.licenses.filter(
        (license) =>
          license.companyId === where.companyId &&
          (where.status === undefined || license.status === where.status),
      ).length,
    create: async ({ data }: { data: { userId: string; companyId: string } }): Promise<License> => {
      const license: License = {
        id: randomUUID(),
        status: 'ACTIVE',
        assignedAt: new Date(),
        revokedAt: null,
        userId: data.userId,
        companyId: data.companyId,
      };
      this.licenses.push(license);
      return license;
    },
  };

  usageMetric = {
    findMany: async (args: FindManyArgs): Promise<UsageMetric[]> => {
      const rows = this.usageMetrics.filter(
        (metric) => metric.companyId === args.where.companyId && metric.date >= args.where.date.gte,
      );
      rows.sort((a, b) => a.date.getTime() - b.date.getTime());
      if (args.orderBy?.date === 'desc') {
        rows.reverse();
      }
      return rows;
    },
  };

  $transaction = async <R>(fn: (tx: FakePrisma) => Promise<R>): Promise<R> => fn(this);
}
