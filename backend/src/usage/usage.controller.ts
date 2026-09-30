import { Controller, Get } from '@nestjs/common';

export interface UsageSummary {
  usage: {
    totalLicenses: number;
    usedLicenses: number;
    availableLicenses: number;
    usagePercentage: number;
  };
  status: string;
}

@Controller('usage')
export class UsageController {
  @Get()
  getUsage(): UsageSummary {
    return {
      usage: {
        totalLicenses: 100,
        usedLicenses: 42,
        availableLicenses: 58,
        usagePercentage: 42,
      },
      status: 'healthy',
    };
  }
}
