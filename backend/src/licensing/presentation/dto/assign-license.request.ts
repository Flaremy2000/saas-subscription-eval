import { IsUUID } from 'class-validator';

export class AssignLicenseRequest {
  @IsUUID()
  userId!: string;
}
