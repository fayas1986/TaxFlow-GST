import { Module } from '@nestjs/common';
import { TaxPeriodsService } from './tax-periods.service';
import { TaxPeriodsController } from './tax-periods.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [TaxPeriodsController],
  providers: [TaxPeriodsService, PrismaService],
  exports: [TaxPeriodsService],
})
export class TaxPeriodsModule {}
