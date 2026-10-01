import { Injectable } from '@nestjs/common';
import type { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  activeLicenseId: string | null;
  licenseAssignedAt: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      include: {
        licenses: {
          where: { status: 'ACTIVE' },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: { id: true, assignedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => {
      const license = user.licenses[0] ?? null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        activeLicenseId: license?.id ?? null,
        licenseAssignedAt: license ? license.assignedAt.toISOString() : null,
      };
    });
  }
}
