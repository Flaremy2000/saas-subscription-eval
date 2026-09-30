import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LicenseStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignLicenseRequest } from './dto/assign-license.request.js';

export interface LicenseAssignment {
  success: boolean;
  message: string;
  license: {
    id: string;
    userId: string;
    companyId: string;
    status: LicenseStatus;
    assignedAt: Date;
  };
}

@Injectable()
export class LicensesService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(admin: Express.User, dto: AssignLicenseRequest): Promise<LicenseAssignment> {
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target || target.companyId !== admin.companyId) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const company = await tx.company.findUnique({ where: { id: admin.companyId } });
        if (!company) {
          throw new NotFoundException('Company not found');
        }

        const active = await tx.license.findFirst({
          where: { userId: target.id, status: 'ACTIVE' },
        });
        if (active) {
          throw new ConflictException('User already has an active license');
        }

        const used = await tx.license.count({
          where: { companyId: company.id, status: 'ACTIVE' },
        });
        if (used >= company.licenseLimit) {
          throw new ForbiddenException('License limit reached');
        }

        const license = await tx.license.create({
          data: { userId: target.id, companyId: company.id },
        });

        return {
          success: true,
          message: 'License assigned successfully',
          license: {
            id: license.id,
            userId: license.userId,
            companyId: license.companyId,
            status: license.status,
            assignedAt: license.assignedAt,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
