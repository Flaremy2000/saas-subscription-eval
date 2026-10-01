import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AuthResponse, JwtPayload } from '../domain/auth.types.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher.js';
import { TOKEN_PROVIDER, type TokenProvider } from '../domain/token-provider.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import type { LoginRequest } from '../presentation/dto/login.request.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokens: TokenProvider,
  ) {}

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const user = await this.users.findByEmail(credentials.email);

    if (!user) {
      this.logger.warn(`Login attempt for unknown account: ${credentials.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await this.hasher.compare(credentials.password, user.passwordHash);
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

    const accessToken = await this.tokens.sign(payload);

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
