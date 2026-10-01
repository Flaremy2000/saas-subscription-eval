import { IsEnum } from 'class-validator';
import { ROLES, type Role } from '../../../shared/domain/role.js';

export class UpdateUserRoleRequest {
  @IsEnum(ROLES)
  role!: Role;
}
