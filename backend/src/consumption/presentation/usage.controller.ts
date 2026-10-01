import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator.js';
import type { UsageReport } from '../domain/usage.types.js';
import { UsageService } from '../application/usage.service.js';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  getUsage(@CurrentUser() user: Express.User): Promise<UsageReport> {
    return this.usageService.getUsage(user.companyId);
  }
}
