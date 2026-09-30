import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);

  Logger.log(`Application is running on http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
