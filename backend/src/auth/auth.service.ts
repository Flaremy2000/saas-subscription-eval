import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthResponse, JwtPayload } from './auth.types.js';
import type { LoginRequest } from './dto/login.request.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: credentials.email } });

    if (!user) {
      this.logger.warn(`Login attempt for unknown account: ${credentials.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!matches) {
      this.logger.warn(`Login attempt failed for account: ${user.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
