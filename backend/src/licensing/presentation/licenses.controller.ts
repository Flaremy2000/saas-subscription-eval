import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../shared/presentation/decorators/roles.decorator.js';
import type { LicenseAssignment } from '../domain/license.types.js';
import { AssignLicenseRequest } from './dto/assign-license.request.js';
import { LicensesService } from '../application/licenses.service.js';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post('assign')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  assign(
    @CurrentUser() admin: Express.User,
    @Body() body: AssignLicenseRequest,
  ): Promise<LicenseAssignment> {
    return this.licensesService.assign(admin, body);
  }
}
