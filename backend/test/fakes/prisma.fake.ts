import { randomUUID } from 'node:crypto';
import type {
  Company,
  License,
  LicenseStatus,
  Role,
  UsageMetric,
  User,
  UserUsageMetric,
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

interface LicenseFindFirstArgs {
  where: LicenseWhere;
  orderBy?: Array<{ status?: 'asc' | 'desc' } | { assignedAt?: 'asc' | 'desc' }>;
  select?: { status?: boolean; assignedAt?: boolean; revokedAt?: boolean };
}

interface FindManyArgs {
  where: { companyId: string; date: { gte: Date } };
  orderBy?: { date: 'asc' | 'desc' };
  select?: { date?: boolean; apiCalls?: boolean };
}

interface UserFindManyArgs {
  where: { companyId: string };
  include?: {
    licenses?: {
      where?: { status?: LicenseStatus };
      orderBy?: { assignedAt: 'asc' | 'desc' };
      take?: number;
      select?: { id?: boolean; assignedAt?: boolean };
    };
  };
  orderBy?: { name: 'asc' | 'desc' };
}

type UserWithLicenses = User & { licenses: Array<{ id: string; assignedAt: Date }> };

/**
 * In-memory Prisma double covering the query shapes used by the application.
 * Lets the e2e suites exercise the real service layer without a database.
 */
export class FakePrisma {
  companies: Company[] = [];
  users: User[] = [];
  licenses: License[] = [];
  usageMetrics: UsageMetric[] = [];
  userUsageMetrics: UserUsageMetric[] = [];

  user = {
    findUnique: async ({ where }: { where: UniqueWhere }): Promise<User | null> => {
      if (where.email !== undefined) {
        return this.users.find((user) => user.email === where.email) ?? null;
      }
      return this.users.find((user) => user.id === where.id) ?? null;
    },
    findMany: async (args: UserFindManyArgs): Promise<UserWithLicenses[]> => {
      const rows = this.users
        .filter((user) => user.companyId === args.where.companyId)
        .sort((a, b) =>
          args.orderBy?.name === 'desc'
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name),
        );

      const licenseArgs = args.include?.licenses;
      return rows.map((user) => {
        const licenses = this.licenses
          .filter(
            (license) =>
              license.userId === user.id &&
              (licenseArgs?.where?.status === undefined ||
                license.status === licenseArgs.where.status),
          )
          .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())
          .slice(0, licenseArgs?.take)
          .map((license) => ({ id: license.id, assignedAt: license.assignedAt }));
        return { ...user, licenses };
      });
    },
    count: async ({ where }: { where: { companyId: string; role?: Role } }): Promise<number> =>
      this.users.filter(
        (user) =>
          user.companyId === where.companyId &&
          (where.role === undefined || user.role === where.role),
      ).length,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { role: Role };
    }): Promise<User> => {
      const user = this.users.find((candidate) => candidate.id === where.id);
      if (!user) {
        throw new Error('Record to update not found.');
      }
      user.role = data.role;
      return user;
    },
  };

  company = {
    findUnique: async ({ where }: { where: { id: string } }): Promise<Company | null> =>
      this.companies.find((company) => company.id === where.id) ?? null,
  };

  license = {
    findFirst: async (args: LicenseFindFirstArgs): Promise<License | null> => {
      const rows = this.licenses.filter(
        (license) =>
          license.userId === args.where.userId &&
          (args.where.companyId === undefined || license.companyId === args.where.companyId) &&
          (args.where.status === undefined || license.status === args.where.status),
      );
      if (args.orderBy?.some((clause) => 'status' in clause && clause.status === 'asc')) {
        rows.sort(
          (a, b) =>
            a.status.localeCompare(b.status) || b.assignedAt.getTime() - a.assignedAt.getTime(),
        );
      } else {
        rows.sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());
      }
      return rows[0] ?? null;
    },
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
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { status: LicenseStatus; revokedAt: Date };
    }): Promise<License> => {
      const license = this.licenses.find((candidate) => candidate.id === where.id);
      if (!license) {
        throw new Error('Record to update not found.');
      }
      license.status = data.status;
      license.revokedAt = data.revokedAt;
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

  userUsageMetric = {
    findMany: async (args: {
      where: { companyId: string; userId: string; date: { gte: Date } };
      orderBy?: { date: 'asc' | 'desc' };
      select?: { date?: boolean; apiCalls?: boolean };
    }): Promise<UserUsageMetric[]> => {
      const rows = this.userUsageMetrics.filter(
        (metric) =>
          metric.companyId === args.where.companyId &&
          metric.userId === args.where.userId &&
          metric.date >= args.where.date.gte,
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
