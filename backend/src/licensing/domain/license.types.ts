export type LicenseStatus = 'ACTIVE' | 'REVOKED';

export interface AssignedLicense {
  id: string;
  userId: string;
  companyId: string;
  status: LicenseStatus;
  assignedAt: Date;
}

export interface LicenseAssignment {
  success: boolean;
  message: string;
  license: AssignedLicense;
}
