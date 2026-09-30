import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

export interface LicenseAssignment {
  success: boolean;
  message: string;
  licenseId: number;
}

@Controller('licenses')
export class LicensesController {
  @Post('assign')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  assignLicense(): LicenseAssignment {
    return {
      success: true,
      message: 'License assigned successfully',
      licenseId: Math.floor(Math.random() * 10000),
    };
  }
}
