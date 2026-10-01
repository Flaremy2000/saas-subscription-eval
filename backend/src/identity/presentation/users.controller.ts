import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../shared/presentation/decorators/roles.decorator.js';
import type { CompanyUser } from '../domain/user.repository.js';
import { UsersService, type UpdatedUser } from '../application/users.service.js';
import { UpdateUserRoleRequest } from './dto/update-user-role.request.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: Express.User): Promise<{ users: CompanyUser[] }> {
    const users = await this.usersService.listCompanyUsers(user.companyId);
    return { users };
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  updateRole(
    @CurrentUser() actor: Express.User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRoleRequest,
  ): Promise<{ user: UpdatedUser }> {
    return this.usersService.updateRole(actor, id, body.role);
  }
}
