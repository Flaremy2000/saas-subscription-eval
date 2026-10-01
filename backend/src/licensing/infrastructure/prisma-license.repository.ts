import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import {
  CompanyNotFoundError,
  DuplicateLicenseError,
  SeatLimitReachedError,
  type LicenseRepository,
} from '../domain/license.repository.js';
import type { AssignedLicense } from '../domain/license.types.js';

@Injectable()
export class PrismaLicenseRepository implements LicenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  countActive(companyId: string): Promise<number> {
    return this.prisma.license.count({ where: { companyId, status: 'ACTIVE' } });
  }

  async assign(params: { userId: string; companyId: string }): Promise<AssignedLicense> {
    return this.prisma.$transaction(
      async (tx) => {
        const company = await tx.company.findUnique({ where: { id: params.companyId } });
        if (!company) {
          throw new CompanyNotFoundError();
        }

        const active = await tx.license.findFirst({
          where: { userId: params.userId, status: 'ACTIVE' },
        });
        if (active) {
          throw new DuplicateLicenseError();
        }

        const used = await tx.license.count({
          where: { companyId: company.id, status: 'ACTIVE' },
        });
        if (used >= company.licenseLimit) {
          throw new SeatLimitReachedError();
        }

        const license = await tx.license.create({
          data: { userId: params.userId, companyId: company.id },
        });

        return {
          id: license.id,
          userId: license.userId,
          companyId: license.companyId,
          status: license.status,
          assignedAt: license.assignedAt,
          revokedAt: license.revokedAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findActiveByUser(params: { userId: string; companyId: string }): Promise<AssignedLicense | null> {
    return this.prisma.license.findFirst({
      where: { userId: params.userId, companyId: params.companyId, status: 'ACTIVE' },
    });
  }

  async revoke(id: string): Promise<AssignedLicense> {
    const revokedAt = new Date();
    return this.prisma.license.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt },
    });
  }
}
