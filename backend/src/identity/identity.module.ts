import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PASSWORD_HASHER } from './domain/password-hasher.js';
import { TOKEN_PROVIDER } from './domain/token-provider.js';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { AuthService } from './application/auth.service.js';
import { UsersService } from './application/users.service.js';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher.js';
import { JwtTokenProvider } from './infrastructure/jwt-token.provider.js';
import { JwtStrategy } from './infrastructure/jwt.strategy.js';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js';
import { AuthController } from './presentation/auth.controller.js';
import { UsersController } from './presentation/users.controller.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<NonNullable<JwtSignOptions['expiresIn']>>('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_PROVIDER, useClass: JwtTokenProvider },
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule {}
