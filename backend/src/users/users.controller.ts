import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsersService, type CompanyUser } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: Express.User): Promise<{ users: CompanyUser[] }> {
    const users = await this.usersService.listCompanyUsers(user.companyId);
    return { users };
  }
}
