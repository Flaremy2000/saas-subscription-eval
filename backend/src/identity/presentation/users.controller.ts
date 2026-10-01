import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator.js';
import type { CompanyUser } from '../domain/user.repository.js';
import { UsersService } from '../application/users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: Express.User): Promise<{ users: CompanyUser[] }> {
    const users = await this.usersService.listCompanyUsers(user.companyId);
    return { users };
  }
}
