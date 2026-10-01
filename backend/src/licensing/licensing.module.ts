import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { LICENSE_REPOSITORY } from './domain/license.repository.js';
import { LicensesService } from './application/licenses.service.js';
import { PrismaLicenseRepository } from './infrastructure/prisma-license.repository.js';
import { LicensesController } from './presentation/licenses.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [LicensesController],
  providers: [LicensesService, { provide: LICENSE_REPOSITORY, useClass: PrismaLicenseRepository }],
  exports: [LICENSE_REPOSITORY],
})
export class LicensingModule {}
