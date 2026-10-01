import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConsumptionModule } from './consumption/consumption.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { LicensingModule } from './licensing/licensing.module.js';
import { AllExceptionsFilter } from './shared/infrastructure/all-exceptions.filter.js';
import { JwtAuthGuard } from './shared/infrastructure/jwt-auth.guard.js';
import { PrismaModule } from './shared/infrastructure/prisma.module.js';
import { RolesGuard } from './shared/infrastructure/roles.guard.js';
import { HealthController } from './shared/presentation/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IdentityModule,
    LicensingModule,
    ConsumptionModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
