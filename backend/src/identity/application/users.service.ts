import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '../../shared/domain/role.js';
import {
  USER_REPOSITORY,
  type CompanyUser,
  type UserRepository,
} from '../domain/user.repository.js';

export interface UpdatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    return this.users.findCompanyUsers(companyId);
  }

  async updateRole(
    actor: Express.User,
    targetId: string,
    role: Role,
  ): Promise<{ user: UpdatedUser }> {
    const target = await this.users.findById(targetId);
    if (!target || target.companyId !== actor.companyId) {
      throw new NotFoundException('User not found');
    }

    if (targetId === actor.sub) {
      throw new ConflictException('You cannot change your own role');
    }

    if (target.role === 'ADMIN' && role === 'USER') {
      const admins = await this.users.countAdmins(actor.companyId);
      if (admins <= 1) {
        throw new ConflictException('Cannot demote the last admin of the company');
      }
    }

    const updated = await this.users.updateRole({ id: target.id, role });
    return {
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
    };
  }
}
