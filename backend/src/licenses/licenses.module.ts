import { Module } from '@nestjs/common';
import { LicensesController } from './licenses.controller.js';

@Module({
  controllers: [LicensesController],
})
export class LicensesModule {}
