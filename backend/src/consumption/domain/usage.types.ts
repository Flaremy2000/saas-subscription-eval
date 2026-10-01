export type UsageStatus = 'healthy' | 'warning' | 'exceeded';

export interface UsageReport {
  company: {
    id: string;
    name: string;
    apiLimit: number;
    licenseLimit: number;
  };
  usage: {
    totalLicenses: number;
    usedLicenses: number;
    availableLicenses: number;
    usagePercentage: number;
  };
  api: {
    used: number;
    limit: number;
    usagePercentage: number;
    exceeded: boolean;
  };
  daily: { date: string; apiCalls: number }[];
  status: UsageStatus;
}
