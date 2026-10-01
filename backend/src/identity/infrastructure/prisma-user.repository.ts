import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service.js';
import type { Role } from '../../shared/domain/role.js';
import type { CompanyUser, UserRecord, UserRepository } from '../domain/user.repository.js';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  countAdmins(companyId: string): Promise<number> {
    return this.prisma.user.count({ where: { companyId, role: 'ADMIN' } });
  }

  updateRole(params: { id: string; role: Role }): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id: params.id }, data: { role: params.role } });
  }

  async findCompanyUsers(companyId: string): Promise<CompanyUser[]> {
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
