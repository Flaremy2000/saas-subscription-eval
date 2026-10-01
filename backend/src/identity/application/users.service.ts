import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type CompanyUser,
  type UserRepository,
} from '../domain/user.repository.js';

@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    return this.users.findCompanyUsers(companyId);
  }
}
