import { IsUUID } from 'class-validator';

export class RevokeLicenseRequest {
  @IsUUID()
  userId!: string;
}
