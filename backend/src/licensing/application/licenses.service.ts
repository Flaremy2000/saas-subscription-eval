import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from '../../identity/domain/user.repository.js';
import {
  CompanyNotFoundError,
  DuplicateLicenseError,
  LICENSE_REPOSITORY,
  SeatLimitReachedError,
  type LicenseRepository,
} from '../domain/license.repository.js';
import type { AssignedLicense, LicenseAssignment } from '../domain/license.types.js';
import type { AssignLicenseRequest } from '../presentation/dto/assign-license.request.js';

@Injectable()
export class LicensesService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository,
  ) {}

  async assign(admin: Express.User, dto: AssignLicenseRequest): Promise<LicenseAssignment> {
    const target = await this.users.findById(dto.userId);
    if (!target || target.companyId !== admin.companyId) {
      throw new NotFoundException('User not found');
    }

    let license: AssignedLicense;
    try {
      license = await this.licenses.assign({ userId: target.id, companyId: admin.companyId });
    } catch (error) {
      if (error instanceof DuplicateLicenseError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof SeatLimitReachedError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof CompanyNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }

    return {
      success: true,
      message: 'License assigned successfully',
      license,
    };
  }

  async revoke(admin: Express.User, userId: string): Promise<LicenseAssignment> {
    const target = await this.users.findById(userId);
    if (!target || target.companyId !== admin.companyId) {
      throw new NotFoundException('User not found');
    }

    const active = await this.licenses.findActiveByUser({
      userId: target.id,
      companyId: admin.companyId,
    });
    if (!active) {
      throw new ConflictException('User does not have an active license');
    }

    const license = await this.licenses.revoke(active.id);
    return {
      success: true,
      message: 'License revoked successfully',
      license,
    };
  }
}
