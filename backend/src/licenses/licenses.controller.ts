import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AssignLicenseRequest } from './dto/assign-license.request.js';
import { LicensesService, type LicenseAssignment } from './licenses.service.js';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Post('assign')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  assign(
    @CurrentUser() admin: Express.User,
    @Body() body: AssignLicenseRequest,
  ): Promise<LicenseAssignment> {
    return this.licensesService.assign(admin, body);
  }
}
