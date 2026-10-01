export type UsageStatus = 'healthy' | 'warning' | 'exceeded'

export type Role = 'ADMIN' | 'USER'

export interface UsageReport {
  company: {
    id: string
    name: string
    apiLimit: number
    licenseLimit: number
  }
  usage: {
    totalLicenses: number
    usedLicenses: number
    availableLicenses: number
    usagePercentage: number
  }
  api: {
    used: number
    limit: number
    usagePercentage: number
    exceeded: boolean
  }
  daily: { date: string; apiCalls: number }[]
  status: UsageStatus
}

export interface CompanyUser {
  id: string
  email: string
  name: string
  role: Role
  activeLicenseId: string | null
  licenseAssignedAt: string | null
}

export interface LicenseAssignment {
  success: boolean
  message: string
  license: {
    id: string
    userId: string
    companyId: string
    status: 'ACTIVE' | 'REVOKED'
    assignedAt: string
  }
}
