import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsageService, type UsageReport } from './usage.service.js';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  getUsage(@CurrentUser() user: Express.User): Promise<UsageReport> {
    return this.usageService.getUsage(user.companyId);
  }
}
