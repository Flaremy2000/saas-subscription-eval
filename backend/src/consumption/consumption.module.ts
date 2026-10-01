import { Module } from '@nestjs/common';
import { USAGE_REPOSITORY } from './domain/usage.repository.js';
import { UsageService } from './application/usage.service.js';
import { PrismaUsageRepository } from './infrastructure/prisma-usage.repository.js';
import { UsageController } from './presentation/usage.controller.js';

@Module({
  controllers: [UsageController],
  providers: [UsageService, { provide: USAGE_REPOSITORY, useClass: PrismaUsageRepository }],
})
export class ConsumptionModule {}
